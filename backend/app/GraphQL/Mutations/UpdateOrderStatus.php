<?php

namespace App\GraphQL\Mutations;

use App\Models\Order;
use App\Models\AuditLog;
use App\Services\OrderStatusTransitionService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Gate;
use GraphQL\Error\Error;

class UpdateOrderStatus
{
    protected OrderStatusTransitionService $transitionService;

    public function __construct(OrderStatusTransitionService $transitionService)
    {
        $this->transitionService = $transitionService;
    }

    public function __invoke($_, array $args, $context)
    {
        $user = $context->user();
        
        if (!$user) {
            throw new \Exception('You must be authenticated to update order status');
        }

        // Check if user has permission to update orders
        if (!Gate::forUser($user)->allows('update-orders')) {
            // Fallback: Check if user has admin role
            if (!$user->hasRole('admin') && !$user->hasRole('superadmin')) {
                throw new \Exception('You do not have permission to update order status');
            }
        }

        $order = Order::findOrFail($args['id']);
        $oldStatus = $order->status;
        $newStatus = $args['status'];
        
        // Validate status is a valid enum value
        $validStatuses = ['pending', 'processing', 'complete', 'cancelled', 'on_hold', 'refunded'];
        if (!in_array($newStatus, $validStatuses)) {
            throw new \Exception("Invalid order status: {$newStatus}. Valid statuses are: " . implode(', ', $validStatuses));
        }
        
        // Use transition service to validate and execute transition
        try {
            $order = $this->transitionService->transition($order, $newStatus, "Manual update by admin {$user->email}");
        } catch (\Exception $e) {
            Log::warning('Order status transition failed', [
                'order_number' => $order->order_number,
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
                'error' => $e->getMessage(),
                'admin_id' => $user->id,
            ]);
            throw new Error($e->getMessage());
        }
        
        // Log the status change
        AuditLog::logEvent('order_status_updated', $order, $user, [
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'payment_status' => $order->payment_status,
        ], "Order {$order->order_number} status changed from {$oldStatus} to {$newStatus} by admin");
        
        Log::info('Order status updated by admin', [
            'order_number' => $order->order_number,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'payment_status' => $order->payment_status,
            'admin_id' => $user->id,
            'admin_email' => $user->email,
        ]);
        
        return $order->load(['user', 'items.product']);
    }
}

