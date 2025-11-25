<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Flutterwave Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for Flutterwave payment gateway integration.
    | Supports MTN MOMO, Airtel Money, and Card payments.
    |
    */

    // Flutterwave API Keys (from dashboard)
    'public_key' => env('FLUTTERWAVE_PUBLIC_KEY'), // Also called "Client ID" in some contexts
    'secret_key' => env('FLUTTERWAVE_SECRET_KEY'), // Also called "Client Secret"
    'encryption_key' => env('FLUTTERWAVE_ENCRYPTION_KEY'),
    
    // Webhook secret hash (set in Flutterwave dashboard webhook settings)
    'webhook_secret_hash' => env('FLUTTERWAVE_WEBHOOK_SECRET_HASH'),
    
    'environment' => env('FLUTTERWAVE_ENV', 'sandbox'), // sandbox or live
    
    // Flutterwave API Base URL
    // Sandbox: https://developersandbox-api.flutterwave.com (without /v3)
    // Live: https://api.flutterwave.com/v3
    // Can be overridden via FLUTTERWAVE_BASE_URL env variable
    'base_url' => env('FLUTTERWAVE_BASE_URL') ?: (
        env('FLUTTERWAVE_ENV', 'sandbox') === 'live'
            ? (env('FLUTTERWAVE_LIVE_BASE_URL') ?: 'https://api.flutterwave.com/v3')
            : (env('FLUTTERWAVE_SANDBOX_BASE_URL') ?: 'https://developersandbox-api.flutterwave.com')
    ),
    
    // Flutterwave OAuth Token URL (for OAuth 2.0 authentication)
    // Default: https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token
    'oauth_token_url' => env('FLUTTERWAVE_OAUTH_TOKEN_URL', 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token'),
    
    'currency' => env('FLUTTERWAVE_CURRENCY', 'RWF'), // RWF for Rwanda
    
    // Redirect URL for payment callbacks (3DS authentication)
    // Note: Flutterwave doesn't accept localhost URLs
    // For local development, use ngrok or set FLUTTERWAVE_REDIRECT_URL to a public URL
    'redirect_url' => env('FLUTTERWAVE_REDIRECT_URL', env('APP_URL') . '/payment/callback'),
    'webhook_url' => env('FLUTTERWAVE_WEBHOOK_URL', env('APP_URL') . '/api/webhooks/flutterwave'),
];

