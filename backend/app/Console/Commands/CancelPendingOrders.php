<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\OrderStatusTransitionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

/**
 * Cancel pending orders that have not been paid within the timeout period
 * 
 * This command should be run periodically (e.g., every 5 minutes via cron)
 * to automatically cancel orders that have been pending for too long without payment.
 */
class CancelPendingOrders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'orders:cancel-pending 
                            {--timeout=30 : Timeout in minutes (default: 30)}
                            {--dry-run : Show what would be cancelled without actually cancelling}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Cancel pending orders that have exceeded the payment timeout period';

    protected OrderStatusTransitionService $transitionService;

    public function __construct(OrderStatusTransitionService $transitionService)
    {
        parent::__construct();
        $this->transitionService = $transitionService;
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $timeoutMinutes = (int) $this->option('timeout');
        $dryRun = $this->option('dry-run');
        
        $cutoffTime = Carbon::now()->subMinutes($timeoutMinutes);
        
        // Find orders that are:
        // 1. Status is 'pending'
        // 2. Payment status is 'pending' or 'failed'
        // 3. Created more than $timeoutMinutes ago
        $pendingOrders = Order::where('status', 'pending')
            ->whereIn('payment_status', ['pending', 'failed'])
            ->where('created_at', '<=', $cutoffTime)
            ->get();
        
        if ($pendingOrders->isEmpty()) {
            $this->info("No pending orders found that exceed the {$timeoutMinutes}-minute timeout.");
            return 0;
        }
        
        $this->info("Found {$pendingOrders->count()} pending order(s) that exceed the {$timeoutMinutes}-minute timeout.");
        
        if ($dryRun) {
            $this->warn("DRY RUN MODE - No orders will be cancelled");
            $this->table(
                ['Order Number', 'Created At', 'Payment Status', 'Grand Total'],
                $pendingOrders->map(function ($order) {
                    return [
                        $order->order_number,
                        $order->created_at->format('Y-m-d H:i:s'),
                        $order->payment_status,
                        $order->currency . ' ' . number_format($order->grand_total, 2),
                    ];
                })->toArray()
            );
            return 0;
        }
        
        $cancelledCount = 0;
        $failedCount = 0;
        
        foreach ($pendingOrders as $order) {
            try {
                // Use transition service to cancel the order
                $this->transitionService->transition(
                    $order, 
                    'cancelled', 
                    "Auto-cancelled: Payment timeout ({$timeoutMinutes} minutes) exceeded"
                );
                
                $cancelledCount++;
                $this->info("✓ Cancelled order: {$order->order_number}");
                
                Log::info('Order auto-cancelled due to payment timeout', [
                    'order_number' => $order->order_number,
                    'timeout_minutes' => $timeoutMinutes,
                    'created_at' => $order->created_at,
                    'payment_status' => $order->payment_status,
                ]);
            } catch (\Exception $e) {
                $failedCount++;
                $this->error("✗ Failed to cancel order {$order->order_number}: {$e->getMessage()}");
                
                Log::error('Failed to auto-cancel order due to payment timeout', [
                    'order_number' => $order->order_number,
                    'error' => $e->getMessage(),
                ]);
            }
        }
        
        $this->info("\nSummary:");
        $this->info("  Cancelled: {$cancelledCount}");
        if ($failedCount > 0) {
            $this->warn("  Failed: {$failedCount}");
        }
        
        return 0;
    }
}

