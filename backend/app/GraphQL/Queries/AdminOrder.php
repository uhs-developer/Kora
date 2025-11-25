<?php

namespace App\GraphQL\Queries;

use App\Models\Order;

class AdminOrder
{
    public function __invoke($_, array $args)
    {
        $order = Order::with(['user', 'items.product.images'])
            ->findOrFail($args['id']);
        
        return $order;
    }
}

