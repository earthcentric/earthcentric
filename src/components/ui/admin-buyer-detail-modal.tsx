"use client";

import React, { useEffect, useState } from "react";
import { getBuyerProfileById } from "@/actions/admin";
import { Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableCell, TableHead, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/shared";
import { X, User, ShoppingBag, MapPin, Activity, Calendar, Mail } from "lucide-react";
import { FadeIn } from "@/components/FramerComponents";

export interface AdminBuyerDetailModalProps {
  buyerId: string;
  onClose: () => void;
}

export function AdminBuyerDetailModal({ buyerId, onClose }: AdminBuyerDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const fetchBuyerDetails = async () => {
      setLoading(true);
      try {
        const data = await getBuyerProfileById(buyerId);
        if (mounted) {
          setProfile(data);
        }
      } catch (err) {
        console.error("Failed to load buyer detailed view:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchBuyerDetails();
    
    // Lock body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      mounted = false;
      document.body.style.overflow = 'auto';
    };
  }, [buyerId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <FadeIn className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center border border-primary/20">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground leading-tight">
                {profile?.name || "Loading Buyer..."}
              </h2>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Buyer ID: {buyerId.substring(0, 10)}...
                </span>
              </div>
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground space-y-4">
              <Activity className="h-8 w-8 animate-spin text-primary/50" />
              <p className="text-xs font-medium uppercase tracking-widest">Compiling Customer Dossier...</p>
            </div>
          ) : !profile ? (
            <div className="h-64 flex flex-col items-center justify-center text-red-500/70 text-sm">
              <X className="h-8 w-8 mb-2" />
              <p>Buyer profile not found or could not be loaded.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile details & Quick KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-border/50 bg-muted/10 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1.5">Contact Details</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{profile.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Joined {profile.joinedDate}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border-border/50 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Total Orders</span>
                  <h3 className="text-2xl font-black text-[#1a3321]">
                    {profile.orders.length} orders
                  </h3>
                </Card>

                <Card className="p-4 border-border/50 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Total Spent</span>
                  <h3 className="text-2xl font-black text-emerald-600">
                    ₹{profile.orders.reduce((sum: number, o: any) => sum + o.totalAmount, 0).toLocaleString()}
                  </h3>
                </Card>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="history" className="w-full">
                <TabsList className="mb-4 bg-muted/40 p-1">
                  <TabsTrigger value="history" className="text-xs">Order History ({profile.orders.length})</TabsTrigger>
                  <TabsTrigger value="addresses" className="text-xs">Saved Addresses ({profile.addresses.length})</TabsTrigger>
                </TabsList>

                {/* Tab: Order History */}
                <TabsContent value="history" className="animate-in fade-in duration-200">
                  <Card className="border-border/40 bg-card overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="text-xs pl-4">Order ID</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Items</TableHead>
                          <TableHead className="text-xs">Total Amount</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs pr-4">Payment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profile.orders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground">
                              No purchases recorded.
                            </TableCell>
                          </TableRow>
                        ) : (
                          profile.orders.map((o: any) => (
                            <TableRow key={o.id}>
                              <TableCell className="font-mono text-xs font-bold pl-4">
                                EC-ORD-{o.id.substring(4, 10).toUpperCase()}
                              </TableCell>
                              <TableCell className="text-xs">{o.date}</TableCell>
                              <TableCell className="text-xs">{o.itemsCount} units</TableCell>
                              <TableCell className="font-mono text-xs font-semibold">₹{o.totalAmount.toLocaleString()}</TableCell>
                              <TableCell className="text-xs">
                                <Badge className="bg-emerald-50 text-emerald-800 border-none text-[10px]">
                                  {o.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs pr-4">
                                <Badge className={o.paymentStatus === "COMPLETED" ? "bg-emerald-50 text-emerald-800 border-none text-[10px]" : "bg-amber-50 text-amber-800 border-none text-[10px]"}>
                                  {o.paymentStatus}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </Card>
                </TabsContent>

                {/* Tab: Saved Addresses */}
                <TabsContent value="addresses" className="animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {profile.addresses.length === 0 ? (
                      <div className="col-span-full py-10 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                        No shipping addresses saved.
                      </div>
                    ) : (
                      profile.addresses.map((addr: any, idx: number) => (
                        <Card key={idx} className="p-4 border-border/50 space-y-2 relative">
                          {addr.isDefault && (
                            <Badge className="absolute top-3 right-3 bg-emerald-500 text-white text-[9px] border-none">Default</Badge>
                          )}
                          <div className="flex items-start space-x-2 text-xs">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold text-[#1a3321]">{addr.street}</p>
                              <p className="text-muted-foreground mt-0.5">{addr.city}, {addr.state} - {addr.postalCode}</p>
                              <p className="text-muted-foreground mt-0.5">{addr.country}</p>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
