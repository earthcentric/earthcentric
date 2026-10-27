import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/actions/orders";
import { Card, Badge, Button } from "@/components/ui/shared";
import { CheckCircle2, Package, Truck, Calendar, ShoppingBag, Leaf, HelpCircle, MapPin, Clock, XCircle, RotateCcw, AlertCircle, Zap, Loader2 } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderTrackingPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  // Predefined list of timeline stages
  const STAGES = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];
  
  // Find index of current stage to calculate completion progress
  const currentStageIndex = STAGES.indexOf(order.status);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-6 gap-4">
        <div className="space-y-1">
          <Badge variant="primary" className="text-xs">
            🌿 Carbon-Neutral Dispatch
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">Track Order #{order.id}</h1>
          <p className="text-xs text-muted-foreground">
            Created on {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Link href="/marketplace">
          <Button variant="cool" size="sm">
            Continue Shopping
          </Button>
        </Link>
      </div>

      {order.cancellation && (
        <Card className={`p-5 space-y-3 ${
          order.cancellation.status === "APPROVED"
            ? "border-emerald-200 bg-emerald-50/70"
            : order.cancellation.status === "REJECTED"
              ? "border-rose-200 bg-rose-50/70"
              : "border-amber-200 bg-amber-50"
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {order.cancellation.status === "APPROVED" ? (
                <Badge variant="success" className="gap-1.5 text-xs py-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Cancellation Approved
                </Badge>
              ) : order.cancellation.status === "REJECTED" ? (
                <Badge variant="danger" className="gap-1.5 text-xs py-0.5">
                  <XCircle className="w-3.5 h-3.5" /> Cancellation Rejected
                </Badge>
              ) : (
                <Badge variant="accent" className="gap-1.5 text-xs py-0.5">
                  <Clock className="w-3.5 h-3.5" /> Cancellation Pending Admin Review
                </Badge>
              )}
              {order.cancellation.isAutoApproved && (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] gap-1 py-0.5">
                  <Zap className="w-3 h-3 text-emerald-600" /> Instant 24h Approval
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              Requested on {new Date(order.cancellation.requestedAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric"
              })}
            </span>
          </div>

          <p className="text-xs text-slate-800">
            <span className="font-semibold text-slate-700">Reason:</span> {order.cancellation.reason}
          </p>

          {order.cancellation.rejectionReason && (
            <div className="p-3 rounded-xl bg-rose-100/70 border border-rose-200/80 text-rose-950 text-xs">
              <p className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Admin Rejection Reason:
              </p>
              <p className="mt-0.5 text-rose-900">{order.cancellation.rejectionReason}</p>
              <p className="mt-1 text-[11px] text-rose-700 italic">This order remains active and will proceed with shipping and delivery as planned.</p>
            </div>
          )}

          {order.cancellation.adminNote && !order.cancellation.rejectionReason && (
            <p className="text-xs text-slate-700">
              <span className="font-semibold">Admin update:</span> {order.cancellation.adminNote}
            </p>
          )}

          {order.cancellation.status === "APPROVED" && (
            <div className="p-4 rounded-xl bg-white/90 border border-emerald-200/70 shadow-xs space-y-2 text-xs text-slate-700">
              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-100 flex-wrap gap-2">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600" /> Payment Refund Details
                </span>
                {order.cancellation.refundStatus === "SUCCESS" ? (
                  <Badge variant="success" className="gap-1 text-[11px] py-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Refund Completed
                  </Badge>
                ) : order.cancellation.refundStatus === "PENDING" ? (
                  <Badge variant="primary" className="gap-1 text-[11px] py-0.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Refund Processing
                  </Badge>
                ) : order.cancellation.refundStatus === "FAILED" ? (
                  <Badge variant="danger" className="gap-1 text-[11px] py-0.5">
                    <AlertCircle className="w-3 h-3" /> Refund Delayed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] py-0.5">
                    {order.cancellation.refundStatus.replaceAll("_", " ")}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Approved Refund Amount</span>
                  <p className="font-extrabold text-emerald-700 text-sm">
                    ₹{(order.cancellation.refundAmount ?? order.totalAmount).toLocaleString("en-IN")}
                  </p>
                </div>
                {order.cancellation.cashfreeRefundReference && (
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Cashfree Reference</span>
                    <p className="font-mono text-slate-800 text-xs">{order.cancellation.cashfreeRefundReference}</p>
                  </div>
                )}
                {order.cancellation.refundArn && (
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Bank ARN</span>
                    <p className="font-mono text-slate-800 text-xs">{order.cancellation.refundArn}</p>
                  </div>
                )}
              </div>

              {order.cancellation.refundStatus === "PENDING" && (
                <p className="text-[11px] text-slate-600 bg-emerald-50/60 p-2.5 rounded-lg leading-relaxed">
                  The refund is currently being routed by Cashfree. Credit to your original account typically takes 3–5 working days depending on your bank.
                </p>
              )}
              {order.cancellation.refundStatus === "FAILED" && (
                <p className="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded-lg leading-relaxed">
                  {order.cancellation.refundError || "Automatic refund confirmation was delayed. Super Admin is reviewing this transaction."}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Timeline Status Panel (Apple/Linear alignment) */}
        <div className="md:col-span-8 space-y-6">
          <Card className="border-border/40 p-6 space-y-6 bg-card">
            <h3 className="font-bold text-sm text-primary uppercase tracking-wider flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Logistics Timeline</span>
            </h3>

            {/* Stepper tracker */}
            <div className="relative pl-6 space-y-6">
              {/* Stepper bar line */}
              <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-muted dark:bg-muted/10" />
              
              {STAGES.map((stage, idx) => {
                const isCompleted = idx <= currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                
                // Get timeline note details
                const timelineEntry = order.timeline.find((t) => t.status === stage);
                const entryDesc = timelineEntry?.description || getFallbackDescriptionForStage(stage);
                const entryDate = timelineEntry?.createdAt ? new Date(timelineEntry.createdAt) : null;

                return (
                  <div key={stage} className="relative flex items-start space-x-4">
                    {/* Circle indicators */}
                    <div
                      className={`absolute -left-6 flex h-5.5 w-5.5 items-center justify-center rounded-full border z-10 transition-colors duration-300 ${
                        isCompleted
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "bg-background border-border/80 text-muted-foreground/40"
                      }`}
                    >
                      <CheckCircle2 className={`h-3 w-3 ${isCompleted ? "opacity-100" : "opacity-0"}`} />
                    </div>

                    <div className="space-y-1 pl-2">
                      <h4
                        className={`text-xs font-bold uppercase tracking-wider ${
                          isCurrent ? "text-primary dark:text-foreground font-extrabold" : "text-muted-foreground"
                        }`}
                      >
                        {stage}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {entryDesc}
                      </p>
                      {entryDate && (
                        <p className="text-[10px] text-muted-foreground flex items-center space-x-1">
                          <Calendar className="h-3 w-3 text-primary shrink-0" />
                          <span>{entryDate.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          {order.timeline.length > 0 && (
            <Card className="border-border/40 p-5 space-y-3 bg-card">
              <h3 className="font-bold text-xs text-primary uppercase tracking-wider">Order activity</h3>
              <div className="space-y-3">
                {order.timeline.map((event, index) => (
                  <div key={`${event.status}-${index}`} className="border-l-2 border-emerald-200 pl-3 text-xs">
                    <p className="font-semibold text-slate-800">{event.status}</p>
                    <p className="text-slate-600">{event.description}</p>
                    <p className="text-[10px] text-slate-400">{new Date(event.createdAt).toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Address and metadata Panel */}
        <div className="md:col-span-4 space-y-6">
          <Card className="border-border/60 bg-card p-5 space-y-5">
            <h3 className="font-bold text-xs text-primary uppercase tracking-wider flex items-center space-x-1.5 border-b border-border/30 pb-2">
              <MapPin className="h-3.5 w-3.5" />
              <span>Delivery Hub</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold block text-foreground">Recipient Location:</span>
                <p className="text-muted-foreground leading-relaxed mt-0.5">
                  {order.address.street},<br />
                  {order.address.city}, {order.address.state} - {order.address.postalCode},<br />
                  {order.address.country}
                </p>
              </div>

              <div>
                <span className="font-semibold block text-foreground">Payment Mode:</span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <Badge variant={order.paymentStatus === "COMPLETED" ? "success" : "primary"}>
                    {order.paymentStatus === "COMPLETED" ? "Authorised Success" : "Pending Auth"}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Patagonia recycle promise box */}
          <Card className="border-accent/40 bg-accent/5 p-5 space-y-3">
            <div className="flex items-center space-x-2 text-primary">
              <Leaf className="h-4.5 w-4.5 fill-accent stroke-primary shrink-0" />
              <h4 className="font-bold text-xs uppercase tracking-wider">Recyclable Guarantee</h4>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              We ship utilizing 100% FSC-recycled cardboard cartons. No bubblewrap or synthetic tapes are used. Please compost or recycle the packaging boxes upon delivery.
            </p>
          </Card>
        </div>
      </div>

      {/* Items review summary */}
      <Card className="border-border/40 p-6 bg-card">
        <h3 className="font-bold text-sm text-primary uppercase tracking-wider flex items-center space-x-2 border-b border-border/20 pb-3 mb-4">
          <ShoppingBag className="h-4 w-4" />
          <span>Items Ordered</span>
        </h3>
        
        <div className="divide-y divide-border/25">
          {order.items.map((item) => (
            <div key={item.productId} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
              <div className="flex items-center space-x-4">
                <img
                  src={item.image || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600"}
                  alt={item.name}
                  className="h-12 w-12 rounded-lg object-cover border border-border/20 shrink-0"
                />
                <div>
                  <h4 className="font-bold text-xs">{item.name}</h4>
                  <span className="text-[10px] text-muted-foreground">Qty: {item.quantity} x ₹{item.price}</span>
                </div>
              </div>
              <span className="font-bold text-xs text-foreground">₹{item.price * item.quantity}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border/30 pt-4 flex justify-between items-center text-xs font-bold text-foreground">
          <span>Grand Total Charged</span>
          <span>₹{order.totalAmount}</span>
        </div>
      </Card>
    </div>
  );
}

function getFallbackDescriptionForStage(stage: string): string {
  switch (stage) {
    case "PLACED":
      return "Order created. Awaiting merchant gateway confirmation.";
    case "CONFIRMED":
      return "Logistics verification completed. Order accepted by partner mills.";
    case "PACKED":
      return "Consolidated inside biodegradable, plastic-free boxes.";
    case "SHIPPED":
      return "Dispatched via carbon-offset cargo fleet. Tracking numbers assigned.";
    case "DELIVERED":
      return "Safely arrived at destination hub. Carbon saved counted.";
    default:
      return "Stage status notification update.";
  }
}
