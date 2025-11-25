<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use App\Services\FlutterwaveService;
use App\Services\OrderStatusTransitionService;
use App\Models\Order;
use App\Models\AuditLog;
use App\Mail\PaymentSuccessful;
use App\Mail\PaymentFailed;

class FlutterwaveWebhookController extends Controller
{
    protected FlutterwaveService $flutterwaveService;
    protected OrderStatusTransitionService $transitionService;

    public function __construct(FlutterwaveService $flutterwaveService, OrderStatusTransitionService $transitionService)
    {
        $this->flutterwaveService = $flutterwaveService;
        $this->transitionService = $transitionService;
    }

    /**
     * Handle Flutterwave webhook
     */
    public function handleWebhook(Request $request)
    {
        $payload = $request->getContent();
        $signature = $request->header('verif-hash');

        // Verify webhook signature (skip if webhook secret hash not configured for testing)
        $webhookSecretHash = config('flutterwave.webhook_secret_hash');
        if ($webhookSecretHash) {
            if (!$this->flutterwaveService->verifyWebhookSignature($signature, $payload)) {
                Log::warning('Flutterwave webhook signature verification failed', [
                    'signature' => $signature ? 'present' : 'missing',
                ]);
                return response()->json(['message' => 'Invalid signature'], 401);
            }
        } else {
            Log::info('Flutterwave webhook received without signature verification (webhook secret hash not configured)');
        }

        $data = json_decode($payload, true);

        if (!$data || !isset($data['event'])) {
            Log::warning('Invalid Flutterwave webhook payload', ['payload' => $payload]);
            return response()->json(['message' => 'Invalid payload'], 400);
        }

        $event = $data['event'];
        $transactionData = $data['data'] ?? [];

        Log::info('Flutterwave webhook received', [
            'event' => $event,
            'transaction_id' => $transactionData['id'] ?? null,
            'tx_ref' => $transactionData['tx_ref'] ?? null,
        ]);

        // Handle different webhook events
        switch ($event) {
            case 'charge.completed':
                $this->handleChargeCompleted($transactionData);
                break;
            case 'transfer.completed':
                // Handle transfer completion if needed
                break;
            default:
                Log::info('Unhandled Flutterwave webhook event', ['event' => $event]);
        }

        return response()->json(['status' => 'success'], 200);
    }

