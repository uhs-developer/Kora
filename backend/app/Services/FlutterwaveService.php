<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Order;

class FlutterwaveService
{
    protected ?string $publicKey;
    protected ?string $secretKey;
    protected ?string $encryptionKey;
    protected string $baseUrl;
    protected string $currency;
    protected string $redirectUrl;
    protected string $webhookUrl;
    protected string $oauthTokenUrl;
    protected string $environment;
    
    // Cache for OAuth access token
    protected ?string $accessToken = null;
    protected ?int $tokenExpiresAt = null;

    public function __construct()
    {
        $this->publicKey = config('flutterwave.public_key');
        $this->secretKey = config('flutterwave.secret_key');
        $this->encryptionKey = config('flutterwave.encryption_key');
        $this->baseUrl = config('flutterwave.base_url');
        $this->currency = config('flutterwave.currency', 'RWF');
        $this->redirectUrl = config('flutterwave.redirect_url');
        $this->webhookUrl = config('flutterwave.webhook_url');
        $this->oauthTokenUrl = config('flutterwave.oauth_token_url');
        $this->environment = config('flutterwave.environment', 'sandbox');
        
        // Validate base URL is set
        if (empty($this->baseUrl)) {
            $defaultUrl = $this->environment === 'live' 
                ? 'https://api.flutterwave.com/v3'
                : 'https://developersandbox-api.flutterwave.com';
            
            Log::warning('Flutterwave base_url not configured, using default', [
                'environment' => $this->environment,
                'default_url' => $defaultUrl,
            ]);
            
            $this->baseUrl = $defaultUrl;
        }
        
        // Validate OAuth token URL is set
        if (empty($this->oauthTokenUrl)) {
            $this->oauthTokenUrl = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';
        }
    }

