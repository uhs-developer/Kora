<?php

namespace App\GraphQL\Queries;

use App\Models\Order;
use Illuminate\Support\Facades\Log;

class MyOrders
{
    public function __invoke($_, array $args, $context)
    {
        $user = $context->user();
        
        if (!$user) {
            throw new \Exception('You must be logged in to view your orders');
        }

        $page = $args['page'] ?? 1;
        $perPage = $args['perPage'] ?? 20;

        // Get orders for the authenticated user
        $orders = Order::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);

        return [
            'data' => $orders->items(),
            'paginatorInfo' => [
                'currentPage' => $orders->currentPage(),
                'lastPage' => $orders->lastPage(),
                'perPage' => $orders->perPage(),
                'total' => $orders->total(),
            ],
        ];
    }
}

