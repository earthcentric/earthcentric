"use client";

import React from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { Button, Card, Badge, LiquidButton } from "@/components/ui/shared";
import { FadeIn, ScaleHover } from "@/components/FramerComponents";
import { Trash2, ShoppingBag, ArrowLeft, ArrowRight, Minus, Plus, Leaf, Shield } from "lucide-react";

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, cartTotal, cartCount } = useCart();

  // Calculate carbon offset estimate (e.g. 1 item saves 2kg CO2 on average)
  const co2Savings = cart.reduce((total, item) => total + item.quantity * 2.4, 0);

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
                <img
                  src={item.image || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600"}
                  alt={item.name}
                  className="h-20 w-20 rounded-xl object-cover border border-border/20 shrink-0"
                />
                
                <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                    <h3 className="font-bold text-sm text-foreground truncate">{item.name}</h3>
                    <span className="text-sm font-bold sm:ml-4 text-foreground">₹{item.price * item.quantity}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">by {item.sellerName}</p>
                  
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
                    <Badge variant="primary" className="text-[10px] bg-primary/10 text-primary border-none">
                      🌿 Eco Score: {item.sustainabilityScore}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/40">
                      Carbon Neutral
                    </Badge>
                  </div>
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
