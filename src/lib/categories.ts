export interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productCount: number;
}

export interface CategoryAttribute {
  key: string;   // e.g. "material", "size"
  label: string; // e.g. "Material", "Size"
  values: string[]; // e.g. ["Bagasse", "Bamboo"]
}

// ── Slug normalization helper ────────────────────────────────────────────────
export function normalizeCategorySlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Predefined sustainable categories (seeded into DB on first use) ──────────
export const SUSTAINABLE_CATEGORIES = [
  { name: "Clothing & Apparel",         slug: "clothing",            description: "Sustainable, organic, and ethically made garments" },
  { name: "Paper Plates & Tableware",   slug: "paper-plates",        description: "Compostable and recycled paper tableware" },
  { name: "Fertilizers & Soil",         slug: "fertilizers",         description: "Organic and natural fertilizers for sustainable farming" },
  { name: "Bamboo Products",            slug: "bamboo",              description: "Eco-friendly bamboo-based everyday items" },
  { name: "Reusable Bags & Packaging",  slug: "reusable-packaging",  description: "Sustainable alternatives to single-use plastics" },
  { name: "Eco Packaging",              slug: "eco-packaging",       description: "Sustainable and biodegradable packaging solutions" },
  { name: "Biodegradable Cutlery",      slug: "cutlery",             description: "Plant-based, compostable cutlery and utensils" },
  { name: "Organic Personal Care",      slug: "personal-care",       description: "Chemical-free, cruelty-free personal hygiene products" },
  { name: "Eco Stationery",             slug: "stationery",          description: "Recycled paper notebooks, pens, and office supplies" },
  { name: "Natural Cleaning Products",  slug: "cleaning",            description: "Non-toxic, biodegradable household cleaning solutions" },
  { name: "Sustainable Home Decor",     slug: "home-decor",          description: "Upcycled and natural material home furnishings" },
  { name: "Compostable Disposables",    slug: "disposables",         description: "Single-use items that fully biodegrade" },
  { name: "Organic Food & Spices",      slug: "food",                description: "Certified organic food products and spices" },
];

