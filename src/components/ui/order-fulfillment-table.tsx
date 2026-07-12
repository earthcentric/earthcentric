"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import { X, Play, Pause, CheckCircle2 } from "lucide-react";
import { OrderDetail } from "@/actions/orders";
import { Badge } from "@/components/ui/shared";

interface OrderFulfillmentTableProps {
  orders: OrderDetail[];
  onUpdateStatus: (orderId: string, currentStatus: string) => void;
  className?: string;
}

export function OrderFulfillmentTable({
  orders,
  onUpdateStatus,
  className = ""
}: OrderFulfillmentTableProps) {
  const [hoveredOrder, setHoveredOrder] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const openOrderModal = (order: OrderDetail) => {
    setSelectedOrder(order);
  };

  const closeOrderModal = () => {
    setSelectedOrder(null);
  };

  // Sync selected order state updates
  useEffect(() => {
    if (selectedOrder) {
      const updated = orders.find(o => o.id === selectedOrder.id);
      if (updated) {
        setSelectedOrder(updated);
      }
    }
  }, [orders, selectedOrder]);

  const getCountryFlag = (country: string = "India") => {
    const code = country.toLowerCase();
    if (code.includes("india") || code.includes("in")) {
      return (
        <svg width="24" height="24" viewBox="0 0 3 2" fill="none" className="scale-150">
          <rect width="3" height="2" fill="#FF9933" />
          <rect y="0.66" width="3" height="0.68" fill="#FFFFFF" />
          <rect y="1.33" width="3" height="0.67" fill="#138808" />
          <circle cx="1.5" cy="1" r="0.2" fill="#000080" />
        </svg>
      );
    }
    if (code.includes("uk") || code.includes("united kingdom") || code.includes("gb")) {
      return (
        <svg width="24" height="24" viewBox="0 0 60 30" fill="none" className="scale-125">
          <clipPath id="s">
            <path d="M0,0 L60,0 L60,30 L0,30 Z"/>
          </clipPath>
          <g clipPath="url(#s)">
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6"/>
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#012169" strokeWidth="4"/>
            <path d="M30,0 L30,30 M0,15 L60,15" stroke="#FFFFFF" strokeWidth="10"/>
            <path d="M30,0 L30,30 M0,15 L60,15" stroke="#C8102E" strokeWidth="6"/>
          </g>
        </svg>
      );
    }
    // Default US/Universal flag fallback
    return (
      <svg width="24" height="24" viewBox="0 0 130 120" fill="none" className="scale-125">
        <rect y="0" fill="#DC4437" width="130" height="13.3"/>
        <rect y="26.7" fill="#DC4437" width="130" height="13.3"/>
        <rect y="80" fill="#DC4437" width="130" height="13.3"/>
        <rect y="106.7" fill="#DC4437" width="130" height="13.3"/>
        <rect y="53.3" fill="#DC4437" width="130" height="13.3"/>
        <rect y="13.3" fill="#FFFFFF" width="130" height="13.3"/>
        <rect y="40" fill="#FFFFFF" width="130" height="13.3"/>
        <rect y="93.3" fill="#FFFFFF" width="130" height="13.3"/>
        <rect y="66.7" fill="#FFFFFF" width="130" height="13.3"/>
        <rect y="0" fill="#2A66B7" width="70" height="66.7"/>
      </svg>
    );
  };

  const getFulfillmentProgressPercentage = (status: OrderDetail["status"]) => {
    switch (status) {
      case "PLACED":
        return 20;
      case "CONFIRMED":
        return 40;
      case "PACKED":
        return 60;
      case "SHIPPED":
        return 80;
      case "DELIVERED":
        return 100;
      default:
        return 0;
    }
  };

  const getProgressBars = (status: OrderDetail["status"]) => {
    const percentage = getFulfillmentProgressPercentage(status);
    const filledBars = Math.round((percentage / 100) * 10);

    const getBarColor = (index: number) => {
      if (index >= filledBars) {
        return "bg-muted/40 border border-border/30";
      }
      
      switch (status) {
        case "DELIVERED":
          return "bg-foreground/60";
        case "SHIPPED":
          return "bg-blue-500/60";
        case "PACKED":
          return "bg-yellow-500/60";
        case "CONFIRMED":
          return "bg-purple-500/60";
        case "PLACED":
          return "bg-orange-500/60";
        default:
          return "bg-foreground/60";
      }
    };

    return (
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className={`w-1.5 h-5 rounded-full transition-all duration-500 ${getBarColor(index)}`}
            />
          ))}
        </div>
        <span className="text-sm font-mono text-foreground font-medium min-w-[3rem]">
          {percentage}%
        </span>
      </div>
    );
  };

  const getStatusBadge = (status: OrderDetail["status"]) => {
    switch (status) {
      case "DELIVERED":
        return (
          <div className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <span className="text-green-400 text-sm font-medium">Delivered</span>
          </div>
        );
      case "SHIPPED":
        return (
          <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <span className="text-blue-400 text-sm font-medium">Shipped</span>
          </div>
        );
      case "PACKED":
        return (
          <div className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
            <span className="text-yellow-400 text-sm font-medium">Packed</span>
          </div>
        );
      case "CONFIRMED":
        return (
          <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
            <span className="text-purple-400 text-sm font-medium">Confirmed</span>
          </div>
        );
      case "PLACED":
        return (
          <div className="px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
            <span className="text-orange-400 text-sm font-medium animate-pulse">Placed</span>
          </div>
        );
    }
  };

  const getStatusGradient = (status: OrderDetail["status"]) => {
    switch (status) {
      case "DELIVERED":
        return "from-green-500/10 to-transparent";
      case "SHIPPED":
        return "from-blue-500/10 to-transparent";
      case "PACKED":
        return "from-yellow-500/10 to-transparent";
      case "CONFIRMED":
        return "from-purple-500/10 to-transparent";
      case "PLACED":
        return "from-orange-500/10 to-transparent";
    }
  };

  return (
    <div className={`w-full max-w-7xl mx-auto p-6 ${className}`}>
      <div className="relative border border-border/30 rounded-2xl p-6 bg-card">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h1 className="text-xl font-medium text-foreground">Orders Fulfillment Monitor</h1>
            </div>
            <div className="text-sm text-muted-foreground">
              {orders.filter(o => o.status === "DELIVERED").length} Fulfilled • {orders.filter(o => o.status !== "DELIVERED").length} Pending
            </div>
          </div>
        </div>

        {/* Table Rows */}
        <motion.div
          className="space-y-2"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.08,
                delayChildren: 0.1,
              }
            }
          }}
          initial="hidden"
          animate="visible"
        >
          {/* Table Headers */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-1">No</div>
            <div className="col-span-3">Order Info & Items</div>
            <div className="col-span-2">Shipping Hub</div>
            <div className="col-span-2">Grand Total</div>
            <div className="col-span-3">Fulfillment Progress</div>
            <div className="col-span-1 text-right">Status</div>
          </div>

          {orders.map((order, idx) => (
            <motion.div
              key={order.id}
              variants={{
                hidden: { 
                  opacity: 0, 
                  x: -25,
                  scale: 0.95,
                  filter: "blur(4px)" 
                },
                visible: {
                  opacity: 1,
                  x: 0,
                  scale: 1,
                  filter: "blur(0px)",
                  transition: {
                    type: "spring",
                    stiffness: 400,
                    damping: 28,
                    mass: 0.6,
                  },
                },
              }}
              className="relative cursor-pointer"
              onMouseEnter={() => setHoveredOrder(order.id)}
              onMouseLeave={() => setHoveredOrder(null)}
              onClick={() => openOrderModal(order)}
            >
              <motion.div
                className="relative bg-muted/50 border border-border/50 rounded-xl p-4 overflow-hidden"
                whileHover={{
                  y: -1,
                  transition: { type: "spring", stiffness: 400, damping: 25 }
                }}
              >
                {/* Status gradient overlay */}
                <div 
                  className={`absolute inset-0 bg-gradient-to-l ${getStatusGradient(order.status)} pointer-events-none`}
                  style={{ 
                    backgroundSize: "30% 100%", 
                    backgroundPosition: "right",
                    backgroundRepeat: "no-repeat"
                  }} 
                />

                <div className="relative grid grid-cols-12 gap-4 items-center">
                  {/* Index No */}
                  <div className="col-span-1">
                    <span className="text-2xl font-bold text-muted-foreground">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>

                  {/* Order ID & Item Image */}
                  <div className="col-span-3 flex items-center gap-3">
                    <img 
                      src={order.items[0]?.image || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=100"} 
                      alt="Order item preview" 
                      className="w-8 h-8 rounded-lg object-cover border border-border/30 bg-muted"
                    />
                    <div className="truncate">
                      <span className="text-foreground font-medium text-sm block">
                        {order.id}
                      </span>
                      <span className="text-xs text-muted-foreground block truncate">
                        {order.items.map(it => `${it.quantity}x ${it.name}`).join(", ")}
                      </span>
                    </div>
                  </div>

                  {/* Location Hub */}
                  <div className="col-span-2 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-border/30 flex items-center justify-center shrink-0">
                      <div className="w-full h-full scale-125 flex items-center justify-center">
                        {getCountryFlag(order.address.country)}
                      </div>
                    </div>
                    <span className="text-foreground font-medium text-sm truncate">
                      {order.address.city}, {order.address.country}
                    </span>
                  </div>

                  {/* Grand Total */}
                  <div className="col-span-2">
                    <span className="text-foreground font-mono text-sm font-semibold">
                      ₹{order.totalAmount}
                    </span>
                    <span className="block text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      {order.paymentStatus === "COMPLETED" ? "Paid" : "Pending"}
                    </span>
                  </div>

                  {/* Progress Bars */}
                  <div className="col-span-3">
                    {getProgressBars(order.status)}
                  </div>

                  {/* Status Badge */}
                  <div className="col-span-1 flex justify-end">
                    {getStatusBadge(order.status)}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* Detailed Order Overlay Drawer */}
        <AnimatePresence>
          {selectedOrder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col rounded-2xl z-20 overflow-hidden"
            >
              {/* Header with Actions */}
              <div className="relative bg-gradient-to-r from-muted/50 to-transparent p-4 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-muted-foreground">
                    {String(orders.findIndex(o => o.id === selectedOrder.id) + 1).padStart(2, "0")}
                  </div>
                  <img 
                    src={selectedOrder.items[0]?.image || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=100"} 
                    alt="Order preview" 
                    className="w-8 h-8 rounded-lg object-cover border border-border/30 bg-muted"
                  />
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {selectedOrder.id}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-border/30 flex items-center justify-center shrink-0">
                        <div className="w-full h-full scale-125 flex items-center justify-center">
                          {getCountryFlag(selectedOrder.address.country)}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {selectedOrder.address.city}, {selectedOrder.address.country}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Logistics Control Actions */}
                <div className="flex items-center gap-2">
                  {selectedOrder.status !== "DELIVERED" ? (
                    <motion.button
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm transition-colors cursor-pointer"
                      onClick={() => onUpdateStatus(selectedOrder.id, selectedOrder.status)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Play className="w-3 h-3 fill-green-400" />
                      <span>
                        {selectedOrder.status === "PLACED" && "Confirm Order"}
                        {selectedOrder.status === "CONFIRMED" && "Pack Order"}
                        {selectedOrder.status === "PACKED" && "Ship Order"}
                        {selectedOrder.status === "SHIPPED" && "Complete Delivery"}
                      </span>
                    </motion.button>
                  ) : (
                    <div className="flex items-center space-x-1.5 text-sm text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Order Completed</span>
                    </div>
                  )}

                  {/* Hold Order Toggle Simulation */}
                  {selectedOrder.status !== "DELIVERED" && (
                    <motion.button
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm transition-colors cursor-pointer"
                      onClick={() => alert("Simulation Hold: Logistics queue paused for verification checks.")}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Pause className="w-3 h-3" />
                      Hold
                    </motion.button>
                  )}

                  {/* Close button */}
                  <motion.button
                    className="w-8 h-8 bg-background/80 hover:bg-background rounded-full flex items-center justify-center border border-border/50 ml-2 cursor-pointer"
                    onClick={closeOrderModal}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Grand Total Cost */}
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Total Invoice Amount
                    </label>
                    <div className="text-sm font-mono font-medium mt-1">
                      ₹{selectedOrder.totalAmount}
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Gateway Authorization
                    </label>
                    <div className="mt-1">
                      <Badge variant={selectedOrder.paymentStatus === "COMPLETED" ? "success" : "primary"}>
                        {selectedOrder.paymentStatus === "COMPLETED" ? "Success (Paid)" : "Pending"}
                      </Badge>
                    </div>
                  </div>

                  {/* Current Status */}
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Fulfillment Status
                    </label>
                    <div className="mt-1">
                      {getStatusBadge(selectedOrder.status)}
                    </div>
                  </div>
                </div>

                {/* Progress Visualizer */}
                <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                    Fulfillment Pipeline Progress
                  </label>
                  {getProgressBars(selectedOrder.status)}
                </div>

                {/* Items detail list */}
                <div className="bg-muted/40 rounded-lg p-3 border border-border/30 space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block border-b border-border/20 pb-1.5">
                    Ordered Goods Description
                  </label>
                  <div className="divide-y divide-border/20 max-h-36 overflow-y-auto">
                    {selectedOrder.items.map((it) => (
                      <div key={it.productId} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center space-x-3">
                          <img src={it.image || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600"} alt={it.name} className="w-10 h-10 object-cover rounded border" />
                          <div>
                            <h4 className="text-xs font-bold text-foreground">{it.name}</h4>
                            <span className="text-[10px] text-muted-foreground">Quantity: {it.quantity}</span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-foreground">₹{it.price * it.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logistics timeline track */}
                <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block border-b border-border/20 pb-1.5">
                    Recent Activity
                  </label>
                  <div className="font-mono text-xs space-y-1 max-h-28 overflow-y-auto">
                    {selectedOrder.timeline?.length > 0 ? (
                      selectedOrder.timeline.map((log, idx) => {
                        let colorClass = "text-muted-foreground";
                        if (log.status === "DELIVERED") {
                          colorClass = "text-green-400";
                        } else if (log.status === "SHIPPED") {
                          colorClass = "text-blue-400";
                        } else if (log.status === "PACKED") {
                          colorClass = "text-yellow-400";
                        } else if (log.status === "CONFIRMED") {
                          colorClass = "text-purple-400";
                        } else if (log.status === "PLACED") {
                          colorClass = "text-orange-400";
                        }
                        return (
                          <div key={idx} className="flex items-start space-x-2">
                            <span className="text-muted-foreground">
                              [{new Date(log.createdAt).toLocaleTimeString("en-IN", { hour12: false })}]
                            </span>
                            <span className={colorClass}>
                              {log.description}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <>
                        <div className="text-green-400">[12:00:00] Order initialized successfully</div>
                        <div className="text-blue-400">[12:05:00] Payment authorization complete</div>
                        <div className="text-yellow-400">[12:10:00] Ready for confirmation</div>
                        <div className="text-muted-foreground">[System Initialize] Awaiting seller validation</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
