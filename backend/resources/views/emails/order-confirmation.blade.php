<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #2563eb; margin: 0;">Order Confirmation</h1>
        <p style="margin: 10px 0 0 0; color: #666;">Thank you for your order!</p>
    </div>

    <div style="background-color: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px;">
        <p>Hello {{ $customerName }},</p>
        <p>We've received your order and it's being processed. Here are your order details:</p>

        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Order Number:</strong> #{{ $orderNumber }}</p>
            <p style="margin: 5px 0 0 0;"><strong>Order Date:</strong> {{ $order->created_at->format('F d, Y') }}</p>
            <p style="margin: 5px 0 0 0;"><strong>Payment Status:</strong> 
                @if($order->payment_status === 'paid')
                    <span style="color: #10b981;">Paid</span>
                @elseif($order->payment_status === 'pending')
                    <span style="color: #f59e0b;">Pending</span>
                @else
                    <span style="color: #ef4444;">{{ ucfirst($order->payment_status) }}</span>
                @endif
            </p>
        </div>

        <h2 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Order Items</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
                <tr style="background-color: #f9fafb;">
                    <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb;">Item</th>
                    <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb;">Quantity</th>
                    <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb;">Price</th>
                </tr>
            </thead>
            <tbody>
                @foreach($items as $item)
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{{ $item->name }}</td>
                    <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb;">{{ $item->quantity }}</td>
                    <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb;">{{ $currency }} {{ number_format($item->row_total, 2) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>

        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>Subtotal:</span>
                <span>{{ $currency }} {{ number_format($order->subtotal, 2) }}</span>
            </div>
            @if($order->discount_amount > 0)
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #10b981;">
                <span>Discount:</span>
                <span>-{{ $currency }} {{ number_format($order->discount_amount, 2) }}</span>
            </div>
            @endif
            @if($order->tax_amount > 0)
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>Tax:</span>
                <span>{{ $currency }} {{ number_format($order->tax_amount, 2) }}</span>
            </div>
            @endif
            @if($order->shipping_amount > 0)
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>Shipping:</span>
                <span>{{ $currency }} {{ number_format($order->shipping_amount, 2) }}</span>
            </div>
            @endif
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; padding-top: 10px; border-top: 2px solid #e5e7eb; margin-top: 10px;">
                <span>Total:</span>
                <span>{{ $currency }} {{ number_format($orderTotal, 2) }}</span>
            </div>
        </div>
    </div>

    <div style="background-color: #eff6ff; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <p style="margin: 0;"><strong>Shipping Address:</strong></p>
        <p style="margin: 5px 0 0 0;">
            {{ $order->shipping_address['street'] ?? '' }}<br>
            {{ $order->shipping_address['city'] ?? '' }}, {{ $order->shipping_address['district'] ?? '' }}<br>
            {{ $order->shipping_address['postcode'] ?? '' }}
        </p>
    </div>

    <div style="text-align: center; padding: 20px; color: #666;">
        <p style="margin: 0;">You can track your order status in your account dashboard.</p>
        <p style="margin: 10px 0 0 0;">If you have any questions, please contact our support team.</p>
    </div>
</body>
</html>

