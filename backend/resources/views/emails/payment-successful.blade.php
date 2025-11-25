<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Successful</title>
</head>
@php
    $frontendBaseUrl = rtrim((string) (config('app.frontend_url') ?? config('app.url')), '/');
    $ordersUrl = $frontendBaseUrl ? $frontendBaseUrl . '/orders' : url('/orders');
@endphp

<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <h1 style="color: #10b981; margin: 0;">✓ Payment Successful</h1>
        <p style="margin: 10px 0 0 0; color: #065f46;">Your payment has been confirmed!</p>
    </div>

    <div style="background-color: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px;">
        <p>Hello {{ $customerName }},</p>
        <p>Great news! Your payment for order <strong>#{{ $orderNumber }}</strong> has been successfully processed.</p>

        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0;"><strong>Order Number:</strong> #{{ $orderNumber }}</p>
            <p style="margin: 5px 0 0 0;"><strong>Amount Paid:</strong> {{ $currency }} {{ number_format($orderTotal, 2) }}</p>
            <p style="margin: 5px 0 0 0;"><strong>Payment Date:</strong> {{ now()->format('F d, Y g:i A') }}</p>
        </div>

        <p>Your order is now being processed and will be shipped soon. You'll receive another email with tracking information once your order ships.</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{{ $ordersUrl }}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Order Details</a>
        </div>
    </div>

    <div style="text-align: center; padding: 20px; color: #666;">
        <p style="margin: 0;">Thank you for your purchase!</p>
    </div>
</body>
</html>

