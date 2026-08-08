"use client";

import React, { useEffect, useState } from "react";
import { getProductById } from "@/actions/products";
import { X, Package, ShieldCheck, Leaf, Tag, AlertCircle } from "lucide-react";
import { Button, Badge } from "./shared";

export function AdminProductDetailModal({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getProductById(productId);
      setProduct(data);
      setLoading(false);
    }
    load();
  }, [productId]);

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

                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-[#8ca193] uppercase tracking-wider">Pricing & Stock</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg border bg-muted/10">
                        <p className="text-xs text-muted-foreground">Retail Price</p>
                        <p className="text-lg font-bold text-[#1a3321]">₹{product.price}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/10">
                        <p className="text-xs text-muted-foreground">Wholesale Price</p>
                        <p className="text-lg font-bold text-[#1a3321]">{product.wholesalePrice ? `₹${product.wholesalePrice}` : "N/A"}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/10">
                        <p className="text-xs text-muted-foreground">MOQ</p>
                        <p className="text-sm font-semibold">{product.moq || 1} {product.unit || "units"}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/10">
                        <p className="text-xs text-muted-foreground">Stock Available</p>
                        <p className="text-sm font-semibold">{product.stock || 0}</p>
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
