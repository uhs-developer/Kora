<?php

namespace App\GraphQL\Mutations;

use App\Models\Cart;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use App\Mail\OrderConfirmation;

class PlaceOrder
{
    public function __invoke($_, array $args, $context)
    {
        // Get tenant - with fallback to default if not set
        $tenant = app()->bound('tenant') ? app('tenant') : \App\Models\Tenant::where('slug', 'default')->first();
        
        if (!$tenant) {
            throw new \Exception('Unable to process order. Please contact support.');
        }
        
        // Get authenticated user from context (set by AttemptAuthentication middleware)
        $user = $context->user();

        if (!$user) {
            throw new \Exception('Please log in to place an order.');
        }

        // Get active cart
        try {
            $cart = Cart::where('tenant_id', $tenant->id)
                ->where('user_id', $user->id)
                ->whereNull('converted_at')
                ->with('items.product')
                ->firstOrFail();
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            throw new \Exception('No active cart found. Please add items to your cart and try again.');
        }

        if ($cart->items->isEmpty()) {
            throw new \Exception('Your cart is empty. Please add items before checkout.');
        }

        try {
            return DB::transaction(function () use ($cart, $user, $args, $tenant) {
                // Create order
                $order = Order::create([
                'tenant_id' => $tenant->id,
                'user_id' => $user->id,
                'order_number' => Order::generateOrderNumber(),
                'status' => 'pending',
                'payment_status' => 'pending',
                'payment_method' => $args['payment_method'] ?? null,
                'shipping_method' => $cart->shipping_method ?? $args['shipping_method'] ?? null,
                'customer_email' => $user->email,
                'customer_first_name' => explode(' ', $user->name)[0] ?? $user->name,
                'customer_last_name' => explode(' ', $user->name)[1] ?? '',
                'billing_address' => $args['billing_address'],
                'shipping_address' => $args['shipping_address'],
                'subtotal' => $cart->subtotal,
                'discount_amount' => $cart->discount_amount,
                'tax_amount' => $cart->tax_amount,
                'shipping_amount' => $cart->shipping_amount,
                'grand_total' => $cart->grand_total,
                'currency' => $cart->currency,
                'coupon_code' => $cart->coupon_code,
                'customer_note' => $args['customer_note'] ?? null,
            ]);

            // Copy cart items to order items
            foreach ($cart->items as $cartItem) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $cartItem->product_id,
                    'sku' => $cartItem->sku,
                    'name' => $cartItem->name,
                    'quantity' => $cartItem->quantity,
                    'price' => $cartItem->price,
                    'row_total' => $cartItem->row_total,
                    'tax_amount' => $cartItem->tax_amount,
                    'discount_amount' => $cartItem->discount_amount,
                    'custom_options' => $cartItem->custom_options,
                ]);
            }

            // Mark cart as converted
            $cart->converted_at = now();
            $cart->save();

            // Log order placement
            AuditLog::logEvent('order_placed', $order, null, [
                'order_number' => $order->order_number,
                'grand_total' => $order->grand_total,
                'items_count' => $order->items->count(),
            ], "Order {$order->order_number} placed by {$user->email}");

            // Send order confirmation email (Step 8)
            try {
                Mail::to($order->customer_email)->send(new OrderConfirmation($order));
            } catch (\Exception $e) {
                \Log::error('Failed to send order confirmation email', [
                    'order_number' => $order->order_number,
                    'error' => $e->getMessage(),
                ]);
                // Don't fail the order placement if email fails
            }

                return $order->load('items.product');
            });
        } catch (\Illuminate\Database\QueryException $e) {
            \Log::error('Order placement database error', [
                'error' => $e->getMessage(),
                'user_id' => $user->id ?? null,
            ]);
            throw new \Exception('Failed to create order due to a database error. Please try again or contact support.');
        } catch (\Exception $e) {
            // Re-throw user-friendly exceptions as-is
            throw $e;
        }
    }
}
