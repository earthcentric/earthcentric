/**
 * GSTIN Validation and Helper Module
 * Validates 15-digit Indian Goods and Services Tax Identification Numbers (GSTIN)
 * Format: 2 digits (State code) + 10 chars (PAN) + 1 char (Entity code) + 'Z' + 1 checksum char
 */

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export interface GSTINValidationResult {
  isValid: boolean;
  error?: string;
  normalizedGstin?: string;
  stateCode?: string;
  stateName?: string;
  pan?: string;
}

/**
 * Normalizes input GSTIN string by trimming and uppercasing
 */
export function normalizeGSTIN(input?: string | null): string {
  if (!input) return "";
  return input.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * Validates whether a given string is a valid GSTIN
 */
export function validateGSTIN(input?: string | null): GSTINValidationResult {
  const gstin = normalizeGSTIN(input);

  if (!gstin) {
    return {
      isValid: false,
      error: "GSTIN is required for B2B commercial bulk purchasing.",
    };
  }

  if (gstin.length !== 15) {
    return {
      isValid: false,
      error: `GSTIN must be exactly 15 characters long (currently ${gstin.length}).`,
      normalizedGstin: gstin,
    };
  }

  const stateCode = gstin.substring(0, 2);
  const stateName = GST_STATE_CODES[stateCode];
  if (!stateName) {
    return {
      isValid: false,
      error: `Invalid GST state code "${stateCode}". Must be a recognized Indian state or territory code (01-38).`,
      normalizedGstin: gstin,
    };
  }

  const panPart = gstin.substring(2, 12);
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(panPart)) {
    return {
      isValid: false,
      error: `Invalid PAN structure in GSTIN ("${panPart}"). Must follow 5 letters, 4 digits, 1 letter.`,
      normalizedGstin: gstin,
      stateCode,
      stateName,
    };
  }

  const fourteenthChar = gstin.charAt(13);
  if (fourteenthChar !== "Z") {
    return {
      isValid: false,
      error: `14th character of GSTIN must be "Z" (received "${fourteenthChar}").`,
      normalizedGstin: gstin,
      stateCode,
      stateName,
      pan: panPart,
    };
  }

  if (!GSTIN_REGEX.test(gstin)) {
    return {
      isValid: false,
      error: "GSTIN does not match standard Indian GST format (e.g. 29ABCDE1234F1Z5).",
      normalizedGstin: gstin,
    };
  }

  return {
    isValid: true,
    normalizedGstin: gstin,
    stateCode,
    stateName,
    pan: panPart,
  };
}

