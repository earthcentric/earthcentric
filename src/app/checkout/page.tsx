"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, Input, Label, Badge, LiquidButton, MetalButton } from "@/components/ui/shared";
import { createOrder, confirmOrderPayment, AddressInput } from "@/actions/orders";
import { getRazorpayKeyId } from "@/actions/credentials";
import { ShieldCheck, ShoppingBag, CreditCard, ArrowLeft, Leaf, Loader2 } from "lucide-react";

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Address Form State
  const [street, setStreet] = useState("14 Green Ridge Lane");
  const [city, setCity] = useState("Bangalore");
  const [state, setState] = useState("Karnataka");
  const [postalCode, setPostalCode] = useState("560001");
  const [country, setCountry] = useState("India");

  // Payment Status Simulator State
  const [showMockGateway, setShowMockGateway] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeRazorpayOrderId, setActiveRazorpayOrderId] = useState<string | null>(null);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please log in to complete your purchase.");
      return;
    }

    if (cart.length === 0) return;

    startTransition(async () => {
      const address: AddressInput = { street, city, state, postalCode, country };
      const items = cart.map((item) => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        sellerId: item.sellerId,
      }));

      // Call server action to create Order & Razorpay ID
      const res = await createOrder({
        userId: user.id,
        userEmail: user.email,
        address,
        items,
        totalAmount: cartTotal,
      });

      if (!res.success || !res.order) {
        alert("Failed to initialize order payment. Try again.");
        return;
      }

      setActiveOrderId(res.order.id);
      setActiveRazorpayOrderId(res.razorpayOrderId);

      // If Razorpay ID is mock-generated, open our custom overlay simulator. Otherwise trigger real Razorpay checkout
      if (res.razorpayOrderId.startsWith("order_mock_")) {
        setShowMockGateway(true);
      } else {
        await openRealRazorpaySDK(res.order.id, res.razorpayOrderId);
      }
    });
  };

  const openRealRazorpaySDK = async (orderId: string, razorpayOrderId: string) => {
    const razorpayKeyId = await getRazorpayKeyId();
    const options = {
      key: razorpayKeyId,
      amount: cartTotal * 100,
      currency: "INR",
      name: "EarthCentric",
      description: "Sustainable Catalog Checkout",
      order_id: razorpayOrderId,
      handler: async function (response: any) {
        const success = await confirmOrderPayment(
          orderId,
          response.razorpay_payment_id,
          response.razorpay_signature,
          user?.email || "buyer@earthcentric.com"
        );

        if (success) {
          clearCart();
          router.push(`/orders/${orderId}`);
        } else {
          alert("Payment signature verification failed.");
        }
      },
      prefill: {
        name: user?.name,
        email: user?.email,
      },
      theme: {
        color: "#1F3A2E",
      },
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  // Mock Gateway Sandbox Handlers
  const handleSimulatePaymentSuccess = async () => {
    if (!activeOrderId || !activeRazorpayOrderId) return;
    
    setShowMockGateway(false);
    startTransition(async () => {
      const mockPaymentId = `pay_${Math.random().toString(36).substring(2, 10)}`;
      const mockSignature = `sig_${Math.random().toString(36).substring(2, 10)}`;

      // Confirm with Server Action
      const success = await confirmOrderPayment(
        activeOrderId,
        mockPaymentId,
        mockSignature,
        user?.email || "buyer@earthcentric.com"
      );

      if (success) {
        clearCart();
        router.push(`/orders/${activeOrderId}`);
      } else {
        alert("Simulated transaction check failed.");
      }
    });
  };

  const handleSimulatePaymentFailure = () => {
    setShowMockGateway(false);
    alert("Simulated payment transaction cancelled or failed.");
  };

  if (cart.length === 0 && !activeOrderId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center space-y-6">
        <h2 className="text-xl font-bold">Checkout is unavailable</h2>
        <p className="text-sm text-muted-foreground">Please add items to your cart first.</p>
        <LiquidButton size="lg" className="mx-auto" onClick={() => router.push("/marketplace")}>Shop Marketplace</LiquidButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Razorpay Script Injection */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="flex items-center space-x-2">
        <button onClick={() => router.back()} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Cart</span>
        </button>
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">Secure Checkout</h1>

      <form onSubmit={handleCheckoutSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Delivery Address (Stripe style layout) */}
        <div className="lg:col-span-7">
          <Card className="border-border/40 p-6 space-y-6 bg-card">
            <h3 className="font-bold text-sm text-primary uppercase tracking-wider flex items-center space-x-2 border-b border-border/20 pb-3">
              <CreditCard className="h-4 w-4" />
              <span>Shipping Address Details</span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Street Address</Label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>City</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>State / Province</Label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Postal / ZIP Code</Label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>Country</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} required />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Order summary and Payment */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border/60 bg-card p-6 space-y-6 shadow-sm">
            <h3 className="font-bold text-base text-primary border-b border-border/30 pb-3">Review Items</h3>
            
            <div className="space-y-3 max-h-56 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-xs">
                  <div className="truncate pr-4 flex-1">
                    <span className="font-bold text-foreground">{item.quantity}x</span> {item.name}
                  </div>
                  <span className="font-semibold text-foreground shrink-0">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border/30 pt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Subtotal</span>
                <span>₹{cartTotal}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Shipping Carbon Offset Fee</span>
                <span>SPONSORED</span>
              </div>
              <div className="flex justify-between border-t border-border/30 pt-3 text-sm font-bold text-foreground">
                <span>Amount Due</span>
                <span>₹{cartTotal}</span>
              </div>
            </div>

            <MetalButton
              type="submit"
              variant="success"
              className="w-full py-3 flex items-center justify-center space-x-2"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  <span>Processing Verification...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4.5 w-4.5" />
                  <span>Authorize & Pay ₹{cartTotal}</span>
                </>
              )}
            </MetalButton>
          </Card>
        </div>
      </form>

      {/* MOCK PAYMENT GATEWAY MODAL SANDBOX */}
      {showMockGateway && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Card className="max-w-md w-full border-border/60 shadow-2xl bg-card rounded-2xl overflow-hidden p-6 space-y-6">
            <div className="text-center space-y-2">
              <Badge variant="premium" className="bg-primary/10 text-primary border-none">
                Razorpay Sandbox Emulator
              </Badge>
              <h3 className="font-extrabold text-xl text-primary">Simulate Payment Auth</h3>
              <p className="text-xs text-muted-foreground">
                EarthCentric is running in development fallback mode. Please authorize your mock order payment below.
              </p>
            </div>

            <div className="bg-muted/30 border border-border/40 p-4 rounded-xl space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">EarthCentric Order ID:</span>
                <span className="font-mono font-semibold">{activeOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Razorpay Order ID:</span>
                <span className="font-mono font-semibold">{activeRazorpayOrderId}</span>
              </div>
              <div className="flex justify-between border-t border-border/30 pt-2 font-bold">
                <span>Amount Charged:</span>
                <span className="text-primary">₹{cartTotal}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="destructive" className="w-full text-xs" onClick={handleSimulatePaymentFailure}>
                Cancel / Fail
              </Button>
              <MetalButton variant="success" className="w-full text-xs justify-center flex text-center" onClick={handleSimulatePaymentSuccess}>
                Authorize Success
              </MetalButton>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
