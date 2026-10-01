"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, Input, Label, Badge, LiquidButton, MetalButton } from "@/components/ui/shared";
import { createOrder, confirmOrderPayment, AddressInput } from "@/actions/orders";
import { getCashfreeAppId } from "@/actions/credentials";
import { load } from '@cashfreepayments/cashfree-js';
import { getUserAddresses, addUserAddress, AddressData, getBuyerProfile, updateBuyerProfile } from "@/actions/profile";
import { ShieldCheck, ShoppingBag, CreditCard, ArrowLeft, Leaf, Loader2, MapPin, Plus, Check, Star, Phone } from "lucide-react";
import Link from "next/link";
import { calculateBuyXGetYFreeItems, getEffectiveUnitPrice } from "@/lib/offers";

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart } = useCart();
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Contact details
  const [contactPhone, setContactPhone] = useState(user?.phone || "");
  const [savePhoneToProfile, setSavePhoneToProfile] = useState(true);

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
  const [activeCashfreeOrderId, setActiveCashfreeOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (user.phone && !contactPhone) {
        setContactPhone(user.phone);
      } else if (user.id && !contactPhone) {
        getBuyerProfile(user.id, user.email).then((p) => {
          if (p?.phone) {
            setContactPhone(p.phone);
            updateUser({ phone: p.phone });
          }
        });
      }
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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strictly numeric digits, maximum 10 digits
    const cleanDigits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setContactPhone(cleanDigits);
  };

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
      // Re-fetch full address list to ensure UI is always in sync with DB
      const refreshed = await getUserAddresses(user.id);
      setSavedAddresses(refreshed);
      setSelectedAddressId(res.address.id!);
      setShowNewAddressForm(false);
      // Clear the form fields
      setStreet(""); setCity(""); setState(""); setPostalCode(""); setCountry("India");
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

    const digitsPhone = contactPhone.replace(/\D/g, "").slice(0, 10);
    if (!digitsPhone || digitsPhone.length !== 10) {
      alert("Please provide a valid 10-digit mobile number for order delivery & verification.");
      return;
    }

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

      // Call server action to create Order & Cashfree ID
      const res = await createOrder({
        userId: user.id,
        userEmail: user.email,
        userPhone: digitsPhone,
        address,
        items,
        totalAmount: cartTotal,
      });

      if (!res.success || !res.order) {
        alert((res as any)?.error || "Failed to initialize order payment. Try again.");
        return;
      }

      // Sync phone to profile if user opted in or if user had no phone registered
      if (savePhoneToProfile || !user.phone) {
        updateBuyerProfile(user.id, {
          name: user.name || "",
          phone: digitsPhone,
          email: user.email,
        }).catch(console.error);
        updateUser({ phone: digitsPhone });
      }

      setActiveOrderId(res.order.id);
      setActiveCashfreeOrderId(res.cashfreeOrderId);

      if (res.cashfreeOrderId.startsWith("order_mock_")) {
        setShowMockGateway(true);
      } else {
        await openRealCashfreeSDK(res.order.id, res.paymentSessionId);
      }
    });
  };

  const openRealCashfreeSDK = async (orderId: string, paymentSessionId: string) => {
    const cashfree = await load({
      mode: process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT === "PRODUCTION" ? "production" : "sandbox"
    });

    let checkoutOptions = {
      paymentSessionId: paymentSessionId,
      redirectTarget: "_modal",
    };

    cashfree.checkout(checkoutOptions).then(async (result: any) => {
      if (result.error) {
        console.error("Payment error:", result.error);
        alert("Payment was cancelled or failed.");
      }
      if (result.paymentDetails) {
        // Call backend to verify payment status
        const success = await confirmOrderPayment(
          orderId,
          "cashfree",
          "handled-by-backend",
          user?.email || "buyer@earthcentric.com"
        );

        if (success) {
          clearCart();
          router.push(`/orders/${orderId}`);
        } else {
          alert("Payment signature verification failed.");
        }
      }
    });
  };

  // Mock Gateway Sandbox Handlers
  const handleSimulatePaymentSuccess = async () => {
    if (!activeOrderId || !activeCashfreeOrderId) return;
    
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
      {/* Cashfree handles script injection via the npm package internally */}

      <div className="flex items-center space-x-2">
        <button onClick={() => router.back()} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Cart</span>
        </button>
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">Secure Checkout</h1>

      <form onSubmit={handleCheckoutSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Contact Details & Delivery Address */}
        <div className="lg:col-span-7 space-y-6">
          {/* Contact Details Card */}
          <Card className="border-border/40 p-6 space-y-4 bg-card shadow-xs">
            <div className="flex items-center justify-between border-b border-border/20 pb-3">
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider flex items-center space-x-2">
                <Phone className="h-4 w-4" />
                <span>Contact & Delivery Mobile</span>
              </h3>
              <span className="text-[11px] font-mono text-muted-foreground font-semibold">
                {contactPhone.length}/10 digits
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                  Mobile Number for Order & Delivery <span className="text-red-500">*</span>
                </Label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-lg pointer-events-none select-none z-10">
                    <span className="text-sm">🇮🇳</span>
                    <span className="tracking-tight">+91</span>
                  </div>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    value={contactPhone}
                    onChange={handlePhoneChange}
                    placeholder="9876543210"
                    className="pl-20 font-mono tracking-widest text-sm font-semibold"
                    required
                  />
                </div>
                {contactPhone.length > 0 && contactPhone.length < 10 && (
                  <p className="text-[11px] text-amber-600 mt-1.5 font-semibold flex items-center gap-1">
                    <span>⚠️</span> Please enter a valid 10-digit number ({10 - contactPhone.length} more needed).
                  </p>
                )}
                {contactPhone.length === 10 && (
                  <p className="text-[11px] text-emerald-600 mt-1.5 font-semibold flex items-center gap-1">
                    <span>✅</span> Valid 10-digit phone number. Pre-filled from your profile.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  Defaulted from your account profile. You can edit this number anytime for this order.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={savePhoneToProfile}
                  onChange={(e) => setSavePhoneToProfile(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-xs text-muted-foreground">
                  Update this mobile number in my profile for future checkouts
                </span>
              </label>
            </div>
          </Card>

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
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {cart.map((item) => {
                const freeCount = calculateBuyXGetYFreeItems(item.quantity, item.buyXGetYOffer);
                const itemSavings = freeCount * item.price;
                const totalDelivered = item.quantity + freeCount;
                const effective = getEffectiveUnitPrice(item, item.quantity);
                const itemPayable = effective.unitPrice * item.quantity;

                return (
                  <div key={item.id} className="space-y-1.5 border-b border-border/20 pb-3">
                    <div className="flex justify-between items-start text-xs">
                      <div className="pr-2 flex-1 min-w-0">
                        <p className="font-bold text-foreground truncate">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Purchased Qty: <strong className="text-foreground">{item.quantity}</strong>
                          {freeCount > 0 && <> • Free Qty: <strong className="text-emerald-700">+{freeCount}</strong></>}
                          {" "}• Delivered: <strong>{totalDelivered}</strong>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-foreground text-xs block">₹{itemPayable.toLocaleString()}</span>
                        {effective.appliedDiscountType !== "NONE" && (
                          <span className="text-[10px] text-muted-foreground line-through block">₹{(effective.originalPrice * item.quantity).toLocaleString()}</span>
                        )}
                      </div>
                    </div>

                    {effective.appliedDiscountType !== "NONE" && (
                      <div className="flex justify-between items-center text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg font-bold border border-emerald-100">
                        <span className="flex items-center gap-1">
                          <span>🏷️</span>
                          <span>{effective.badgeText || "Product Discount"}</span>
                        </span>
                        <span className="text-emerald-700">Save ₹{((effective.originalPrice - effective.unitPrice) * item.quantity).toLocaleString()}</span>
                      </div>
                    )}

                    {freeCount > 0 && (
                      <div className="flex justify-between items-center text-[11px] text-emerald-800 bg-[#f0f7f2] px-2.5 py-1 rounded-lg font-bold border border-[#c3decb]">
                        <span className="flex items-center gap-1">
                          <span>🎁</span>
                          <span>Buy {item.buyXGetYOffer?.buyQuantity} Get {item.buyXGetYOffer?.getQuantity} Free</span>
                        </span>
                        <span className="text-emerald-700">Save ₹{itemSavings.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {(() => {
              const totalPurchasedQty = cart.reduce((acc, item) => acc + item.quantity, 0);
              const totalFreeItems = cart.reduce((acc, item) => acc + calculateBuyXGetYFreeItems(item.quantity, item.buyXGetYOffer), 0);
              const totalFreeSavings = cart.reduce((acc, item) => acc + calculateBuyXGetYFreeItems(item.quantity, item.buyXGetYOffer) * item.price, 0);
              const totalUnitSavings = cart.reduce((acc, item) => {
                const effective = getEffectiveUnitPrice(item, item.quantity);
                return acc + (effective.originalPrice - effective.unitPrice) * item.quantity;
              }, 0);

              return (
                <div className="border-t border-border/30 pt-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Purchased Quantity</span>
                    <span className="font-semibold text-foreground">{totalPurchasedQty} Items</span>
                  </div>

                  {totalUnitSavings > 0 && (
                    <div className="flex justify-between text-emerald-700 bg-emerald-50 p-2 rounded-lg font-bold border border-emerald-100">
                      <span className="flex items-center gap-1">
                        <span>🏷️</span>
                        <span>Product Discount Savings</span>
                      </span>
                      <span>-₹{totalUnitSavings.toLocaleString()}</span>
                    </div>
                  )}

                  {totalFreeItems > 0 && (
                    <>
                      <div className="flex justify-between text-emerald-700 font-semibold">
                        <span>Free Items Earned</span>
                        <span>+{totalFreeItems} Items</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 bg-emerald-50 p-2 rounded-lg font-bold border border-emerald-100">
                        <span className="flex items-center gap-1">
                          <span>🎁</span>
                          <span>Free Offer Savings</span>
                        </span>
                        <span>-₹{totalFreeSavings.toLocaleString()}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Items Delivered</span>
                    <span className="font-semibold text-foreground">{totalPurchasedQty + totalFreeItems} Items</span>
                  </div>

                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Shipping Carbon Offset Fee</span>
                    <span>SPONSORED</span>
                  </div>
                  <div className="flex justify-between border-t border-border/30 pt-3 text-sm font-bold text-foreground">
                    <span>Final Amount Due</span>
                    <span>₹{cartTotal.toLocaleString()}</span>
                  </div>
                </div>
              );
            })()}

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
                Cashfree Sandbox Emulator
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
                <span className="text-muted-foreground">Cashfree Order ID:</span>
                <span className="font-mono font-semibold">{activeCashfreeOrderId}</span>
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
