<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PaymentSuccessful extends Mailable
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
        return $this->subject('Payment Successful - Order ' . $this->order->order_number)
            ->view('emails.payment-successful')
            ->with([
                'order' => $this->order,
                'orderNumber' => $this->order->order_number,
                'customerName' => $this->order->customer_first_name . ' ' . $this->order->customer_last_name,
                'orderTotal' => $this->order->grand_total,
                'currency' => $this->order->currency,
            ]);
    }
}

