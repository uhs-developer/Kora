<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PaymentFailed extends Mailable
{
    use Queueable, SerializesModels;

    public Order $order;
    public ?string $failureReason;

    /**
     * Create a new message instance.
     */
    public function __construct(Order $order, ?string $failureReason = null)
    {
        $this->order = $order;
        $this->failureReason = $failureReason;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        // Extract failure reason from admin_note if not provided
        if (!$this->failureReason) {
            $adminNote = json_decode($this->order->admin_note ?? '{}', true);
            $this->failureReason = $adminNote['failure_reason'] ?? 'Payment could not be processed';
        }

        return $this->subject('Payment Failed - Order ' . $this->order->order_number)
            ->view('emails.payment-failed')
            ->with([
                'order' => $this->order,
                'orderNumber' => $this->order->order_number,
                'customerName' => $this->order->customer_first_name . ' ' . $this->order->customer_last_name,
                'orderTotal' => $this->order->grand_total,
                'currency' => $this->order->currency,
                'failureReason' => $this->failureReason,
            ]);
    }
}

