"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import { X, Play, Pause, CheckCircle2, Building, ExternalLink, FileText, Globe, Download, AlertTriangle } from "lucide-react";
import { SellerProfile } from "@/actions/sellers";
import { Badge, Input, Textarea } from "@/components/ui/shared";
import { getDocumentPreviewInfo } from "@/lib/cloudinary-utils";

interface SellerApprovalTableProps {
  sellers: SellerProfile[];
  onApprove: (
    userId: string, 
    badges: string[],
    updatedFields: {
      companyName?: string;
      businessType?: string;
      website?: string;
      gstNumber?: string;
      panNumber?: string;
    }
  ) => Promise<void>;
  onReject: (
    userId: string, 
    reason: string,
    updatedFields: {
      companyName?: string;
      businessType?: string;
      website?: string;
      gstNumber?: string;
      panNumber?: string;
    }
  ) => Promise<void>;
  className?: string;
}

export function SellerApprovalTable({
  sellers,
  onApprove,
  onReject,
  className = ""
}: SellerApprovalTableProps) {
  const [hoveredSeller, setHoveredSeller] = useState<string | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<SellerProfile | null>(null);
  const [activeDocUrl, setActiveDocUrl] = useState<string | null>(null);
  const [activeDocName, setActiveDocName] = useState<string | null>(null);

  // Editable fields states
  const [companyNameInput, setCompanyNameInput] = useState("");
  const [businessTypeInput, setBusinessTypeInput] = useState("");
  const [websiteInput, setWebsiteInput] = useState("");
  const [gstInput, setGstInput] = useState("");
  const [panInput, setPanInput] = useState("");

  // Badge selections for Approval
  const [badgeVerifiedBusiness, setBadgeVerifiedBusiness] = useState(true);
  const [badgeSustainableMfg, setBadgeSustainableMfg] = useState(true);
  const [badgePremiumSeller, setBadgePremiumSeller] = useState(false);

  // Rejection Reason
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);

  const shouldReduceMotion = useReducedMotion();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const openSellerModal = (seller: SellerProfile) => {
    setSelectedSeller(seller);
    setActiveDocUrl(null);
    setActiveDocName(null);
    setShowRejectForm(false);
    setRejectionReason("");
    // Default badge selections
    setBadgeVerifiedBusiness(true);
    setBadgeSustainableMfg(true);
    setBadgePremiumSeller(false);
    // Initialize editable inputs
    setCompanyNameInput(seller.companyName || "");
    setBusinessTypeInput(seller.businessType || "");
    setWebsiteInput(seller.website || "");
    setGstInput(seller.gstNumber || "");
    setPanInput(seller.panNumber || "");
  };

  const closeSellerModal = () => {
    setSelectedSeller(null);
  };

  // Sync selected seller state updates
  useEffect(() => {
    if (selectedSeller) {
      const updated = sellers.find(s => s.id === selectedSeller.id);
      if (updated) {
        setSelectedSeller(updated);
      }
    }
  }, [sellers, selectedSeller]);

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

  const getStatusBadge = (status: SellerProfile["verificationStatus"]) => {
    switch (status) {
      case "APPROVED":
        return (
          <div className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <span className="text-green-400 text-sm font-medium">Approved</span>
          </div>
        );
      case "REJECTED":
        return (
          <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <span className="text-red-400 text-sm font-medium">Rejected</span>
          </div>
        );
      case "PENDING":
        return (
          <div className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
            <span className="text-yellow-400 text-sm font-medium animate-pulse">Pending Audit</span>
          </div>
        );
    }
  };

  const getStatusGradient = (status: SellerProfile["verificationStatus"]) => {
    switch (status) {
      case "APPROVED":
        return "from-green-500/10 to-transparent";
      case "REJECTED":
        return "from-red-500/10 to-transparent";
      case "PENDING":
        return "from-yellow-500/10 to-transparent";
    }
  };

  const handleApproveAction = async () => {
    if (!selectedSeller) return;
    setIsSubmitting(true);
    try {
      const selectedBadges: string[] = [];
      if (badgeVerifiedBusiness) selectedBadges.push("Verified Business");
      if (badgeSustainableMfg) selectedBadges.push("Verified Sustainable Manufacturer");
      if (badgePremiumSeller) selectedBadges.push("Premium Verified Seller");

      await onApprove(selectedSeller.userId, selectedBadges, {
        companyName: companyNameInput,
        businessType: businessTypeInput,
        website: websiteInput,
        gstNumber: gstInput,
        panNumber: panInput,
      });
      closeSellerModal();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectAction = async () => {
    if (!selectedSeller || !rejectionReason) return;
    setIsSubmitting(true);
    try {
      await onReject(selectedSeller.userId, rejectionReason, {
        companyName: companyNameInput,
        businessType: businessTypeInput,
        website: websiteInput,
        gstNumber: gstInput,
        panNumber: panInput,
      });
      closeSellerModal();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`w-full max-w-7xl mx-auto p-6 ${className}`}>
      <div className="relative border border-border/30 rounded-2xl p-6 bg-card">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <h1 className="text-xl font-medium text-foreground">Seller Verification Queue</h1>
            </div>
            <div className="text-sm text-muted-foreground">
              {sellers.filter(s => s.verificationStatus === "PENDING").length} Awaiting Audits • {sellers.filter(s => s.verificationStatus === "APPROVED").length} Approved
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
            <div className="col-span-3">Company & Business Type</div>
            <div className="col-span-2">Website</div>
            <div className="col-span-2">Identity Codes</div>
            <div className="col-span-2">Attached Documents</div>
            <div className="col-span-2 text-right">Status</div>
          </div>

          {sellers.map((seller, idx) => (
            <motion.div
              key={seller.id}
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
              onMouseEnter={() => setHoveredSeller(seller.id)}
              onMouseLeave={() => setHoveredSeller(null)}
              onClick={() => openSellerModal(seller)}
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
                  className={`absolute inset-0 bg-gradient-to-l ${getStatusGradient(seller.verificationStatus)} pointer-events-none`}
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

                  {/* Company Name */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center border border-border/30 shrink-0">
                      <Building className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="truncate">
                      <span className="text-foreground font-medium text-sm block">
                        {seller.companyName}
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        {seller.businessType}
                      </span>
                    </div>
                  </div>

                  {/* Website */}
                  <div className="col-span-2">
                    {seller.website ? (
                      <a 
                        href={seller.website} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-primary hover:underline text-sm font-medium inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Globe className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[120px]">{seller.website.replace("https://", "").replace("http://", "")}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No Website</span>
                    )}
                  </div>

                  {/* Identity Codes */}
                  <div className="col-span-2">
                    <span className="text-foreground font-mono text-xs block">
                      GST: {seller.gstNumber || "N/A"}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono block">
                      PAN: {seller.panNumber || "N/A"}
                    </span>
                  </div>

                  {/* Documents count */}
                  <div className="col-span-2 flex items-center gap-2">
                    <FileText className="h-4.5 w-4.5 text-muted-foreground" />
                    <span className="text-foreground text-sm font-medium">
                      {seller.documents?.length || 0} files
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="col-span-2 flex justify-end">
                    {getStatusBadge(seller.verificationStatus)}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* Detailed Seller Overlay Drawer */}
        <AnimatePresence>
          {selectedSeller && (
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
                    {String(sellers.findIndex(s => s.id === selectedSeller.id) + 1).padStart(2, "0")}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center border border-border/30">
                    <Building className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {selectedSeller.companyName}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {selectedSeller.businessType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Audit Actions */}
                <div className="flex items-center gap-2">
                  {selectedSeller.verificationStatus === "PENDING" ? (
                    <>
                      {!showRejectForm ? (
                        <>
                          <motion.button
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm transition-colors cursor-pointer"
                            onClick={handleApproveAction}
                            disabled={isSubmitting}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Play className="w-3 h-3 fill-green-400" />
                            Approve
                          </motion.button>
                          <motion.button
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm transition-colors cursor-pointer"
                            onClick={() => setShowRejectForm(true)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <X className="w-3 h-3" />
                            Reject
                          </motion.button>
                        </>
                      ) : (
                        <>
                          <motion.button
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-lg text-sm transition-colors cursor-pointer font-bold"
                            onClick={handleRejectAction}
                            disabled={isSubmitting || !rejectionReason}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Confirm Rejection
                          </motion.button>
                          <motion.button
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground border border-border/40 rounded-lg text-sm transition-colors cursor-pointer"
                            onClick={() => setShowRejectForm(false)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Cancel
                          </motion.button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center space-x-1.5 text-sm text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Audit Complete: {selectedSeller.verificationStatus}</span>
                    </div>
                  )}

                  {/* Close button */}
                  <motion.button
                    className="w-8 h-8 bg-background/80 hover:bg-background rounded-full flex items-center justify-center border border-border/50 ml-2 cursor-pointer"
                    onClick={closeSellerModal}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Company Name */}
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={companyNameInput}
                      onChange={(e) => setCompanyNameInput(e.target.value)}
                      className="w-full bg-background/50 border border-border/40 rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Business Type */}
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                      Business Type
                    </label>
                    <input
                      type="text"
                      value={businessTypeInput}
                      onChange={(e) => setBusinessTypeInput(e.target.value)}
                      className="w-full bg-background/50 border border-border/40 rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Website link */}
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                      Website URL
                    </label>
                    <input
                      type="text"
                      value={websiteInput}
                      onChange={(e) => setWebsiteInput(e.target.value)}
                      className="w-full bg-background/50 border border-border/40 rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* GST */}
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                      GST Identification No
                    </label>
                    <input
                      type="text"
                      value={gstInput}
                      onChange={(e) => setGstInput(e.target.value)}
                      className="w-full bg-background/50 border border-border/40 rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* PAN */}
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                      Business PAN Code
                    </label>
                    <input
                      type="text"
                      value={panInput}
                      onChange={(e) => setPanInput(e.target.value)}
                      className="w-full bg-background/50 border border-border/40 rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Badges Assignor (visible if pending) */}
                {selectedSeller.verificationStatus === "PENDING" && !showRejectForm && (
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/30 space-y-3">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                      Sustainability Trust Badges Allocation
                    </label>
                    <div className="flex flex-wrap gap-4 text-xs">
                      <label className="flex items-center space-x-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={badgeVerifiedBusiness}
                          onChange={(e) => setBadgeVerifiedBusiness(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-border text-primary cursor-pointer"
                        />
                        <span className="font-semibold text-foreground">Verified Business</span>
                      </label>

                      <label className="flex items-center space-x-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={badgeSustainableMfg}
                          onChange={(e) => setBadgeSustainableMfg(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-border text-primary cursor-pointer"
                        />
                        <span className="font-semibold text-foreground">Verified Sustainable Manufacturer</span>
                      </label>

                      <label className="flex items-center space-x-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={badgePremiumSeller}
                          onChange={(e) => setBadgePremiumSeller(e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-border text-primary cursor-pointer"
                        />
                        <span className="font-semibold text-foreground">Premium Verified Seller</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Rejection Reason Form */}
                {showRejectForm && (
                  <div className="bg-red-500/5 rounded-lg p-3 border border-red-500/25 space-y-2">
                    <label className="text-xs font-medium text-red-400 uppercase tracking-wider block">
                      Enter Audit Failure Comments
                    </label>
                    <Textarea
                      placeholder="e.g. Uploaded GST registration scan is illegible. Please scan and re-submit a clean PDF document."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>
                )}

                {/* Documents Review Center */}
                <div className="bg-muted/40 rounded-lg p-3 border border-border/30 space-y-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block border-b border-border/20 pb-1.5">
                    Document Review Center
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedSeller.documents && selectedSeller.documents.length > 0 ? (
                      selectedSeller.documents.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => {
                            setActiveDocUrl(doc.fileUrl);
                            setActiveDocName(doc.fileName);
                          }}
                          className={`inline-flex items-center space-x-1.5 text-xs rounded-lg px-3 py-1.5 border transition-colors cursor-pointer ${
                            activeDocName === doc.fileName
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted border-border/60 text-muted-foreground"
                          }`}
                        >
                          <FileText className="h-4 w-4" />
                          <span>{doc.type}</span>
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No identity files uploaded yet.</span>
                    )}
                  </div>

                  {/* Interactive Document Preview Box inside the Drawer */}
                  {activeDocUrl && (() => {
                    const previewInfo = getDocumentPreviewInfo(activeDocUrl, activeDocName || undefined);
                    return (
                      <div className="border border-border/30 rounded-xl bg-muted/20 overflow-hidden relative p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border/10 pb-1.5">
                          <span className="font-medium text-foreground">Previewing: {activeDocName}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDocUrl(null);
                              setActiveDocName(null);
                            }}
                            className="hover:text-foreground text-muted-foreground cursor-pointer text-xs"
                          >
                            Hide Preview
                          </button>
                        </div>

                        {previewInfo.isLegacyMock && (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                            <span>Legacy placeholder record. Seller must re-upload actual document.</span>
                          </div>
                        )}

                        <div className="aspect-video w-full max-h-64 rounded-lg overflow-hidden bg-black/5 dark:bg-black/30 relative flex items-center justify-center border border-border/30">
                          {previewInfo.isAvailable ? (
                            <img
                              src={previewInfo.previewUrl}
                              alt={activeDocName || "Document Preview"}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="text-center p-4 text-xs text-muted-foreground space-y-1">
                              <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
                              <p>Document preview unavailable</p>
                            </div>
                          )}

                          {previewInfo.isPdf && (
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-600/90 text-white font-bold text-[10px] uppercase tracking-wider shadow">
                              PDF Preview (Page 1)
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          {previewInfo.cleanUrl && !previewInfo.isLegacyMock && (
                            <>
                              <a
                                href={previewInfo.cleanUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>Open Full Document</span>
                              </a>
                              <a
                                href={previewInfo.cleanUrl}
                                download={activeDocName || "document"}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/80 border border-border/40 transition-colors"
                              >
                                <Download className="h-3 w-3" />
                                <span>Download</span>
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Brand description / values */}
                {selectedSeller.description && (
                  <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                      Brand Bio & Mission Statement
                    </label>
                    <p className="text-xs text-foreground leading-relaxed italic">
                      "{selectedSeller.description}"
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
