<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class OrderConfirmation extends Mailable
{
    use Queueable, SerializesModels;

    public Order $order;

    /**
     * Create a new message instance.
     */
    public function __construct(Order $order)
    {
        $this->order = $order;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        return $this->subject('Order Confirmation - ' . $this->order->order_number)
            ->view('emails.order-confirmation')
            ->with([
                'order' => $this->order,
                'orderNumber' => $this->order->order_number,
                'customerName' => $this->order->customer_first_name . ' ' . $this->order->customer_last_name,
                'orderTotal' => $this->order->grand_total,
                'currency' => $this->order->currency,
                'items' => $this->order->items,
            ]);
    }
}

