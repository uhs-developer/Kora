<?php

namespace App\GraphQL\Queries;

use App\Models\Cart;

class GetCart
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

        // If user is authenticated and has a session_id, merge guest cart with user cart
        if ($user && $sessionId) {
            $guestCart = Cart::where('tenant_id', $tenant->id)
                ->where('session_id', $sessionId)
                ->whereNull('user_id')
                ->whereNull('converted_at')
                ->with('items.product')
                ->first();

            $userCart = Cart::where('tenant_id', $tenant->id)
                ->where('user_id', $user->id)
                ->whereNull('converted_at')
                ->with('items.product')
                ->first();

            // Merge guest cart into user cart if both exist
            if ($guestCart && $guestCart->items->isNotEmpty()) {
                if ($userCart) {
                    // Merge items from guest cart into user cart
                    foreach ($guestCart->items as $guestItem) {
                        $existingItem = $userCart->items->firstWhere('product_id', $guestItem->product_id);
                        if ($existingItem) {
                            // Update quantity if same product
                            $existingItem->quantity += $guestItem->quantity;
                            $existingItem->save();
                        } else {
                            // Add new item
                            $guestItem->cart_id = $userCart->id;
                            $guestItem->save();
                        }
                    }
                    // Delete guest cart
                    $guestCart->delete();
                    $userCart->load('items.product');
                    $userCart->calculateTotals();
                    $cart = $userCart->fresh(['items.product']);
                } else {
                    // Convert guest cart to user cart
                    $guestCart->user_id = $user->id;
                    $guestCart->session_id = null;
                    $guestCart->save();
                    $cart = $guestCart->fresh(['items.product']);
                }
            } else {
                // Use or create user cart
                $cart = $userCart ?? Cart::create([
                    'tenant_id' => $tenant->id,
                    'user_id' => $user->id,
                    'currency' => 'USD',
                ]);
                $cart->load('items.product');
            }
        } else {
            // If no user and no session_id, return empty cart
            if (!$user && !$sessionId) {
                $cart = new Cart([
                    'tenant_id' => $tenant->id,
                    'user_id' => null,
                    'session_id' => null,
                    'currency' => 'USD',
                    'subtotal' => 0,
                    'tax_amount' => 0,
                    'shipping_amount' => 0,
                    'discount_amount' => 0,
                    'grand_total' => 0,
                ]);
                $cart->setRelation('items', collect());
                return $cart;
            }

            // Find cart by user_id or session_id
            $cart = Cart::where('tenant_id', $tenant->id)
                ->whereNull('converted_at')
                ->where(function ($query) use ($user, $sessionId) {
                    if ($user) {
                        $query->where('user_id', $user->id);
                    } else {
                        $query->where('session_id', $sessionId)->whereNull('user_id');
                    }
                })
                ->with('items.product')
                ->first();
        }

        if (!$cart) {
            // Return empty cart structure
            $cart = new Cart([
                'tenant_id' => $tenant->id,
                'user_id' => $user?->id,
                'session_id' => $user ? null : $sessionId,
                'currency' => 'USD',
                'subtotal' => 0,
                'tax_amount' => 0,
                'shipping_amount' => 0,
                'discount_amount' => 0,
                'grand_total' => 0,
            ]);
            $cart->setRelation('items', collect());
        }

        return $cart;
    }
}
