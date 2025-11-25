<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\Log;

/**
 * Service to handle order status transitions based on payment status and business rules
 * 
 * Business Rules:
 * - Order should never become processing until payment is VERIFIED
 * - Order can only become complete after delivery
 * - Canceling a paid order must always trigger a refund workflow
 * - Payment system should drive order status, not the other way around
 */
class OrderStatusTransitionService
{
    /**
     * Validate if a status transition is allowed
     * 
     * @param Order $order
     * @param string $newStatus
     * @return array ['allowed' => bool, 'reason' => string|null]
     */
    public function validateTransition(Order $order, string $newStatus): array
    {
        $currentStatus = $order->status;
        $paymentStatus = $order->payment_status;

        // Same status - always allowed (idempotent)
        if ($currentStatus === $newStatus) {
            return ['allowed' => true, 'reason' => null];
        }

        // Define valid transitions based on current status and payment status
        $validTransitions = $this->getValidTransitions($currentStatus, $paymentStatus);

        if (!in_array($newStatus, $validTransitions)) {
            // Create user-friendly error message based on the transition attempt
            $friendlyMessage = $this->getFriendlyTransitionMessage($currentStatus, $newStatus, $paymentStatus, $validTransitions);
            
            return ['allowed' => false, 'reason' => $friendlyMessage];
        }

        // Additional business rule validations
        $businessRuleCheck = $this->validateBusinessRules($order, $currentStatus, $newStatus);
        if (!$businessRuleCheck['allowed']) {
            return $businessRuleCheck;
        }

        return ['allowed' => true, 'reason' => null];
    }

    /**
     * Get user-friendly error message for invalid transitions
     */
    protected function getFriendlyTransitionMessage(string $currentStatus, string $newStatus, string $paymentStatus, array $validTransitions): string
    {
        // Special cases for common invalid transitions
        if ($currentStatus === 'pending' && $newStatus === 'processing' && $paymentStatus === 'pending') {
            return "Sorry, the order status can't be updated right now. Payment is still pending. Please wait for the customer to complete payment, or cancel the order if payment has failed.";
        }
        
        if ($currentStatus === 'pending' && $newStatus === 'complete') {
            return "Sorry, you can't mark this order as complete because it's still pending payment. Orders must be paid and in 'processing' status before they can be completed.";
        }
        
        if ($currentStatus === 'complete' && in_array($newStatus, ['processing', 'pending'])) {
            return "Sorry, you can't change a completed order back to '{$newStatus}'. Completed orders are final.";
        }
        
        if ($currentStatus === 'cancelled' && $newStatus !== 'cancelled') {
            return "Sorry, you can't change a cancelled order. Cancelled orders are final.";
        }
        
        if ($currentStatus === 'refunded' && $newStatus !== 'refunded') {
            return "Sorry, you can't change a refunded order. Refunded orders are final.";
        }
        
        // Generic message with context
        $validList = !empty($validTransitions) ? implode(', ', $validTransitions) : 'none';
        return "Sorry, you can't change the order status from '{$currentStatus}' to '{$newStatus}' right now. Payment status is '{$paymentStatus}'. " .
               "Valid status changes from '{$currentStatus}' are: {$validList}.";
    }

    /**
     * Get valid transitions based on current status and payment status
     */
    protected function getValidTransitions(string $currentStatus, string $paymentStatus): array
    {
        $transitions = [
            'pending' => [],
            'processing' => ['complete', 'on_hold', 'cancelled', 'refunded'],
            'on_hold' => ['processing', 'cancelled'],
            'complete' => [], // Final state
            'cancelled' => [], // Final state
            'refunded' => [], // Final state
        ];

        // Payment-driven transitions for pending orders
        if ($currentStatus === 'pending') {
            if ($paymentStatus === 'paid') {
                // Payment successful - can move to processing
                $transitions['pending'][] = 'processing';
            } elseif ($paymentStatus === 'failed') {
                // Payment failed - can cancel
                $transitions['pending'][] = 'cancelled';
            }
            // If payment is still pending, no transitions allowed (wait for payment)
        }

        // Processing can move to complete, on_hold, cancelled, or refunded
        // But cancelling a paid order requires refund
        if ($currentStatus === 'processing') {
            // All transitions are allowed, but business rules will validate refund requirement
        }

        // On hold can return to processing or be cancelled
        if ($currentStatus === 'on_hold') {
            // Can return to processing if payment is still paid
            if ($paymentStatus === 'paid') {
                $transitions['on_hold'][] = 'processing';
            }
            // Can be cancelled (will require refund if payment was paid)
        }

        return $transitions[$currentStatus] ?? [];
    }

