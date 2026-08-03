"use client";

import React from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { Button, Card, Badge, LiquidButton } from "@/components/ui/shared";
import { FadeIn, ScaleHover } from "@/components/FramerComponents";
import { Trash2, ShoppingBag, ArrowLeft, ArrowRight, Minus, Plus, Leaf, Shield } from "lucide-react";
import { isBuyXGetYActive, calculateBuyXGetYFreeItems, getEffectiveUnitPrice } from "@/lib/offers";

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, cartTotal, cartCount } = useCart();

  // Calculate carbon offset estimate (e.g. 1 item saves 2kg CO2 on average)
  const co2Savings = cart.reduce((total, item) => total + item.quantity * 2.4, 0);

  // Total free items & savings calculation
  const totalFreeItems = cart.reduce((acc, item) => acc + calculateBuyXGetYFreeItems(item.quantity, item.buyXGetYOffer), 0);
  const totalFreeSavings = cart.reduce((acc, item) => acc + calculateBuyXGetYFreeItems(item.quantity, item.buyXGetYOffer) * item.price, 0);

  // Total unit discount savings (Individual Discount & Tier Discount)
  const totalUnitSavings = cart.reduce((acc, item) => {
    const effective = getEffectiveUnitPrice(item, item.quantity);
    return acc + (effective.originalPrice - effective.unitPrice) * item.quantity;
  }, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="flex items-center space-x-2">
        <Link href="/marketplace" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Catalog</span>
        </Link>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-primary">Your Basket</h1>

      {cart.length === 0 ? (
        <Card className="p-16 text-center space-y-6 max-w-2xl mx-auto border-border/40">
          <div className="h-16 w-16 bg-muted/40 rounded-full flex items-center justify-center text-muted-foreground mx-auto">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">Your cart is empty</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Choose from our curated marketplace of verified sustainable suppliers, organic clothing weavers, and eco-friendly home designers.
            </p>
          </div>
          <Link href="/marketplace">
            <LiquidButton size="lg" className="mx-auto">Shop Sustainable Goods</LiquidButton>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Items list */}
          <div className="lg:col-span-8 space-y-4">
            {cart.map((item) => (
              <Card key={item.id} className="border-border/40 bg-card p-5 flex flex-col sm:flex-row items-center gap-5">
                <Link href={`/products/${item.id}`} className="shrink-0 hover:opacity-90 transition-opacity">
                  <img
                    src={item.image || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600"}
                    alt={item.name}
                    className="h-20 w-20 rounded-xl object-cover border border-border/20 shrink-0 cursor-pointer"
                  />
                </Link>
                
                <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
                  {(() => {
                    const effective = getEffectiveUnitPrice(item, item.quantity);
                    const itemTotal = effective.unitPrice * item.quantity;
                    return (
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                        <div>
                          <Link href={`/products/${item.id}`} className="hover:text-primary transition-colors truncate">
                            <h3 className="font-bold text-sm text-foreground truncate cursor-pointer">{item.name}</h3>
                          </Link>
                          <div className="flex items-baseline space-x-2 mt-0.5">
                            <span className="text-xs font-bold text-foreground">₹{effective.unitPrice.toLocaleString()} / unit</span>
                            {effective.appliedDiscountType !== "NONE" && (
                              <span className="text-[11px] text-muted-foreground line-through">₹{effective.originalPrice.toLocaleString()}</span>
                            )}
                            {effective.badgeText && (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-bold border-none px-1.5 py-0.5">{effective.badgeText}</Badge>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-bold sm:ml-4 text-emerald-700 shrink-0">₹{itemTotal.toLocaleString()}</span>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground">by {item.sellerName}</p>
                  
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
                    <Badge variant="primary" className="text-[10px] bg-primary/10 text-primary border-none">
                      🌿 Sustainable Verified
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/40">
                      Carbon Neutral
                    </Badge>
                  </div>

                  {/* Buy X Get Y Offer Breakdown */}
                  {isBuyXGetYActive(item.buyXGetYOffer) && (() => {
                    const buyQty = item.buyXGetYOffer!.buyQuantity;
                    const getQty = item.buyXGetYOffer!.getQuantity;
                    const freeItems = calculateBuyXGetYFreeItems(item.quantity, item.buyXGetYOffer);
                    const savings = freeItems * item.price;
                    const neededForNext = buyQty - (item.quantity % buyQty);

                    return (
                      <div className="mt-3 p-3.5 rounded-2xl bg-[#f0f7f2] border border-[#2d4a36]/30 space-y-1.5 text-xs shadow-xs">
                        <div className="flex items-center justify-between font-extrabold text-[#1f3a2e]">
                          <span className="flex items-center gap-1.5 text-sm">
                            <span>🎁</span>
                            <span>Buy {buyQty} Get {getQty} FREE</span>
                          </span>
                          {freeItems > 0 && (
                            <span className="bg-[#2d4a36] text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              +{freeItems} Free Item{freeItems > 1 ? "s" : ""} Earned! 🎉
                            </span>
                          )}
                        </div>

                        <p className="text-[#2d4a36] font-medium text-[11.5px]">
                          Purchase {buyQty} items and receive {getQty} item free.
                        </p>

                        {freeItems > 0 ? (
                          <div className="space-y-1 pt-1 border-t border-[#c8e2d0]">
                            <p className="text-[#1f3a2e] font-semibold text-xs">
                              You currently qualify for <strong>{freeItems}</strong> free item{freeItems > 1 ? "s" : ""}.
                            </p>
                            <div className="flex items-center justify-between text-xs pt-0.5">
                              <span className="text-[#2d4a36] font-medium">
                                Total delivered: <strong>{item.quantity + freeItems}</strong> ({item.quantity} paid + {freeItems} free)
                              </span>
                              <span className="text-emerald-700 font-extrabold text-sm">
                                You save ₹{savings.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 font-semibold mt-1">
                            Add <strong>{neededForNext}</strong> more item{neededForNext > 1 ? "s" : ""} to qualify for <strong>{getQty} free item{getQty > 1 ? "s" : ""}</strong>!
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center space-x-6 shrink-0">
                  {/* Quantity selector */}
                  <div className="flex items-center space-x-1.5 border border-border/60 rounded-md bg-muted/20 px-1 py-0.5">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1 hover:bg-muted rounded text-muted-foreground cursor-pointer font-semibold"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-xs font-semibold px-2 text-center min-w-[20px]">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="p-1 hover:bg-muted rounded text-muted-foreground cursor-pointer font-semibold"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 hover:text-red-700 p-2 hover:bg-red-500/5 rounded-full cursor-pointer transition-colors"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              </Card>
            ))}

            {/* Patagonia-style CO2 savings banner */}
            <Card className="border-accent/40 bg-accent/5 p-5 flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center text-primary shrink-0">
                <Leaf className="h-5 w-5 fill-accent stroke-primary" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-primary uppercase tracking-wider">Your Environmental Impact</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  By sourcing from EarthCentric verified partners instead of standard retailers, this order diverts an estimated <span className="font-bold text-primary">{co2Savings.toFixed(1)} kg of CO2 emissions</span> from entering our atmosphere.
                </p>
              </div>
            </Card>
          </div>

          {/* Cart Summary */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-border/60 bg-card p-6 space-y-6 shadow-sm">
              <h3 className="font-bold text-base text-primary border-b border-border/30 pb-3">Order Summary</h3>
              
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal ({cartCount} items)</span>
                  <span className="font-semibold text-foreground">₹{cartTotal}</span>
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
                  <div className="flex justify-between text-emerald-700 bg-emerald-50 p-2 rounded-lg font-bold border border-emerald-100">
                    <span className="flex items-center gap-1">
                      <span>🎁</span>
                      <span>Buy X Get Y Free Items</span>
                    </span>
                    <span>+{totalFreeItems} Items (Save ₹{totalFreeSavings.toLocaleString()})</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Verified Packing (Recyclable Box)</span>
                  <span className="text-emerald-600 font-semibold uppercase tracking-wider">FREE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Logistics (Carbon Offset Ship)</span>
                  <span className="text-emerald-600 font-semibold uppercase tracking-wider">FREE</span>
                </div>
                <div className="flex justify-between border-t border-border/30 pt-3 text-sm font-bold text-foreground">
                  <span>Grand Total</span>
                  <span>₹{cartTotal}</span>
                </div>
              </div>

              <div className="pt-2">
                <Link href="/checkout" className="w-full block">
                  <LiquidButton size="lg" className="w-full justify-center flex items-center space-x-2">
                    <span>Proceed to Secure Checkout</span>
                    <ArrowRight className="h-4 w-4" />
                  </LiquidButton>
                </Link>
              </div>

              <div className="flex items-center justify-center space-x-2 text-[10px] text-muted-foreground pt-1 bg-muted/20 p-2.5 rounded">
                <Shield className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Protected by Razorpay secure checkout. Verified brand catalog.</span>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
