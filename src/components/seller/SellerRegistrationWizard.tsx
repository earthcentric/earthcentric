"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  getSellerProfile,
  submit3StepSellerVerification,
  SellerProfile,
} from "@/actions/sellers";
import {
  validatePhone,
  validateGSTIN,
  validatePAN,
  validateAadhaar,
  validateIFSC,
  validateStep1,
  validateStep2,
  validateStep3,
  validateFullApplication,
  UploadedDocRef,
} from "@/lib/seller-validation";
import {
  Building,
  FileText,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Upload,
  CheckCircle2,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  X,
  FileCheck,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  Lock,
} from "lucide-react";
import CategoryTypeahead from "@/components/ui/CategoryTypeahead";
import { SellerRegistrationFeeCard } from "@/components/seller/SellerRegistrationFeeCard";
import { isGrandfatheredSeller } from "@/lib/seller-verification-constants";

export interface SellerRegistrationWizardProps {

  userId: string;
  onSuccess?: () => void;
}

const STORAGE_KEY_PREFIX = "earthcentric_seller_reg_";

export function SellerRegistrationWizard({ userId, onSuccess }: SellerRegistrationWizardProps) {
  const router = useRouter();
  const { user, updateSellerStatus } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // ── Step 1: Company Identity ──
  const [companyName, setCompanyName] = useState("");
  const [founderName, setFounderName] = useState("");
  const [businessType, setBusinessType] = useState("Manufacturer");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [factoryAddress, setFactoryAddress] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [logoDoc, setLogoDoc] = useState<UploadedDocRef | null>(null);

  // ── Step 2: Legal Verification Documents ──
  const [gstNumber, setGstNumber] = useState("");
  const [gstDoc, setGstDoc] = useState<UploadedDocRef | null>(null);

  const [panNumber, setPanNumber] = useState("");
  const [panDoc, setPanDoc] = useState<UploadedDocRef | null>(null);

  const [aadharNumber, setAadharNumber] = useState("");
  const [aadharDoc, setAadharDoc] = useState<UploadedDocRef | null>(null);

  const [certDocs, setCertDocs] = useState<UploadedDocRef[]>([]);

  const [bankName, setBankName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankProofDoc, setBankProofDoc] = useState<UploadedDocRef | null>(null);

  // ── Step 3: Product Launch (initial product) ──
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState("Eco Packaging");
  const [prodUnit, setProdUnit] = useState("Piece");
  const [prodPrice, setProdPrice] = useState("");
  const [prodWholesalePrice, setProdWholesalePrice] = useState("");
  const [prodOriginalPrice, setProdOriginalPrice] = useState("");
  const [prodStock, setProdStock] = useState("");
  const [prodScore, setProdScore] = useState(90);
  const [prodMaterial, setProdMaterial] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [manualImageUrl, setManualImageUrl] = useState("");

  // Validation Error State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // ── Session draft helper (retains seller's in-progress inputs across step changes & re-renders) ──
  const saveDraftLocally = () => {
    if (typeof window === "undefined" || !userId) return;
    try {
      const draft = {
        step,
        companyName,
        founderName,
        businessType,
        phone,
        website,
        description,
        companyAddress,
        factoryAddress,
        pickupAddress,
        logoDoc,
        gstDoc,
        panDoc,
        aadharDoc,
        certDocs,
        bankProofDoc,
        gstNumber,
        panNumber,
        aadharNumber,
        bankName,
        bankAccountNo,
        bankIfsc,
        prodName,
        prodCategory,
        prodUnit,
        prodPrice,
        prodWholesalePrice,
        prodOriginalPrice,
        prodStock,
        prodScore,
        prodMaterial,
        prodDescription,
        prodImages,
      };
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(draft));
    } catch (e) {
      // Ignore sessionStorage errors
    }
  };

  const loadDraftLocally = () => {
    if (typeof window === "undefined" || !userId) return null;
    try {
      const saved = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  };

  const clearDraftLocally = () => {
    if (typeof window === "undefined" || !userId) return;
    try {
      sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${userId}`);
    } catch (e) {}
  };

  // Sync draft whenever wizard state updates
  useEffect(() => {
    if (!loading && (!sellerProfile || sellerProfile.verificationStatus === "REJECTED" || sellerProfile.verificationStatus === "NEED_MORE_DOCS")) {
      saveDraftLocally();
    }
  }, [
    step,
    companyName,
    founderName,
    businessType,
    phone,
    website,
    description,
    companyAddress,
    factoryAddress,
    pickupAddress,
    logoDoc,
    gstDoc,
    panDoc,
    aadharDoc,
    certDocs,
    bankProofDoc,
    gstNumber,
    panNumber,
    aadharNumber,
    bankName,
    bankAccountNo,
    bankIfsc,
    prodName,
    prodCategory,
    prodUnit,
    prodPrice,
    prodWholesalePrice,
    prodOriginalPrice,
    prodStock,
    prodScore,
    prodMaterial,
    prodDescription,
    prodImages,
  ]);

  const hasInitializedRef = useRef(false);

  // Initial load: Fetch profile from DB or restore local draft
  useEffect(() => {
    if (hasInitializedRef.current) return;
    let mounted = true;

    const init = async () => {
      setLoading(true);
      try {
        const p = await getSellerProfile(userId);
        if (!mounted) return;

        // Restore active draft from sessionStorage first
        const draft = loadDraftLocally();
        if (draft) {
          if (draft.step) setStep(draft.step);
          if (draft.companyName) setCompanyName(draft.companyName);
          if (draft.founderName) setFounderName(draft.founderName);
          if (draft.businessType) setBusinessType(draft.businessType);
          if (draft.phone) setPhone(draft.phone);
          if (draft.website) setWebsite(draft.website);
          if (draft.description) setDescription(draft.description);
          if (draft.companyAddress) setCompanyAddress(draft.companyAddress);
          if (draft.factoryAddress) setFactoryAddress(draft.factoryAddress);
          if (draft.pickupAddress) setPickupAddress(draft.pickupAddress);
          if (draft.logoDoc) setLogoDoc(draft.logoDoc);
          if (draft.gstDoc) setGstDoc(draft.gstDoc);
          if (draft.panDoc) setPanDoc(draft.panDoc);
          if (draft.aadharDoc) setAadharDoc(draft.aadharDoc);
          if (draft.certDocs) setCertDocs(draft.certDocs);
          if (draft.bankProofDoc) setBankProofDoc(draft.bankProofDoc);
          if (draft.gstNumber) setGstNumber(draft.gstNumber);
          if (draft.panNumber) setPanNumber(draft.panNumber.trim().toUpperCase().replace(/\s+/g, ""));
          if (draft.aadharNumber) setAadharNumber(draft.aadharNumber);
          if (draft.bankName) setBankName(draft.bankName);
          if (draft.bankAccountNo) setBankAccountNo(draft.bankAccountNo);
          if (draft.bankIfsc) setBankIfsc(draft.bankIfsc);
          if (draft.prodName) setProdName(draft.prodName);
          if (draft.prodCategory) setProdCategory(draft.prodCategory);
          if (draft.prodUnit) setProdUnit(draft.prodUnit);
          if (draft.prodPrice) setProdPrice(draft.prodPrice);
          if (draft.prodWholesalePrice) setProdWholesalePrice(draft.prodWholesalePrice);
          if (draft.prodOriginalPrice) setProdOriginalPrice(draft.prodOriginalPrice);
          if (draft.prodStock) setProdStock(draft.prodStock);
          if (draft.prodScore) setProdScore(draft.prodScore);
          if (draft.prodMaterial) setProdMaterial(draft.prodMaterial);
          if (draft.prodDescription) setProdDescription(draft.prodDescription);
          if (draft.prodImages) setProdImages(draft.prodImages);
        }

        if (p) {
          setSellerProfile(p);
          if (!draft?.companyName && p.companyName) setCompanyName(p.companyName);
          if (!draft?.founderName) setFounderName(p.founderName || p.ownerName || p.userName || user?.name || "");
          if (!draft?.businessType && p.businessType) setBusinessType(p.businessType);
          if (!draft?.phone && p.phone) setPhone(p.phone);
          if (!draft?.website && p.website) setWebsite(p.website);
          if (!draft?.description && p.description) setDescription(p.description);
          if (!draft?.gstNumber && p.gstNumber) setGstNumber(p.gstNumber);
          if (!draft?.panNumber && p.panNumber) setPanNumber(p.panNumber.trim().toUpperCase().replace(/\s+/g, ""));
          if (!draft?.aadharNumber && p.aadharNumber) setAadharNumber(p.aadharNumber);
          if (!draft?.companyAddress && p.companyAddress) setCompanyAddress(p.companyAddress);
          if (!draft?.factoryAddress && p.factoryAddress) setFactoryAddress(p.factoryAddress);
          if (!draft?.pickupAddress && p.pickupAddress) setPickupAddress(p.pickupAddress);
          if (!draft?.bankName && p.bankName) setBankName(p.bankName);
          if (!draft?.bankAccountNo && p.bankAccountNo) setBankAccountNo(p.bankAccountNo);
          if (!draft?.bankIfsc && p.bankIfsc) setBankIfsc(p.bankIfsc);

          if (!draft?.logoDoc && p.logoUrl) {
            setLogoDoc({ name: "Company Logo", url: p.logoUrl });
          }

          // Map documents
          if (!draft?.gstDoc) {
            const gst = p.documents.find((d) => d.type === "GST");
            if (gst && !gst.fileUrl.includes("images.unsplash.com")) {
              setGstDoc({ name: gst.fileName, url: gst.fileUrl, format: (gst as any).format });
            }
          }

          if (!draft?.panDoc) {
            const pan = p.documents.find((d) => d.type === "PAN");
            if (pan && !pan.fileUrl.includes("images.unsplash.com")) {
              setPanDoc({ name: pan.fileName, url: pan.fileUrl, format: (pan as any).format });
            }
          }

          if (!draft?.aadharDoc) {
            const aadhar = p.documents.find((d) => d.type === "AADHAR");
            if (aadhar && !aadhar.fileUrl.includes("images.unsplash.com")) {
              setAadharDoc({ name: aadhar.fileName, url: aadhar.fileUrl, format: (aadhar as any).format });
            }
          }

          if (!draft?.certDocs || draft.certDocs.length === 0) {
            const certs = p.documents
              .filter((d) => d.type === "SUSTAINABILITY_CERTIFICATE" && !d.fileUrl.includes("images.unsplash.com"))
              .map((d) => ({ name: d.fileName, url: d.fileUrl, format: (d as any).format }));
            if (certs.length > 0) setCertDocs(certs);
          }

          if (!draft?.bankProofDoc) {
            const bankDocItem = p.documents.find((d) => d.type === "BANK_PROOF");
            if (bankDocItem) {
              setBankProofDoc({ name: bankDocItem.fileName, url: bankDocItem.fileUrl });
            }
          }

          if (p.verificationStatus === "APPROVED" && updateSellerStatus) {
            updateSellerStatus("APPROVED", p.badges);
          }
        } else if (!draft && user?.name) {
          setFounderName(user.name);
        }

        hasInitializedRef.current = true;
      } catch (err) {
        console.error("Error loading seller profile:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();

    return () => {
      mounted = false;
    };
  }, [userId]);

  // ── Real-time File Upload Handler ──
  const handleUploadFile = async (
    file: File,
    docType: string,
    folder: string,
    onSuccessUpload: (doc: UploadedDocRef) => void
  ) => {
    setUploadingField(docType);
    const toastId = toast.loading(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);
      formData.append("docType", docType);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Upload failed. Please try again.");
      }

      let sanitizedFileName = data.fileName || file.name || `${docType.toLowerCase()}_document`;
      if (sanitizedFileName.toLowerCase().startsWith("undefined")) {
        const ext = file.name?.split(".").pop() || data.format || "pdf";
        sanitizedFileName = `${docType.toLowerCase()}_document.${ext}`;
      }

      const docRef: UploadedDocRef = {
        name: sanitizedFileName,
        url: data.url,
        publicId: data.publicId,
        format: data.format,
        resourceType: data.resourceType,
        size: data.fileSize || file.size,
      };

      onSuccessUpload(docRef);
      toast.success(`Successfully uploaded ${sanitizedFileName}`, { id: toastId });

      // Clear any previous error on this field
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[docType];
        if (docType === "GST") delete next.gstDoc;
        if (docType === "PAN") delete next.panDoc;
        if (docType === "AADHAR") delete next.aadharDoc;
        if (docType === "LOGO") delete next.logoDoc;
        return next;
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "File upload failed.", { id: toastId });
    } finally {
      setUploadingField(null);
    }
  };

  // ── Phone input change handler (disallows alphabets strictly) ──
  const handlePhoneChange = (val: string) => {
    // Strip alphabets and non-phone characters, keep digits, spaces, hyphens, and leading +
    const sanitized = val.replace(/[a-zA-Z]/g, "").replace(/[^0-9+\s-]/g, "");
    setPhone(sanitized);

    if (sanitized.trim().length > 0) {
      const res = validatePhone(sanitized);
      if (!res.valid) {
        setFieldErrors((prev) => ({ ...prev, phone: res.error || "Invalid phone number." }));
      } else {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.phone;
          return next;
        });
      }
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.phone;
        return next;
      });
    }
  };

  // ── Step Navigation Handlers ──
  const handleNextToStep2 = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const res = validateStep1({
      companyName,
      founderName,
      businessType,
      phone,
      description,
      companyAddress,
      website,
      factoryAddress,
      pickupAddress,
      logoUrl: logoDoc?.url,
    });

    if (!res.valid) {
      setFieldErrors(res.errors);
      const firstError = Object.values(res.errors)[0];
      toast.error(firstError || "Please fill in all required company fields.");
      return;
    }

    setFieldErrors({});
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNextToStep3 = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const res = validateStep2({
      gstNumber,
      gstDoc,
      panNumber,
      panDoc,
      aadharNumber,
      aadharDoc,
      bankIfsc,
    });

    if (!res.valid) {
      setFieldErrors(res.errors);
      const firstError = Object.values(res.errors)[0];
      toast.error(firstError || "Please provide valid legal documents.");
      return;
    }

    setFieldErrors({});
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Final Submission Handler ──
  const handleSubmitCompleteApplication = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    // Full Application Validation
    const fullValidation = validateFullApplication({
      company: {
        companyName,
        founderName,
        businessType,
        phone,
        description,
        companyAddress,
        website,
        factoryAddress,
        pickupAddress,
      },
      legal: {
        gstNumber,
        gstDoc,
        panNumber,
        panDoc,
        aadharNumber,
        aadharDoc,
        bankIfsc,
      },
      product: {
        name: prodName,
        categoryName: prodCategory,
        unit: prodUnit,
        price: prodPrice,
        wholesalePrice: prodWholesalePrice,
        originalPrice: prodOriginalPrice,
        stock: prodStock,
        description: prodDescription,
        imageUrls: prodImages,
      },
    });

    if (!fullValidation.valid) {
      // Find where the error is and highlight it
      if (Object.keys(fullValidation.errors.company).length > 0) {
        setFieldErrors(fullValidation.errors.company);
        setStep(1);
        toast.error("Please correct missing company identity details.");
        return;
      }
      if (Object.keys(fullValidation.errors.legal).length > 0) {
        setFieldErrors(fullValidation.errors.legal);
        setStep(2);
        toast.error("Please upload all required legal documents (GST, PAN, Aadhaar).");
        return;
      }
      if (Object.keys(fullValidation.errors.product).length > 0) {
        setFieldErrors(fullValidation.errors.product);
        const firstError = Object.values(fullValidation.errors.product)[0];
        toast.error(firstError || "Please complete all initial product fields.");
        return;
      }
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Submitting verification audit application...");

    try {
      // Prepare document list with verified URLs and metadata
      const documentsList: any[] = [
        {
          type: "GST",
          fileName: gstDoc!.name,
          fileUrl: gstDoc!.url,
          publicId: gstDoc!.publicId,
          format: gstDoc!.format,
          resourceType: gstDoc!.resourceType || "image",
          fileSize: gstDoc!.size,
        },
        {
          type: "PAN",
          fileName: panDoc!.name,
          fileUrl: panDoc!.url,
          publicId: panDoc!.publicId,
          format: panDoc!.format,
          resourceType: panDoc!.resourceType || "image",
          fileSize: panDoc!.size,
        },
        {
          type: "AADHAR",
          fileName: aadharDoc!.name,
          fileUrl: aadharDoc!.url,
          publicId: aadharDoc!.publicId,
          format: aadharDoc!.format,
          resourceType: aadharDoc!.resourceType || "image",
          fileSize: aadharDoc!.size,
        },
      ];

      certDocs.forEach((c) => {
        documentsList.push({
          type: "SUSTAINABILITY_CERTIFICATE",
          fileName: c.name,
          fileUrl: c.url,
          publicId: c.publicId,
          format: c.format,
          resourceType: c.resourceType || "image",
          fileSize: c.size,
        });
      });

      if (bankProofDoc) {
        documentsList.push({
          type: "BANK_PROOF",
          fileName: bankProofDoc.name,
          fileUrl: bankProofDoc.url,
          publicId: bankProofDoc.publicId,
          format: bankProofDoc.format,
          resourceType: bankProofDoc.resourceType || "image",
          fileSize: bankProofDoc.size,
        });
      }

      const res = await submit3StepSellerVerification({
        userId,
        companyName: companyName.trim(),
        founderName: founderName.trim(),
        businessType,
        description: description.trim(),
        website: website.trim() || undefined,
        phone: phone.trim(),
        gstNumber: gstNumber.trim().toUpperCase(),
        panNumber: panNumber.trim().toUpperCase(),
        aadharNumber: aadharNumber.trim(),
        logoUrl: logoDoc?.url,
        companyAddress: companyAddress.trim(),
        factoryAddress: factoryAddress.trim() || undefined,
        pickupAddress: pickupAddress.trim() || undefined,
        bankName: bankName.trim() || undefined,
        bankAccountNo: bankAccountNo.trim() || undefined,
        bankIfsc: bankIfsc.trim().toUpperCase() || undefined,
        documents: documentsList,
        product: {
          name: prodName.trim(),
          description: prodDescription.trim(),
          categoryName: prodCategory,
          price: Number(prodPrice),
          wholesalePrice: prodWholesalePrice ? Number(prodWholesalePrice) : undefined,
          originalPrice: prodOriginalPrice ? Number(prodOriginalPrice) : undefined,
          stock: Number(prodStock),
          unit: prodUnit,
          materialUsed: prodMaterial.trim() || undefined,
          sustainabilityScore: Number(prodScore) || 90,
          sustainabilityDetail: `${prodScore}/100 Eco Certified`,
          imageUrls: prodImages,
        },
      });

      setSellerProfile(res);
      clearDraftLocally();
      if (updateSellerStatus) {
        updateSellerStatus("PENDING");
      }

      toast.success("Application submitted successfully! Our Super Admin team will review it.", {
        id: toastId,
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Submission failed:", err);
      toast.error(err.message || "Failed to submit application. Please check your fields.", {
        id: toastId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render Loading State ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#2D5A40]" />
        <p className="text-xs font-semibold text-[#5A7A5A]">Verifying partner session...</p>
      </div>
    );
  }

  // ── View 1: PENDING REVIEW STATE ──
  if (sellerProfile && (sellerProfile.verificationStatus === "PENDING" || sellerProfile.verificationStatus === "UNDER_REVIEW")) {
    return (
      <div className="p-8 sm:p-10 rounded-3xl bg-[#F8FAF8] border-2 border-[#D8E8D0] text-center space-y-6 max-w-xl mx-auto my-6 shadow-sm">
        <div className="h-16 w-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
          <Clock className="h-8 w-8 animate-pulse" />
        </div>
        <div>
          <span className="text-[10px] font-bold tracking-widest uppercase bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
            Under Super Admin Audit
          </span>
          <h3 className="text-2xl font-black text-[#1F3A2E] mt-2">Application Submitted!</h3>
          <p className="text-xs text-[#5A7A5A] mt-1">Application Reference: <span className="font-mono font-bold text-[#1F3A2E]">{sellerProfile.id}</span></p>
        </div>
        <p className="text-xs text-[#5A7A5A] leading-relaxed max-w-md mx-auto">
          Thank you, <span className="font-bold text-[#2D5A40]">{sellerProfile.companyName}</span>! Your 3-step verification details, legal documents (GST, PAN, Aadhaar), and initial product launch candidate are currently being audited by our verification team.
        </p>
        <div className="p-4 rounded-2xl bg-white border border-[#E8F0E8] text-left text-xs space-y-3 shadow-inner">
          <div className="flex justify-between border-b border-[#F0F7F0] pb-2">
            <span className="text-[#7A9A7A]">Audit Status:</span>
            <span className="font-bold text-amber-600 uppercase tracking-wider">Pending Audit Review</span>
          </div>
          <div className="flex justify-between border-b border-[#F0F7F0] pb-2">
            <span className="text-[#7A9A7A]">Founder / Applicant:</span>
            <span className="font-semibold text-[#1F3A2E]">{sellerProfile.founderName || sellerProfile.ownerName || "N/A"}</span>
          </div>
          <div className="flex justify-between border-b border-[#F0F7F0] pb-2">
            <span className="text-[#7A9A7A]">Submitted Documents:</span>
            <span className="font-semibold text-[#2D5A40]">{sellerProfile.documents?.length || 3} Files Attached</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A9A7A]">Initial Product:</span>
            <span className="font-semibold text-[#2D5A40]">Pending Approval (Auto-launch upon verification)</span>
          </div>
        </div>

        {/* ₹1 Registration Verification Fee Card for new applicants */}
        {!isGrandfatheredSeller(sellerProfile.id, userId) && (
          <div className="text-left pt-2">
            <SellerRegistrationFeeCard
              sellerId={sellerProfile.id}
              sellerName={sellerProfile.companyName}
              isPaid={Boolean(sellerProfile.registrationFeePaid || sellerProfile.registrationPaymentStatus === "PAID")}
              transactionId={sellerProfile.registrationFeeTransactionId}
              paidAt={sellerProfile.registrationFeePaidAt}
              onSuccess={async () => {
                const refreshed = await getSellerProfile(userId);
                if (refreshed) setSellerProfile(refreshed);
              }}
            />
          </div>
        )}

        <p className="text-[11px] text-[#8FA98E] leading-relaxed">
          Verification normally completes within 24 business hours. Once verified, your Seller Dashboard will unlock automatically and your initial product will be published to the catalog.
        </p>
      </div>
    );
  }


  // ── View 2: APPROVED STATE ──
  const isApproved = sellerProfile && sellerProfile.verificationStatus === "APPROVED";
  if (isApproved) {
    return (
      <div className="p-8 sm:p-10 rounded-3xl bg-[#F0F9F0] border-2 border-[#2D5A40] text-center space-y-6 max-w-xl mx-auto my-6 shadow-md">
        <div className="h-16 w-16 bg-[#2D5A40] text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <span className="text-[10px] font-bold tracking-widest uppercase bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
            Verified Partner
          </span>
          <h3 className="text-2xl font-black text-[#1F3A2E] mt-2">You Are a Verified Seller! 🎉</h3>
          <p className="text-xs text-[#5A7A5A] mt-1">Welcome to the EarthCentric Partner Network</p>
        </div>
        <p className="text-xs text-[#5A7A5A] leading-relaxed max-w-md mx-auto">
          Congratulations, <span className="font-bold text-[#1F3A2E]">{sellerProfile.companyName}</span>! Your credentials, legal documents, and sustainability claims have been audited and verified.
        </p>
        <div className="p-4 rounded-2xl bg-white border border-[#E8F0E8] text-left text-xs space-y-2.5 shadow-inner">
          <div className="flex justify-between border-b border-[#F0F7F0] pb-2">
            <span className="text-[#7A9A7A]">Seller Partner ID:</span>
            <span className="font-mono text-[#1F3A2E] font-semibold">{sellerProfile.id}</span>
          </div>
          <div className="flex justify-between border-b border-[#F0F7F0] pb-2">
            <span className="text-[#7A9A7A]">Badges Awarded:</span>
            <span className="font-bold text-[#2D5A40]">{(sellerProfile.badges || ["Verified Business"]).join(", ")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#7A9A7A]">Catalog Access:</span>
            <span className="font-bold text-emerald-700">Full Access Unlocked</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (updateSellerStatus) updateSellerStatus("APPROVED", sellerProfile.badges);
            router.push("/seller/dashboard");
          }}
          className="w-full py-4 rounded-2xl bg-[#2D5A40] text-white text-xs font-extrabold hover:bg-[#1F3A2E] transition shadow-lg flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>Open Seller Dashboard</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── Input CSS Classes ──
  const inputClass =
    "w-full rounded-xl border border-[#C8D8C0] bg-[#F5F9F5] px-4 py-3 text-xs sm:text-sm text-[#1F3A2E] placeholder-[#8FA98E] focus:outline-none focus:border-[#2D5A40] focus:ring-1 focus:ring-[#2D5A40]/30 transition";
  const errorInputClass =
    "w-full rounded-xl border border-red-400 bg-red-50/40 px-4 py-3 text-xs sm:text-sm text-[#1F3A2E] placeholder-[#8FA98E] focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition";

  return (
    <div className="space-y-6 py-2">
      {/* Super Admin Rejection or Action Required Alert */}
      {sellerProfile?.verificationStatus === "NEED_MORE_DOCS" && (
        <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-left space-y-2 mb-6 shadow-sm">
          <div className="flex items-center gap-2.5 text-amber-900 font-bold text-sm">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <span>Action Required: Super Admin Requested Document Updates</span>
          </div>
          <p className="text-xs text-amber-950 bg-amber-100/70 p-3 rounded-xl border border-amber-300 font-medium">
            <strong>Super Admin Note:</strong> {sellerProfile.rejectionReason || "Please upload clearer copies of your legal documents."}
          </p>
          <p className="text-[11px] text-amber-800">You may update your documents below and resubmit for audit.</p>
        </div>
      )}

      {sellerProfile?.verificationStatus === "REJECTED" && (
        <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-400 text-left space-y-2 mb-6 shadow-sm">
          <div className="flex items-center gap-2.5 text-rose-900 font-bold text-sm">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>Application Update: Verification Audit Incomplete</span>
          </div>
          <p className="text-xs text-rose-950 bg-rose-100/70 p-3 rounded-xl border border-rose-300 font-medium">
            <strong>Feedback:</strong> {sellerProfile.rejectionReason || "Your application did not pass verification criteria. Please review details and resubmit."}
          </p>
          <p className="text-[11px] text-rose-800">Please correct your details or documents and resubmit your application below.</p>
        </div>
      )}

      {/* 3-Step Wizard Navigation Header */}
      <div className="bg-[#F8FAF8] p-4 rounded-2xl border border-[#E8F0E8] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setStep(1)}>
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold transition-colors ${
            step === 1 ? "bg-[#2D5A40] text-white shadow-sm" : step > 1 ? "bg-[#D0EDD0] text-[#2D5A40]" : "bg-[#E8F0E8] text-[#7A9A7A]"
          }`}>
            {step > 1 ? <Check className="h-4 w-4" /> : "1"}
          </div>
          <div className="flex flex-col">
            <span className={`text-xs font-bold ${step === 1 ? "text-[#1F3A2E]" : "text-[#7A9A7A]"}`}>Step 1</span>
            <span className="text-[11px] text-[#5A7A5A]">Company Identity</span>
          </div>
        </div>

        <ArrowRight className="h-4 w-4 text-[#C8D8C0] hidden sm:block" />

        <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => { if (step > 1) setStep(2); }}>
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold transition-colors ${
            step === 2 ? "bg-[#2D5A40] text-white shadow-sm" : step > 2 ? "bg-[#D0EDD0] text-[#2D5A40]" : "bg-[#E8F0E8] text-[#7A9A7A]"
          }`}>
            {step > 2 ? <Check className="h-4 w-4" /> : "2"}
          </div>
          <div className="flex flex-col">
            <span className={`text-xs font-bold ${step === 2 ? "text-[#1F3A2E]" : "text-[#7A9A7A]"}`}>Step 2</span>
            <span className="text-[11px] text-[#5A7A5A]">Legal Documents</span>
          </div>
        </div>

        <ArrowRight className="h-4 w-4 text-[#C8D8C0] hidden sm:block" />

        <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => { if (step > 2) setStep(3); }}>
          <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold transition-colors ${
            step === 3 ? "bg-[#2D5A40] text-white shadow-sm" : "bg-[#E8F0E8] text-[#7A9A7A]"
          }`}>
            3
          </div>
          <div className="flex flex-col">
            <span className={`text-xs font-bold ${step === 3 ? "text-[#1F3A2E]" : "text-[#7A9A7A]"}`}>Step 3</span>
            <span className="text-[11px] text-[#5A7A5A]">Product Launch (5+ Images)</span>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* STEP 1: COMPANY IDENTITY                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="border-b border-[#E8F0E8] pb-3">
            <h3 className="text-base font-extrabold text-[#1F3A2E] flex items-center gap-2">
              <Building className="h-4.5 w-4.5 text-[#2D5A40]" />
              <span>Step 1: Company Identity & Mission</span>
            </h3>
            <p className="text-xs text-[#7A9A7A] mt-0.5">
              Enter your enterprise identity, founder details, and official business address.
            </p>
          </div>

          {/* Logo Upload Box */}
          <div className="p-4 rounded-2xl bg-[#F8FAF8] border border-[#E8F0E8] flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl border border-[#C8D8C0] bg-white overflow-hidden flex items-center justify-center shrink-0">
              {logoDoc?.url ? (
                <img src={logoDoc.url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building className="h-6 w-6 text-[#8FA98E]" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-xs font-bold text-[#1F3A2E]">Company Logo (Optional)</span>
              <p className="text-[11px] text-[#7A9A7A]">Recommend square image (PNG, JPG, WebP under 5MB).</p>
              <div className="flex items-center gap-2 pt-1">
                <label className="px-3 py-1.5 rounded-lg border border-[#2D5A40] text-[#2D5A40] text-xs font-semibold hover:bg-[#F0F7F0] transition cursor-pointer flex items-center gap-1.5">
                  <Upload className="h-3 w-3" />
                  <span>{logoDoc ? "Change Logo" : "Upload Logo"}</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadFile(f, "LOGO", "sellers/logos", (doc) => setLogoDoc(doc));
                    }}
                  />
                </label>
                {logoDoc && (
                  <button
                    type="button"
                    onClick={() => setLogoDoc(null)}
                    className="text-xs text-red-600 hover:underline px-2 py-1"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Company / Brand Name *</label>
              <input
                className={fieldErrors.companyName ? errorInputClass : inputClass}
                placeholder="e.g. GreenEarth Packaging Co."
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  clearFieldError("companyName");
                }}
              />
              {fieldErrors.companyName && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.companyName}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Founder / Owner Name *</label>
              <input
                className={fieldErrors.founderName ? errorInputClass : inputClass}
                placeholder="e.g. Aarav Sharma"
                value={founderName}
                onChange={(e) => {
                  setFounderName(e.target.value);
                  clearFieldError("founderName");
                }}
              />
              {fieldErrors.founderName && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.founderName}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Business Type *</label>
              <select
                className={inputClass}
                value={businessType}
                onChange={(e) => {
                  setBusinessType(e.target.value);
                  clearFieldError("businessType");
                }}
              >
                <option value="Manufacturer">Manufacturer</option>
                <option value="Brand">Independent Eco Brand</option>
                <option value="Artisan">Artisan Collective / Cooperative</option>
                <option value="Supplier">Sustainable Wholesaler / Supplier</option>
              </select>
            </div>

            {/* Phone Number Field with Strict No-Alphabets Validation */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-[#2D5A40]">Company Phone Number *</label>
                <span className="text-[10px] text-[#7A9A7A]">Numbers & + only</span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="tel"
                  inputMode="tel"
                  className={fieldErrors.phone ? errorInputClass : inputClass}
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
              </div>
              {fieldErrors.phone ? (
                <p className="text-[11px] text-red-600 mt-1">{fieldErrors.phone}</p>
              ) : (
                <p className="text-[10px] text-[#7A9A7A] mt-1">Accepts 10-digit Indian numbers or international format with +</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Company Website (Optional)</label>
              <input
                className={inputClass}
                placeholder="https://yourgreenbrand.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Company Description & Sustainability Mission *</label>
              <textarea
                className={`${fieldErrors.description ? errorInputClass : inputClass} h-24 resize-none`}
                placeholder="Detail your organic sourcing pipelines, zero-waste packaging, and environmental commitments..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clearFieldError("description");
                }}
              />
              {fieldErrors.description && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.description}</p>}
            </div>
          </div>

          {/* Business Addresses Section */}
          <div className="mt-4 pt-4 border-t border-[#E8F0E8] space-y-4">
            <div>
              <h4 className="text-sm font-bold text-[#1F3A2E]">Business Addresses</h4>
              <p className="text-[11px] text-[#7A9A7A]">Your registered office address is mandatory for commercial verification.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Company Registered Business Address *</label>
              <textarea
                className={`${fieldErrors.companyAddress ? errorInputClass : inputClass} h-18 resize-none`}
                placeholder="e.g. Suite 402, Eco-Business Park, Sector 62, Noida, UP 201301"
                value={companyAddress}
                onChange={(e) => {
                  setCompanyAddress(e.target.value);
                  clearFieldError("companyAddress");
                }}
              />
              {fieldErrors.companyAddress && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.companyAddress}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Factory / Plant Address (Optional)</label>
                <textarea
                  className={`${inputClass} h-16 resize-none`}
                  placeholder="e.g. Plot 12, Industrial Area Phase 1, Hosur 635109"
                  value={factoryAddress}
                  onChange={(e) => setFactoryAddress(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Default Pickup / Dispatch Address (Optional)</label>
                <textarea
                  className={`${inputClass} h-16 resize-none`}
                  placeholder="e.g. Same as Registered Office or Warehouse 5, Sector 18"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Stepper Navigation Actions */}
          <div className="pt-4 border-t border-[#E8F0E8] flex justify-end">
            <button
              type="button"
              onClick={handleNextToStep2}
              className="px-6 py-3 rounded-xl bg-[#1F3A2E] text-white text-xs font-bold hover:bg-[#2D5A40] transition flex items-center gap-2 cursor-pointer shadow-md"
            >
              <span>Next: Legal Documents</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* STEP 2: LEGAL VERIFICATION DOCUMENTS                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="border-b border-[#E8F0E8] pb-3">
            <h3 className="text-base font-extrabold text-[#1F3A2E] flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-[#2D5A40]" />
              <span>Step 2: Legal Verification Documents</span>
            </h3>
            <p className="text-xs text-[#7A9A7A] mt-0.5">
              Upload tax and identity verification documents. Supported formats: PDF, JPG, PNG under 15MB.
            </p>
          </div>

          {/* GST Section */}
          <div className="p-4 rounded-2xl bg-[#F8FAF8] border border-[#E8F0E8] space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#1F3A2E]">1. GST Registration Number & Certificate *</label>
              {gstDoc && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> File Verified</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  className={fieldErrors.gstNumber ? errorInputClass : inputClass}
                  placeholder="29ABCDE1234F1Z5 (15 Characters)"
                  value={gstNumber}
                  onChange={(e) => {
                    setGstNumber(e.target.value.toUpperCase().replace(/\s+/g, ""));
                    clearFieldError("gstNumber");
                  }}
                />
                {fieldErrors.gstNumber && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.gstNumber}</p>}
              </div>

              <div>
                {gstDoc ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#2D5A40] text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-[#1F3A2E] truncate">{gstDoc.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={gstDoc.url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline text-[11px]">View</a>
                      <label className="text-blue-600 hover:underline text-[11px] cursor-pointer">
                        Change
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadFile(f, "GST", "documents/verification", (d) => setGstDoc(d));
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#2D5A40] bg-white cursor-pointer hover:bg-[#F0F7F0] transition text-xs text-[#2D5A40] font-semibold">
                    {uploadingField === "GST" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span>{uploadingField === "GST" ? "Uploading to Cloud..." : "Upload GST Certificate (PDF/Image)"}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadFile(f, "GST", "documents/verification", (d) => setGstDoc(d));
                      }}
                    />
                  </label>
                )}
                {fieldErrors.gstDoc && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.gstDoc}</p>}
              </div>
            </div>
          </div>

          {/* PAN Section */}
          <div className="p-4 rounded-2xl bg-[#F8FAF8] border border-[#E8F0E8] space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#1F3A2E]">2. PAN Card Number & Document *</label>
              {panDoc && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> File Verified</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  className={fieldErrors.panNumber ? errorInputClass : inputClass}
                  placeholder="ABCDE1234F (10 Characters)"
                  value={panNumber}
                  onChange={(e) => {
                    const normalized = e.target.value.toUpperCase().replace(/\s+/g, "");
                    setPanNumber(normalized);
                    clearFieldError("panNumber");
                  }}
                  onBlur={() => {
                    const normalized = panNumber.trim().toUpperCase().replace(/\s+/g, "");
                    if (normalized !== panNumber) {
                      setPanNumber(normalized);
                    }
                    if (normalized.length > 0) {
                      const res = validatePAN(normalized);
                      if (!res.valid) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          panNumber: res.error || "Invalid PAN format. Expected format: ABCDE1234F.",
                        }));
                      } else {
                        clearFieldError("panNumber");
                      }
                    } else {
                      clearFieldError("panNumber");
                    }
                  }}
                />
                {fieldErrors.panNumber && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.panNumber}</p>}
              </div>

              <div>
                {panDoc ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#2D5A40] text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-[#1F3A2E] truncate">{panDoc.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={panDoc.url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline text-[11px]">View</a>
                      <label className="text-blue-600 hover:underline text-[11px] cursor-pointer">
                        Change
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadFile(f, "PAN", "documents/verification", (d) => setPanDoc(d));
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#2D5A40] bg-white cursor-pointer hover:bg-[#F0F7F0] transition text-xs text-[#2D5A40] font-semibold">
                    {uploadingField === "PAN" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span>{uploadingField === "PAN" ? "Uploading to Cloud..." : "Upload PAN Card (PDF/Image)"}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadFile(f, "PAN", "documents/verification", (d) => setPanDoc(d));
                      }}
                    />
                  </label>
                )}
                {fieldErrors.panDoc && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.panDoc}</p>}
              </div>
            </div>
          </div>

          {/* Aadhaar Section */}
          <div className="p-4 rounded-2xl bg-[#F8FAF8] border border-[#E8F0E8] space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#1F3A2E]">3. Aadhaar Number & Document *</label>
              {aadharDoc && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> File Verified</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  className={fieldErrors.aadharNumber ? errorInputClass : inputClass}
                  placeholder="1234 5678 9012 (12 Digits)"
                  value={aadharNumber}
                  onChange={(e) => {
                    setAadharNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 12));
                    clearFieldError("aadharNumber");
                  }}
                />
                {fieldErrors.aadharNumber && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.aadharNumber}</p>}
              </div>

              <div>
                {aadharDoc ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#2D5A40] text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-[#1F3A2E] truncate">{aadharDoc.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={aadharDoc.url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline text-[11px]">View</a>
                      <label className="text-blue-600 hover:underline text-[11px] cursor-pointer">
                        Change
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadFile(f, "AADHAR", "documents/verification", (d) => setAadharDoc(d));
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#2D5A40] bg-white cursor-pointer hover:bg-[#F0F7F0] transition text-xs text-[#2D5A40] font-semibold">
                    {uploadingField === "AADHAR" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span>{uploadingField === "AADHAR" ? "Uploading to Cloud..." : "Upload Aadhaar Photo/PDF"}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadFile(f, "AADHAR", "documents/verification", (d) => setAadharDoc(d));
                      }}
                    />
                  </label>
                )}
                {fieldErrors.aadharDoc && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.aadharDoc}</p>}
              </div>
            </div>
          </div>

          {/* Optional Sustainability Certifications */}
          <div className="p-4 rounded-2xl bg-[#F8FAF8] border border-[#E8F0E8] space-y-2">
            <label className="block text-xs font-bold text-[#1F3A2E]">
              4. Optional Eco Certifications (GOTS, FSC, FairTrade, USDA Organic)
            </label>
            <p className="text-[11px] text-[#7A9A7A]">
              Upload certificates backing up your sustainability claims to earn badges like "Verified Sustainable Manufacturer".
            </p>
            <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#8FA98E] bg-white cursor-pointer hover:bg-[#F0F7F0] transition text-xs text-[#5A7A5A] font-semibold">
              <Upload className="h-4 w-4" />
              <span>Add Sustainability Certificate</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadFile(f, `CERT_${certDocs.length}`, "documents/verification", (d) => {
                    setCertDocs((prev) => [...prev, d]);
                  });
                }}
              />
            </label>

            {certDocs.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {certDocs.map((c, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#D0EDD0] text-[#1F3A2E] text-xs font-medium">
                    <FileCheck className="h-3.5 w-3.5 text-emerald-700" />
                    <span>{c.name}</span>
                    <button
                      type="button"
                      onClick={() => setCertDocs(certDocs.filter((_, i) => i !== idx))}
                      className="text-red-600 hover:text-red-800 ml-1 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Optional Bank Account Details for Payout Settlements */}
          <div className="p-4 rounded-2xl bg-[#F8FAF8] border border-[#E8F0E8] space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#1F3A2E]">5. Bank Details (For Payout Settlements)</label>
              <span className="text-[10px] text-[#8FA98E] font-medium flex items-center gap-1"><Lock className="h-3 w-3" /> Encrypted & Private</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#2D5A40] mb-1">Bank Name</label>
                <input
                  className={inputClass}
                  placeholder="e.g. HDFC Bank"
                  value={bankName}
                  onChange={(e) => {
                    setBankName(e.target.value);
                    clearFieldError("bankName");
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#2D5A40] mb-1">Account Number</label>
                <input
                  className={inputClass}
                  placeholder="e.g. 50100234567890"
                  value={bankAccountNo}
                  onChange={(e) => {
                    setBankAccountNo(e.target.value);
                    clearFieldError("bankAccountNo");
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#2D5A40] mb-1">IFSC Code</label>
                <input
                  className={fieldErrors.bankIfsc ? errorInputClass : inputClass}
                  placeholder="e.g. HDFC0001234"
                  value={bankIfsc}
                  onChange={(e) => {
                    setBankIfsc(e.target.value.toUpperCase().replace(/\s+/g, ""));
                    clearFieldError("bankIfsc");
                  }}
                />
                {fieldErrors.bankIfsc && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.bankIfsc}</p>}
              </div>
            </div>
          </div>

          {/* Stepper Navigation Actions */}
          <div className="pt-4 border-t border-[#E8F0E8] flex justify-between items-center">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-5 py-3 rounded-xl border border-[#C8D8C0] text-xs font-semibold text-[#5A7A5A] hover:bg-[#F5F9F5] transition flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Identity</span>
            </button>
            <button
              type="button"
              onClick={handleNextToStep3}
              className="px-6 py-3 rounded-xl bg-[#1F3A2E] text-white text-xs font-bold hover:bg-[#2D5A40] transition flex items-center gap-2 cursor-pointer shadow-md"
            >
              <span>Next: Product Launch</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* STEP 3: INITIAL PRODUCT LAUNCH                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="border-b border-[#E8F0E8] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-[#1F3A2E] flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-[#2D5A40]" />
                <span>Step 3: Initial Product Launch Candidate</span>
              </h3>
              <p className="text-xs text-[#7A9A7A] mt-0.5">
                Upon Super Admin approval, this product will automatically launch to the live marketplace.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Auto-Launch Ready
            </span>
          </div>

          {/* Image Gallery Uploader (Mandatory 5+ images) */}
          <div className="p-5 rounded-2xl bg-[#F0F7F0] border-2 border-dashed border-[#2D5A40] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-extrabold text-[#1F3A2E]">Product Images (Minimum 5 Required) *</label>
                <p className="text-[11px] text-[#5A7A5A]">Upload clear photos from multiple angles of the actual product.</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                prodImages.length >= 5 ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-900 animate-pulse"
              }`}>
                {prodImages.length >= 5 ? `✓ ${prodImages.length} Images Added` : `⚠️ ${prodImages.length} / 5 (Need ${5 - prodImages.length} more)`}
              </span>
            </div>

            {/* Thumbnail Grid */}
            {prodImages.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
                {prodImages.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-[#C8D8C0] group bg-white shadow-xs">
                    <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setProdImages(prodImages.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow cursor-pointer"
                      title="Remove Image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {idx === 0 && (
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center py-0.5 font-bold">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload File and Add URL inputs */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <label className="px-4 py-2.5 rounded-xl border border-[#2D5A40] bg-white text-[#2D5A40] text-xs font-bold hover:bg-[#EAF3EA] transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs">
                {uploadingField === "PRODUCT_IMAGE" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span>{uploadingField === "PRODUCT_IMAGE" ? "Uploading Image..." : "Upload Image File"}</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      handleUploadFile(f, "PRODUCT_IMAGE", "products/images", (doc) => {
                        setProdImages((prev) => [...prev, doc.url]);
                      });
                    }
                  }}
                />
              </label>

              <div className="flex-1 flex gap-2">
                <input
                  className={`${inputClass} py-2 text-xs bg-white`}
                  placeholder="Or paste image URL (https://...)..."
                  value={manualImageUrl}
                  onChange={(e) => setManualImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (manualImageUrl.trim()) {
                        setProdImages((prev) => [...prev, manualImageUrl.trim()]);
                        setManualImageUrl("");
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (manualImageUrl.trim()) {
                      setProdImages((prev) => [...prev, manualImageUrl.trim()]);
                      setManualImageUrl("");
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-[#2D5A40] text-white text-xs font-bold hover:bg-[#1F3A2E] transition whitespace-nowrap cursor-pointer shadow-xs"
                >
                  Add URL
                </button>
              </div>
            </div>
            {fieldErrors.imageUrls && <p className="text-[11px] text-red-600 font-semibold">{fieldErrors.imageUrls}</p>}
          </div>

          {/* Product Specifications Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Product Title / Name *</label>
              <input
                className={fieldErrors.name ? errorInputClass : inputClass}
                placeholder="e.g. 100% Biodegradable Cornstarch Mailer Bags (Pack of 50)"
                value={prodName}
                onChange={(e) => {
                  setProdName(e.target.value);
                  clearFieldError("name");
                }}
              />
              {fieldErrors.name && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Category *</label>
              <CategoryTypeahead
                id="seller-reg-category"
                value={prodCategory}
                onChange={(cat) => {
                  setProdCategory(cat);
                  clearFieldError("categoryName");
                }}
                placeholder="Type or select a category..."
                required
              />
              {fieldErrors.categoryName && <p className="text-[11px] text-red-600 mt-1 font-semibold">{fieldErrors.categoryName}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Unit / Packaging Type *</label>
              <select
                className={inputClass}
                value={prodUnit}
                onChange={(e) => setProdUnit(e.target.value)}
              >
                <option value="Piece">Piece / Unit</option>
                <option value="Pack of 50">Pack of 50</option>
                <option value="Pack of 100">Pack of 100</option>
                <option value="Kg">Kilogram (Kg)</option>
                <option value="Set">Complete Set</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Selling Price (₹) *</label>
              <input
                type="number"
                min="1"
                className={fieldErrors.price ? errorInputClass : inputClass}
                placeholder="e.g. 499"
                value={prodPrice}
                onChange={(e) => {
                  setProdPrice(e.target.value);
                  clearFieldError("price");
                }}
              />
              {fieldErrors.price && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.price}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Wholesale Price (₹) (Optional)</label>
              <input
                type="number"
                min="1"
                className={inputClass}
                placeholder="e.g. 399 for bulk orders"
                value={prodWholesalePrice}
                onChange={(e) => setProdWholesalePrice(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Original / MRP Price (₹) (Optional)</label>
              <input
                type="number"
                min="1"
                className={inputClass}
                placeholder="e.g. 699"
                value={prodOriginalPrice}
                onChange={(e) => setProdOriginalPrice(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Initial Stock / Inventory *</label>
              <input
                type="number"
                min="1"
                className={fieldErrors.stock ? errorInputClass : inputClass}
                placeholder="e.g. 500"
                value={prodStock}
                onChange={(e) => {
                  setProdStock(e.target.value);
                  clearFieldError("stock");
                }}
              />
              {fieldErrors.stock && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.stock}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Sustainability Rating (1-100) *</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={prodScore}
                  onChange={(e) => setProdScore(Number(e.target.value))}
                  className="w-full accent-[#2D5A40]"
                />
                <span className="px-2.5 py-1 rounded-lg bg-[#D0EDD0] text-[#1F3A2E] font-bold text-xs shrink-0">
                  {prodScore}/100
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Primary Materials Used</label>
              <input
                className={inputClass}
                placeholder="e.g. Organic Cornstarch, Plant Cellulose"
                value={prodMaterial}
                onChange={(e) => setProdMaterial(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#2D5A40] mb-1.5">Complete Product Description *</label>
              <textarea
                className={`${fieldErrors.description ? errorInputClass : inputClass} h-24 resize-none`}
                placeholder="Describe features, eco benefits, dimensions, certifications, and disposal instructions..."
                value={prodDescription}
                onChange={(e) => {
                  setProdDescription(e.target.value);
                  clearFieldError("description");
                }}
              />
              {fieldErrors.description && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.description}</p>}
            </div>
          </div>

          {/* Stepper Navigation Actions */}
          <div className="pt-4 border-t border-[#E8F0E8] flex justify-between items-center">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-5 py-3 rounded-xl border border-[#C8D8C0] text-xs font-semibold text-[#5A7A5A] hover:bg-[#F5F9F5] transition flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Documents</span>
            </button>

            <button
              type="button"
              onClick={handleSubmitCompleteApplication}
              disabled={isSubmitting || prodImages.length < 5}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#1F3A2E] to-[#2D5A40] text-white text-xs font-extrabold shadow-lg hover:opacity-95 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting Application...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Submit Audit Application</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
