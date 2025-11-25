# Payment Flow Status Transitions

This document outlines all order and payment status transitions throughout the payment flow.

## Order Status Enum Values
- `pending` - Order created, awaiting payment
- `processing` - Payment successful, order being processed
- `complete` - Order fulfilled and delivered
- `cancelled` - Order cancelled
- `on_hold` - Order on hold (admin action)
- `refunded` - Order refunded

## Payment Status Enum Values
- `pending` - Payment not yet initiated or in progress
- `authorized` - Payment authorized but not captured (not used in current flow)
- `paid` - Payment successful and confirmed
- `partially_refunded` - Partial refund issued
- `refunded` - Full refund issued
- `failed` - Payment failed

## Status Transition Flow

### 1. Order Placement (PlaceOrder Mutation)
**Initial State:**
- `order.status` = `pending`
- `order.payment_status` = `pending`

**Action:** Order created from cart
**Result:** Order exists with pending status, ready for payment

---

### 2. Payment Initialization (InitializePayment Mutation)
**Pre-condition:** `order.payment_status` !== `paid` (prevents double payment)

**State During Payment:**
- `order.status` = `pending` (unchanged)
- `order.payment_status` = `pending` (unchanged)
- `order.admin_note` stores:
  - `flutterwave_charge_id`
  - `flutterwave_transaction_id`
  - `flutterwave_status` = `pending`
  - `next_action` (for mobile money or 3DS)

**Action:** Payment method created, charge initiated
**Result:** Payment in progress, order still pending

---

### 3A. Card Payment - 3DS Redirect Flow

**Step 3A.1: Redirect to Bank**
- User redirected to Flutterwave 3DS page
- Order status remains `pending`
- Payment status remains `pending`

**Step 3A.2: User Authenticates**
- User enters OTP/PIN on bank page
- Order status remains `pending`
- Payment status remains `pending`

**Step 3A.3: Callback Received (PaymentCallbackController)**

**Success Path:**
- `order.payment_status` = `paid`
- `order.status` = `processing`
- `order.paid_at` = now()
- Email sent: PaymentSuccessful

**Failure Path:**
- `order.payment_status` = `failed`
- `order.status` = `pending` (unchanged - allows retry)
- Email sent: PaymentFailed

---

### 3B. Mobile Money Payment - Push Notification Flow

**Step 3B.1: Push Sent**
- Flutterwave sends push to user's phone
- Order status remains `pending`
- Payment status remains `pending`
- User sees "Payment Pending" page

**Step 3B.2: User Authorizes on Phone**
- User enters MoMo PIN
- Order status remains `pending`
- Payment status remains `pending`
- Frontend polls order status

**Step 3B.3: Webhook Received (FlutterwaveWebhookController)**

**Success Path:**
- `order.payment_status` = `paid`
- `order.status` = `processing`
- `order.paid_at` = now()
- Email sent: PaymentSuccessful
- Frontend polling detects change → updates UI

**Failure Path:**
- `order.payment_status` = `failed`
- `order.status` = `pending` (unchanged - allows retry)
- Email sent: PaymentFailed
- Frontend polling detects change → updates UI

---

### 4. Payment Status Polling (Frontend)

**When:** Order has pending payment (mobile money)

**Action:** Frontend polls `myOrder` query every 10 seconds

**Stops When:**
- `payment_status` = `paid` → Show success, stop polling
- `payment_status` = `failed` → Show failure, stop polling
- Max polls reached (30 polls = 5 minutes) → Stop polling

---

### 5. Order Processing (After Payment Success)

**State:**
- `order.status` = `processing`
- `order.payment_status` = `paid`

**Next Steps (Admin Actions):**
- Admin can update to `on_hold` if needed
- Admin can create shipment → `status` may change to `shipped`
- Admin can mark as `complete` when delivered
- Admin can issue refund → `payment_status` = `refunded` or `partially_refunded`

---

## Important Rules

1. **Idempotency**: All status updates check current status before updating
   - Webhook: `if ($order->payment_status !== 'paid')`
   - Callback: Updates always (but idempotent by design)

2. **Payment Retry**: Failed payments keep `order.status` = `pending` to allow retry

3. **Status Consistency**: 
   - `payment_status` = `paid` → `order.status` = `processing`
   - `payment_status` = `failed` → `order.status` = `pending` (retryable)
   - `payment_status` = `pending` → `order.status` = `pending`

4. **Email Notifications**:
   - Order placed → OrderConfirmation email
   - Payment successful → PaymentSuccessful email
   - Payment failed → PaymentFailed email

5. **No Status Rollback**: Once `payment_status` = `paid`, it should not go back to `pending` or `failed` (except via refund)

---

## Status Transition Diagram

```
Order Created
    ↓
[status: pending, payment_status: pending]
    ↓
Payment Initialized
    ↓
[status: pending, payment_status: pending] + charge_id stored
    ↓
    ├─→ Card 3DS → Callback/Webhook
    │       ├─→ Success: [status: processing, payment_status: paid] ✓
    │       └─→ Failed: [status: pending, payment_status: failed] (retryable)
    │
    └─→ Mobile Money → Webhook
            ├─→ Success: [status: processing, payment_status: paid] ✓
            └─→ Failed: [status: pending, payment_status: failed] (retryable)
```

---

## Validation Checklist

✅ Order created with `pending` status
✅ Payment initialization doesn't change order status
✅ Successful payment → `processing` + `paid`
✅ Failed payment → `pending` + `failed` (retryable)
✅ Idempotent updates (won't duplicate)
✅ Email notifications sent at correct times
✅ Frontend polling stops when payment resolved
✅ Status values match database enum constraints