    /**
     * Handle charge.completed event (API v4 format)
     * Webhook payload structure: { "type": "charge.completed", "data": { "id": "chg_...", "status": "succeeded", ... } }
     */
    protected function handleChargeCompleted(array $transactionData)
    {
        try {
            // API v4 uses 'reference' instead of 'tx_ref' in some cases
            $txRef = $transactionData['reference'] ?? $transactionData['tx_ref'] ?? null;
            $status = $transactionData['status'] ?? null;
            $chargeId = $transactionData['id'] ?? null;

            if (!$chargeId) {
                Log::error('Flutterwave webhook missing charge ID', ['data' => $transactionData]);
                return;
            }

            // Try to find order by charge_id first (most reliable)
            $order = null;
            if ($chargeId) {
                $order = Order::whereRaw('JSON_EXTRACT(admin_note, "$.flutterwave_charge_id") = ?', [$chargeId])->first();
            }

            // If not found by charge_id, try to extract from reference
            if (!$order && $txRef) {
                // Reference format: ORDER{order_number}{timestamp} or ORDER-{order_number}-{timestamp}
                // Remove non-alphanumeric characters except ORDER prefix
                $cleanRef = preg_replace('/[^a-zA-Z0-9-]/', '', $txRef);
                
                if (str_starts_with($cleanRef, 'ORDER')) {
                    // Try to find orders where the reference contains the order number
                    $orders = Order::get()->filter(function ($o) use ($cleanRef) {
                        return str_contains($cleanRef, $o->order_number);
                    });
                    
                    if ($orders->count() === 1) {
                        $order = $orders->first();
                    } else {
                        // Try parsing ORDER-{order_number}-{timestamp} format
                        $parts = explode('-', $cleanRef);
                        if (count($parts) >= 2 && $parts[0] === 'ORDER') {
                            $orderNumber = $parts[1];
                            $order = Order::where('order_number', $orderNumber)->first();
                        }
                    }
                } else {
                    // Try direct match
                    $order = Order::where('order_number', $txRef)->first();
                }
            }

            if (!$order) {
                Log::error('Order not found for Flutterwave webhook', [
                    'charge_id' => $chargeId,
                    'tx_ref' => $txRef,
                    'reference' => $transactionData['reference'] ?? null,
                ]);
                return;
            }

            DB::transaction(function () use ($order, $status, $chargeId, $transactionData) {
                // Map Flutterwave status to our payment status
                // API v4 uses 'succeeded' for successful payments
                $isSuccessful = ($status === 'successful' || $status === 'succeeded');
                
                if ($isSuccessful) {
                    // Use transition service to handle payment status change and auto-transition order status
                    $order = $this->transitionService->handlePaymentStatusChange($order, 'paid');
                    $order->paid_at = now();
                    
                    // Merge with existing admin_note
                    $existingNote = json_decode($order->admin_note ?? '{}', true) ?: [];
                    $order->admin_note = json_encode(array_merge($existingNote, [
                        'flutterwave_charge_id' => $chargeId,
                        'flutterwave_transaction_id' => $chargeId, // For backward compatibility
                        'payment_type' => $transactionData['payment_method']['type'] ?? null,
                        'paid_at' => now()->toDateTimeString(),
                        'webhook_received_at' => now()->toDateTimeString(),
                    ]));
                    
                    $order->save();

                    // Log the payment
                        AuditLog::logEvent('payment_received', $order, null, [
                            'charge_id' => $chargeId,
                            'amount' => $transactionData['amount'] ?? $order->grand_total,
                            'payment_type' => $transactionData['payment_method']['type'] ?? null,
                        ], "Payment received for order {$order->order_number} via Flutterwave webhook");
                        
                        // Send payment success email (Step 8)
                        try {
                            Mail::to($order->customer_email)->send(new PaymentSuccessful($order));
                        } catch (\Exception $e) {
                            Log::error('Failed to send payment success email via webhook', [
                                'order_number' => $order->order_number,
                                'error' => $e->getMessage(),
                            ]);
                        }
                    } elseif ($status === 'failed' || $status === 'cancelled' || $status === 'declined') {
                    // Only update if not already failed (idempotent)
                    if ($order->payment_status !== 'failed') {
                        $order->payment_status = 'failed';
                        // Don't change order status - keep as 'pending' so user can retry payment
                        // Order status will remain 'pending' until payment succeeds
                        
                        // Extract detailed failure reason
                        $failureReason = 'Payment failed';
                        if (isset($transactionData['processor_response'])) {
                            $processorResponse = $transactionData['processor_response'];
                            $failureReason = $processorResponse['message'] 
                                ?? $processorResponse['type'] 
                                ?? ($processorResponse['code'] ? "Error code: {$processorResponse['code']}" : 'Payment failed');
                        } elseif ($status === 'cancelled') {
                            $failureReason = 'Payment was cancelled by user';
                        } elseif ($status === 'declined') {
                            $failureReason = 'Payment was declined by bank';
                        }
                        
                        $existingNote = json_decode($order->admin_note ?? '{}', true) ?: [];
                        $order->admin_note = json_encode(array_merge($existingNote, [
                            'flutterwave_charge_id' => $chargeId,
                            'payment_failed_at' => now()->toDateTimeString(),
                            'failure_reason' => $failureReason,
                            'failure_code' => $transactionData['processor_response']['code'] ?? null,
                            'webhook_received_at' => now()->toDateTimeString(),
                        ]));
                        $order->save();

                        AuditLog::logEvent('payment_failed', $order, null, [
                            'charge_id' => $chargeId,
                            'reason' => $failureReason,
                            'status' => $status,
                        ], "Payment failed for order {$order->order_number} via Flutterwave webhook");
                        
                        // Send payment failure email
                        try {
                            Mail::to($order->customer_email)->send(new PaymentFailed($order, $failureReason));
                        } catch (\Exception $e) {
                            Log::error('Failed to send payment failure email via webhook', [
                                'order_number' => $order->order_number,
                                'error' => $e->getMessage(),
                            ]);
                        }
                    }
                } else {
                    // Pending or unknown status - log but don't update order
                    Log::info('Payment webhook received with pending/unknown status', [
                        'order_number' => $order->order_number,
                        'charge_id' => $chargeId,
                        'status' => $status,
                    ]);
                }
            });
        } catch (\Exception $e) {
            Log::error('Error handling Flutterwave webhook', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'transaction_data' => $transactionData,
            ]);
        }
    }
}

