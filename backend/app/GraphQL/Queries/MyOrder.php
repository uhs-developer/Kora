<?php

namespace App\GraphQL\Queries;

use App\Models\Order;

class MyOrder
{
    public function __invoke($_, array $args, $context)
    {
        $user = $context->user();
        
        if (!$user) {
            throw new \Exception('You must be logged in to view your order');
        }

        $orderNumber = $args['order_number'];
        
        // Get order for the authenticated user by order number
        $order = Order::where('order_number', $orderNumber)
            ->where('user_id', $user->id)
            ->with('items.product')
            ->first();

        if (!$order) {
            throw new \Exception('Order not found');
        }

        return $order;
    }
}