    /**
     * Validate business rules for specific transitions
     */
    protected function validateBusinessRules(Order $order, string $currentStatus, string $newStatus): array
    {
        $paymentStatus = $order->payment_status;

        // Rule 1: Cannot move to processing unless payment is paid
        if ($newStatus === 'processing' && $paymentStatus !== 'paid') {
            $friendlyMessage = match($paymentStatus) {
                'pending' => "Sorry, the order status can't be updated right now. Payment is still pending. Please wait for the customer to complete payment, or cancel the order if payment has failed.",
                'failed' => "Sorry, the order status can't be updated right now. Payment has failed. You can cancel this order or wait for the customer to retry payment.",
                default => "Sorry, the order status can't be updated right now. Payment status is '{$paymentStatus}'. Payment must be completed (paid) before the order can be moved to processing."
            };
            return [
                'allowed' => false,
                'reason' => $friendlyMessage
            ];
        }

        // Rule 2: Cannot cancel a paid order without refunding
        if ($newStatus === 'cancelled' && $paymentStatus === 'paid') {
            return [
                'allowed' => false,
                'reason' => "Sorry, you can't cancel this order right now because payment has already been received. Please process a refund through the payment gateway first, then you can cancel the order."
            ];
        }

        // Rule 3: Cannot move from processing to cancelled if payment is paid (must refund first)
        if ($currentStatus === 'processing' && $newStatus === 'cancelled' && $paymentStatus === 'paid') {
            return [
                'allowed' => false,
                'reason' => "Sorry, you can't cancel this order because payment has already been received. Please process a refund through the payment gateway first, then the order status will be updated automatically."
            ];
        }

        // Rule 4: Can only complete an order that is in processing
        if ($newStatus === 'complete' && $currentStatus !== 'processing') {
            return [
                'allowed' => false,
                'reason' => "Sorry, you can only mark an order as 'complete' when it's in 'processing' status. Current order status is '{$currentStatus}'. Please ensure the order has been paid and is being processed first."
            ];
        }

        // Rule 5: Can only complete if payment is paid
        if ($newStatus === 'complete' && $paymentStatus !== 'paid') {
            return [
                'allowed' => false,
                'reason' => "Sorry, you can't mark this order as complete because payment hasn't been received yet. Payment status is '{$paymentStatus}'. Please wait for payment to be completed first."
            ];
        }

        // Rule 6: Refunded status requires payment_status to be refunded or partially_refunded
        if ($newStatus === 'refunded' && !in_array($paymentStatus, ['refunded', 'partially_refunded'])) {
            return [
                'allowed' => false,
                'reason' => "Sorry, you can't set the order status to 'refunded' because the refund hasn't been processed yet. Payment status is '{$paymentStatus}'. Please process the refund through the payment gateway first, then the order status will be updated automatically."
            ];
        }

        return ['allowed' => true, 'reason' => null];
    }

    /**
     * Execute status transition with all validations and side effects
     */
    public function transition(Order $order, string $newStatus, ?string $reason = null): Order
    {
        $validation = $this->validateTransition($order, $newStatus);
        
        if (!$validation['allowed']) {
            throw new \Exception($validation['reason']);
        }

        $oldStatus = $order->status;
        $order->status = $newStatus;

        // Set appropriate timestamps
        if ($newStatus === 'complete' && !$order->completed_at) {
            $order->completed_at = now();
        } elseif ($newStatus === 'cancelled' && !$order->cancelled_at) {
            $order->cancelled_at = now();
        }

        $order->save();

        Log::info('Order status transition executed', [
            'order_number' => $order->order_number,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'payment_status' => $order->payment_status,
            'reason' => $reason,
        ]);

        return $order;
    }

    /**
     * Handle payment status change and automatically transition order status if needed
     * This is called by payment webhooks and callbacks
     */
    public function handlePaymentStatusChange(Order $order, string $newPaymentStatus): Order
    {
        $oldPaymentStatus = $order->payment_status;
        $order->payment_status = $newPaymentStatus;

        // Auto-transition order status based on payment status
        if ($newPaymentStatus === 'paid' && $order->status === 'pending') {
            // Payment successful - move to processing
            $this->transition($order, 'processing', 'Payment verified - automatic transition');
            Log::info('Order automatically moved to processing after payment', [
                'order_number' => $order->order_number,
            ]);
        } elseif ($newPaymentStatus === 'failed' && $order->status === 'pending') {
            // Payment failed - can be cancelled (but don't auto-cancel, let admin decide or timeout handle it)
            // We keep it as pending so user can retry payment
            Log::info('Payment failed - order remains pending for retry', [
                'order_number' => $order->order_number,
            ]);
        } elseif (in_array($newPaymentStatus, ['refunded', 'partially_refunded']) && $order->status === 'processing') {
            // Refund processed - update order status
            if ($newPaymentStatus === 'refunded') {
                $this->transition($order, 'refunded', 'Payment refunded - automatic transition');
            } else {
                // Partially refunded - move to on_hold for admin review
                if ($order->status !== 'on_hold') {
                    $this->transition($order, 'on_hold', 'Partial refund processed - requires admin review');
                }
            }
        }

        $order->save();

        return $order;
    }
}

