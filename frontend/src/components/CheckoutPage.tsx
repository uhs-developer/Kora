import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "urql";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import {
  CreditCard,
  Smartphone,
  Building2,
  Lock,
  ArrowLeft,
  Check,
  Truck,
  Shield
} from "lucide-react";
import { CartItem } from "./ShoppingCart";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { toast } from "sonner";
import { isSandboxPayment } from "../config/paymentConfig";
import { PLACE_ORDER, INITIALIZE_PAYMENT } from "../graphql/storefront";
import { encryptCardDetails } from "../utils/flutterwaveEncryption";
import { getErrorMessage } from "../utils/errorHandler";

interface CheckoutPageProps {
  items: CartItem[];
  onBack: () => void;
  onPlaceOrder?: (orderData: any) => void;
}

export function CheckoutPage({ items, onBack, onPlaceOrder }: CheckoutPageProps) {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { cart, refreshCart } = useCart();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // GraphQL mutations
  const [, placeOrderMutation] = useMutation(PLACE_ORDER);
  const [, initializePaymentMutation] = useMutation(INITIALIZE_PAYMENT);
  const [formData, setFormData] = useState({
    // Shipping Information
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    district: "",
    postalCode: "",
    // Payment Information
    paymentMethod: "card",
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardName: "",
    // Mobile Money
    mobileNumber: "",
    mobileProvider: "",
    // Additional
    saveInfo: false,
    differentBilling: false,
    agreeTerms: false,
  });

  // Autofill from authenticated user profile on initial load / when user changes
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    setFormData(prev => ({
      ...prev,
      firstName: prev.firstName || (user as any).first_name || (user as any).name?.split(" ")[0] || "",
      lastName:
        prev.lastName ||
        (user as any).last_name ||
        ((user as any).name && (user as any).name.split(" ").slice(1).join(" ")) ||
        "",
      email: prev.email || (user as any).email || "",
      phone: prev.phone || (user as any).phone || "",
      address: prev.address || (user as any).default_address?.street || "",
      city: prev.city || (user as any).default_address?.city || "",
      district: prev.district || (user as any).default_address?.district || "",
      postalCode: prev.postalCode || (user as any).default_address?.postcode || "",
    }));
  }, [isAuthenticated, user]);

  // Use cart totals from GraphQL if available, otherwise calculate from items
  const subtotal = cart?.subtotal || items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = cart?.shipping_amount || (subtotal > 500 ? 0 : 50);
  const tax = cart?.tax_amount || subtotal * 0.05;
  const discount = cart?.discount_amount || 0;
  const total = cart?.grand_total || (subtotal + shipping + tax - discount);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!formData.agreeTerms) {
      toast.error("Please agree to the terms and conditions");
      return;
    }

    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || 
        !formData.address || !formData.city || !formData.district) {
      toast.error("Please fill in all required shipping information");
      return;
    }

    if (!cart || cart.items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    try {
      setIsSubmitting(true);

      // Format addresses according to AddressInput type
      const billingAddress = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        company: "",
        street_address: formData.address,
        street_address_2: "",
        city: formData.city,
        state_province: formData.district,
        postal_code: formData.postalCode || "",
        country: "RW", // Rwanda
        phone: formData.phone,
      };

      const shippingAddress = {
        ...billingAddress,
        // Could be different if differentBilling is true, but for now use same
      };

      // Determine payment method for GraphQL
      let paymentMethod = "cash_on_delivery"; // Default
      if (formData.paymentMethod === "card") {
        paymentMethod = "credit_card";
      } else if (formData.paymentMethod === "mobile") {
        paymentMethod = formData.mobileProvider === "mtn" ? "mtn_momo" : "airtel_money";
      } else if (formData.paymentMethod === "bank") {
        paymentMethod = "bank_transfer";
      }

      // Call GraphQL mutation
      const result = await placeOrderMutation({
        payment_method: paymentMethod,
        shipping_method: "standard", // TODO: Get from cart or user selection
        billing_address: billingAddress,
        shipping_address: shippingAddress,
        customer_note: formData.agreeTerms ? "Order placed via checkout" : null,
      });

      if (result.error) {
        const errorMessage = getErrorMessage(result.error);
        throw new Error(errorMessage);
      }

      if (result.data?.placeOrder) {
        const order = result.data.placeOrder;
        
        // Refresh cart to clear it
        refreshCart();
        
        // Initialize payment if payment method requires it (not cash on delivery)
        if (paymentMethod !== 'cash_on_delivery' && paymentMethod !== 'bank_transfer') {
          try {
            // For card payments, we need encrypted card details
            // TODO: Implement card encryption before sending
            let encryptedCardData: {
              encrypted_card_number: string;
              encrypted_expiry_month: string;
              encrypted_expiry_year: string;
              encrypted_cvv: string;
              nonce: string;
            } | null = null;
            
            if (paymentMethod === 'credit_card' && formData.paymentMethod === 'card') {
              // Card details need to be encrypted on frontend
              if (formData.cardNumber && formData.expiryDate && formData.cvv) {
                try {
                  const encryptionKey = import.meta.env.VITE_FLUTTERWAVE_ENCRYPTION_KEY;
                  if (!encryptionKey) {
                    toast.error('Flutterwave encryption key not configured. Please contact support.');
                    setIsSubmitting(false);
                    return;
                  }
                  
                  // Parse expiry date (format: MM/YY or MM/YYYY)
                  const expiryParts = formData.expiryDate.split('/').map(part => part.trim());
                  if (expiryParts.length !== 2) {
                    toast.error('Invalid expiry date format. Please use MM/YY or MM/YYYY');
                    setIsSubmitting(false);
                    return;
                  }
                  
                  const [expiryMonth, expiryYear] = expiryParts;
                  
                  // Encrypt card details
                  encryptedCardData = await encryptCardDetails(
                    formData.cardNumber,
                    expiryMonth,
                    expiryYear,
                    formData.cvv,
                    encryptionKey
                  );
                } catch (encryptionError: any) {
                  console.error('Card encryption error:', encryptionError);
                  const errorMessage = getErrorMessage(encryptionError);
                  toast.error(errorMessage || 'Failed to encrypt card details. Please check your card information and try again.');
                  setIsSubmitting(false);
                  return;
                }
              } else {
                toast.error('Please fill in all card details');
                setIsSubmitting(false);
                return;
              }
            }
            
            const paymentResult = await initializePaymentMutation({
              order_number: order.order_number,
              payment_method: paymentMethod,
              customer_phone: formData.phone,
              mobile_number: formData.paymentMethod === 'mobile' ? formData.mobileNumber : null,
              // Card encryption fields (will be null for mobile money)
              encrypted_card_number: encryptedCardData?.encrypted_card_number || null,
              encrypted_expiry_month: encryptedCardData?.encrypted_expiry_month || null,
              encrypted_expiry_year: encryptedCardData?.encrypted_expiry_year || null,
              encrypted_cvv: encryptedCardData?.encrypted_cvv || null,
              nonce: encryptedCardData?.nonce || null,
            });

            if (paymentResult.error) {
              const errorMessage = getErrorMessage(paymentResult.error);
              throw new Error(errorMessage);
            }

            const paymentInit = paymentResult.data?.initializePayment;
            
            // Step 4: Handle payment response based on payment method and next_action
            // For card payments, we MUST wait for 3DS redirect - don't show success yet
            if (paymentInit?.payment_url) {
              // Card payment with 3DS redirect flow (Step 4.2)
              toast.info('Redirecting to payment gateway for authentication...', {
                duration: 3000,
              });
              // IMPORTANT: Redirect immediately - don't navigate to thank you page
              // The callback will redirect to thank you page after 3DS authentication
              window.location.href = paymentInit.payment_url;
              setIsSubmitting(false);
              return; // Exit early - don't continue to thank you page
            } else if (paymentInit?.status === 'pending' && paymentInit?.next_action) {
              // Mobile Money push notification flow (Step 4.2-4.3)
              try {
                const nextAction = JSON.parse(paymentInit.next_action);
                
                if (nextAction.type === 'payment_instruction') {
                  // Step 4.2: Flutterwave sent MoMo push to user's phone
                  const instruction = nextAction.payment_instruction?.note || 
                    `Please authorize the payment on your ${formData.paymentMethod === 'mtn_momo' ? 'MTN' : 'Airtel'} mobile money account. Check your phone for a payment prompt.`;
                  
                  toast.info(instruction, {
                    duration: 8000, // Show longer for important instruction
                  });
                  
                  // Store payment info for thank you page
                  sessionStorage.setItem('pending_payment', JSON.stringify({
                    order_number: order.order_number,
                    charge_id: paymentInit.charge_id,
                    payment_method: formData.paymentMethod,
                    instruction: instruction,
                  }));
                } else {
                  toast.info('Payment initiated. Please check your mobile device to authorize the payment.', {
                    duration: 6000,
                  });
                }
              } catch (e) {
                // If parsing fails, show generic message
                toast.info('Payment initiated. Please check your mobile device to authorize the payment.', {
                  duration: 6000,
                });
              }
              // Step 4.4: Continue to thank you page - payment will be confirmed via webhook (Step 5-6)
              // Continue to navigation below
            } else if (paymentInit?.status === 'succeeded' || paymentInit?.status === 'successful') {
              // Payment already succeeded (rare - might happen in testing or if no 3DS required)
              // Only show success if it's NOT a card payment (card payments should always redirect)
              if (paymentMethod !== 'credit_card' && paymentMethod !== 'card' && paymentMethod !== 'debit_card') {
                toast.success('Payment successful!');
                // Continue to navigation below
              } else {
                // For card payments, even if status is succeeded, navigate to thank you with processing status
                // This might be a testing scenario
                console.warn('Card payment returned success without redirect - navigating to thank you page', paymentInit);
                toast.info('Payment processing... Redirecting to order confirmation.');
                // Store as pending payment so thank you page shows processing state
                sessionStorage.setItem('pending_payment', JSON.stringify({
                  order_number: order.order_number,
                  charge_id: paymentInit.charge_id,
                  payment_method: paymentMethod,
                  instruction: 'Payment is being processed. Please wait for confirmation.',
                }));
                // Continue to navigation below - will show processing state on thank you page
              }
            } else {
              // Payment initiated but status unknown or pending
              // For card payments without payment_url, navigate to thank you with processing status
              if (paymentMethod === 'credit_card' || paymentMethod === 'card' || paymentMethod === 'debit_card') {
                console.warn('Card payment initialized but no payment_url returned - navigating to thank you page', paymentInit);
                toast.info('Payment processing... Redirecting to order confirmation.');
                // Store as pending payment so thank you page shows processing state
                sessionStorage.setItem('pending_payment', JSON.stringify({
                  order_number: order.order_number,
                  charge_id: paymentInit.charge_id,
                  payment_method: paymentMethod,
                  instruction: 'Payment is being processed. Please wait for confirmation from the payment gateway.',
                }));
                // Continue to navigation below - will show processing state on thank you page
              } else {
                toast.success('Payment initiated successfully.');
                // Continue to navigation below
              }
            }
          } catch (paymentError: any) {
            console.error('Payment initialization error:', paymentError);
            const errorMessage = getErrorMessage(paymentError);
            toast.error(errorMessage || 'Payment initialization failed. Your order has been created but payment was not processed. You can retry payment from your order history.');
            // Continue to thank you page even if payment initialization fails
          }
        }
        
        // Only navigate to thank you page if:
        // 1. Payment method is NOT card (cash on delivery, bank transfer, etc.)
        // 2. Mobile money (which shows pending view)
        // 3. Payment initialization failed (so user can retry)
        // For card payments with 3DS, we should have already redirected above
        
        // Call legacy callback if provided
        if (onPlaceOrder) {
          onPlaceOrder({
            order,
        items,
        shipping: formData,
        payment: {
          method: formData.paymentMethod,
        },
        totals: { subtotal, shipping, tax, total },
        timestamp: new Date(),
          });
        }
        
        // Navigate to thank you page (for cash on delivery, bank transfer, mobile money, or if payment init failed)
        // NOTE: Card payments with 3DS should have already redirected above
        navigate('/thank-you', { 
          state: { orderData: {
            ...order,
            items: order.items.map((item: any) => ({
              ...item,
              image: item.product?.images?.[0]?.url || '',
              name: item.name || item.product?.name,
              price: item.price,
              quantity: item.quantity,
            })),
            shipping: {
              email: formData.email,
              city: formData.city,
              district: formData.district,
            },
            totals: {
              total: order.grand_total,
            },
          }} 
        });
        
        toast.success(`Order ${order.order_number} placed successfully!`);
      }
    } catch (error: any) {
      console.error('Place order error:', error);
      toast.error(error.message || "Failed to place order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { id: 1, title: t("checkout.shipping"), icon: Truck },
    { id: 2, title: t("checkout.payment"), icon: CreditCard },
    { id: 3, title: t("checkout.review"), icon: Check },
  ];

  const rwandanDistricts = [
    "Kigali", "Nyanza", "Huye", "Muhanga", "Kamonyi", "Ruhango", "Nyaruguru",
    "Gisagara", "Nyamagabe", "Rusizi", "Nyamasheke", "Karongi", "Rutsiro",
    "Rubavu", "Nyabihu", "Ngororero", "Musanze", "Burera", "Gicumbi",
    "Rulindo", "Gakenke", "Gasabo", "Kicukiro", "Nyarugenge", "Rwamagana",
    "Nyagatare", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Bugesera"
  ];

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("checkout.backToCart")}
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t("checkout.title")}</h1>
          <p className="text-muted-foreground">{t("checkout.subtitle")}</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              currentStep >= step.id 
                ? 'bg-primary border-primary text-primary-foreground' 
                : 'border-muted-foreground text-muted-foreground'
            }`}>
              {currentStep > step.id ? (
                <Check className="h-5 w-5" />
              ) : (
                <step.icon className="h-5 w-5" />
              )}
            </div>
            <span className={`ml-2 ${currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'}`}>
              {step.title}
            </span>
            {index < steps.length - 1 && (
              <div className={`w-16 h-0.5 mx-4 ${
                currentStep > step.id ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2">
          {/* Step 1: Shipping Information */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  {t("checkout.shippingInformation")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">{t("checkout.firstName")} *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">{t("checkout.lastName")} *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">{t("checkout.emailAddress")} *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">{t("checkout.phoneNumber")} *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+250 XXX XXX XXX"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Street Address *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="House number, street name"
                    required
                  />
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City/Town *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="district">District *</Label>
                    <Select value={formData.district} onValueChange={(value) => handleInputChange('district', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {rwandanDistricts.map((district) => (
                          <SelectItem key={district} value={district}>
                            {district}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={formData.postalCode}
                      onChange={(e) => handleInputChange('postalCode', e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="saveInfo"
                    checked={formData.saveInfo}
                    onCheckedChange={(checked) => handleInputChange('saveInfo', checked as boolean)}
                  />
                  <Label htmlFor="saveInfo" className="text-sm">
                    Save this information for faster checkout next time
                  </Label>
                </div>

                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={() => setCurrentStep(2)}
                  disabled={
                    !formData.firstName ||
                    !formData.lastName ||
                    !formData.email ||
                    !formData.phone ||
                    !formData.address ||
                    !formData.city ||
                    !formData.district
                  }
                >
                  {t("checkout.continueToPayment")}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Payment Information */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup 
                  value={formData.paymentMethod} 
                  onValueChange={(value) => handleInputChange('paymentMethod', value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Credit/Debit Card
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mobile" id="mobile" />
                    <Label htmlFor="mobile" className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Mobile Money
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bank" id="bank" />
                    <Label htmlFor="bank" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Bank Transfer
                    </Label>
                  </div>
                </RadioGroup>

                {formData.paymentMethod === 'card' && (
                  <div className="space-y-4 border rounded-lg p-4">
                    <div>
                      <Label htmlFor="cardName">Name on Card *</Label>
                      <Input
                        id="cardName"
                        value={formData.cardName}
                        onChange={(e) => handleInputChange('cardName', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="cardNumber">Card Number *</Label>
                      <Input
                        id="cardNumber"
                        placeholder="1234 5678 9012 3456"
                        value={formData.cardNumber}
                        onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expiryDate">Expiry Date *</Label>
                        <Input
                          id="expiryDate"
                          placeholder="MM/YY"
                          value={formData.expiryDate}
                          onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="cvv">CVV *</Label>
                        <Input
                          id="cvv"
                          placeholder="123"
                          value={formData.cvv}
                          onChange={(e) => handleInputChange('cvv', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.paymentMethod === 'mobile' && (
                  <div className="space-y-4 border rounded-lg p-4">
                    <div>
                      <Label htmlFor="mobileProvider">Mobile Provider *</Label>
                      <Select value={formData.mobileProvider} onValueChange={(value) => handleInputChange('mobileProvider', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mtn">MTN Rwanda</SelectItem>
                          <SelectItem value="airtel">Airtel Rwanda</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="mobileNumber">Mobile Number *</Label>
                      <Input
                        id="mobileNumber"
                        placeholder="+250 XXX XXX XXX"
                        value={formData.mobileNumber}
                        onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {formData.paymentMethod === 'bank' && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h4 className="font-medium mb-2">Bank Transfer Details</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      You will receive bank transfer instructions after placing your order.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 items-center">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={() => setCurrentStep(1)}
                  >
                    Back
                  </Button>
                  <Button 
                    size="lg" 
                    className="flex-1"
                    onClick={() => setCurrentStep(3)}
                  >
                    Review Order
                  </Button>
                </div>

                {isSandboxPayment && (
                  <p className="text-xs text-muted-foreground">
                    Sandbox checkout: payments are simulated using test data; you won&apos;t be charged.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Review Order */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  Review Your Order
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Order Items */}
                <div>
                  <h3 className="font-semibold mb-3">Order Items</h3>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-3 p-3 border rounded-lg">
                        <div className="w-16 h-16 rounded overflow-hidden">
                          <ImageWithFallback
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium line-clamp-1">{item.name}</h4>
                          <p className="text-sm text-muted-foreground">{item.brand}</p>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-sm">Qty: {item.quantity}</span>
                            <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Shipping Address */}
                <div>
                  <h3 className="font-semibold mb-2">Shipping Address</h3>
                  <div className="text-sm text-muted-foreground">
                    <p>{formData.firstName} {formData.lastName}</p>
                    <p>{formData.address}</p>
                    <p>{formData.city}, {formData.district}</p>
                    <p>{formData.phone}</p>
                    <p>{formData.email}</p>
                  </div>
                </div>

                <Separator />

                {/* Payment Method */}
                <div>
                  <h3 className="font-semibold mb-2">Payment Method</h3>
                  <div className="text-sm text-muted-foreground">
                    {formData.paymentMethod === 'card' && (
                      <p>Credit/Debit Card ending in {formData.cardNumber.slice(-4)}</p>
                    )}
                    {formData.paymentMethod === 'mobile' && (
                      <p>{formData.mobileProvider?.toUpperCase()} Mobile Money - {formData.mobileNumber}</p>
                    )}
                    {formData.paymentMethod === 'bank' && (
                      <p>Bank Transfer</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Terms and Conditions */}
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="agreeTerms"
                    checked={formData.agreeTerms}
                    onCheckedChange={(checked) => handleInputChange('agreeTerms', checked as boolean)}
                  />
                  <Label htmlFor="agreeTerms" className="text-sm leading-5">
                    I agree to the{" "}
                    <a href="#" className="text-primary hover:underline">Terms and Conditions</a>,{" "}
                    <a href="#" className="text-primary hover:underline">Privacy Policy</a>, and{" "}
                    <a href="#" className="text-primary hover:underline">Return Policy</a>
                  </Label>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={() => setCurrentStep(2)}
                  >
                    Back
                  </Button>
                  <Button 
                    size="lg" 
                    className="flex-1"
                    onClick={handleSubmit}
                    disabled={!formData.agreeTerms || isSubmitting}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {isSubmitting
                      ? t("checkout.placingOrder") ?? "Placing Order..."
                      : `${t("checkout.placeOrder") ?? "Place Order"} - $${total.toFixed(2)}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal ({items.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>

              {/* Security Features */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>SSL encrypted checkout</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Truck className="h-4 w-4" />
                  <span>7-14 day delivery to Rwanda</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}