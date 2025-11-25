import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "urql";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { 
  CheckCircle, 
  Package, 
  Truck, 
  Mail, 
  Phone, 
  Download,
  ArrowRight,
  XCircle,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { MY_ORDER } from "../graphql/storefront";

interface ThankYouPageProps {
  orderData?: any;
  onContinueShopping?: () => void;
  onTrackOrder?: () => void;
}

export function ThankYouPage({ orderData: propOrderData, onContinueShopping, onTrackOrder }: ThankYouPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  
  // Get order data from location state or props
  const orderData = (location.state as any)?.orderData || propOrderData;
  
  // Check for payment status from URL params (from Flutterwave callback)
  const paymentStatus = searchParams.get('payment'); // 'success', 'failed', 'pending', or 'unknown'
  const orderNumberFromUrl = searchParams.get('order');
  
  const [orderNumber] = useState(orderNumberFromUrl || orderData?.order_number || `TB${Date.now().toString().slice(-8)}`);
  const [estimatedDelivery] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + Math.floor(Math.random() * 7) + 7); // 7-14 days
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  });

  // Check for pending mobile money payment from sessionStorage
  const [pendingPayment, setPendingPayment] = useState<any>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const maxPolls = 30; // Poll for up to 5 minutes (30 * 10 seconds)
  
  // Query order status for polling
  const [orderResult, refetchOrder] = useQuery({
    query: MY_ORDER,
    variables: { order_number: orderNumber },
    pause: !pollingEnabled || !orderNumber, // Only query when polling is enabled
    requestPolicy: 'network-only', // Always fetch fresh data
  });
  
  const currentOrder = orderResult.data?.myOrder;
  
  // Set up polling for pending payments
  useEffect(() => {
    const stored = sessionStorage.getItem('pending_payment');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Only show if order number matches
        if (parsed.order_number === orderNumber) {
          setPendingPayment(parsed);
          // Enable polling for pending payments
          setPollingEnabled(true);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [orderNumber]);
  
  // Poll for payment status updates
  useEffect(() => {
    if (!pollingEnabled || !orderNumber) return;
    
    // Check if payment is no longer pending
    if (currentOrder) {
      const isPaid = currentOrder.payment_status === 'paid';
      const isFailed = currentOrder.payment_status === 'failed';
      
      if (isPaid || isFailed) {
        // Payment resolved - stop polling and update UI
        setPollingEnabled(false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        // Clear pending payment from session
        sessionStorage.removeItem('pending_payment');
        
        // Update URL to reflect payment status
        const newStatus = isPaid ? 'success' : 'failed';
        const newUrl = `${window.location.pathname}?order=${orderNumber}&payment=${newStatus}`;
        window.history.replaceState({}, '', newUrl);
        
        // Reload to show updated status
        window.location.reload();
        return;
      }
    }
    
    // Set up polling interval (every 10 seconds)
    if (!pollingIntervalRef.current && pollCount < maxPolls) {
      pollingIntervalRef.current = setInterval(() => {
        setPollCount(prev => {
          const newCount = prev + 1;
          if (newCount >= maxPolls) {
            // Stop polling after max attempts
            setPollingEnabled(false);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            return newCount;
          }
          // Refetch order status
          refetchOrder({ requestPolicy: 'network-only' });
          return newCount;
        });
      }, 10000); // Poll every 10 seconds
    }
    
    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [pollingEnabled, orderNumber, currentOrder, pollCount, refetchOrder]);

  const isPaymentFailed = paymentStatus === 'failed';
  const isPaymentSuccess = paymentStatus === 'success';
  const isPaymentPendingFromUrl = paymentStatus === 'pending';
  const isPaymentPending = isPaymentPendingFromUrl || (!paymentStatus && !isPaymentFailed && !isPaymentSuccess && pendingPayment);
  
  // Check if pending payment is for a card (should show different message)
  const isCardPaymentPending = isPaymentPending && 
    (pendingPayment?.payment_method === 'credit_card' || 
     pendingPayment?.payment_method === 'card' || 
     pendingPayment?.payment_method === 'debit_card');

  const handleRetryPayment = () => {
    // Navigate back to checkout with the order number
    navigate(`/checkout?order=${orderNumber}&retry=true`);
  };

  // Payment Pending View (Mobile Money or Card - Step 4.2-4.4)
  if (isPaymentPending) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Pending Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
              {isCardPaymentPending ? (
                <RefreshCw className="h-10 w-10 text-blue-600 animate-spin" />
              ) : (
                <Phone className="h-10 w-10 text-blue-600" />
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2">Payment Processing</h1>
            <p className="text-lg text-muted-foreground">
              {isCardPaymentPending 
                ? 'Your payment is being processed. Please wait for confirmation.'
                : 'Please complete the payment on your mobile device'}
            </p>
          </div>

          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">
                      {isCardPaymentPending ? 'What\'s happening?' : 'Next Steps'}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {pendingPayment.instruction || 
                        (isCardPaymentPending 
                          ? 'Your card payment is being verified by the payment gateway. This may take a few moments.'
                          : `Check your ${pendingPayment.payment_method === 'mtn_momo' ? 'MTN' : 'Airtel'} mobile money account for a payment prompt.`)}
                    </p>
                    {!isCardPaymentPending && (
                      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                        <li>Open the notification on your mobile device</li>
                        <li>Enter your Mobile Money PIN to authorize the payment</li>
                        <li>Wait for confirmation (this page will update automatically)</li>
                      </ol>
                    )}
                    {isCardPaymentPending && (
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p>• Your order has been created successfully</p>
                        <p>• Payment verification is in progress</p>
                        <p>• You'll be notified once payment is confirmed</p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Order Number</h4>
                  <Badge variant="secondary" className="font-mono">#{orderNumber}</Badge>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Order Total</h4>
                  <p className="text-lg font-semibold">
                    ${orderData?.grand_total?.toFixed(2) || orderData?.totals?.total?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1 text-blue-900">Payment Processing</h3>
                  <p className="text-sm text-blue-700">
                    Your order has been created and is waiting for payment confirmation. 
                    Once you authorize the payment on your phone, we'll update your order status automatically.
                    You'll receive an email confirmation when payment is successful.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              size="lg" 
              className="w-full" 
              onClick={() => {
                // Manually refetch order status
                refetchOrder({ requestPolicy: 'network-only' });
                setPollCount(0); // Reset poll count
              }}
              disabled={orderResult.fetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${orderResult.fetching ? 'animate-spin' : ''}`} />
              {orderResult.fetching ? 'Checking...' : 'Check Payment Status'}
            </Button>
            {pollingEnabled && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Auto-checking every 10 seconds... ({pollCount}/{maxPolls})
              </p>
            )}
            <Button variant="outline" size="lg" className="w-full" onClick={onTrackOrder || (() => navigate('/orders'))}>
              View Order History
            </Button>
          </div>

          {/* Continue Shopping */}
          <div className="text-center mt-6">
            <Button variant="ghost" onClick={onContinueShopping || (() => navigate('/'))}>
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Payment Failure View
  if (isPaymentFailed) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Failure Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Payment Failed</h1>
            <p className="text-lg text-muted-foreground">
              We couldn't process your payment. Don't worry, your order has been saved.
            </p>
          </div>

          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">What happened?</h3>
                    <p className="text-sm text-muted-foreground">
                      Your payment could not be processed. This could be due to insufficient funds, 
                      incorrect card details, or a temporary issue with your bank.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Order Number</h4>
                  <Badge variant="secondary" className="font-mono">#{orderNumber}</Badge>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Order Total</h4>
                  <p className="text-lg font-semibold">
                    ${orderData?.grand_total?.toFixed(2) || orderData?.totals?.total?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button size="lg" className="w-full" onClick={handleRetryPayment}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Payment Again
            </Button>
            <Button variant="outline" size="lg" className="w-full" onClick={() => navigate('/checkout')}>
              Update Payment Method
            </Button>
          </div>

          {/* Help Section */}
          <Card className="mt-6">
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="font-semibold mb-2">Need Help?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  If you continue to experience issues, please contact our support team.
                </p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" size="sm">
                    <Phone className="h-4 w-4 mr-2" />
                    Call Support
                  </Button>
                  <Button variant="outline" size="sm">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Us
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Continue Shopping */}
          <div className="text-center mt-6">
            <Button variant="ghost" onClick={onContinueShopping || (() => navigate('/'))}>
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Payment Success View
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
          <p className="text-lg text-muted-foreground">
            Thank you for your purchase. Your order has been successfully placed.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Order Number</span>
                <Badge variant="secondary" className="font-mono">#{orderNumber}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Order Date</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Estimated Delivery</span>
                <span className="font-medium">{estimatedDelivery}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Amount</span>
                <span className="font-semibold text-lg">
                  ${orderData?.grand_total?.toFixed(2) || orderData?.totals?.total?.toFixed(2) || '0.00'}
                </span>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Order Items</h4>
                {orderData?.items?.map((item: any) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-12 h-12 rounded overflow-hidden">
                      <ImageWithFallback
                        src={item.product?.images?.[0]?.url || item.image || ''}
                        alt={item.name || item.product?.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm line-clamp-1">{item.name || item.product?.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-medium">
                      ${(item.row_total || (item.price * item.quantity)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* What's Next */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                What Happens Next?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Confirmation Email</h4>
                    <p className="text-sm text-muted-foreground">
                      Order confirmation sent to {orderData?.customer_email || orderData?.shipping?.email || 'your email'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Order Processing</h4>
                    <p className="text-sm text-muted-foreground">
                      Your order is being prepared in our Dubai warehouse
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Truck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Shipping & Delivery</h4>
                    <p className="text-sm text-muted-foreground">
                      Shipped to {orderData?.shipping_address?.city || orderData?.shipping?.city}, {orderData?.shipping_address?.state_province || orderData?.shipping?.district}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Button size="lg" className="w-full" onClick={onTrackOrder || (() => navigate('/orders'))}>
                  Track Your Order
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="outline" size="lg" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Receipt
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Support Section */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Need Help?</h3>
              <p className="text-muted-foreground mb-4">
                Our customer support team is here to help with any questions about your order.
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" size="sm">
                  <Phone className="h-4 w-4 mr-2" />
                  Call Support
                </Button>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Email Us
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Continue Shopping */}
        <div className="text-center mt-8">
          <Button size="lg" onClick={onContinueShopping || (() => navigate('/'))}>
            Continue Shopping
          </Button>
        </div>
      </div>
    </div>
  );
}