    /**
     * Get OAuth access token (required for new API v4 with OAuth flow)
     * Tokens are valid for 10 minutes, so we cache and refresh as needed
     */
    protected function getAccessToken(): string
    {
        // Check if we have a valid cached token (refresh 1 minute before expiry)
        if ($this->accessToken && $this->tokenExpiresAt && time() < ($this->tokenExpiresAt - 60)) {
            return $this->accessToken;
        }

        try {
            $clientId = trim($this->publicKey);
            $clientSecret = trim($this->secretKey);

            if (!$clientId || !$clientSecret) {
                throw new \Exception('Flutterwave Client ID and Client Secret are required for OAuth authentication');
            }

            $response = Http::asForm()->post($this->oauthTokenUrl, [
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'grant_type' => 'client_credentials',
            ]);

            if (!$response->successful()) {
                $error = $response->json();
                Log::error('Flutterwave OAuth token request failed', [
                    'status' => $response->status(),
                    'response' => $error,
                ]);
                throw new \Exception('Failed to obtain OAuth access token: ' . ($error['error_description'] ?? $error['error'] ?? 'Unknown error'));
            }

            $tokenData = $response->json();
            
            if (!isset($tokenData['access_token'])) {
                Log::error('Flutterwave OAuth token response missing access_token', ['response' => $tokenData]);
                throw new \Exception('Invalid OAuth token response: access_token not found');
            }

            // Cache the token
            $this->accessToken = $tokenData['access_token'];
            $expiresIn = $tokenData['expires_in'] ?? 600; // Default to 10 minutes if not provided
            $this->tokenExpiresAt = time() + $expiresIn;

            Log::info('Flutterwave OAuth access token obtained successfully', [
                'expires_in' => $expiresIn,
            ]);

            return $this->accessToken;
        } catch (\Exception $e) {
            Log::error('Flutterwave OAuth token error', [
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Create or retrieve a customer
     */
    protected function getOrCreateCustomer(array $customerData): string
    {
        // Try to find existing customer by email first
        $accessToken = $this->getAccessToken();
        
        // For now, we'll create a new customer each time
        // In production, you might want to store customer IDs and reuse them
        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $accessToken,
            'Content-Type' => 'application/json',
        ])->post($this->baseUrl . '/customers', [
            'email' => $customerData['email'],
            'name' => [
                'first' => $customerData['first_name'] ?? explode(' ', $customerData['name'])[0] ?? '',
                'last' => $customerData['last_name'] ?? explode(' ', $customerData['name'])[1] ?? '',
            ],
            'phone' => [
                'country_code' => $this->extractCountryCode($customerData['phone']),
                'number' => $this->extractPhoneNumber($customerData['phone']),
            ],
        ]);

        if ($response->successful()) {
            $responseData = $response->json();
            if (isset($responseData['data']['id'])) {
                return $responseData['data']['id'];
            }
        }

        Log::error('Flutterwave customer creation failed', [
            'response' => $response->json(),
        ]);

        throw new \Exception('Failed to create customer: ' . ($response->json()['message'] ?? 'Unknown error'));
    }

    /**
     * Create a payment method
     */
    protected function createPaymentMethod(string $customerId, array $paymentData): ?string
    {
        $accessToken = $this->getAccessToken();
        
        $paymentMethodData = [];
        
        // Determine payment method type
        if (isset($paymentData['payment_method'])) {
            if (in_array($paymentData['payment_method'], ['mtn_momo', 'airtel_money'])) {
                // Mobile money payment method
                $network = $paymentData['payment_method'] === 'mtn_momo' ? 'MTN' : 'AIRTEL';
                $phone = $paymentData['mobile_number'] ?? $paymentData['customer_phone'];
                
                $paymentMethodData = [
                    'type' => 'mobile_money',
                    'mobile_money' => [
                        'country_code' => $this->extractCountryCode($phone),
                        'network' => $network,
                        'phone_number' => $this->extractPhoneNumber($phone),
                    ],
                ];
            } elseif (in_array($paymentData['payment_method'], ['credit_card', 'card', 'debit_card'])) {
                // Card payment method - requires encrypted card details
                if (!isset($paymentData['encrypted_card_number']) || 
                    !isset($paymentData['encrypted_expiry_month']) || 
                    !isset($paymentData['encrypted_expiry_year']) || 
                    !isset($paymentData['encrypted_cvv']) || 
                    !isset($paymentData['nonce'])) {
                    throw new \Exception('Card payment method requires encrypted card details: encrypted_card_number, encrypted_expiry_month, encrypted_expiry_year, encrypted_cvv, and nonce');
                }
                
                $paymentMethodData = [
                    'type' => 'card',
                    'card' => [
                        'encrypted_card_number' => $paymentData['encrypted_card_number'],
                        'encrypted_expiry_month' => $paymentData['encrypted_expiry_month'],
                        'encrypted_expiry_year' => $paymentData['encrypted_expiry_year'],
                        'encrypted_cvv' => $paymentData['encrypted_cvv'],
                        'nonce' => $paymentData['nonce'],
                    ],
                ];
            } else {
                throw new \Exception('Unsupported payment method: ' . $paymentData['payment_method']);
            }
        } else {
            throw new \Exception('Payment method type is required');
        }

        // Log the request payload (without sensitive data) for debugging
        $logPayload = $paymentMethodData;
        if (isset($logPayload['card'])) {
            $logPayload['card'] = [
                'encrypted_card_number' => substr($logPayload['card']['encrypted_card_number'] ?? '', 0, 20) . '...',
                'encrypted_expiry_month' => substr($logPayload['card']['encrypted_expiry_month'] ?? '', 0, 20) . '...',
                'encrypted_expiry_year' => substr($logPayload['card']['encrypted_expiry_year'] ?? '', 0, 20) . '...',
                'encrypted_cvv' => substr($logPayload['card']['encrypted_cvv'] ?? '', 0, 20) . '...',
                'nonce' => $logPayload['card']['nonce'] ?? null,
                'nonce_length' => strlen($logPayload['card']['nonce'] ?? ''),
            ];
        }
        
        Log::info('Creating Flutterwave payment method', [
            'type' => $paymentMethodData['type'] ?? 'unknown',
            'payload_preview' => $logPayload,
        ]);

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $accessToken,
            'Content-Type' => 'application/json',
        ])->post($this->baseUrl . '/payment-methods', $paymentMethodData);

        if ($response->successful()) {
            $responseData = $response->json();
            if (isset($responseData['data']['id'])) {
                return $responseData['data']['id'];
            }
        }

        $errorResponse = $response->json();
        $statusCode = $response->status();
        $rawBody = $response->body();
        
        Log::error('Flutterwave payment method creation failed', [
            'status' => $statusCode,
            'response' => $errorResponse,
            'raw_response_body' => $rawBody,
            'payment_method_type' => $paymentMethodData['type'] ?? 'unknown',
            'has_encrypted_fields' => isset($paymentMethodData['card']['encrypted_card_number']),
            'encrypted_field_lengths' => isset($paymentMethodData['card']) ? [
                'card_number_len' => strlen($paymentMethodData['card']['encrypted_card_number'] ?? ''),
                'expiry_month_len' => strlen($paymentMethodData['card']['encrypted_expiry_month'] ?? ''),
                'expiry_year_len' => strlen($paymentMethodData['card']['encrypted_expiry_year'] ?? ''),
                'cvv_len' => strlen($paymentMethodData['card']['encrypted_cvv'] ?? ''),
                'nonce_len' => strlen($paymentMethodData['card']['nonce'] ?? ''),
            ] : null,
        ]);

        // Extract detailed error message and convert to user-friendly format
        $errorMessage = 'Failed to process payment method';
        $errorCode = null;
        $validationErrors = [];
        
        if (isset($errorResponse['error'])) {
            $error = $errorResponse['error'];
            $errorCode = $error['code'] ?? null;
            $rawMessage = $error['message'] ?? 'Unknown error';
            
            // Check for validation errors
            if (isset($error['validation_errors']) && is_array($error['validation_errors'])) {
                $validationErrors = $error['validation_errors'];
                foreach ($validationErrors as $validationError) {
                    $field = $validationError['field_name'] ?? 'unknown';
                    $message = $validationError['message'] ?? 'Invalid';
                    Log::error("Flutterwave validation error: {$field} - {$message}");
                }
            }
            
            // Map error codes to user-friendly messages
            $errorMessage = $this->getUserFriendlyErrorMessage($errorCode, $rawMessage, $validationErrors);
        } elseif (isset($errorResponse['message'])) {
            $errorMessage = $this->getUserFriendlyErrorMessage(null, $errorResponse['message'], []);
        }

        throw new \Exception($errorMessage);
    }

