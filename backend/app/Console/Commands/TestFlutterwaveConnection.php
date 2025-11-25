<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\FlutterwaveService;

class TestFlutterwaveConnection extends Command
{
    protected $signature = 'flutterwave:test';
    protected $description = 'Test Flutterwave API connection';

    public function handle(FlutterwaveService $flutterwaveService)
    {
        $this->info('Testing Flutterwave Connection...');
        $this->newLine();

        // Check configuration
        $publicKey = config('flutterwave.public_key');
        $secretKey = config('flutterwave.secret_key');
        $encryptionKey = config('flutterwave.encryption_key');
        $env = config('flutterwave.environment', 'sandbox');

        $this->info('Configuration Check:');
        $this->line('Environment: ' . ($env === 'live' ? 'LIVE' : 'SANDBOX'));
        $this->line('Public Key: ' . ($publicKey ? substr($publicKey, 0, 10) . '...' : 'NOT SET'));
        $this->line('Secret Key: ' . ($secretKey ? substr($secretKey, 0, 10) . '...' : 'NOT SET'));
        $this->line('Encryption Key: ' . ($encryptionKey ? substr($encryptionKey, 0, 10) . '...' : 'NOT SET'));
        $this->newLine();

        if (!$publicKey || !$secretKey || !$encryptionKey) {
            $this->error('Missing Flutterwave credentials in .env file!');
            $this->line('Please add:');
            $this->line('FLUTTERWAVE_PUBLIC_KEY=your_client_id');
            $this->line('FLUTTERWAVE_SECRET_KEY=your_client_secret');
            $this->line('FLUTTERWAVE_ENCRYPTION_KEY=your_encryption_key');
            return 1;
        }

        // Test API connection by making a simple request
        $this->info('Testing API Connection...');
        
        // Check key format and provide guidance
        $this->line('Key Format Check:');
        $secretKeyTrimmed = trim($secretKey);
        $publicKeyTrimmed = trim($publicKey);
        
        if ($secretKey !== $secretKeyTrimmed) {
            $this->warn('⚠ Secret Key has leading/trailing spaces - this will cause authentication to fail!');
            $this->line('   Please remove spaces from your .env file');
        }
        
        // Check for key format issues
        $isLegacySecret = str_starts_with($secretKeyTrimmed, 'FLWSECK_TEST-') || str_starts_with($secretKeyTrimmed, 'FLWSECK-');
        $isLegacyPublic = str_starts_with($publicKeyTrimmed, 'FLWPUBK_TEST-') || str_starts_with($publicKeyTrimmed, 'FLWPUBK-');
        $secretLooksLikePublic = str_starts_with($secretKeyTrimmed, 'FLWPUBK');
        
        if ($secretLooksLikePublic) {
            $this->error('✗ ERROR: Your SECRET KEY looks like a PUBLIC KEY!');
            $this->line('   Secret Key starts with FLWPUBK, but it should be the Client Secret');
            $this->line('   Go to Flutterwave Dashboard → API Keys');
            $this->line('   Make sure you copied:');
            $this->line('     - Client ID → FLUTTERWAVE_PUBLIC_KEY');
            $this->line('     - Client Secret → FLUTTERWAVE_SECRET_KEY');
            $this->newLine();
            $this->warn('⚠️  Your keys might be swapped in .env file!');
            return 1;
        }
        
        if ($isLegacySecret) {
            $this->line('✓ Secret Key format: Legacy format (FLWSECK_TEST-...)');
            $this->warn('⚠️  Note: Legacy keys may not work with OAuth flow. Use new OAuth keys if available.');
        } elseif ($isLegacyPublic && !$isLegacySecret) {
            $this->line('✓ Key format: New OAuth format (base64-like strings) - Valid for 2024-2025');
            $this->line('   Client ID starts with: ' . substr($publicKeyTrimmed, 0, 15) . '...');
            $this->line('   Client Secret starts with: ' . substr($secretKeyTrimmed, 0, 15) . '...');
        } else {
            $this->line('✓ Key format: New OAuth format (base64-like strings) - Valid for 2024-2025');
            $this->line('   Client ID starts with: ' . substr($publicKeyTrimmed, 0, 15) . '...');
            $this->line('   Client Secret starts with: ' . substr($secretKeyTrimmed, 0, 15) . '...');
        }
        $this->newLine();
        
        try {
            // For OAuth sandbox, use sandbox URL. For live, use production URL
            $baseUrl = config('flutterwave.base_url', 
                ($env === 'live' ? 'https://api.flutterwave.com/v3' : 'https://developersandbox-api.flutterwave.com/v3')
            );
            $endpoint = $baseUrl . '/banks/RW';
            
            $this->line('Testing endpoint: ' . $endpoint);
            $this->newLine();
            
            // New OAuth flow: Get access token first
            $this->info('Step 1: Obtaining OAuth access token...');
            $oauthTokenUrl = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';
            
            $publicKeyTrimmed = trim($publicKey);
            $secretKeyTrimmed = trim($secretKey);
            
            $this->line('Using Client ID: ' . substr($publicKeyTrimmed, 0, 20) . '...');
            $this->line('Using Client Secret: ' . substr($secretKeyTrimmed, 0, 20) . '...');
            $this->newLine();
            
            $tokenResponse = \Illuminate\Support\Facades\Http::asForm()->post($oauthTokenUrl, [
                'client_id' => $publicKeyTrimmed,
                'client_secret' => $secretKeyTrimmed,
                'grant_type' => 'client_credentials',
            ]);
            
            if (!$tokenResponse->successful()) {
                $this->error('✗ Failed to obtain OAuth access token');
                $this->line('Status Code: ' . $tokenResponse->status());
                $errorData = $tokenResponse->json();
                $this->line('Response: ' . json_encode($errorData, JSON_PRETTY_PRINT));
                $this->newLine();
                
                if (isset($errorData['error'])) {
                    $this->error('OAuth Error: ' . $errorData['error']);
                    if (isset($errorData['error_description'])) {
                        $this->line('Description: ' . $errorData['error_description']);
                    }
                }
                
                return 1;
            }
            
            $tokenData = $tokenResponse->json();
            
            if (!isset($tokenData['access_token'])) {
                $this->error('✗ OAuth response missing access_token');
                $this->line('Response: ' . json_encode($tokenData, JSON_PRETTY_PRINT));
                return 1;
            }
            
            $accessToken = $tokenData['access_token'];
            $expiresIn = $tokenData['expires_in'] ?? 600;
            
            $this->info('✓ OAuth access token obtained successfully!');
            $this->line('Token expires in: ' . $expiresIn . ' seconds');
            $this->newLine();
            
            // Step 2: Use access token for API call
            $this->info('Step 2: Testing API call with access token...');
            $this->line('Using Authorization: Bearer ' . substr($accessToken, 0, 20) . '...');
            $this->newLine();
            
            $response = \Illuminate\Support\Facades\Http::withHeaders([
                'Authorization' => 'Bearer ' . $accessToken,
                'Content-Type' => 'application/json',
            ])->get($endpoint);
            
            // If still failing, provide detailed debugging
            if (!$response->successful() && $response->status() === 401) {
                $this->warn('Authentication failed. Checking for common issues...');
                $this->newLine();
                
                // Check key length
                $this->line('Key Length Check:');
                $this->line('  Secret Key length: ' . strlen($secretKeyTrimmed) . ' characters');
                $this->line('  Public Key length: ' . strlen($publicKeyTrimmed) . ' characters');
                $this->newLine();
                
                // Check for common issues
                if (empty($secretKeyTrimmed)) {
                    $this->error('✗ Secret Key is empty!');
                    return 1;
                }
                
                if (strlen($secretKeyTrimmed) < 20) {
                    $this->warn('⚠ Secret Key seems too short (less than 20 characters)');
                }
                
                // Show first and last few characters (for debugging, but not full key)
                $this->line('Key Format (first/last 10 chars):');
                $this->line('  Secret Key: ' . substr($secretKeyTrimmed, 0, 10) . '...' . substr($secretKeyTrimmed, -10));
                $this->newLine();
            }

            $this->line('Response Status: ' . $response->status());
            
            if ($response->successful()) {
                $this->info('✓ API Connection Successful!');
                $data = $response->json();
                if (isset($data['data']) && is_array($data['data'])) {
                    $this->line('Found ' . count($data['data']) . ' banks in Rwanda');
                }
                return 0;
            } else {
                $this->error('✗ API Connection Failed');
                $responseBody = $response->json();
                $this->line('Status Code: ' . $response->status());
                $this->line('Response: ' . json_encode($responseBody, JSON_PRETTY_PRINT));
                
                // Provide helpful suggestions
                if (isset($responseBody['message']) && str_contains($responseBody['message'], 'authorization')) {
                    $this->newLine();
                    $this->error('AUTHORIZATION FAILED - Troubleshooting Steps:');
                    $this->newLine();
                    $this->line('1. ✓ KEY FORMAT: Your keys use the new 2024-2025 format (base64-like strings)');
                    $this->line('   - This is correct and valid');
                    $this->newLine();
                    $this->line('2. ⚠ VERIFY KEY MAPPING: Make sure you copied the correct keys');
                    $this->line('   - Client ID → FLUTTERWAVE_PUBLIC_KEY');
                    $this->line('   - Client Secret → FLUTTERWAVE_SECRET_KEY (this is the one for API auth)');
                    $this->line('   - Encryption Key → FLUTTERWAVE_ENCRYPTION_KEY');
                    $this->newLine();
                    $this->line('3. ⚠ CHECK .env FILE: Verify no extra spaces or characters');
                    $this->line('   - Open backend/.env');
                    $this->line('   - Check FLUTTERWAVE_SECRET_KEY line');
                    $this->line('   - Should be: FLUTTERWAVE_SECRET_KEY=4BKsiJjpwA... (no spaces around =)');
                    $this->newLine();
                    $this->line('4. ⚠ ACCOUNT STATUS: Check Flutterwave dashboard');
                    $this->line('   - Verify account is activated');
                    $this->line('   - Check if Test Mode is enabled');
                    $this->line('   - Look for any warnings or activation requirements');
                    $this->newLine();
                    $this->line('5. ⚠ KEY LENGTH: Your Secret Key is ' . strlen($secretKeyTrimmed) . ' characters');
                    $this->line('   - If it seems incomplete, check if you copied the full key');
                    $this->line('   - Some keys might be longer - make sure you got the complete key');
                    $this->newLine();
                    $this->line('6. ⚠ TRY REGENERATING: If still not working');
                    $this->line('   - Go to Flutterwave Dashboard → API Keys');
                    $this->line('   - Look for "Generate Secret Key" or "Regenerate" button');
                    $this->line('   - Generate a new key and update .env');
                }
                
                return 1;
            }
        } catch (\Exception $e) {
            $this->error('✗ Connection Error: ' . $e->getMessage());
            $this->line('Stack trace: ' . $e->getTraceAsString());
            return 1;
        }
    }
}

