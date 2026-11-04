"use client";

import React, { useEffect, useState } from "react";
import { getProductById, updateProductBulkPricingByAdmin } from "@/actions/products";
import { X, Package, ShieldCheck, Leaf, Tag, AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { Button, Badge } from "./shared";

export function AdminProductDetailModal({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Bulk Pricing Management State
  const [adminPrice, setAdminPrice] = useState("");
  const [adminTwoBoxPrice, setAdminTwoBoxPrice] = useState("");
  const [adminThreePlusBoxPrice, setAdminThreePlusBoxPrice] = useState("");
  const [adminMinBulkBoxes, setAdminMinBulkBoxes] = useState("2");
  const [adminMaxBulkBoxes, setAdminMaxBulkBoxes] = useState("");
  const [adminBulkApproved, setAdminBulkApproved] = useState(true);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getProductById(productId);
      setProduct(data);
      if (data) {
        setAdminPrice(data.price?.toString() || "2");
        setAdminTwoBoxPrice(data.twoBoxPrice !== undefined && data.twoBoxPrice !== null ? data.twoBoxPrice.toString() : "3.5");
        setAdminThreePlusBoxPrice(data.threePlusBoxPrice !== undefined && data.threePlusBoxPrice !== null ? data.threePlusBoxPrice.toString() : "1.6");
        setAdminMinBulkBoxes(data.minBulkBoxes?.toString() || "2");
        setAdminMaxBulkBoxes(data.maxBulkBoxes ? data.maxBulkBoxes.toString() : "");
        setAdminBulkApproved(data.bulkPricingApproved !== false);
      }
      setLoading(false);
    }
    load();
  }, [productId]);

  const handleSaveBulkPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBulk(true);
    setBulkFeedback(null);
    try {
      const res = await updateProductBulkPricingByAdmin(productId, {
        price: Number(adminPrice) || 2,
        twoBoxPrice: Number(adminTwoBoxPrice) || 3.5,
        threePlusBoxPrice: Number(adminThreePlusBoxPrice) || 1.6,
        minBulkBoxes: Number(adminMinBulkBoxes) || 2,
        maxBulkBoxes: adminMaxBulkBoxes ? Number(adminMaxBulkBoxes) : null,
        bulkPricingApproved: adminBulkApproved,
      });

      if (res.success) {
        setBulkFeedback({ type: "success", msg: "Bulk pricing configuration successfully updated & saved!" });
        const refreshed = await getProductById(productId);
        setProduct(refreshed);
      } else {
        setBulkFeedback({ type: "error", msg: res.error || "Failed to update bulk pricing." });
      }
    } catch (err: any) {
      setBulkFeedback({ type: "error", msg: err?.message || "Failed to update bulk pricing." });
    } finally {
      setIsSavingBulk(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl bg-card border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/30">
            <h2 className="text-lg font-bold text-[#1a3321] flex items-center">
              <Package className="mr-2 h-5 w-5 text-[#8ca193]" /> Product Inspection
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-4 border-[#1a3321] border-t-transparent rounded-full" />
              </div>
            ) : !product ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="h-10 w-10 mb-4 text-rose-500/50" />
                <p>Product not found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Images */}
                <div className="space-y-4">
                  <div className="aspect-square rounded-xl border bg-muted/10 overflow-hidden flex items-center justify-center">
                    <img src={product.images?.[0] || product.imageUrls?.[0] || "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=800"} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                  {product.images?.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {product.images.slice(1).map((img: any, i: number) => (
                        <div key={i} className="aspect-square rounded-lg border bg-muted/10 overflow-hidden">
                           <img src={typeof img === 'string' ? img : img.url} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column: Details */}
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-black text-[#1a3321]">{product.name}</h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center">
                       <Tag className="h-3.5 w-3.5 mr-1" /> {product.category?.name || product.category || product.categoryId || "Uncategorized"}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant={product.isApproved ? "success" : "secondary"} className={product.isApproved ? "bg-emerald-100 text-emerald-800 border-none" : "bg-amber-100 text-amber-800 border-none"}>
                      {product.isApproved ? "Approved" : "Pending Review"}
                    </Badge>
                  </div>

                  {/* Super Admin Bulk Pricing Control */}
                  <div className="space-y-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Lock className="h-4 w-4 text-[#0F6E56]" />
                        <h3 className="text-xs font-bold text-[#1a3321] uppercase tracking-wider">
                          Super Admin Bulk Pricing Control (GST Tiers)
                        </h3>
                      </div>
                      <Badge className={adminBulkApproved ? "bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]" : "bg-amber-100 text-amber-900 border-amber-300 text-[10px]"}>
                        {adminBulkApproved ? "✓ Bulk Pricing Approved" : "⏳ Pending Approval"}
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Before GST verification, buyers only see the 1-box price. Tier 2 and Tier 3 unlock after verified 15-character GSTIN and 10-digit mobile number.
                    </p>

                    {bulkFeedback && (
                      <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${bulkFeedback.type === "success" ? "bg-emerald-100 text-emerald-900 border border-emerald-300" : "bg-rose-100 text-rose-900 border border-rose-300"}`}>
                        {bulkFeedback.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" /> : <AlertCircle className="h-4 w-4 shrink-0 text-rose-700" />}
                        <span>{bulkFeedback.msg}</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveBulkPricing} className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-700 uppercase">1 Box Price (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={adminPrice}
                            onChange={(e) => setAdminPrice(e.target.value)}
                            className="w-full text-xs font-bold border border-slate-300 rounded px-2 py-1.5 bg-white"
                          />
                          <p className="text-[9px] text-slate-500">Public (₹2 default)</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-[#0F6E56] uppercase">2 Boxes Price (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={adminTwoBoxPrice}
                            onChange={(e) => setAdminTwoBoxPrice(e.target.value)}
                            className="w-full text-xs font-bold border border-emerald-300 rounded px-2 py-1.5 bg-white text-emerald-900"
                          />
                          <p className="text-[9px] text-emerald-700">GST-locked (NOT 2x ₹2)</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-700 uppercase">3+ Boxes (₹/box)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={adminThreePlusBoxPrice}
                            onChange={(e) => setAdminThreePlusBoxPrice(e.target.value)}
                            className="w-full text-xs font-bold border border-slate-300 rounded px-2 py-1.5 bg-white"
                          />
                          <p className="text-[9px] text-slate-500">Per box for 3+ boxes</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-700 uppercase">Min Bulk Boxes</label>
                          <input
                            type="number"
                            min="1"
                            value={adminMinBulkBoxes}
                            onChange={(e) => setAdminMinBulkBoxes(e.target.value)}
                            className="w-full text-xs font-bold border border-slate-300 rounded px-2 py-1 bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-700 uppercase">Max Bulk Boxes (Optional)</label>
                          <input
                            type="number"
                            placeholder="No limit"
                            value={adminMaxBulkBoxes}
                            onChange={(e) => setAdminMaxBulkBoxes(e.target.value)}
                            className="w-full text-xs font-bold border border-slate-300 rounded px-2 py-1 bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={adminBulkApproved}
                            onChange={(e) => setAdminBulkApproved(e.target.checked)}
                            className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Approve Bulk Pricing for Marketplace</span>
                        </label>

                        <Button
                          type="submit"
                          size="sm"
                          disabled={isSavingBulk}
                          className="bg-[#0F6E56] hover:bg-[#0c5945] text-white text-xs font-bold px-4 py-1.5 rounded-lg"
                        >
                          {isSavingBulk ? "Saving..." : "Approve & Override Pricing"}
                        </Button>
                      </div>
                    </form>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider">Bulk Box Packaging & Logistics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg border bg-emerald-50/40 border-emerald-100">
                        <p className="text-xs text-muted-foreground">Price per Box</p>
                        <p className="text-lg font-bold text-[#1a3321]">₹{product.price}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-emerald-50/40 border-emerald-100">
                        <p className="text-xs text-muted-foreground">Units per Box</p>
                        <p className="text-lg font-bold text-[#1a3321]">{product.unitsPerBox || 100} units</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/10">
                        <p className="text-xs text-muted-foreground">Effective Unit Rate</p>
                        <p className="text-sm font-semibold">₹{((product.price) / (product.unitsPerBox || 100)).toFixed(2)} / unit</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/10">
                        <p className="text-xs text-muted-foreground">Available Boxes in Stock</p>
                        <p className="text-sm font-semibold">{product.stock || 0} boxes</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/10">
                        <p className="text-xs text-muted-foreground">Delivery Timeline</p>
                        <p className="text-xs font-semibold">{product.deliveryTime || "Dispatches within 24–48 hours"}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/10">
                        <p className="text-xs text-muted-foreground">Return & Guarantee</p>
                        <p className="text-xs font-semibold">{product.returnEligibility || "10-day replacement"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider">Product Description</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description}</p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider">Sustainability & Specs</h3>
                    <div className="bg-[#f4f5f3] p-4 rounded-xl space-y-3">
                      <div className="flex items-start">
                        <Leaf className="h-4 w-4 mr-2 text-emerald-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-[#1a3321]">Sustainability Claim</p>
                          <p className="text-xs text-muted-foreground">{product.sustainabilityDetail || "No details provided"}</p>
                        </div>
                      </div>
                      {product.certifications?.length > 0 && (
                        <div className="flex items-start pt-2 border-t border-[#e9ece6]">
                          <ShieldCheck className="h-4 w-4 mr-2 text-emerald-600 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-[#1a3321]">Certifications</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {product.certifications.map((c: any, i: number) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-white">{typeof c === 'string' ? c : c.name || "Cert"}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {product.seller && (
                     <div className="space-y-2">
                       <h3 className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider">Seller Information</h3>
                       <div className="flex items-center p-3 border rounded-xl bg-white shadow-sm">
                         <div className="h-10 w-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold">
                           {product.seller.companyName?.substring(0, 2).toUpperCase() || "EC"}
                         </div>
                         <div className="ml-3">
                           <p className="text-sm font-bold text-[#1a3321]">{product.seller.companyName}</p>
                           <p className="text-xs text-muted-foreground">ID: {product.sellerId || product.seller.id}</p>
                         </div>
                       </div>
                     </div>
                  )}

                </div>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t bg-[#fdfdfc] flex justify-end">
             <Button variant="outline" onClick={onClose} className="rounded-full px-6 border-[#e9ece6] hover:bg-[#f4f5f3]">Close Inspection</Button>
          </div>
      </div>
    </div>
  );
}