    /**
     * Extract country code from phone number
     */
    protected function extractCountryCode(string $phone): string
    {
        // Remove any non-digit characters
        $phone = preg_replace('/[^0-9]/', '', $phone);
        
        // For Rwanda, country code is 250
        if (str_starts_with($phone, '250')) {
            return '250';
        }
        
        // Default to 250 for Rwanda
        return '250';
    }

    /**
     * Extract phone number without country code
     * Phone number must be 7-10 digits for Flutterwave
     * Rwanda numbers are typically 9 digits (e.g., 788123456)
     */
    protected function extractPhoneNumber(string $phone): string
    {
        // Remove any non-digit characters
        $phone = preg_replace('/[^0-9]/', '', $phone);
        
        // Remove country code if present (250 for Rwanda)
        if (str_starts_with($phone, '250')) {
            $phone = substr($phone, 3);
        }
        
        // Remove leading 0 if present (Rwanda numbers often start with 0, e.g., 0788123456)
        if (str_starts_with($phone, '0')) {
            $phone = substr($phone, 1);
        }
        
        // For Rwanda, numbers should be 9 digits starting with 7
        // If the number is longer than expected, take the first 9 digits (not last)
        // This handles cases where extra digits might have been added
        if (strlen($phone) > 9) {
            // Take first 9 digits to preserve the correct number format
            $phone = substr($phone, 0, 9);
        }
        
        // Validate length (must be 7-10 digits for Flutterwave)
        if (strlen($phone) < 7 || strlen($phone) > 10) {
            Log::warning('Phone number length invalid after processing', [
                'original_input' => $phone,
                'processed_length' => strlen($phone),
            ]);
        }
        
        return $phone;
    }

