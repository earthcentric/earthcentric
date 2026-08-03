"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSellerProfile, submitSellerVerification, SellerProfile } from "@/actions/sellers";
import { Button, Card, Input, Label, Textarea, Badge, LiquidButton, MetalButton } from "@/components/ui/shared";
import { FadeIn } from "@/components/FramerComponents";
import {
  Building,
  FileText,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Upload,
  CheckCircle2,
  FileCheck,
  Clock,
  AlertOctagon,
  Award,
  Sparkles,
  ChevronRight,
} from "lucide-react";

const STEPS = [
  { num: 1, name: "Business Details" },
  { num: 2, name: "GST File" },
  { num: 3, name: "PAN Card" },
  { num: 4, name: "Registration" },
  { num: 5, name: "Eco Certificates" },
];

export default function VerificationPage() {
  const { user, isLoading, updateSellerStatus } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [currentStep, setCurrentStep] = useState(1);
  const [companyName, setCompanyName] = useState("Organic Cotton Mills");
  const [businessType, setBusinessType] = useState("Manufacturer");
  const [description, setDescription] = useState("We craft zero-waste textiles utilizing organic linen and hemp fields.");
  const [website, setWebsite] = useState("https://organicmills.co");
  const [gstNumber, setGstNumber] = useState("29GGGGG1234F1Z5");
  const [panNumber, setPanNumber] = useState("ABCDE1234F");
  const [declaredRevenue, setDeclaredRevenue] = useState("");

  // Onboarding Additional details
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [factoryAddress, setFactoryAddress] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");

  // Bank Details state
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  // Logo file and file attachments states
  const [logoFile, setLogoFile] = useState<{ name: string; base64: string } | null>(null);
  const [gstFile, setGstFile] = useState<{ name: string; base64: string } | null>(null);
  const [panFile, setPanFile] = useState<{ name: string; base64: string } | null>(null);
  const [regFile, setRegFile] = useState<{ name: string; base64: string } | null>(null);
  const [certFile, setCertFile] = useState<{ name: string; base64: string } | null>(null);
  const [bankFile, setBankFile] = useState<{ name: string; base64: string } | null>(null);

  // Sync profile details if existing
  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        setLoading(true);
        try {
          const p = await getSellerProfile(user.id);
          if (p) {
            setProfile(p);
            setCompanyName(p.companyName);
            setBusinessType(p.businessType);
            setDescription(p.description || "");
            setWebsite(p.website || "");
            setGstNumber(p.gstNumber || "");
            setPanNumber(p.panNumber || "");
            setDeclaredRevenue(p.declaredRevenue || "");
            setOwnerName(p.ownerName || "");
            setPhone(p.phone || "");
            setCompanyAddress(p.companyAddress || "");
            setFactoryAddress(p.factoryAddress || "");
            setPickupAddress(p.pickupAddress || "");
            setBankAccountNo(p.bankAccountNo || "");
            setBankName(p.bankName || "");
            setBankIfsc(p.bankIfsc || "");
            if (p.logoUrl) setLogoFile({ name: "Company Logo", base64: "existing" });
            
            // Map existing docs to display names
            const gstDoc = p.documents.find(d => d.type === "GST");
            if (gstDoc) setGstFile({ name: gstDoc.fileName, base64: "existing" });
            const panDoc = p.documents.find(d => d.type === "PAN");
            if (panDoc) setPanFile({ name: panDoc.fileName, base64: "existing" });
            const regDoc = p.documents.find(d => d.type === "BUSINESS_REGISTRATION");
            if (regDoc) setRegFile({ name: regDoc.fileName, base64: "existing" });
            const certDoc = p.documents.find(d => d.type === "SUSTAINABILITY_CERTIFICATE");
            if (certDoc) setCertFile({ name: certDoc.fileName, base64: "existing" });
            const bankDoc = p.documents.find(d => d.type === "BANK_PROOF");
            if (bankDoc) setBankFile({ name: bankDoc.fileName, base64: "existing" });
          }
        } catch (err) {
          console.error("Error loading seller profile:", err);
        }
        setLoading(false);
      } else if (!isLoading) {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user, isLoading]);

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!companyName || !businessType || !ownerName || !phone) return;
    }
    setCurrentStep((prev) => Math.min(STEPS.length, prev + 1));
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Check files
    const finalGst = gstFile || { name: "gst_cert.pdf", base64: "mock_base64" };
    const finalPan = panFile || { name: "pan_card.jpg", base64: "mock_base64" };
    const finalReg = regFile || { name: "registration_proof.pdf", base64: "mock_base64" };
    const finalCert = certFile || { name: "eco_certifications.pdf", base64: "mock_base64" };

    startTransition(async () => {
      const result = await submitSellerVerification({
        userId: user.id,
        companyName,
        businessType,
        description,
        website,
        gstNumber,
        panNumber,
        logoBase64: logoFile?.base64 || undefined,
        declaredRevenue,
        ownerName,
        phone,
        companyAddress,
        factoryAddress,
        pickupAddress,
        bankAccountNo,
        bankName,
        bankIfsc,
        documents: [
          { type: "GST", fileName: finalGst.name, fileBase64: finalGst.base64 },
          { type: "PAN", fileName: finalPan.name, fileBase64: finalPan.base64 },
          { type: "BUSINESS_REGISTRATION", fileName: finalReg.name, fileBase64: finalReg.base64 },
          { type: "SUSTAINABILITY_CERTIFICATE", fileName: finalCert.name, fileBase64: finalCert.base64 },
          ...(bankFile ? [{ type: "BANK_PROOF" as const, fileName: bankFile.name, fileBase64: bankFile.base64 }] : []),
        ],
      });

      updateSellerStatus("PENDING");
      setProfile(result);
    });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center space-y-3">
        <Clock className="h-8 w-8 text-primary animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground">Authenticating credentials...</p>
      </div>
    );
  }

  // ----------------------------------------------------
  // CONDITIONAL VIEW 1: APPROVED STATE
  // ----------------------------------------------------
  if (profile?.verificationStatus === "APPROVED" || user?.sellerStatus === "APPROVED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card className="border-border/40 p-8 text-center space-y-6 bg-card rounded-2xl shadow-lg">
          <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 fill-emerald-500/10" />
          </div>
          
          <div className="space-y-2">
            <Badge variant="success">Verification Completed</Badge>
            <h2 className="text-2xl font-bold text-primary">Your Brand is Verified!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              Congratulations, **{companyName}**. Your credentials and sustainability claims have been audited and verified by our board.
            </p>
          </div>

          {/* Badges assigned display */}
          <div className="border border-border/40 bg-muted/20 p-4 rounded-xl space-y-3 max-w-sm mx-auto">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Assigned Badges
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="premium">Verified Business</Badge>
              <Badge variant="primary">Verified Sustainable Manufacturer</Badge>
            </div>
          </div>

          <div className="pt-2">
            <Button variant="cool" onClick={() => router.push("/seller/dashboard")} className="w-full sm:w-auto px-8">
              Proceed to Seller Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------
  // CONDITIONAL VIEW 2: PENDING REVIEW STATE
  // ----------------------------------------------------
  if (profile?.verificationStatus === "PENDING" || user?.sellerStatus === "PENDING") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card className="border-border/60 p-8 text-center space-y-6 bg-card rounded-2xl shadow-sm">
          <div className="h-16 w-16 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Clock className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <Badge variant="outline" className="text-amber-600 border-amber-500/30">
              Audit Pending
            </Badge>
            <h2 className="text-2xl font-bold text-primary">Verification in Progress</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              Our sustainability analysts are reviewing your GST certificate, PAN records, and environmental documentation. This process usually completes in 24 hours.
            </p>
          </div>

          <div className="pt-2">
            <Button variant="cool" onClick={() => router.push("/marketplace")} className="px-8">
              Explore Marketplace Catalog
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------
  // CONDITIONAL VIEW 3: REJECTED STATE
  // ----------------------------------------------------
  if (profile?.verificationStatus === "REJECTED" || user?.sellerStatus === "REJECTED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card className="border-red-500/20 p-8 text-center space-y-6 bg-card rounded-2xl shadow-lg">
          <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertOctagon className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <Badge variant="danger">Action Required</Badge>
            <h2 className="text-2xl font-bold text-primary">Verification Rejected</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              We encountered issues validating your credentials. Please correct the fields and resubmit.
            </p>
          </div>

          {profile?.rejectionReason && (
            <div className="border border-red-500/20 bg-red-500/5 p-4 rounded-xl max-w-md mx-auto text-xs text-red-600 dark:text-red-400 text-left">
              <strong>Admin Feedback:</strong> {profile.rejectionReason}
            </div>
          )}

          <div className="pt-2">
            <MetalButton
              variant="error"
              onClick={() => {
                // Clear rejection status to allow resubmission
                if (profile) profile.verificationStatus = "PENDING";
                updateSellerStatus("PENDING");
                setCurrentStep(1);
              }}
              className="w-full sm:w-auto"
            >
              Re-open Form & Edit Details
            </MetalButton>
          </div>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------
  // STANDARD STEPPER FORM FLOW
  // ----------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="space-y-2 border-b border-border/40 pb-5">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">Partner Verification</h1>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
          Fill in your details and upload verification documents. Help us guarantee greenwashing-free commerce.
        </p>
      </div>

      {/* Verification Stepper Tracker */}
      <div className="flex items-center justify-between flex-wrap gap-2 border border-border/50 rounded-xl bg-card p-3 sm:p-4 shadow-sm">
        {STEPS.map((step) => {
          const isActive = step.num === currentStep;
          const isDone = step.num < currentStep;
          return (
            <div key={step.num} className="flex items-center space-x-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  isDone
                    ? "bg-primary text-primary-foreground"
                    : isActive
                    ? "bg-accent text-accent-foreground ring-2 ring-ring"
                    : "bg-muted text-muted-foreground/60"
                }`}
              >
                {step.num}
              </div>
              <span
                className={`hidden md:inline text-xs font-medium ${
                  isActive ? "text-primary font-bold" : "text-muted-foreground"
                }`}
              >
                {step.name}
              </span>
              {step.num < STEPS.length && <ChevronRightIcon />}
            </div>
          );
        })}
      </div>

      {/* Stepper Views Form */}
      <Card className="border-border/40 p-6 bg-card shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* STEP 1: BUSINESS DETAILS */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-bold text-base text-primary flex items-center space-x-2 pb-2 border-b border-border/10">
                <Building className="h-4.5 w-4.5" />
                <span>Business Details</span>
              </h3>

              {/* Company Logo Upload Box */}
              <div className="space-y-2 pb-4 border-b border-border/10">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Company Logo</Label>
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 rounded-xl border border-border/60 overflow-hidden flex items-center justify-center bg-muted/20 relative">
                    {logoFile ? (
                      <img src={logoFile.base64 === "existing" ? (profile?.logoUrl || "/leaf.png") : logoFile.base64} alt="Company Logo" className="h-full w-full object-cover" />
                    ) : (
                      <Building className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex flex-col space-y-1.5">
                    <div className="flex space-x-2">
                      <Button type="button" variant="cool" size="sm" className="text-xs border-none cursor-pointer" onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setLogoFile({ name: file.name, base64: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        };
                        input.click();
                      }}>
                        {logoFile ? "Change Logo" : "Upload Logo"}
                      </Button>
                      {logoFile && (
                        <Button type="button" variant="destructive" size="sm" className="text-xs cursor-pointer border-none" onClick={() => setLogoFile(null)}>
                          Remove Logo
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Recommend 200x200px square image. PNG, JPG allowed.</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Company / Brand Name</Label>
                  <Input
                    placeholder="e.g. EcoThreads Apparel"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Type of Business</Label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="flex w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  >
                    <option value="Manufacturer">Manufacturer</option>
                    <option value="Supplier">Supplier / Sourcing Partner</option>
                    <option value="Brand">Independent Eco Brand</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Owner Full Name</Label>
                  <Input
                    placeholder="e.g. Aarav Mehta"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Contact Phone Number</Label>
                  <Input
                    placeholder="e.g. +91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Sustainability Statement</Label>
                <Textarea
                  placeholder="Detail your organic sourcing pipelines, circular materials used, and low-waste manufacturing processes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Company Registered Address</Label>
                <Input
                  placeholder="e.g. Suite 402, Eco-Business Park, Sector 62, Noida, UP"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Factory / Manufacturing Plant Address</Label>
                  <Input
                    placeholder="e.g. Plot 12, Industrial Area Phase 1, Gurgaon, Haryana"
                    value={factoryAddress}
                    onChange={(e) => setFactoryAddress(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Default Order Pickup / Warehouse Address</Label>
                  <Input
                    placeholder="e.g. Same as Factory Address"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Corporate Website</Label>
                  <Input
                    placeholder="e.g. https://ecothreads.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Estimated Annual Revenue</Label>
                  <Input
                    placeholder="e.g. ₹15,00,000"
                    value={declaredRevenue}
                    onChange={(e) => setDeclaredRevenue(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>PAN Code</Label>
                  <Input
                    placeholder="e.g. ABCDE1234F"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>GST Identification Code</Label>
                <Input
                  placeholder="e.g. 29GGGGG1234F1Z5"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* STEP 2: GST FILE UPLOAD */}
          {currentStep === 2 && (
            <FileUploadSection
              title="Upload GST Registration Certificate"
              desc="Upload your GST Certificate (Form REG-06) issued by the tax department to verify tax eligibility."
              file={gstFile}
              onFileSelect={(name, b64) => setGstFile({ name, base64: b64 })}
            />
          )}

          {/* STEP 3: PAN CARD UPLOAD */}
          {currentStep === 3 && (
            <FileUploadSection
              title="Upload Corporate PAN Document"
              desc="Attach a clear scanned copy of your Business or Owner Permanent Account Number (PAN) Card."
              file={panFile}
              onFileSelect={(name, b64) => setPanFile({ name, base64: b64 })}
            />
          )}

          {/* STEP 4: BUSINESS REGISTRATION PROOF */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <FileUploadSection
                title="Upload Business Registration Proof"
                desc="Upload corporate proof like Certificate of Incorporation, Partnership Deed, or local Trade License."
                file={regFile}
                onFileSelect={(name, b64) => setRegFile({ name, base64: b64 })}
              />

              <Card className="border-border/30 bg-muted/10 p-5 space-y-4">
                <h4 className="font-bold text-sm text-primary border-b border-border/10 pb-2">
                  Bank Account Details (For Payout Settlements)
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Bank Name</Label>
                    <Input
                      placeholder="e.g. HDFC Bank"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Bank Account Number</Label>
                    <Input
                      placeholder="e.g. 50100234567890"
                      value={bankAccountNo}
                      onChange={(e) => setBankAccountNo(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>IFSC Code</Label>
                    <Input
                      placeholder="e.g. HDFC0000123"
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <FileUploadSection
                    title="Upload Cancelled Check or Bank Passbook Proof"
                    desc="Attach a clear scanned copy of a cancelled check or the front page of your bank passbook/statement containing account details."
                    file={bankFile}
                    onFileSelect={(name, b64) => setBankFile({ name, base64: b64 })}
                  />
                </div>
              </Card>
            </div>
          )}

          {/* STEP 5: SUSTAINABILITY CERTIFICATIONS */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <FileUploadSection
                title="Upload Sustainability & Material Certificates"
                desc="Upload third-party certificates backing up eco-claims (GOTS Organic, FSC Wood Sourcing, B-Corp, FairTrade, etc.)."
                file={certFile}
                onFileSelect={(name, b64) => setCertFile({ name, base64: b64 })}
              />
              
              <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-start space-x-3 text-xs leading-relaxed text-primary">
                <Sparkles className="h-4.5 w-4.5 text-primary shrink-0" />
                <span>Verification badges (e.g. <strong>Verified Sustainable Manufacturer</strong>) are awarded based on these third-party certificates. Submitting documents speeds up approval times.</span>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-between items-center border-t border-border/20 pt-5">
            <Button
              type="button"
              variant="cool"
              onClick={handlePrevStep}
              className={`flex items-center space-x-1.5 ${currentStep === 1 ? "invisible" : ""}`}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Button>

            {currentStep < STEPS.length ? (
              <Button type="button" variant="cool" onClick={handleNextStep} className="flex items-center space-x-1.5">
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <MetalButton type="submit" variant="success" disabled={isPending} className="flex items-center space-x-1.5 justify-center">
                <ShieldCheck className="h-4 w-4 animate-pulse" />
                <span>Submit Audit Request</span>
              </MetalButton>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

// ----------------------------------------------------
// UI HELPERS
// ----------------------------------------------------
function ChevronRightIcon() {
  return <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />;
}

interface FileUploadSectionProps {
  title: string;
  desc: string;
  file: { name: string } | null;
  onFileSelect: (fileName: string, fileBase64: string) => void;
}

function FileUploadSection({ title, desc, file, onFileSelect }: FileUploadSectionProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      onFileSelect(selectedFile.name, base64String);
    };
    reader.readAsDataURL(selectedFile);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-base text-primary flex items-center space-x-2 pb-2 border-b border-border/10">
        <FileText className="h-4.5 w-4.5" />
        <span>{title}</span>
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
      />

      {file ? (
        <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3">
          <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <FileCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-primary">{file.name}</h4>
            <span className="text-[10px] text-muted-foreground">Document attached successfully</span>
          </div>
          <Button
            type="button"
            variant="cool"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs"
          >
            Re-attach Document
          </Button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border/60 hover:border-primary rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3 cursor-pointer transition-colors duration-200 bg-muted/10"
        >
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-xs text-primary">Upload Document</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Click to browse and select file</p>
          </div>
        </div>
      )}
    </div>
  );
}
