"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, Input, Label, Badge, LiquidButton, MetalButton } from "@/components/ui/shared";
import { createOrder, confirmOrderPayment, AddressInput } from "@/actions/orders";
import { getRazorpayKeyId } from "@/actions/credentials";
import { getUserAddresses, addUserAddress, AddressData } from "@/actions/profile";
import { ShieldCheck, ShoppingBag, CreditCard, ArrowLeft, Leaf, Loader2, MapPin, Plus, Check, Star } from "lucide-react";
import Link from "next/link";

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<AddressData[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);

  // New address form state
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("India");
  const [savingAddress, setSavingAddress] = useState(false);

  // Payment Status Simulator State
  const [showMockGateway, setShowMockGateway] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeRazorpayOrderId, setActiveRazorpayOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      getUserAddresses(user.id).then((addrs) => {
        setSavedAddresses(addrs);
        const def = addrs.find((a) => a.isDefault) || addrs[0];
        if (def?.id) setSelectedAddressId(def.id);
        if (addrs.length === 0) setShowNewAddressForm(true);
        setAddressesLoading(false);
      });
    } else {
      setAddressesLoading(false);
      setShowNewAddressForm(true);
    }
  }, [user]);

  const handleSaveNewAddress = async () => {
    if (!street || !city || !state || !postalCode || !country) {
      alert("Please fill in all address fields.");
      return;
    }
    if (!user) return;
    setSavingAddress(true);
    const res = await addUserAddress(user.id, { street, city, state, postalCode, country });
    setSavingAddress(false);
    if (res.success && res.address) {
      setSavedAddresses((prev) => [...prev, res.address!]);
      setSelectedAddressId(res.address.id!);
      setShowNewAddressForm(false);
    }
  };

  const getSelectedAddress = (): AddressInput | null => {
    if (selectedAddressId) {
      const addr = savedAddresses.find((a) => a.id === selectedAddressId);
      if (addr) return { street: addr.street, city: addr.city, state: addr.state, postalCode: addr.postalCode, country: addr.country };
    }
    if (showNewAddressForm && street && city && state && postalCode && country) {
      return { street, city, state, postalCode, country };
    }
    return null;
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please log in to complete your purchase.");
      return;
    }
    if (cart.length === 0) return;

    const address = getSelectedAddress();
    if (!address) {
      alert("Please select or add a delivery address.");
      return;
    }

    startTransition(async () => {
      const address = getSelectedAddress()!;
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
        {/* Left Column: Delivery Address */}
        <div className="lg:col-span-7">
          <Card className="border-border/40 p-6 space-y-5 bg-card">
            <h3 className="font-bold text-sm text-primary uppercase tracking-wider flex items-center space-x-2 border-b border-border/20 pb-3">
              <CreditCard className="h-4 w-4" />
              <span>Delivery Address</span>
            </h3>

            {addressesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Saved Address Cards */}
                {savedAddresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => { setSelectedAddressId(addr.id!); setShowNewAddressForm(false); }}
                    className={`w-full text-left rounded-xl border p-4 transition ${
                      selectedAddressId === addr.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/40 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedAddressId === addr.id ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}>
                        {selectedAddressId === addr.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        {addr.isDefault && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full mr-2">Default</span>
                        )}
                        <p className="text-sm font-medium text-foreground">{addr.street}</p>
                        <p className="text-xs text-muted-foreground">{addr.city}, {addr.state} — {addr.postalCode}, {addr.country}</p>
                      </div>
                    </div>
                  </button>
                ))}

                {/* Add New Address Toggle */}
                {savedAddresses.length > 0 && !showNewAddressForm && (
                  <button
                    type="button"
                    onClick={() => { setShowNewAddressForm(true); setSelectedAddressId(null); }}
                    className="w-full flex items-center gap-2 rounded-xl border border-dashed border-primary/30 px-4 py-3 text-sm text-primary hover:bg-primary/5 transition"
                  >
                    <Plus className="h-4 w-4" /> Use a different / new address
                  </button>
                )}

                {/* New Address Inline Form */}
                {showNewAddressForm && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs font-semibold text-primary mb-2">Enter New Address</p>
                    <div className="space-y-1">
                      <Label>Street Address</Label>
                      <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="e.g. 14 Green Ridge Lane" required={!selectedAddressId} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} required={!selectedAddressId} /></div>
                      <div className="space-y-1"><Label>State</Label><Input value={state} onChange={(e) => setState(e.target.value)} required={!selectedAddressId} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>Postal Code</Label><Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required={!selectedAddressId} /></div>
                      <div className="space-y-1"><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} required={!selectedAddressId} /></div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {user && (
                        <button
                          type="button"
                          onClick={handleSaveNewAddress}
                          disabled={savingAddress}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition disabled:opacity-60"
                        >
                          {savingAddress ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Save & Use This Address
                        </button>
                      )}
                      {savedAddresses.length > 0 && (
                        <button type="button" onClick={() => { setShowNewAddressForm(false); const def = savedAddresses.find(a => a.isDefault) || savedAddresses[0]; setSelectedAddressId(def?.id ?? null); }} className="px-3 py-2 rounded-lg border text-xs text-muted-foreground hover:bg-muted/30 transition">
                          Cancel
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Or <Link href="/account" className="underline text-primary">manage addresses</Link> in your account to save them for future orders.
                    </p>
                  </div>
                )}
              </div>
            )}
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
