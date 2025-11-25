<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\FlutterwaveService;

class TestFlutterwavePayment extends Command
{
    protected $signature = 'flutterwave:test-payment';
    protected $description = 'Test Flutterwave payment initialization (alternative to banks endpoint)';

    public function handle(FlutterwaveService $flutterwaveService)
    {
        $this->info('Testing Flutterwave Payment Initialization...');
        $this->newLine();

        $secretKey = trim(config('flutterwave.secret_key'));
        
        if (!$secretKey) {
            $this->error('Secret Key not configured!');
            return 1;
        }

        // Try to initialize a test payment
        $testData = [
            'tx_ref' => 'TEST_' . uniqid(),
            'amount' => 1000, // 1000 RWF
            'currency' => 'RWF',
            'customer_email' => 'test@example.com',
            'customer_phone' => '250788123456',
            'customer_name' => 'Test User',
            'payment_method' => 'card',
            'order_id' => 1,
            'order_number' => 'TEST001',
        ];

        $this->line('Attempting to initialize test payment...');
        $this->line('Using Secret Key: ' . substr($secretKey, 0, 20) . '...');
        $this->newLine();

        try {
            $result = $flutterwaveService->initializePayment($testData);

            if ($result['success']) {
                $this->info('✓ Payment initialization successful!');
                $this->line('Payment URL: ' . $result['payment_url']);
                $this->newLine();
                $this->info('Your Flutterwave keys are working correctly!');
                $this->line('The /banks endpoint might have different permissions, but payment API works.');
                return 0;
            } else {
                $this->error('✗ Payment initialization failed');
                $this->line('Error: ' . ($result['message'] ?? 'Unknown error'));
                $this->newLine();
                $this->warn('This suggests the keys might be incorrect or account needs activation.');
                return 1;
            }
        } catch (\Exception $e) {
            $this->error('✗ Error: ' . $e->getMessage());
            return 1;
        }
    }
}

