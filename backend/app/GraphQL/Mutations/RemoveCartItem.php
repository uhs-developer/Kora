<?php

namespace App\GraphQL\Mutations;

use App\Models\CartItem;

class RemoveCartItem
{
    public function __invoke($_, array $args, $context)
    {
        // Get tenant - with fallback to default if not set
        $tenant = app()->bound('tenant') ? app('tenant') : \App\Models\Tenant::where('slug', 'default')->first();
        
        if (!$tenant) {
            throw new \Exception('Tenant not found. Please ensure a default tenant exists.');
        }
        
        // Get authenticated user from context (set by AttemptAuthentication middleware)
        $user = $context->user();
        
        // Get session ID for guest carts
        $sessionId = $args['session_id'] ?? null;
        
        // If no user and no session_id, we can't find the cart
        if (!$user && !$sessionId) {
            throw new \Exception('Session ID is required for guest carts');
        }

        $cartItem = CartItem::whereHas('cart', function ($query) use ($tenant, $user, $sessionId) {
            $query->where('tenant_id', $tenant->id)
                ->whereNull('converted_at');
            
            if ($user) {
                $query->where('user_id', $user->id);
            } else {
                $query->where('session_id', $sessionId)->whereNull('user_id');
            }
        })
            ->where('id', $args['cart_item_id'])
            ->firstOrFail();

        $cart = $cartItem->cart;
        $cartItem->delete();

        // Recalculate cart totals
        $cart->load('items');
        $cart->calculateTotals();

        return $cart->load('items.product');
    }
}