    /**
     * Initialize payment using the new API v4 flow (customers -> payment-methods -> charges)
     * This follows the official Flutterwave API v4 documentation
     */
    public function initializePayment(array $data): array
    {
        try {
            $accessToken = $this->getAccessToken();
            
            // Step 1: Create or get customer
            $customerName = $data['customer_name'] ?? '';
            $nameParts = explode(' ', $customerName, 2);
            
            $customerResponse = Http::withHeaders([
                'Authorization' => 'Bearer ' . $accessToken,
                'Content-Type' => 'application/json',
            ])->post($this->baseUrl . '/customers', [
                'email' => $data['customer_email'],
                'name' => [
                    'first' => $nameParts[0] ?? '',
                    'last' => $nameParts[1] ?? '',
                ],
                'phone' => [
                    'country_code' => $this->extractCountryCode($data['customer_phone']),
                    'number' => $this->extractPhoneNumber($data['customer_phone']),
                ],
            ]);

            $customerId = null;
            
            if ($customerResponse->successful()) {
                $customerData = $customerResponse->json();
                $customerId = $customerData['data']['id'] ?? null;
                Log::info('Flutterwave customer created', ['customer_id' => $customerId]);
            } else {
                $error = $customerResponse->json();
                // Check if customer already exists
                if (isset($error['error']['code']) && $error['error']['code'] === '10409') {
                    // Customer already exists - try to retrieve by email
                    // Note: Flutterwave API might not have a direct "get by email" endpoint
                    // For now, we'll create a new customer with a slightly different email or handle it
                    Log::warning('Flutterwave customer already exists', ['email' => $data['customer_email']]);
                    // Create customer with timestamp to ensure uniqueness, or use the existing one
                    // For simplicity, we'll append a small random string to email for uniqueness
                    $uniqueEmail = $data['customer_email'];
                    if (strpos($uniqueEmail, '+') === false) {
                        $emailParts = explode('@', $uniqueEmail);
                        $uniqueEmail = $emailParts[0] . '+' . time() . '@' . ($emailParts[1] ?? '');
                    }
                    
                    $retryResponse = Http::withHeaders([
                        'Authorization' => 'Bearer ' . $accessToken,
                        'Content-Type' => 'application/json',
                    ])->post($this->baseUrl . '/customers', [
                        'email' => $uniqueEmail,
                        'name' => [
                            'first' => $nameParts[0] ?? '',
                            'last' => $nameParts[1] ?? '',
                        ],
                        'phone' => [
                            'country_code' => $this->extractCountryCode($data['customer_phone']),
                            'number' => $this->extractPhoneNumber($data['customer_phone']),
                        ],
                    ]);
                    
                    if ($retryResponse->successful()) {
                        $customerData = $retryResponse->json();
                        $customerId = $customerData['data']['id'] ?? null;
                        Log::info('Flutterwave customer created with unique email', ['customer_id' => $customerId]);
                    } else {
                        throw new \Exception('Failed to create customer: ' . ($retryResponse->json()['error']['message'] ?? 'Unknown error'));
                    }
                } else {
                    Log::error('Flutterwave customer creation failed', ['response' => $error]);
                    throw new \Exception('Failed to create customer: ' . ($error['error']['message'] ?? 'Unknown error'));
                }
            }

            if (!$customerId) {
                throw new \Exception('Customer ID not returned from Flutterwave');
            }

            // Step 2: Create payment method (for mobile money or card)
            $paymentMethodId = null;
            
            if (isset($data['payment_method']) && 
                (in_array($data['payment_method'], ['mtn_momo', 'airtel_money']) || 
                 in_array($data['payment_method'], ['credit_card', 'card', 'debit_card']))) {
                
                $paymentMethodId = $this->createPaymentMethod($customerId, $data);
                Log::info('Flutterwave payment method created', ['payment_method_id' => $paymentMethodId]);
            }

            // Step 3: Create charge
            // Reference must be alphanumeric only (no underscores, hyphens, etc.)
            $reference = $data['tx_ref'] ?? $data['order_number'] ?? uniqid();
            // Remove any non-alphanumeric characters
            $reference = preg_replace('/[^a-zA-Z0-9]/', '', $reference);
            // Ensure it's not empty
            if (empty($reference)) {
                $reference = 'ORDER' . time() . rand(1000, 9999);
            }
            
            $chargePayload = [
                'currency' => $this->currency,
                'customer_id' => $customerId,
                'amount' => (float) $data['amount'],
                'reference' => $reference,
            ];

            // Payment method ID is required
            if (!$paymentMethodId) {
                throw new \Exception('Payment method must be created before creating charge');
            }
            
            $chargePayload['payment_method_id'] = $paymentMethodId;
            
            // For card payments, include redirect_url for 3DS authentication (Step 4.2-4.3)
            // Note: Flutterwave doesn't accept localhost URLs - must be a public URL
            // The redirect URL should point to backend callback route which then redirects to frontend
            if (isset($data['payment_method']) && in_array($data['payment_method'], ['credit_card', 'card', 'debit_card'])) {
                $redirectUrl = $this->redirectUrl;
                $isProduction = $this->environment === 'live';
                $hasLocalhost = str_contains($redirectUrl, 'localhost') || str_contains($redirectUrl, '127.0.0.1');
                
                // In production, localhost URLs will definitely fail
                if ($hasLocalhost) {
                    // Priority 1: Use FLUTTERWAVE_REDIRECT_URL if explicitly set (for ngrok/public URLs)
                    $customRedirectUrl = env('FLUTTERWAVE_REDIRECT_URL');
                    if ($customRedirectUrl && !str_contains($customRedirectUrl, 'localhost') && !str_contains($customRedirectUrl, '127.0.0.1')) {
                        $redirectUrl = $customRedirectUrl;
                        Log::info('Using FLUTTERWAVE_REDIRECT_URL for 3DS callback', ['url' => $redirectUrl]);
                    } else {
                        // Priority 2: Try to construct from APP_URL if it's public
                        $appUrl = env('APP_URL');
                        if ($appUrl && !str_contains($appUrl, 'localhost') && !str_contains($appUrl, '127.0.0.1')) {
                            $redirectUrl = rtrim($appUrl, '/') . '/payment/callback';
                            Log::info('Using APP_URL for 3DS callback', ['url' => $redirectUrl]);
                        } else {
                            // In production, this is a critical error
                            if ($isProduction) {
                                Log::error('CRITICAL: 3DS redirect URL contains localhost in PRODUCTION. Payment will fail. Set FLUTTERWAVE_REDIRECT_URL to your production callback URL.');
                                throw new \Exception('Payment configuration error: Redirect URL must be a public URL in production. Please set FLUTTERWAVE_REDIRECT_URL in your environment variables.');
                            } else {
                                // In sandbox, log warning but allow (for testing with ngrok)
                                Log::warning('3DS redirect URL contains localhost - Flutterwave will reject this. Set FLUTTERWAVE_REDIRECT_URL in .env to a public URL (e.g., ngrok URL for testing).');
                            }
                        }
                    }
                }
                
                $chargePayload['redirect_url'] = $redirectUrl;
                
                Log::info('Card payment 3DS redirect URL configured', [
                    'payment_method' => $data['payment_method'],
                    'redirect_url' => $redirectUrl,
                    'environment' => $this->environment,
                    'is_public_url' => !$hasLocalhost,
                ]);
            }
            
            // Add meta data if provided
            if (isset($data['order_id']) || isset($data['order_number'])) {
                $chargePayload['meta'] = [
                    'order_id' => $data['order_id'] ?? null,
                    'order_number' => $data['order_number'] ?? null,
                ];
            }

            $chargeResponse = Http::withHeaders([
                'Authorization' => 'Bearer ' . $accessToken,
                'Content-Type' => 'application/json',
            ])->post($this->baseUrl . '/charges', $chargePayload);

            if (!$chargeResponse->successful()) {
                $error = $chargeResponse->json();
                Log::error('Flutterwave charge creation failed', [
                    'response' => $error,
                    'payload' => $chargePayload,
                ]);
                
                $errorCode = $error['error']['code'] ?? null;
                $rawMessage = $error['error']['message'] ?? 'Unknown error';
                $errorMessage = $this->getUserFriendlyErrorMessage($errorCode, $rawMessage, []);
                
                throw new \Exception($errorMessage);
            }

            $chargeData = $chargeResponse->json();
            
            Log::info('Flutterwave charge created', [
                'charge_id' => $chargeData['data']['id'] ?? null,
                'status' => $chargeData['data']['status'] ?? null,
            ]);

            // Extract payment URL from next_action
            $paymentUrl = null;
            $nextActionType = null;
            
            if (isset($chargeData['data']['next_action'])) {
                $nextAction = $chargeData['data']['next_action'];
                $nextActionType = $nextAction['type'] ?? null;
                
                if ($nextActionType === 'redirect_url') {
                    // 3DS/VBVSECURECODE - redirect to bank for authentication
                    $paymentUrl = $nextAction['redirect_url']['url'] ?? null;
                } elseif ($nextActionType === 'payment_instruction') {
                    // Mobile money push notification flow
                    $paymentUrl = null;
                } elseif ($nextActionType === 'requires_additional_fields') {
                    // AVS - requires address fields
                    $paymentUrl = null;
                } elseif ($nextActionType === 'requires_pin') {
                    // PIN/OTP - requires PIN and OTP
                    $paymentUrl = null;
                }
            }

            return [
                'success' => true,
                'payment_url' => $paymentUrl,
                'transaction_id' => $chargeData['data']['id'] ?? null,
                'charge_id' => $chargeData['data']['id'] ?? null,
                'status' => $chargeData['data']['status'] ?? 'pending',
                'next_action' => $chargeData['data']['next_action'] ?? null,
                'next_action_type' => $nextActionType,
            ];

        } catch (\Exception $e) {
            Log::error('Flutterwave payment initialization error', [
                'error' => $e->getMessage(),
                'data' => $data,
            ]);

            return [
                'success' => false,
                'message' => 'Payment initialization failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Verify payment transaction (using charge ID from API v4)
     * In API v4, we use charge IDs, not transaction IDs
     */
    public function verifyTransaction(string $chargeId): array
    {
        try {
            // Get OAuth access token (required for new API v4)
            $accessToken = $this->getAccessToken();
            
            // API v4 uses /charges/{id} endpoint
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $accessToken,
                'Content-Type' => 'application/json',
            ])->get($this->baseUrl . '/charges/' . $chargeId);

            if ($response->successful()) {
                $responseData = $response->json();
                
                if ($responseData['status'] === 'success' && isset($responseData['data'])) {
                    $charge = $responseData['data'];
                    
                    // Map charge status to transaction status
                    $status = $charge['status'] ?? 'pending';
                    // Flutterwave uses 'succeeded' for successful payments
                    if ($status === 'succeeded') {
                        $status = 'successful';
                    }
                    
                    return [
                        'success' => true,
                        'transaction' => [
                            'id' => $charge['id'],
                            'charge_id' => $charge['id'],
                            'tx_ref' => $charge['reference'] ?? null,
                            'reference' => $charge['reference'] ?? null,
                            'status' => $status,
                            'amount' => $charge['amount'] ?? null,
                            'currency' => $charge['currency'] ?? null,
                            'payment_method' => $charge['payment_method_details']['type'] ?? null,
                            'customer_id' => $charge['customer_id'] ?? null,
                            'processor_response' => $charge['processor_response'] ?? null,
                            'created_at' => $charge['created_datetime'] ?? null,
                        ],
                    ];
                }
            }

            $errorData = $response->json();
            return [
                'success' => false,
                'message' => $errorData['message'] ?? $errorData['error']['message'] ?? 'Failed to verify transaction',
            ];
        } catch (\Exception $e) {
            Log::error('Flutterwave transaction verification error', [
                'error' => $e->getMessage(),
                'charge_id' => $chargeId,
            ]);

            return [
                'success' => false,
                'message' => 'Transaction verification failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Verify webhook signature
     */
    public function verifyWebhookSignature(string $signature, string $payload): bool
    {
        $secretHash = config('flutterwave.webhook_secret_hash');
        
        if (!$secretHash) {
            return true; // Skip verification if not configured
        }

        $computedHash = hash_hmac('sha256', $payload, $secretHash);
        
        return hash_equals($computedHash, $signature);
    }

    /**
     * Convert Flutterwave error codes and messages to user-friendly error messages
     */
    protected function getUserFriendlyErrorMessage(?string $errorCode, string $rawMessage, array $validationErrors = []): string
    {
        // Handle validation errors first
        if (!empty($validationErrors)) {
            $fieldMessages = [];
            foreach ($validationErrors as $validationError) {
                $field = $validationError['field_name'] ?? 'unknown';
                $message = $validationError['message'] ?? 'Invalid';
                
                // Map field names to user-friendly labels
                $fieldLabels = [
                    'card.nonce' => 'Payment security code',
                    'card.encrypted_card_number' => 'Card number',
                    'card.encrypted_expiry_month' => 'Expiry month',
                    'card.encrypted_expiry_year' => 'Expiry year',
                    'card.encrypted_cvv' => 'CVV',
                ];
                
                $fieldLabel = $fieldLabels[$field] ?? ucfirst(str_replace(['_', '.'], ' ', $field));
                
                // Map validation messages to user-friendly text
                if (str_contains($message, 'size must be between')) {
                    $fieldMessages[] = "{$fieldLabel} format is incorrect";
                } elseif (str_contains($message, 'required')) {
                    $fieldMessages[] = "{$fieldLabel} is required";
                } else {
                    $fieldMessages[] = "{$fieldLabel}: {$message}";
                }
            }
            
            if (!empty($fieldMessages)) {
                return 'Please check your payment details: ' . implode(', ', $fieldMessages);
            }
        }
        
        // Map error codes to user-friendly messages
        $errorCodeMappings = [
            '10400' => 'Invalid payment request. Please check your payment details and try again.',
            '10409' => 'A customer with this information already exists. Please try again.',
            '1134422' => 'Your card has expired. Please use a different payment method.',
            '1135422' => 'Invalid card expiry date. Please check and try again.',
            '1137400' => 'Card encryption error. Please verify your card details and try again.',
            '1141400' => 'Payment redirect URL is invalid. Please contact support.',
            'CARD_EXPIRED' => 'Your card has expired. Please use a different payment method.',
            'CARD_DECLINED' => 'Your card was declined. Please use a different payment method.',
            'INSUFFICIENT_FUNDS' => 'Insufficient funds. Please use a different payment method.',
            'INVALID_CARD' => 'Invalid card details. Please check your card information and try again.',
            'REDIRECT_URL_INVALID' => 'Payment configuration error. Please contact support.',
            'REQUEST_NOT_VALID' => 'Invalid payment request. Please check your payment details.',
        ];
        
        if ($errorCode && isset($errorCodeMappings[$errorCode])) {
            return $errorCodeMappings[$errorCode];
        }
        
        // Map common error messages
        $messageMappings = [
            'decrypt' => 'Card encryption error. Please verify your card details and try again.',
            'encrypt' => 'Card encryption error. Please verify your card details and try again.',
            'expired' => 'Your card has expired. Please use a different payment method.',
            'declined' => 'Your card was declined. Please use a different payment method.',
            'insufficient' => 'Insufficient funds. Please use a different payment method.',
            'invalid' => 'Invalid payment information. Please check your details and try again.',
            'redirect url is invalid' => 'Payment configuration error. Please contact support.',
            'request is not valid' => 'Invalid payment request. Please check your payment details.',
        ];
        
        $lowerMessage = strtolower($rawMessage);
        foreach ($messageMappings as $key => $friendlyMessage) {
            if (str_contains($lowerMessage, $key)) {
                return $friendlyMessage;
            }
        }
        
        // Default: return a generic user-friendly message
        return 'Payment processing failed. Please check your payment details and try again, or use a different payment method.';
    }
}

