<?php

namespace App\GraphQL\Mutations;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;

class AddToCart
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
        
        // Get session ID for guest carts (from args or generate one)
        $sessionId = $args['session_id'] ?? null;
        
        // If no user and no session_id, we can't create a cart
        if (!$user && !$sessionId) {
            throw new \Exception('Session ID is required for guest carts');
        }

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
                            $existingItem->row_total = $existingItem->price * $existingItem->quantity;
                            $existingItem->save();
                        } else {
                            // Add new item - update cart_id
                            $guestItem->cart_id = $userCart->id;
                            $guestItem->save();
                        }
                    }
                    // Delete guest cart
                    $guestCart->delete();
                    // Refresh user cart to get updated items
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
                if (!$userCart) {
                    $cart = Cart::create([
                        'tenant_id' => $tenant->id,
                        'user_id' => $user->id,
                        'currency' => 'USD',
                    ]);
                } else {
                    $cart = $userCart;
                }
            }
        } else {
            // Get or create cart - use user_id if authenticated, otherwise use session_id
            $cart = Cart::where('tenant_id', $tenant->id)
                ->whereNull('converted_at')
                ->where(function ($query) use ($user, $sessionId) {
                    if ($user) {
                        $query->where('user_id', $user->id);
                    } else {
                        $query->where('session_id', $sessionId)->whereNull('user_id');
                    }
                })
                ->first();

            if (!$cart) {
                $cart = Cart::create([
                    'tenant_id' => $tenant->id,
                    'user_id' => $user?->id,
                    'session_id' => $user ? null : $sessionId,
                    'currency' => 'USD',
                ]);
            }
        }

        // Get product - check if it exists first
        // Handle both products with tenant_id and without (for backward compatibility)
        $product = Product::where('id', $args['product_id'])
            ->where(function ($query) use ($tenant) {
                $query->where('tenant_id', $tenant->id)
                    ->orWhereNull('tenant_id'); // Allow products without tenant_id for backward compatibility
            })
            ->first();

        if (!$product) {
            throw new \Exception("Product with ID {$args['product_id']} not found");
        }

        // Check if product is active
        if (!$product->is_active) {
            throw new \Exception("Product '{$product->name}' is not active");
        }

        // Check if product is in stock
        if (!$product->in_stock) {
            throw new \Exception("Product '{$product->name}' is out of stock");
        }

        // Check if item already exists in cart
        $cartItem = CartItem::where('cart_id', $cart->id)
            ->where('product_id', $product->id)
            ->first();

        if ($cartItem) {
            // Update quantity
            $cartItem->quantity += $args['quantity'];
            $cartItem->row_total = $cartItem->price * $cartItem->quantity;
            $cartItem->save();
        } else {
            // Add new item
            $cartItem = CartItem::create([
                'cart_id' => $cart->id,
                'product_id' => $product->id,
                'sku' => $product->sku,
                'name' => $product->name,
                'quantity' => $args['quantity'],
                'price' => $product->price,
                'row_total' => $product->price * $args['quantity'],
                'custom_options' => $args['custom_options'] ?? null,
            ]);
        }

        // Recalculate cart totals - refresh items to get latest data
        $cart->refresh();
        $cart->load('items');
        $cart->calculateTotals();

        // Return cart with items and product relationships loaded
        return $cart->load('items.product');
    }
}
