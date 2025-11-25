<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Failed</title>
</head>
@php
    $frontendBaseUrl = rtrim((string) (config('app.frontend_url') ?? config('app.url')), '/');
    $ordersUrl = $frontendBaseUrl ? $frontendBaseUrl . '/orders' : url('/orders');
    $retryUrl = $frontendBaseUrl
        ? $frontendBaseUrl . '/checkout?order=' . urlencode($orderNumber) . '&retry=true'
        : url('/checkout?order=' . urlencode($orderNumber) . '&retry=true');
@endphp

<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <h1 style="color: #dc2626; margin: 0;">Payment Failed</h1>
        <p style="margin: 10px 0 0 0; color: #991b1b;">We couldn't process your payment</p>
    </div>

    <div style="background-color: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px;">
        <p>Hello {{ $customerName }},</p>
        <p>Unfortunately, we couldn't process your payment for order <strong>#{{ $orderNumber }}</strong>.</p>

        <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0;"><strong>Order Number:</strong> #{{ $orderNumber }}</p>
            <p style="margin: 5px 0 0 0;"><strong>Order Total:</strong> {{ $currency }} {{ number_format($orderTotal, 2) }}</p>
            <p style="margin: 5px 0 0 0;"><strong>Reason:</strong> {{ $failureReason }}</p>
        </div>

        <p><strong>Don't worry!</strong> Your order has been saved. You can try the payment again using one of these options:</p>

        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin-top: 0;">What you can do:</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Try the payment again from your order history</li>
                <li>Use a different payment method</li>
                <li>Contact your bank if the issue persists</li>
                <li>Contact our support team for assistance</li>
            </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{{ $ordersUrl }}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px;">View Order</a>
            <a href="{{ $retryUrl }}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Retry Payment</a>
        </div>
    </div>

    <div style="text-align: center; padding: 20px; color: #666;">
        <p style="margin: 0;">If you continue to experience issues, please contact our support team.</p>
    </div>
</body>
</html>

