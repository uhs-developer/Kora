<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cart extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'session_id',
        'shipping_address_id',
        'billing_address_id',
        'coupon_code',
        'discount_amount',
        'subtotal',
        'tax_amount',
        'shipping_amount',
        'shipping_method_id',
        'shipping_method_name',
        'payment_method',
        'grand_total',
        'currency',
        'converted_at',
    ];

    protected $casts = [
        'discount_amount' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'shipping_amount' => 'decimal:2',
        'grand_total' => 'decimal:2',
        'converted_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(CartItem::class);
    }

    public function shippingAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'shipping_address_id');
    }

    public function billingAddress(): BelongsTo
    {
        return $this->belongsTo(Address::class, 'billing_address_id');
    }

    public function shippingMethod(): BelongsTo
    {
        return $this->belongsTo(ShippingMethod::class);
    }

    /**
     * Calculate cart totals
     */
    public function calculateTotals(): void
    {
        // Refresh items relationship to ensure we have the latest items
        $this->load('items');
        
        // Get items collection
        $items = $this->items;

        $subtotal = $items ? $items->sum('row_total') : 0;
        $taxAmount = $items ? $items->sum('tax_amount') : 0;
        $discountAmount = $items ? $items->sum('discount_amount') : 0;
        $shippingAmount = $this->shipping_amount ?? 0;

        $this->subtotal = $subtotal;
        $this->tax_amount = $taxAmount;
        $this->discount_amount = $discountAmount;
        $this->grand_total = $subtotal + $taxAmount + $shippingAmount - $discountAmount;

        $this->save();
    }
}
