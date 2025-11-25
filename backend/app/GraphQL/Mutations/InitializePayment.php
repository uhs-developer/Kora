<?php

namespace App\GraphQL\Mutations;

use App\Models\Order;
use App\Services\FlutterwaveService;
use Illuminate\Support\Facades\Log;

class InitializePayment
{
    protected FlutterwaveService $flutterwaveService;

    public function __construct(FlutterwaveService $flutterwaveService)
    {
        $this->flutterwaveService = $flutterwaveService;
    }

    public function __invoke($_, array $args, $context)
    {
        // Get tenant - with fallback to default if not set
        $tenant = app()->bound('tenant') ? app('tenant') : \App\Models\Tenant::where('slug', 'default')->first();
        
        if (!$tenant) {
            throw new \Exception('Tenant not found. Please ensure a default tenant exists.');
        }
        
        // Get authenticated user from context
        $user = $context->user();

        if (!$user) {
            throw new \Exception('You must be logged in to initialize payment');
        }

        // Get order
        $order = Order::where('order_number', $args['order_number'])
            ->where('user_id', $user->id)
            ->firstOrFail();

        // Check if order is already paid
        if ($order->payment_status === 'paid') {
            throw new \Exception('This order has already been paid');
        }

        // Prepare payment data
        $paymentData = [
            'tx_ref' => 'ORDER-' . $order->order_number . '-' . time(),
            'amount' => (float) $order->grand_total,
            'customer_email' => $order->customer_email,
            'customer_phone' => $args['customer_phone'] ?? $order->shipping_address['phone'] ?? '',
            'customer_name' => $order->customer_first_name . ' ' . $order->customer_last_name,
            'title' => 'Order Payment - ' . $order->order_number,
            'description' => 'Payment for order ' . $order->order_number,
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'payment_method' => $args['payment_method'] ?? $order->payment_method,
            'mobile_number' => $args['mobile_number'] ?? null,
        ];
        
        // For card payments, include encrypted card details
        if (isset($args['payment_method']) && in_array($args['payment_method'], ['credit_card', 'card', 'debit_card'])) {
            if (isset($args['encrypted_card_number'])) {
                $paymentData['encrypted_card_number'] = $args['encrypted_card_number'];
                $paymentData['encrypted_expiry_month'] = $args['encrypted_expiry_month'] ?? null;
                $paymentData['encrypted_expiry_year'] = $args['encrypted_expiry_year'] ?? null;
                $paymentData['encrypted_cvv'] = $args['encrypted_cvv'] ?? null;
                $paymentData['nonce'] = $args['nonce'] ?? null;
            }
        }

        // Determine payment options based on payment method
        if (isset($args['payment_method'])) {
            if ($args['payment_method'] === 'mtn_momo' || $args['payment_method'] === 'airtel_money') {
                $paymentData['payment_options'] = 'mobilemoneyrwanda';
            } else {
                $paymentData['payment_options'] = 'card';
            }
        } else {
            $paymentData['payment_options'] = 'card,mobilemoneyrwanda';
        }

        // Initialize payment using new API v4 flow
        try {
            $result = $this->flutterwaveService->initializePayment($paymentData);

            if (!$result['success']) {
                $errorMessage = $result['message'] ?? 'Failed to initialize payment';
                
                // Provide more helpful error messages
                if (str_contains($errorMessage, 'decrypt')) {
                    $errorMessage = 'Card encryption error: Flutterwave cannot decrypt the card details. Please verify your encryption key or contact support.';
                }
                
                Log::error('Payment initialization failed', [
                    'order_number' => $order->order_number,
                    'error' => $errorMessage,
                    'payment_method' => $paymentData['payment_method'] ?? 'unknown',
                ]);
                
                throw new \Exception($errorMessage);
            }
        } catch (\Exception $e) {
            Log::error('Payment initialization exception', [
                'order_number' => $order->order_number,
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }

        // Update order with transaction reference and charge ID
        $order->admin_note = json_encode([
            'order_number' => $order->order_number, // Store for easy lookup
            'flutterwave_charge_id' => $result['charge_id'] ?? null,
            'flutterwave_transaction_id' => $result['transaction_id'] ?? null,
            'flutterwave_status' => $result['status'] ?? 'pending',
            'payment_initiated_at' => now()->toDateTimeString(),
            'next_action' => $result['next_action'] ?? null,
            'tx_ref' => $paymentData['tx_ref'] ?? null, // Store original tx_ref
        ]);
        $order->save();

        return [
            'payment_url' => $result['payment_url'], // May be null for push notification flow
            'transaction_id' => $result['charge_id'] ?? $result['transaction_id'],
            'charge_id' => $result['charge_id'] ?? null,
            'status' => $result['status'] ?? 'pending',
            'next_action' => $result['next_action'] ? json_encode($result['next_action']) : null,
            'order_number' => $order->order_number,
        ];
    }
}

