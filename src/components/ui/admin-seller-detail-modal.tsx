"use client";

import React, { useEffect, useState } from "react";
import { getSellerProfileById, getSellerDashboardStats, getSellerAnalyticsTimeSeries, SellerProfile } from "@/actions/sellers";
import { approveSeller, updateSellerVerificationStatus, updateSellerTrustScore, getSellerInitialProductForAdmin } from "@/actions/admin";
import { getSellerPayoutStats } from "@/actions/payouts";
import { getProducts, ProductItem } from "@/actions/products";
import { AnalyticsData, SellerAnalyticsCharts } from "@/components/ui/seller-analytics-charts";
import { Badge, Button, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/shared";
import { Activity, Building, CheckCircle2, ExternalLink, MapPin, Package, Star, X } from "lucide-react";
import { FadeIn } from "@/components/FramerComponents";
import { AdminSellerMessenger } from "./admin-seller-messenger";
import { AdminProductDetailModal } from "./admin-product-detail-modal";

export interface AdminSellerDetailModalProps {
  sellerId: string;
  onClose: () => void;
  adminEmail?: string;
  onActionComplete?: () => void;
}

export function AdminSellerDetailModal({ sellerId, onClose, adminEmail, onActionComplete }: AdminSellerDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [stats, setStats] = useState({ revenue: 0, ordersCount: 0, productsCount: 0, rating: 4.8, mostSoldProduct: "" });
  const [payoutStats, setPayoutStats] = useState({ pendingAmount: 0, availableBalance: 0, settledAmount: 0, totalSalesRevenue: 0 });
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [initialProduct, setInitialProduct] = useState<any | null>(null);
  const [badges, setBadges] = useState<string[]>(["Verified Business"]);
  const [rejectReason, setRejectReason] = useState("");
  const [trustScore, setTrustScore] = useState<number>(0);
  const [updatingTrust, setUpdatingTrust] = useState(false);
  const [inspectProductId, setInspectProductId] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setTrustScore(profile.trustScore || 0);
    }
  }, [profile]);

  const handleUpdateTrustScore = async () => {
    if (!profile) return;
    setUpdatingTrust(true);
    try {
      await updateSellerTrustScore(profile.id, trustScore);
      // Update local profile state to reflect change
      setProfile({ ...profile, trustScore });
      // Optionally show a toast or success notification here
    } catch (err) {
      console.error("Failed to update trust score:", err);
    } finally {
      setUpdatingTrust(false);
    }
  };

  const handleApprove = async () => {
    try {
      await updateSellerVerificationStatus(profile?.userId || sellerId, "APPROVED", badges, "", adminEmail);
      if (onActionComplete) onActionComplete();
      onClose();
    } catch (err) {
      console.error("Failed to approve seller:", err);
    }
  };

  const handleReject = async () => {
    try {
      await updateSellerVerificationStatus(profile?.userId || sellerId, "REJECTED", [], rejectReason || "Documents incomplete or invalid.", adminEmail);
      if (onActionComplete) onActionComplete();
      onClose();
    } catch (err) {
      console.error("Failed to reject seller:", err);
    }
  };

  const handleNeedMoreDocs = async () => {
    try {
      await updateSellerVerificationStatus(profile?.userId || sellerId, "NEED_MORE_DOCS", [], rejectReason || "Please upload clear documents.", adminEmail);
      if (onActionComplete) onActionComplete();
      onClose();
    } catch (err) {
      console.error("Failed to request docs:", err);
    }
  };

  const handleSuspend = async () => {
    try {
      await updateSellerVerificationStatus(profile?.userId || sellerId, "SUSPENDED", [], rejectReason || "Violation of terms.", adminEmail);
      if (onActionComplete) onActionComplete();
      onClose();
    } catch (err) {
      console.error("Failed to suspend seller:", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchSellerDetails = async () => {
      setLoading(true);
      try {
        const [profData, statData, aData, prodData, initProd, payoutData] = await Promise.all([
          getSellerProfileById(sellerId),
          getSellerDashboardStats(sellerId),
          getSellerAnalyticsTimeSeries(sellerId),
          getProducts({ sellerId }),
          getSellerInitialProductForAdmin(sellerId),
          getSellerPayoutStats(sellerId)
        ]);

        let initProdResult = initProd;
        if (!initProdResult && profData?.userId) {
          initProdResult = await getSellerInitialProductForAdmin(profData.userId);
        }
        if (!initProdResult && profData?.id) {
          initProdResult = await getSellerInitialProductForAdmin(profData.id);
        }

        let allProds = prodData || [];
        if (allProds.length === 0 && profData?.id) {
          allProds = await getProducts({ sellerId: profData.id });
        }
        if (allProds.length === 0 && profData?.userId) {
          allProds = await getProducts({ sellerId: profData.userId });
        }
        if (allProds.length === 0 && initProdResult) {
          allProds = [initProdResult];
        }

        if (mounted) {
          setProfile(profData);
          setStats(statData);
          setAnalyticsData(aData as AnalyticsData);
          setProducts(allProds);
          setInitialProduct(initProdResult);
          setPayoutStats(payoutData);
        }
      } catch (err) {
        console.error("Failed to load seller detailed view:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchSellerDetails();
    
    // Lock body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      mounted = false;
      document.body.style.overflow = 'auto';
    };
  }, [sellerId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <FadeIn className="relative w-full max-w-6xl max-h-[90vh] bg-card border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center border border-primary/20">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground leading-tight flex items-center gap-2">
                <span>{profile?.companyName || "Loading Seller..."}</span>
                {profile && (profile.userName || profile.user?.name) && (
                  <span className="text-xs font-normal text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                    User Profile: {profile.userName || profile.user?.name}
                  </span>
                )}
              </h2>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Partner ID: {sellerId.substring(0, 10)}...
                </span>
                {profile?.verificationStatus && (
                  <Badge 
                    variant={
                      profile.verificationStatus === "APPROVED" ? "success" : 
                      profile.verificationStatus === "REJECTED" ? "danger" : "primary"
                    } 
                    className="text-[9px] py-0 border-none"
                  >
                    {profile.verificationStatus}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground space-y-4">
              <Activity className="h-8 w-8 animate-spin text-primary/50" />
              <p className="text-xs font-medium uppercase tracking-widest">Compiling Partner Dossier...</p>
            </div>
          ) : !profile ? (
            <div className="h-64 flex flex-col items-center justify-center text-red-500/70 text-sm">
              <X className="h-8 w-8 mb-2" />
              <p>Seller profile not found or could not be loaded.</p>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* TOP ROW: Profile Details & Core Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Profile Snapshot */}
                <Card className="lg:col-span-1 p-5 border-border/50 bg-muted/10 space-y-4 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">Business Profile</h3>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Business Type</span>
                      <p className="font-semibold">{profile.businessType}</p>
                    </div>
                    {profile.description && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Description</span>
                        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">{profile.description}</p>
                      </div>
                    )}
                    {(profile.website || profile.gstNumber || profile.panNumber || profile.declaredRevenue || profile.userName || profile.user?.name || profile.founderName || profile.ownerName || profile.aadharNumber || profile.phone || profile.user?.email || profile.companyAddress || profile.factoryAddress || profile.pickupAddress || profile.bankName) && (
                      <div className="pt-2 mt-2 border-t border-border/30 grid grid-cols-2 gap-3">
                        {(profile.userName || profile.user?.name || profile.founderName || profile.ownerName) && (
                          <div className="col-span-2">
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Founder / Owner Name</span>
                            <p className="text-xs font-semibold text-foreground">{profile.userName || profile.user?.name || profile.founderName || profile.ownerName}</p>
                          </div>
                        )}
                        {profile.aadharNumber && (
                          <div className="col-span-2">
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Aadhar Number</span>
                            <p className="text-xs font-mono font-bold text-primary">{profile.aadharNumber}</p>
                          </div>
                        )}
                        {profile.gstNumber && (
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">GST Code</span>
                            <p className="text-xs font-mono">{profile.gstNumber}</p>
                          </div>
                        )}
                        {profile.panNumber && (
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">PAN Code</span>
                            <p className="text-xs font-mono">{profile.panNumber}</p>
                          </div>
                        )}
                        {profile.declaredRevenue && (
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Declared Annual Revenue</span>
                            <p className="text-xs font-semibold text-emerald-700">{profile.declaredRevenue}</p>
                          </div>
                        )}
                        {profile.website && (
                          <div className="col-span-2">
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Website</span>
                            <a href={profile.website} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center">
                              {profile.website} <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </div>
                        )}
                        {profile.user?.email && (
                          <div className="col-span-2">
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Email</span>
                            <p className="text-xs font-semibold">{profile.user.email}</p>
                          </div>
                        )}
                        {profile.phone && (
                          <div className="col-span-2">
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Contact Number</span>
                            <p className="text-xs font-semibold">{profile.phone}</p>
                          </div>
                        )}
                        {profile.companyAddress && (
                          <div className="col-span-2">
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Company Address</span>
                            <p className="text-xs text-muted-foreground leading-snug">{profile.companyAddress}</p>
                          </div>
                        )}
                        {profile.factoryAddress && (
                          <div className="col-span-2">
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Factory Address</span>
                            <p className="text-xs text-muted-foreground leading-snug">{profile.factoryAddress}</p>
                          </div>
                        )}
                        {profile.pickupAddress && (
                          <div className="col-span-2">
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Pickup Address</span>
                            <p className="text-xs text-muted-foreground leading-snug">{profile.pickupAddress}</p>
                          </div>
                        )}
                        {(profile.bankName || profile.bankAccountNo) && (
                          <div className="col-span-2 grid grid-cols-2 gap-2 p-3 mt-1 bg-background rounded-xl border border-border/60 shadow-sm">
                            {profile.bankName && (
                              <div>
                                <span className="text-[9px] text-muted-foreground uppercase block mb-0.5">Bank Name</span>
                                <p className="text-xs font-medium">{profile.bankName}</p>
                              </div>
                            )}
                            {profile.bankAccountNo && (
                              <div>
                                <span className="text-[9px] text-muted-foreground uppercase block mb-0.5">Account No.</span>
                                <p className="text-xs font-mono font-medium">{profile.bankAccountNo}</p>
                              </div>
                            )}
                            {profile.bankIfsc && (
                              <div className="col-span-2 pt-1 border-t border-border/30">
                                <span className="text-[9px] text-muted-foreground uppercase block mb-0.5">IFSC Code</span>
                                <p className="text-xs font-mono font-medium">{profile.bankIfsc}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {(profile.badges || []).length > 0 && (
                      <div className="pt-2 mt-2 border-t border-border/30">
                        <span className="text-[10px] text-muted-foreground uppercase block mb-1.5">Assigned Badges</span>
                        <div className="flex flex-wrap gap-1.5">
                          {(profile.badges || []).map((b: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[9px] bg-primary/5 text-primary border-primary/20">
                              {b}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Core KPIs */}
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <Card className="p-4 border-border/40 bg-card flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Total Revenue</span>
                    <h3 className="text-xl sm:text-2xl font-black text-emerald-600">
                      ₹{stats.revenue.toLocaleString()}
                    </h3>
                  </Card>
                  
                  <Card className="p-4 border-border/40 bg-card flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600/80 mb-2 block">Pending Withdrawal</span>
                    <h3 className="text-xl sm:text-2xl font-black text-amber-500">
                      ₹{payoutStats.pendingAmount.toLocaleString()}
                    </h3>
                  </Card>
                  
                  <Card className="p-4 border-border/40 bg-card flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Total Orders</span>
                    <h3 className="text-xl sm:text-2xl font-black text-foreground">
                      {stats.ordersCount.toLocaleString()}
                    </h3>
                  </Card>

                  <Card className="p-4 border-border/40 bg-card flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2 text-muted-foreground">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Super Admin Trust Score</span>
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
                    </div>
                    <div className="flex flex-col space-y-2 mt-2">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="number" 
                          min="0" max="5" step="0.1"
                          value={trustScore}
                          onChange={(e) => setTrustScore(parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-sm border rounded bg-transparent font-bold"
                        />
                        <span className="text-[10px] text-muted-foreground">/ 5.0</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full text-[10px] h-7"
                        onClick={handleUpdateTrustScore}
                        disabled={updatingTrust}
                      >
                        {updatingTrust ? "Saving..." : "Update Score"}
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-4 border-border/40 bg-card flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2 text-muted-foreground">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Top Product</span>
                      <Package className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2" title={stats.mostSoldProduct || "N/A"}>
                      {stats.mostSoldProduct || "N/A"}
                    </h3>
                  </Card>
                </div>
              </div>

              {/* TABS FOR DEEP DIVE */}
              <Tabs defaultValue="analytics" className="w-full">
                <TabsList className="mb-6 overflow-x-auto flex-nowrap bg-muted/40 p-1">
                  <TabsTrigger value="analytics" className="text-xs">Performance Charts</TabsTrigger>
                  <TabsTrigger value="catalog" className="text-xs">Product Catalog ({products.length})</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">Verification Docs</TabsTrigger>
                  <TabsTrigger value="messages" className="text-xs">Messages</TabsTrigger>
                </TabsList>

                {/* Tab: Analytics */}
                <TabsContent value="analytics" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-card border border-border/40 rounded-xl p-4 shadow-sm">
                    {analyticsData ? (
                      <SellerAnalyticsCharts data={analyticsData} />
                    ) : (
                      <div className="py-12 text-center text-xs text-muted-foreground">Chart data unavailable.</div>
                    )}
                  </div>
                </TabsContent>

                {/* Tab: Catalog */}
                <TabsContent value="catalog" className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                  {(() => {
                    const displayInitProd = initialProduct || (products.length > 0 ? products[0] : null);
                    if (!displayInitProd) return null;
                    return (
                      <Card className="p-5 border-2 border-primary/40 bg-primary/5 space-y-4 shadow-md">
                        <div className="flex items-center justify-between border-b border-primary/20 pb-3">
                          <div className="flex items-center space-x-2">
                            <Package className="h-5 w-5 text-primary" />
                            <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Initial Verification Product (Launch Candidate)</h4>
                          </div>
                          <Badge variant={displayInitProd.isApproved ? "primary" : "outline"} className="text-[10px]">
                            {displayInitProd.isApproved ? "Approved & Live" : "Pending Audit Approval"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-1 space-y-2">
                            <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Image Gallery ({displayInitProd.images?.length || 0} Images)</span>
                            <div className="grid grid-cols-5 gap-1.5">
                              {(displayInitProd.images || []).map((imgUrl: string, idx: number) => (
                                <a key={idx} href={imgUrl} target="_blank" rel="noreferrer" className="block aspect-square rounded overflow-hidden border border-border hover:opacity-80 transition-opacity">
                                  <img src={imgUrl} alt={`Prod ${idx + 1}`} className="w-full h-full object-cover" />
                                </a>
                              ))}
                            </div>
                          </div>
                          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                            <div className="col-span-2 sm:col-span-3">
                              <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Product Title</span>
                              <p className="font-bold text-sm text-foreground">{displayInitProd.name}</p>
                              <p className="text-muted-foreground line-clamp-2 mt-1">{displayInitProd.description}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Selling Price</span>
                              <p className="font-mono font-bold text-emerald-600 text-sm">₹{displayInitProd.price}</p>
                            </div>
                            {displayInitProd.wholesalePrice && (
                              <div>
                                <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Wholesale Price</span>
                                <p className="font-mono font-semibold text-foreground">₹{displayInitProd.wholesalePrice}</p>
                              </div>
                            )}
                            {displayInitProd.originalPrice && (
                              <div>
                                <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Original Price</span>
                                <p className="font-mono text-muted-foreground line-through">₹{displayInitProd.originalPrice}</p>
                              </div>
                            )}
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Initial Inventory</span>
                              <p className="font-semibold">{displayInitProd.stock} units</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Category</span>
                              <p className="font-semibold">{displayInitProd.category}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Eco Score</span>
                              <Badge variant="primary" className="text-[10px] bg-primary/10 text-primary border-none">
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })()}
                  <Card className="border-border/40 bg-card shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableHead className="w-12 text-xs">IMG</TableHead>
                            <TableHead className="text-xs">Product Name</TableHead>
                            <TableHead className="text-xs">Category</TableHead>
                            <TableHead className="text-xs">Price</TableHead>
                            <TableHead className="text-xs">Stock</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="w-8 text-xs"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                                This seller has not listed any products yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            products.map((p) => (
                              <TableRow
                                key={p.id}
                                className="cursor-pointer hover:bg-primary/5 transition-colors group"
                                onClick={() => setInspectProductId(p.id)}
                                title={`View full details of "${p.name}"`}
                              >
                                <TableCell>
                                  <img src={p.images[0]} alt={p.name} className="h-8 w-8 object-cover rounded shadow-sm border border-border/50" />
                                </TableCell>
                                <TableCell className="font-semibold text-xs text-foreground max-w-[200px] truncate group-hover:text-primary transition-colors" title={p.name}>
                                  {p.name}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{p.category}</TableCell>
                                <TableCell className="font-mono text-xs font-semibold">₹{p.price}</TableCell>
                                <TableCell className="text-xs">{p.stock} units</TableCell>
                                <TableCell>
                                  <Badge variant={p.isApproved ? "success" : "outline"} className="text-[9px]">
                                    {p.isApproved ? "Live" : "Pending"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                </TabsContent>

                {/* Tab: Documents */}
                <TabsContent value="documents" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {profile.documents && profile.documents.length > 0 ? (
                      profile.documents.map((doc) => (
                        <Card key={doc.id} className="p-4 border-border/50 flex flex-col items-center text-center space-y-3 bg-muted/5 hover:bg-muted/20 transition-colors">
                          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6" />
                          </div>
                          <div className="flex-1 w-full">
                            <p className="text-xs font-bold uppercase text-foreground mb-1">{doc.type.replace(/_/g, " ")}</p>
                            <p className="text-[10px] text-muted-foreground truncate w-full px-2" title={doc.fileName}>{doc.fileName}</p>
                          </div>
                          <Button variant="cool" size="sm" className="w-full text-xs py-1" onClick={() => window.open(doc.fileUrl, "_blank")}>
                            View Document
                          </Button>
                        </Card>
                      ))
                    ) : (
                      <div className="col-span-full py-12 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
                        No verification documents were uploaded by this seller.
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Tab: Messages */}
                <TabsContent value="messages" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <AdminSellerMessenger sellerId={sellerId} adminId={adminEmail || "admin@earthcentric.com"} />
                </TabsContent>

              </Tabs>
            </div>
          )}
        </div>

        {/* Action Footer for Status updates */}
        {!loading && profile && (
          <div className="px-6 py-4 border-t border-border/40 bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {((profile.verificationStatus as string) === "PENDING" || (profile.verificationStatus as string) === "UNDER_REVIEW" || (profile.verificationStatus as string) === "APPROVED") && (
              <div className="flex flex-col space-y-1.5 w-full sm:w-auto">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Assign Seller Quality Badges
                </span>
                <div className="flex flex-wrap gap-4 text-xs font-medium">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={badges.includes("Verified Business")}
                      onChange={(e) => {
                        if (e.target.checked) setBadges([...badges, "Verified Business"]);
                        else setBadges(badges.filter(b => b !== "Verified Business"));
                      }}
                      className="rounded text-primary border-border focus:ring-ring"
                    />
                    <span>Verified Business</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={badges.includes("Verified Sustainable Manufacturer")}
                      onChange={(e) => {
                        if (e.target.checked) setBadges([...badges, "Verified Sustainable Manufacturer"]);
                        else setBadges(badges.filter(b => b !== "Verified Sustainable Manufacturer"));
                      }}
                      className="rounded text-primary border-border focus:ring-ring"
                    />
                    <span>Verified Sustainable Manufacturer</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end flex-wrap gap-y-2">
              <input
                type="text"
                placeholder="Reason (optional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="bg-transparent border border-border/60 rounded-lg text-xs py-2 px-3 focus:outline-none focus:border-primary w-40 inline-block"
              />
              
              {(profile.verificationStatus as string) !== "APPROVED" && (
                <>
                  <Button
                    variant="ghost"
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold px-3 py-1.5 h-8 rounded-lg"
                    onClick={handleReject}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    className="text-amber-600 border-amber-200 hover:bg-amber-50 text-xs font-semibold px-3 py-1.5 h-8 rounded-lg"
                    onClick={handleNeedMoreDocs}
                  >
                    Need More Docs
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 h-8 rounded-lg"
                    onClick={handleApprove}
                  >
                    Approve
                  </Button>
                </>
              )}
              
              {(profile.verificationStatus as string) === "APPROVED" && (
                <>
                  <Button
                    variant="outline"
                    className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs font-semibold px-3 py-1.5 h-8 rounded-lg"
                    onClick={handleSuspend}
                  >
                    Suspend Seller
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 h-8 rounded-lg"
                    onClick={handleApprove}
                  >
                    Update Badges
                  </Button>
                </>
              )}
              
              {(profile.verificationStatus as string) === "SUSPENDED" && (
                 <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 h-8 rounded-lg"
                    onClick={handleApprove}
                 >
                    Reinstate Seller
                 </Button>
              )}
            </div>
          </div>
        )}
      </FadeIn>

      {inspectProductId && (
        <AdminProductDetailModal
          productId={inspectProductId}
          onClose={() => setInspectProductId(null)}
        />
      )}
    </div>
  );
}
