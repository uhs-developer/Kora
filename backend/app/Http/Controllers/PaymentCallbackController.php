<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Services\FlutterwaveService;
use App\Services\OrderStatusTransitionService;
use App\Models\Order;
use App\Mail\PaymentSuccessful;
use App\Mail\PaymentFailed;

class PaymentCallbackController extends Controller
{
    protected FlutterwaveService $flutterwaveService;
    protected OrderStatusTransitionService $transitionService;

    public function __construct(FlutterwaveService $flutterwaveService, OrderStatusTransitionService $transitionService)
    {
        $this->flutterwaveService = $flutterwaveService;
        $this->transitionService = $transitionService;
    }

    /**
     * Handle payment callback from Flutterwave
     * This handles redirects after 3DS authentication for card payments (Step 4.3-4.4)
     * Flow: User enters card → 3DS redirect → Bank authentication → Redirect back here → Verify → Redirect to frontend
     */
    public function handleCallback(Request $request)
    {
        Log::info('Payment callback received from Flutterwave', [
            'query_params' => $request->query(),
            'all_params' => $request->all(),
        ]);

        // API v4 uses charge_id instead of transaction_id
        // Flutterwave may pass charge_id in query params or in the redirect URL
        $chargeId = $request->query('charge_id') 
            ?? $request->query('transaction_id')
            ?? $request->input('charge_id')
            ?? $request->input('transaction_id');
        $status = $request->query('status') ?? $request->input('status');
        $txRef = $request->query('tx_ref') 
            ?? $request->query('reference')
            ?? $request->input('tx_ref')
            ?? $request->input('reference');

        if (!$chargeId) {
            Log::warning('Payment callback missing charge_id', [
                'query_params' => $request->query(),
                'input_params' => $request->input(),
            ]);
            
            // Get frontend URL for error redirect
            $frontendUrl = $this->getFrontendUrl();
            if ($frontendUrl) {
                return redirect($frontendUrl . '/checkout?error=invalid_callback');
            }
            return redirect('/checkout?error=invalid_callback');
        }

        Log::info('Verifying payment transaction', ['charge_id' => $chargeId]);

        // Step 5: Verify the transaction using charge ID
        $verification = $this->flutterwaveService->verifyTransaction($chargeId);

        if (!$verification['success']) {
            Log::error('Flutterwave transaction verification failed', [
                'charge_id' => $chargeId,
                'verification' => $verification,
                'error_message' => $verification['message'] ?? 'Unknown error',
            ]);
            
            // Get frontend URL for error redirect
            $frontendUrl = $this->getFrontendUrl();
            if ($frontendUrl) {
                return redirect($frontendUrl . '/checkout?error=verification_failed');
            }
            return redirect('/checkout?error=verification_failed');
        }

        $transaction = $verification['transaction'];
        $transactionStatus = $transaction['status'];
        
        Log::info('Payment verification successful', [
            'charge_id' => $chargeId,
            'status' => $transactionStatus,
            'amount' => $transaction['amount'] ?? null,
        ]);

        // Find order by charge ID (most reliable method)
        // The charge ID is stored in admin_note when payment is initialized
        $order = Order::whereRaw('JSON_EXTRACT(admin_note, "$.flutterwave_charge_id") = ?', [$chargeId])
            ->orWhereRaw('JSON_EXTRACT(admin_note, "$.flutterwave_transaction_id") = ?', [$chargeId])
            ->first();
        
        // If not found by transaction ID, try to extract from tx_ref
        if (!$order && $txRef) {
            // Try to find by matching order number in reference
            // Reference format might be: ORDER{order_number}{timestamp} or ORDER-{order_number}-{timestamp}
            if (str_starts_with($txRef, 'ORDER')) {
                // Try to find orders where the reference contains the order number
                $orders = Order::get()->filter(function ($o) use ($txRef) {
                    return str_contains($txRef, $o->order_number);
                });
                
                if ($orders->count() === 1) {
                    $order = $orders->first();
                }
            } else {
                // Try direct match
                $order = Order::where('order_number', $txRef)->first();
            }
        }
        
        if (!$order) {
            Log::error('Could not find order for payment callback', [
                'tx_ref' => $txRef,
                'charge_id' => $chargeId,
                'status' => $status,
            ]);
            return redirect('/checkout?error=order_not_found');
        }
        
        $orderNumber = $order->order_number;

        // Step 6-7: Update order status based on payment result
        // Map Flutterwave status to our order status
        // Flutterwave uses 'succeeded' for successful payments
        $isSuccessful = ($transactionStatus === 'successful' || $transactionStatus === 'succeeded');
        $isFailed = ($transactionStatus === 'failed' || $transactionStatus === 'cancelled' || $transactionStatus === 'declined');
        $isPending = ($transactionStatus === 'pending' || $transactionStatus === 'processing');
        
        if ($isSuccessful) {
            // Step 7: Use transition service to handle payment status change and auto-transition order status
            $order = $this->transitionService->handlePaymentStatusChange($order, 'paid');
            $order->paid_at = now();
            $order->admin_note = json_encode(array_merge(
                json_decode($order->admin_note ?? '{}', true) ?: [],
                [
                    'flutterwave_charge_id' => $chargeId,
                    'flutterwave_transaction_id' => $transaction['id'] ?? $chargeId,
                    'payment_completed_at' => now()->toDateTimeString(),
                    'payment_status' => 'successful',
                    'payment_method' => $transaction['payment_method'] ?? 'card',
                    'payment_type' => '3ds_redirect', // Indicate this was a 3DS redirect flow
                    'callback_received_at' => now()->toDateTimeString(),
                ]
            ));
            $order->save();
            
            Log::info('Order payment successful via 3DS callback', [
                'order_number' => $orderNumber,
                'charge_id' => $chargeId,
                'payment_method' => $transaction['payment_method'] ?? 'card',
            ]);
            
            // Send payment success email (Step 8)
            try {
                Mail::to($order->customer_email)->send(new PaymentSuccessful($order));
            } catch (\Exception $e) {
                Log::error('Failed to send payment success email', [
                    'order_number' => $orderNumber,
                    'error' => $e->getMessage(),
                ]);
            }
        } elseif ($isFailed) {
            // Payment failed, cancelled, or declined
            // Keep order status as 'pending' so it can be retried
            // Only update payment_status to 'failed'
            $order->payment_status = 'failed';
            // Don't change order status - keep as 'pending' so user can retry payment
            // Order status will remain 'pending' until payment succeeds
            
            // Extract detailed failure reason
            $failureReason = 'Payment failed';
            if (isset($transaction['processor_response'])) {
                $processorResponse = $transaction['processor_response'];
                $failureReason = $processorResponse['message'] 
                    ?? $processorResponse['type'] 
                    ?? ($processorResponse['code'] ? "Error code: {$processorResponse['code']}" : 'Payment failed');
            } elseif ($transactionStatus === 'cancelled') {
                $failureReason = 'Payment was cancelled by user';
            } elseif ($transactionStatus === 'declined') {
                $failureReason = 'Payment was declined by bank';
            }
            
            $order->admin_note = json_encode(array_merge(
                json_decode($order->admin_note ?? '{}', true) ?: [],
                [
                    'flutterwave_charge_id' => $chargeId,
                    'flutterwave_transaction_id' => $transaction['id'] ?? $chargeId,
                    'payment_failed_at' => now()->toDateTimeString(),
                    'payment_status' => 'failed',
                    'failure_reason' => $failureReason,
                    'failure_code' => $transaction['processor_response']['code'] ?? null,
                    'payment_type' => '3ds_redirect',
                    'callback_received_at' => now()->toDateTimeString(),
                ]
            ));
            $order->save();
            
            Log::warning('Order payment failed via 3DS callback', [
                'order_number' => $orderNumber,
                'charge_id' => $chargeId,
                'status' => $transactionStatus,
                'failure_reason' => $failureReason,
            ]);
            
            // Send payment failure email
            try {
                Mail::to($order->customer_email)->send(new PaymentFailed($order, $failureReason));
            } catch (\Exception $e) {
                Log::error('Failed to send payment failure email', [
                    'order_number' => $orderNumber,
                    'error' => $e->getMessage(),
                ]);
            }
        } elseif ($isPending) {
            // Payment still pending - don't update order status yet, wait for webhook
            Log::info('Payment still pending via 3DS callback - waiting for webhook', [
                'order_number' => $orderNumber,
                'charge_id' => $chargeId,
                'status' => $transactionStatus,
            ]);
            // Don't update order - webhook will handle final status
        } else {
            // Unknown status - log and don't update
            Log::warning('Unknown payment status received via 3DS callback', [
                'order_number' => $orderNumber,
                'charge_id' => $chargeId,
                'status' => $transactionStatus,
            ]);
        }

        // Get frontend URL for redirect (must be configured in .env)
        $frontendUrl = $this->getFrontendUrl();
        if (!$frontendUrl) {
            Log::error('Frontend URL not configured', [
                'charge_id' => $chargeId,
            ]);
            return redirect('/checkout?error=configuration_error');
        }
        
        // Always redirect to thank-you page with payment status
        // Map transaction status to URL parameter
        if ($isSuccessful) {
            $paymentStatus = 'success';
        } elseif ($isFailed) {
            $paymentStatus = 'failed';
        } elseif ($isPending) {
            $paymentStatus = 'pending';
        } else {
            $paymentStatus = 'unknown';
        }
        
        return redirect($frontendUrl . '/thank-you?order=' . $orderNumber . '&payment=' . $paymentStatus);
    }

    private function getFrontendUrl(): ?string
    {
        $frontendUrl = config('app.frontend_url') ?? config('app.url');

        return $frontendUrl ? rtrim($frontendUrl, '/') : null;
    }
}

