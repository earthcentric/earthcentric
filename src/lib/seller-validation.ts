/**
 * Earth Centric - Seller Onboarding Validation Library
 * Centralized validation rules for Company Identity, Legal Documents, and Initial Product Launch.
 * Enforced on both Frontend (immediate feedback) and Backend (prevent API bypass).
 */

// Phone Validation: Reject alphabetical characters, support Indian +91 and international formats
export function validatePhone(phone: string): { valid: boolean; error?: string; normalized?: string } {
  if (!phone || typeof phone !== "string") {
    return { valid: false, error: "Phone number is required." };
  }

  const trimmed = phone.trim();

  // Reject alphabetic characters explicitly
  if (/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, error: "Phone number cannot contain letters or alphabetical characters." };
  }

  // Reject punctuation characters other than leading + and space/hyphen separators
  if (/[^\d+\s-]/.test(trimmed)) {
    return { valid: false, error: "Phone number contains invalid characters." };
  }

  // Remove spaces, hyphens, and parenthesis for digit analysis
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (digitsOnly.length === 0) {
    return { valid: false, error: "Enter a valid phone number." };
  }

  // Check if it's an Indian mobile number
  // Case A: 10 digits starting with 6, 7, 8, 9
  if (digitsOnly.length === 10) {
    if (!/^[6-9]\d{9}$/.test(digitsOnly)) {
      return { valid: false, error: "Enter a valid 10-digit Indian mobile number (must start with 6, 7, 8, or 9)." };
    }
    return { valid: true, normalized: `+91 ${digitsOnly}` };
  }

  // Case B: 12 digits with 91 country code
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    const subscriber = digitsOnly.substring(2);
    if (!/^[6-9]\d{9}$/.test(subscriber)) {
      return { valid: false, error: "Enter a valid 10-digit Indian mobile number following country code 91." };
    }
    return { valid: true, normalized: `+91 ${subscriber}` };
  }

  // Case C: International number (starts with + and has 10 to 15 digits)
  if (trimmed.startsWith("+")) {
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      return { valid: false, error: "International phone numbers must contain between 10 and 15 digits." };
    }
    return { valid: true, normalized: `+${digitsOnly}` };
  }

  return {
    valid: false,
    error: "Enter a valid 10-digit phone number or an international number starting with +.",
  };
}

// GSTIN Validation: 15 alphanumeric characters
// Format: 2 digits (State code) + 5 letters (PAN letters) + 4 digits (PAN numbers) + 1 letter (PAN last) + 1 char (entity) + 2 alphanumeric chars (default 'Z' + checksum)
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{2}$/;

export function validateGSTIN(gstin: string): { valid: boolean; error?: string; normalized?: string } {
  if (!gstin || typeof gstin !== "string") {
    return { valid: false, error: "GSTIN registration number is required." };
  }

  const normalized = gstin.trim().toUpperCase().replace(/\s+/g, "");

  if (normalized.length !== 15) {
    return { valid: false, error: "GSTIN must be exactly 15 characters long." };
  }

  if (!GST_REGEX.test(normalized)) {
    return { valid: false, error: "Invalid GSTIN format. Expected format: 29ABCDE1234F1Z5." };
  }

  return { valid: true, normalized };
}

// PAN Validation: 10 alphanumeric characters (5 letters + 4 digits + 1 letter)
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function validatePAN(pan?: string | null): { valid: boolean; error?: string; normalized?: string } {
  if (!pan || typeof pan !== "string" || !pan.trim()) {
    return { valid: false, error: "PAN number is required." };
  }

  const normalized = pan.trim().toUpperCase().replace(/\s+/g, "");

  if (!PAN_REGEX.test(normalized)) {
    return { valid: false, error: "Invalid PAN format. Expected format: ABCDE1234F." };
  }

  return { valid: true, normalized };
}

// Aadhaar Validation: 12 numeric digits
export function validateAadhaar(aadhaar: string): { valid: boolean; error?: string; normalized?: string } {
  if (!aadhaar || typeof aadhaar !== "string") {
    return { valid: false, error: "Aadhaar number is required." };
  }

  const normalized = aadhaar.trim().replace(/[\s-]/g, "");

  if (normalized.length !== 12 || !/^\d+$/.test(normalized)) {
    return { valid: false, error: "Aadhaar number must be exactly 12 numeric digits." };
  }

  return { valid: true, normalized };
}

// IFSC Validation: 11 alphanumeric characters (4 letters + '0' + 6 alphanumeric)
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function validateIFSC(ifsc: string): { valid: boolean; error?: string; normalized?: string } {
  if (!ifsc || typeof ifsc !== "string") {
    return { valid: true, normalized: "" }; // Optional
  }

  const normalized = ifsc.trim().toUpperCase().replace(/\s+/g, "");
  if (!normalized) return { valid: true, normalized: "" };

  if (normalized.length !== 11) {
    return { valid: false, error: "IFSC code must be exactly 11 characters long." };
  }

  if (!IFSC_REGEX.test(normalized)) {
    return { valid: false, error: "Invalid IFSC format. Expected format: HDFC0001234." };
  }

  return { valid: true, normalized };
}

// Step 1: Company Identity Data Definition
export interface Step1CompanyData {
  companyName: string;
  founderName: string;
  businessType: string;
  phone: string;
  description: string;
  companyAddress: string;
  website?: string;
  factoryAddress?: string;
  pickupAddress?: string;
  logoUrl?: string;
}

export function validateStep1(data: Partial<Step1CompanyData>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.companyName || !data.companyName.trim()) {
    errors.companyName = "Company / Brand Name is required.";
  } else if (data.companyName.trim().length < 2) {
    errors.companyName = "Company name must be at least 2 characters.";
  }

  if (!data.founderName || !data.founderName.trim()) {
    errors.founderName = "Founder / Owner Name is required.";
  } else if (data.founderName.trim().length < 2) {
    errors.founderName = "Founder name must be at least 2 characters.";
  }

  if (!data.businessType || !data.businessType.trim()) {
    errors.businessType = "Please select a business type.";
  }

  if (!data.phone || !data.phone.trim()) {
    errors.phone = "Company contact phone number is required.";
  } else {
    const phoneRes = validatePhone(data.phone);
    if (!phoneRes.valid) {
      errors.phone = phoneRes.error || "Enter a valid phone number.";
    }
  }

  if (!data.description || !data.description.trim()) {
    errors.description = "Company description and mission are required.";
  } else if (data.description.trim().length < 15) {
    errors.description = "Please provide at least 15 characters describing your sustainable mission.";
  }

  if (!data.companyAddress || !data.companyAddress.trim()) {
    errors.companyAddress = "Company registered office address is required.";
  } else if (data.companyAddress.trim().length < 8) {
    errors.companyAddress = "Please provide a complete registered business address.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// Uploaded Document Reference
export interface UploadedDocRef {
  name: string;
  url: string;
  publicId?: string;
  format?: string;
  resourceType?: string;
  size?: number;
}

// Step 2: Legal Verification Data Definition
export interface Step2LegalData {
  gstNumber: string;
  gstDoc: UploadedDocRef | null;
  panNumber: string;
  panDoc: UploadedDocRef | null;
  aadharNumber: string;
  aadharDoc: UploadedDocRef | null;
  certDocs?: UploadedDocRef[];
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankProofDoc?: UploadedDocRef | null;
}

export function validateStep2(data: Partial<Step2LegalData>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  // GST Validation
  if (!data.gstNumber || !data.gstNumber.trim()) {
    errors.gstNumber = "GSTIN registration number is required.";
  } else {
    const gstRes = validateGSTIN(data.gstNumber);
    if (!gstRes.valid) {
      errors.gstNumber = gstRes.error || "Invalid GSTIN format.";
    }
  }

  if (!data.gstDoc || !data.gstDoc.url || data.gstDoc.url.includes("images.unsplash.com") || data.gstDoc.url === "mock_base64") {
    errors.gstDoc = "GST Registration Certificate document must be uploaded.";
  }

  // PAN Validation
  if (!data.panNumber || !data.panNumber.trim()) {
    errors.panNumber = "PAN card number is required.";
  } else {
    const panRes = validatePAN(data.panNumber);
    if (!panRes.valid) {
      errors.panNumber = panRes.error || "Invalid PAN format. Expected format: ABCDE1234F.";
    }
  }

  if (!data.panDoc || !data.panDoc.url || data.panDoc.url.includes("images.unsplash.com") || data.panDoc.url === "mock_base64") {
    errors.panDoc = "PAN Card document photo/PDF must be uploaded.";
  }

  // Aadhaar Validation
  if (!data.aadharNumber || !data.aadharNumber.trim()) {
    errors.aadharNumber = "Aadhaar number is required.";
  } else {
    const aadharRes = validateAadhaar(data.aadharNumber);
    if (!aadharRes.valid) {
      errors.aadharNumber = aadharRes.error || "Invalid Aadhaar number.";
    }
  }

  if (!data.aadharDoc || !data.aadharDoc.url || data.aadharDoc.url.includes("images.unsplash.com") || data.aadharDoc.url === "mock_base64") {
    errors.aadharDoc = "Aadhaar Card document photo/PDF must be uploaded.";
  }

  // Optional Bank Details
  if (data.bankIfsc && data.bankIfsc.trim()) {
    const ifscRes = validateIFSC(data.bankIfsc);
    if (!ifscRes.valid) {
      errors.bankIfsc = ifscRes.error || "Invalid IFSC code.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// Step 3: Product Launch Data Definition
export interface Step3ProductData {
  name: string;
  categoryName: string;
  unit: string;
  price: number | string;
  wholesalePrice?: number | string;
  originalPrice?: number | string;
  stock: number | string;
  description: string;
  materialUsed?: string;
  sustainabilityScore?: number;
  sustainabilityDetail?: string;
  imageUrls: string[];
}

export function validateStep3(data: Partial<Step3ProductData>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.name || !data.name.trim()) {
    errors.name = "Product title / name is required.";
  } else if (data.name.trim().length < 3) {
    errors.name = "Product title must be at least 3 characters.";
  }

  if (!data.categoryName || !data.categoryName.trim()) {
    errors.categoryName = "Product category is required.";
  }

  if (!data.unit || !data.unit.trim()) {
    errors.unit = "Unit / packaging type is required.";
  }

  const priceNum = Number(data.price);
  if (data.price === undefined || data.price === null || data.price === "" || isNaN(priceNum) || priceNum <= 0) {
    errors.price = "Selling price must be a valid positive number (e.g. ₹499).";
  }

  if (data.wholesalePrice !== undefined && data.wholesalePrice !== null && data.wholesalePrice !== "") {
    const wpNum = Number(data.wholesalePrice);
    if (isNaN(wpNum) || wpNum < 0) {
      errors.wholesalePrice = "Wholesale price must be a valid non-negative number.";
    }
  }

  if (data.originalPrice !== undefined && data.originalPrice !== null && data.originalPrice !== "") {
    const opNum = Number(data.originalPrice);
    if (isNaN(opNum) || opNum < 0) {
      errors.originalPrice = "Original MRP price must be a valid non-negative number.";
    }
  }

  const stockNum = Number(data.stock);
  if (data.stock === undefined || data.stock === null || data.stock === "" || isNaN(stockNum) || stockNum < 1) {
    errors.stock = "Initial stock must be at least 1 unit.";
  }

  if (!data.description || !data.description.trim()) {
    errors.description = "Complete product description is required.";
  } else if (data.description.trim().length < 15) {
    errors.description = "Product description must be at least 15 characters.";
  }

  // Mandatory 5+ successfully uploaded product images
  const validImages = (data.imageUrls || []).filter(
    (url) => url && typeof url === "string" && url.trim().length > 0 && !url.includes("example.com")
  );

  if (validImages.length < 5) {
    errors.imageUrls = `You must upload at least 5 product images (${validImages.length} uploaded so far).`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// Centralized Full Application Validation
export interface CompleteSellerApplicationData {
  company: Step1CompanyData;
  legal: Step2LegalData;
  product: Step3ProductData;
}

export function validateFullApplication(data: {
  company: Partial<Step1CompanyData>;
  legal: Partial<Step2LegalData>;
  product: Partial<Step3ProductData>;
}): { valid: boolean; errors: { company: Record<string, string>; legal: Record<string, string>; product: Record<string, string> } } {
  const compRes = validateStep1(data.company || {});
  const legalRes = validateStep2(data.legal || {});
  const prodRes = validateStep3(data.product || {});

  return {
    valid: compRes.valid && legalRes.valid && prodRes.valid,
    errors: {
      company: compRes.errors,
      legal: legalRes.errors,
      product: prodRes.errors,
    },
  };
}
