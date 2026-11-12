
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button, Card, Badge, LiquidButton, MetalButton } from "@/components/ui/shared";
import { FadeIn, FadeInStagger, FadeInStaggerItem, ScaleHover } from "@/components/FramerComponents";
import { ShieldCheck, Award, Leaf, ArrowRight, ArrowUpRight, RefreshCw, ChevronRight, ShoppingBag, MapPin, CheckCircle } from "lucide-react";
import DisplayCards from "@/components/ui/display-cards";
import ScrollGlobe from "@/components/ui/scroll-globe";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { getProducts, ProductItem } from "@/actions/products";
import ProductCard from "@/components/marketplace/ProductCard";
import TestimonialsSection from "@/components/marketplace/TestimonialsSection";

const CATEGORIES = [
  {
    id: "organic-apparel",
    name: "Organic Apparel",
    description: "GOTS-certified garments made from natural flax, hemp, and pesticide-free cotton.",
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop&q=80",
    badge: "Circular Design",
  },
  {
    id: "zero-waste-living",
    name: "Zero-Waste Living",
    description: "Daily lifestyle essentials designed to eliminate single-use plastics completely.",
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80",
    badge: "Biodegradable",
  },
  {
    id: "renewable-energy",
    name: "Renewable Energy",
    description: "High-efficiency solar devices, power banks, and grid-independent outdoor accessories.",
    image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&auto=format&fit=crop&q=80",
    badge: "Net Zero",
  },
  {
    id: "eco-home-goods",
    name: "Eco Home Goods",
    description: "Furniture and tableware repurposed from architectural waste and reclaimed timber.",
    image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&auto=format&fit=crop&q=80",
    badge: "Upcycled",
  },
];

const highlightsCards = [
  {
    icon: <ShieldCheck className="h-5 w-5 text-primary" />,
    title: "Rigorous 5-Step Verification",
    description: "Every supplier submits official PAN, GST, and third-party sustainability audits before catalog access.",
    date: "Verified Supplier Profile",
    className:
      "[grid-area:stack] hover:-translate-y-24 hover:z-30 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
  },
  {
    icon: <Leaf className="h-5 w-5 text-primary" />,
    title: "Carbon-Neutral Delivery",
    description: "We compute shipment carbon footprint and offset 100% of emissions through certified forestry initiatives.",
    date: "100% Carbon Offset",
    className:
      "[grid-area:stack] translate-x-12 translate-y-8 hover:-translate-y-16 hover:z-30 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
  },
  {
    icon: <RefreshCw className="h-5 w-5 text-primary" />,
    title: "Circular Sourcing",
    description: "All products contain clear material transparency indexes promoting end-of-life upcyclability.",
    date: "High Upcyclability Index",
    className:
      "[grid-area:stack] translate-x-24 translate-y-16 hover:-translate-y-8 hover:z-30",
  },
];

const SUSTAINABILITY_DATA = [
  {
    id: "cotton-shirt",
    name: "Organic Raw Cotton Shirt",
    carbon: "-73%",
    water: "-420 Liters",
    score: "92/100",
    certs: ["GOTS Organic", "Fair Trade Certified"],
    desc: "Made from natural rain-fed organic cotton fibers. Zero harmful synthetic pesticides were used, saving soil health and native river basins.",
    color: "text-emerald-600"
  },
  {
    id: "bamboo-brush",
    name: "Biodegradable Bamboo Toothbrush",
    carbon: "-95%",
    water: "-150 Liters",
    score: "98/100",
    certs: ["USDA Biobased", "FSC Certified Wood"],
    desc: "Wild harvested Moso bamboo handle that breaks down completely in residential backyard compost heaps within six months.",
    color: "text-emerald-600"
  },
  {
    id: "solar-lamp",
    name: "Solar Powered Utility Lamp",
    carbon: "-82%",
    water: "-80 Liters",
    score: "95/100",
    certs: ["RoHS Compliant", "CE Certified"],
    desc: "Monocrystalline cells paired with dynamic lithium iron phosphate batteries to enable grid-independent lighting for over 10 years.",
    color: "text-emerald-600"
  },
  {
    id: "notebook",
    name: "Recycled Waste Paper Notebook",
    carbon: "-68%",
    water: "-350 Liters",
    score: "88/100",
    certs: ["FSC Recycled", "Chlorine-Free Process"],
    desc: "Repurposed from post-consumer office refuse using soy-based natural printing inks and zero toxic bleaching chemical agents.",
    color: "text-emerald-600"
  }
];

const BASE_SAVINGS: Record<string, { carbon: number; water: number; waste: number }> = {
  "cotton-shirt": { carbon: 12.5, water: 420, waste: 0.22 },
  "bamboo-brush": { carbon: 0.65, water: 150, waste: 0.05 },
  "solar-lamp": { carbon: 45.2, water: 80, waste: 1.15 },
  "notebook": { carbon: 3.1, water: 350, waste: 0.38 }
};

function AnimatedCounter({ value, isDecimal = false, suffix = "" }: { value: number; isDecimal?: boolean; suffix?: string }) {
  const [count, setCount] = useState(isDecimal ? 0 : Math.floor(value * 0.7));

  useEffect(() => {
    const duration = 1200;
    const steps = 30;
    const stepTime = duration / steps;
    const startVal = isDecimal ? 0 : Math.floor(value * 0.7);
    const diff = value - startVal;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeProgress = progress * (2 - progress); // easeOutQuad
      const currentVal = startVal + easeProgress * diff;
      
      if (currentStep >= steps) {
        clearInterval(timer);
        setCount(value);
      } else {
        setCount(isDecimal ? parseFloat(currentVal.toFixed(1)) : Math.floor(currentVal));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, isDecimal]);

  return (
    <span className="tabular-nums">
      {isDecimal ? count.toFixed(1) : count.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function Homepage() {
  const { addToCart } = useCart();
  const { user, isLoading: authLoading } = useAuth();
  const isBuyerVerified =
    !authLoading &&
    Boolean(user && user.id && (user.role === "ADMIN" || user.role === "SELLER" || user.buyerOnboardingCompleted));
  const marketplaceHref = isBuyerVerified ? "/marketplace" : "/auth/buyer-login?redirect_url=/marketplace";
  // Strictly enforce login and onboarding completion
  const isLoggedIn = isBuyerVerified;

  const [addedItemName, setAddedItemName] = useState<string | null>(null);
  const [selectedWowItemId, setSelectedWowItemId] = useState<string | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(50);
  const [homeCategories, setHomeCategories] = useState<{id: string; name: string; slug: string; productCount: number}[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [activeCatalogCategory, setActiveCatalogCategory] = useState<string>("all");
  const [productPageOffset, setProductPageOffset] = useState<number>(0);
  const [isRotating, setIsRotating] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then(data => setHomeCategories(data.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoadingProducts(true);
        // Fetch products ordered by latest updated first
        const fetchedProducts = await getProducts({ includeUnapproved: false, sortBy: "newest" });
        if (isMounted) {
          const list = Array.isArray(fetchedProducts) ? fetchedProducts : [];
          setProducts(list);
          const uniqueCats = Array.from(new Set(list.map((p) => p.category).filter(Boolean)));
          setAvailableCategories(uniqueCats.slice(0, 5));
          // Start with a non-constant offset so products rotate dynamically across sessions
          if (list.length > 4) {
            setProductPageOffset(Math.floor(Math.random() * Math.max(1, Math.floor(list.length / 4))));
          }
        }
      } catch (err) {
        console.error("Failed to load products on homepage:", err);
      } finally {
        if (isMounted) {
          setLoadingProducts(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter products by selected category
  const filteredProducts = React.useMemo(() => {
    if (activeCatalogCategory === "all") return products;
    return products.filter((p) => 
      p.category?.toLowerCase() === activeCatalogCategory.toLowerCase() ||
      p.categoryId?.toLowerCase() === activeCatalogCategory.toLowerCase()
    );
  }, [products, activeCatalogCategory]);

  // Rotate products so there is no constant static list
  const pageSize = 8;
  const displayedProducts = React.useMemo(() => {
    if (filteredProducts.length === 0) return [];
    if (filteredProducts.length <= pageSize) return filteredProducts;
    const startIndex = (productPageOffset * pageSize) % filteredProducts.length;
    const result: ProductItem[] = [];
    for (let i = 0; i < Math.min(pageSize, filteredProducts.length); i++) {
      result.push(filteredProducts[(startIndex + i) % filteredProducts.length]);
    }
    return result;
  }, [filteredProducts, productPageOffset, pageSize]);

  const handleRotateProducts = () => {
    setIsRotating(true);
    setProductPageOffset((prev) => prev + 1);
    setTimeout(() => setIsRotating(false), 450);
  };

  const handleAddToCart = (e: React.MouseEvent | null, item: ProductItem) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isBuyerVerified) {
      if (typeof window !== "undefined") {
        window.location.href = `/auth/buyer-login?redirect_url=${encodeURIComponent("/marketplace")}`;
      }
      return;
    }
    const units = item.unitsPerBox || item.bulkOrderQuantity || 100;
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      originalPrice: item.originalPrice,
      image: item.images?.[0] || "",
      sellerName: "EarthCentric",
      sellerId: item.sellerId,
      moq: 1,
      boxes: 1,
      unitsPerBox: units,
      pricePerBox: item.price,
      twoBoxPrice: item.twoBoxPrice,
      threePlusBoxPrice: item.threePlusBoxPrice,
      totalUnits: units,
      buyXGetYOffer: item.buyXGetYOffer || null,
      individualDiscount: item.individualDiscount || null,
      tierDiscounts: item.tierDiscounts || null,
      bulkPriceSlabs: (item as any).bulkPriceSlabs || null,
    }, 1);
    setAddedItemName(item.name);
    setTimeout(() => setAddedItemName(null), 2500);
  };

  const fallbackSustainabilityItems: ProductItem[] = [
    {
      id: "preview-1",
      name: "Organic Raw Cotton Shirt",
      slug: "organic-raw-cotton-shirt",
      description: "",
      price: 2,
      stock: 50,
      images: [],
      category: "Apparel",
      categoryId: "apparel",
      isApproved: true,
      sellerId: "earthcentric",
      seller: { id: "earthcentric", companyName: "EarthCentric", badges: [] },
      certifications: [],
      rating: 5,
      reviewsCount: 10,
    },
    {
      id: "preview-2",
      name: "Biodegradable Bamboo Toothbrush",
      slug: "biodegradable-bamboo-toothbrush",
      description: "",
      price: 1,
      stock: 50,
      images: [],
      category: "Zero-Waste",
      categoryId: "zero-waste",
      isApproved: true,
      sellerId: "earthcentric",
      seller: { id: "earthcentric", companyName: "EarthCentric", badges: [] },
      certifications: [],
      rating: 5,
      reviewsCount: 15,
    },
  ];

  // Dynamically map products to sustainability intelligence items
  const intelligenceSource = products.length > 0 ? products : fallbackSustainabilityItems;
  const sustainabilityItems = intelligenceSource.map((prod) => {
    let carbonRate = 0.65;
    let waterRate = 150;
    let wasteRate = 0.05;
    let certs = ["Eco-Friendly Audited", "Material Vetted"];

    const nameLower = prod.name.toLowerCase();
    if (nameLower.includes("toothbrush") || nameLower.includes("brush")) {
      carbonRate = 0.65;
      waterRate = 150;
      wasteRate = 0.05;
      certs = ["USDA Biobased", "FSC Certified Wood"];
    } else if (nameLower.includes("shirt") || nameLower.includes("cotton") || nameLower.includes("apparel")) {
      carbonRate = 12.5;
      waterRate = 420;
      wasteRate = 0.22;
      certs = ["GOTS Organic", "Fair Trade Certified"];
    } else if (nameLower.includes("lamp") || nameLower.includes("solar") || nameLower.includes("power")) {
      carbonRate = 45.2;
      waterRate = 80;
      wasteRate = 1.15;
      certs = ["RoHS Compliant", "CE Certified"];
    } else if (nameLower.includes("notebook") || nameLower.includes("paper")) {
      carbonRate = 3.1;
      waterRate = 350;
      wasteRate = 0.38;
      certs = ["FSC Recycled", "Chlorine-Free Process"];
    } else {
      const score = 90;
      // Proportional fallback based on sustainability score
      carbonRate = Number((score * 0.2).toFixed(2));
      waterRate = Math.round(score * 3.5);
      wasteRate = Number((score * 0.005).toFixed(3));
      
      // Category fallback certs
      const catLower = (prod.category || "").toLowerCase();
      if (catLower.includes("apparel") || catLower.includes("clothing")) {
        certs = ["GOTS Organic", "Fair Trade Certified"];
      } else if (catLower.includes("zero-waste") || catLower.includes("waste")) {
        certs = ["USDA Biobased", "Biodegradable Audited"];
      } else if (catLower.includes("energy") || catLower.includes("solar")) {
        certs = ["RoHS Compliant", "CE Certified"];
      } else if (catLower.includes("home") || catLower.includes("goods") || catLower.includes("wood")) {
        certs = ["FSC Recycled", "Chemical-Free Process"];
      }
    }

    return {
      id: prod.id,
      name: prod.name,
      carbonRate,
      waterRate,
      wasteRate,
      certs,
      desc: "",
      color: "text-emerald-600"
    };
  });

  const activeWowItem = sustainabilityItems.find(item => item.id === selectedWowItemId) || sustainabilityItems[0];

  const sections = [
    {
      id: "hero",
      badge: "Home",
      content: (
        <section className="relative overflow-hidden bg-gradient-to-b from-accent/10 to-transparent pt-12 pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center min-h-[60vh]">
              
              {/* Left Column: Heavy typography, CTAs, & summary */}
              <div className="md:col-span-7 space-y-8 text-left z-20">
                <div className="inline-flex items-center space-x-2 rounded-full glass-badge px-4 py-1.5 text-xs font-semibold text-primary shadow-sm w-fit">
                  <Award className="h-4 w-4 text-emerald-600 animate-pulse" />
                  <span>Premier Ethical Marketplace</span>
                </div>

                <h1 className="text-4xl sm:text-6xl lg:text-[72px] font-extrabold tracking-tight text-primary leading-[0.95] -letter-spacing-[0.04em] uppercase">
                  Every Product Verified. <br />
                  <span className="text-emerald-600">Every Purchase</span> Measurable.
                </h1>

                <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
                  EarthCentric connects conscious buyers with verified sustainable businesses, manufacturers, and carbon-neutral suppliers.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                  <Link href={marketplaceHref} className="w-full sm:w-auto">
                    <LiquidButton size="lg" className="w-full sm:w-auto flex items-center justify-center space-x-2">
                      <span>Explore Marketplace</span>
                      <ArrowRight className="h-4 w-4" />
                    </LiquidButton>
                  </Link>
                </div>

                <div className="pt-6 border-t border-[#d0c6b8]/30 max-w-xl grid grid-cols-2 gap-6 text-xs text-muted-foreground font-semibold">
                  <div>
                    <span className="block text-lg font-black text-primary">5-Stage</span>
                    <span>Audit Process</span>
                  </div>
                  <div>
                    <span className="block text-lg font-black text-primary">100%</span>
                    <span>Carbon-Neutral Shipping</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Empty spacer for Globe overlays */}
              <div className="md:col-span-5 h-[350px] md:h-[500px] pointer-events-none relative" />
            </div>
          </div>


          {/* Floating Product Showcase Preview */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 md:mt-36 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="text-center md:text-left space-y-2 max-w-xl">
                <div className="inline-flex items-center space-x-1.5 rounded-full bg-accent/20 border border-accent/30 px-3 py-1 text-[10px] font-bold text-primary uppercase tracking-wider">
                  <span>Featured Catalog Preview</span>
                </div>
                <h2 className="text-3xl font-extrabold text-primary tracking-tight">Eco Essentials</h2>
                <p className="text-sm text-muted-foreground">Handpicked items from verified manufacturers featuring lifetime carbon offsetting.</p>
                {!isLoggedIn && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-semibold text-emerald-800">
                    <span>🔒</span>
                    <span>Wholesale and bulk pricing locked for guests.</span>
                    <Link href="/auth/buyer-login" className="text-emerald-700 underline font-bold hover:text-emerald-900 ml-0.5">
                      Sign in to view prices
                    </Link>
                  </div>
                )}
              </div>

              {/* Dynamic Controls: Rotate / Refresh picks and Explore all */}
              <div className="flex items-center gap-2.5 self-center md:self-end flex-wrap justify-center">
                {products.length > pageSize && (
                  <button
                    onClick={handleRotateProducts}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 hover:border-emerald-500 text-xs font-bold text-slate-700 hover:text-emerald-700 transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Rotate products from our latest catalog"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-emerald-600 transition-transform ${isRotating ? "animate-spin" : ""}`} />
                    <span>Rotate Picks</span>
                  </button>
                )}
                <Link
                  href={marketplaceHref}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0F6E56] hover:bg-[#0c5844] text-xs font-bold text-white transition-all shadow-xs"
                >
                  <span>Explore Marketplace</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Dynamic category filter pills */}
            {availableCategories.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none pt-2">
                <button
                  onClick={() => {
                    setActiveCatalogCategory("all");
                    setProductPageOffset(0);
                  }}
                  className={`text-xs px-3 py-1 rounded-full font-bold transition-all border whitespace-nowrap cursor-pointer ${
                    activeCatalogCategory === "all"
                      ? "bg-[#0F6E56] text-white border-[#0F6E56] shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-800"
                  }`}
                >
                  ✨ Latest Updates
                </button>
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCatalogCategory(cat);
                      setProductPageOffset(0);
                    }}
                    className={`text-xs px-3 py-1 rounded-full font-semibold transition-all border whitespace-nowrap cursor-pointer ${
                      activeCatalogCategory === cat
                        ? "bg-[#0F6E56] text-white border-[#0F6E56] shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-800"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {loadingProducts ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded-3xl p-4 animate-pulse space-y-4">
                    <div className="aspect-square bg-slate-100 rounded-2xl" />
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                    <div className="h-6 bg-slate-100 rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : displayedProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {displayedProducts.map((item) => (
                  <ProductCard
                    key={item.id}
                    product={item}
                    isLoggedIn={isLoggedIn}
                    onAddToCart={(e, p) => handleAddToCart(e, p)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white/60 border border-dashed border-border/60 rounded-3xl p-8 space-y-3">
                <Leaf className="h-8 w-8 text-emerald-600 mx-auto" />
                <h3 className="text-base font-bold text-primary">Catalog Updating</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Approved products will appear here automatically. Visit the marketplace to explore all live sustainable categories.
                </p>
                <Link href={marketplaceHref}>
                  <Button variant="cool" size="sm" className="mt-2 text-xs">Explore Marketplace</Button>
                </Link>
              </div>
            )}
          </div>

          {/* WOW Component: Sustainability Intelligence Dashboard */}
          <div id="sustainability-dashboard" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 md:mt-36 space-y-8">
            <div className="text-center md:text-left space-y-2 max-w-xl">
              <Badge variant="primary" className="text-[10px] font-bold uppercase tracking-widest px-3 py-1">Interactive panel</Badge>
              <h2 className="text-3xl font-extrabold text-primary tracking-tight">Sustainability Intelligence</h2>
              <p className="text-sm text-muted-foreground">Audit product lifecycles dynamically. Explore ecological offsets and verified compliance parameters.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              
              {/* Toggle Panel Left Column */}
              <div className="lg:col-span-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  {sustainabilityItems.slice(0, 5).map((prod) => {
                    const isSelected = activeWowItem?.id === prod.id;
                    const badgeText = prod.certs[0] || "Eco-Friendly";
                    return (
                      <button suppressHydrationWarning
                        key={prod.id}
                        onClick={() => setSelectedWowItemId(prod.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? "bg-primary border-primary text-primary-foreground shadow-lg scale-[1.02]" 
                            : "bg-card border-border/40 hover:bg-muted/40 text-primary"
                        }`}
                      >
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-accent">{badgeText}</p>
                          <h4 className="text-sm font-bold truncate max-w-[220px]">{prod.name}</h4>
                        </div>
                        <ChevronRight className={`h-4 w-4 ${isSelected ? 'opacity-100' : 'opacity-40'}`} />
                      </button>
                    );
                  })}
                </div>

                <div className="glass-panel rounded-2xl p-5 border border-[#d0c6b8]/40 text-left space-y-2">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-[#6a7b6e]">Eco Certification Auditing</h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Every item passes direct third-party lab documentation verification. Look for verified badges on the marketplace.
                  </p>
                </div>
              </div>

              {/* Dynamic Display Right Column */}
              {activeWowItem ? (
                <div className="lg:col-span-8 glass-panel rounded-3xl p-6 sm:p-8 flex flex-col justify-between text-left border border-[#d0c6b8]/50 dark:border-[#243b2e]/50">
                  <div className="space-y-6">
                    <div className="flex justify-between items-start border-b border-[#d0c6b8]/20 pb-4">
                      <div>
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#6a7b6e]">Verified Product Telemetry</span>
                        <h3 className="text-xl sm:text-2xl font-black text-primary mt-1">{activeWowItem.name}</h3>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-muted-foreground">{activeWowItem.desc}</p>

                    {/* Ecological Savings Simulator */}
                    <div className="space-y-3 bg-[#FFFDF8]/40 dark:bg-[#14241C]/40 rounded-2xl p-4 border border-border/20 text-left">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[#6a7b6e]">Simulated Purchase Quantity:</span>
                        <span className="font-black text-primary px-2.5 py-0.5 bg-[#d0c6b8]/20 dark:bg-emerald-950/40 rounded-md">{purchaseQuantity} units</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="500"
                        value={purchaseQuantity}
                        onChange={(e) => setPurchaseQuantity(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-[#d0c6b8]/40 dark:bg-[#243b2e]/40 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-none"
                      />
                      <p className="text-[9px] text-muted-foreground italic">Drag the slider to calculate the cumulative ecological savings at commercial scale.</p>
                    </div>

                    {/* Dynamic Calculation Cards */}
                    {(() => {
                      const totalCarbon = (activeWowItem.carbonRate * purchaseQuantity).toFixed(1);
                      const totalWater = Math.round(activeWowItem.waterRate * purchaseQuantity).toLocaleString();
                      const totalWaste = (activeWowItem.wasteRate * purchaseQuantity).toFixed(1);

                      return (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-[#FFFDF8]/60 dark:bg-[#14241C]/60 rounded-2xl p-4 border border-border/20">
                            <span className="text-[9px] font-extrabold uppercase text-[#6a7b6e]">Simulated CO₂ Offset</span>
                            <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">{totalCarbon} kg</div>
                            <span className="text-[9px] text-muted-foreground">Emissions avoided</span>
                          </div>
                          <div className="bg-[#FFFDF8]/60 dark:bg-[#14241C]/60 rounded-2xl p-4 border border-border/20">
                            <span className="text-[9px] font-extrabold uppercase text-[#6a7b6e]">Water Conserved</span>
                            <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">{totalWater} L</div>
                            <span className="text-[9px] text-muted-foreground">Fresh water saved</span>
                          </div>
                          <div className="bg-[#FFFDF8]/60 dark:bg-[#14241C]/60 rounded-2xl p-4 border border-border/20">
                            <span className="text-[9px] font-extrabold uppercase text-[#6a7b6e]">Landfill Diverted</span>
                            <div className="text-xl sm:text-2xl font-black text-primary mt-1">{totalWaste} kg</div>
                            <span className="text-[9px] text-muted-foreground">Plastic waste avoided</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="border-t border-[#d0c6b8]/20 pt-6 mt-6 flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-extrabold uppercase text-[#6a7b6e] mr-2">Verified Compliance Audits:</span>
                    {activeWowItem.certs.map((cert) => (
                      <Badge key={cert} variant="accent" className="text-[10px] font-semibold">
                        ✓ {cert}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="lg:col-span-8 glass-panel rounded-3xl p-6 sm:p-8 flex items-center justify-center border border-dashed border-border/40">
                  <p className="text-sm text-muted-foreground">No product sustainability details available.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )
    },
    {
      id: "categories-section",
      badge: "Categories",
      content: (
        <section className="w-full py-16 md:py-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                <Leaf className="h-3 w-3" />
                <span>Browse by Category</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                Shop by Category
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Explore our curated sustainable product categories — from organic clothing to biodegradable tableware.
              </p>
            </div>
            <Link href={marketplaceHref} className="flex items-center text-sm font-bold text-emerald-600 hover:text-emerald-700 hover:underline space-x-1 shrink-0">
              <span>View all products</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {homeCategories.map((cat) => {
              const iconMap: Record<string, string> = {
                "clothing": "👗", "paper-plates": "🍽️", "fertilizers": "🌱",
                "bamboo": "🎋", "reusable-packaging": "♻️", "cutlery": "🥢",
                "personal-care": "🧴", "stationery": "📓", "cleaning": "🧹",
                "home-decor": "🏡", "disposables": "🌿", "food": "🫙",
              };
              const emoji = iconMap[cat.slug] || "🌿";
              return (
                <Link
                  key={cat.id}
                  href={isBuyerVerified ? `/marketplace?category=${cat.slug}` : `/auth/buyer-login?redirect_url=${encodeURIComponent(`/marketplace?category=${cat.slug}`)}`}
                  className="group flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-border/40 bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-md transition-all duration-200 space-y-2 cursor-pointer"
                >
                  <div className="text-3xl">{emoji}</div>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700 leading-tight line-clamp-2">{cat.name}</span>
                  {cat.productCount > 0 && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">{cat.productCount} products</span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )
    },
    {
      id: "credentials",
      badge: "Credentials",
      content: (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-36">
          <FadeInStagger className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <FadeInStaggerItem>
              <div className="flex flex-col justify-center space-y-6 max-w-xl">
                <div className="inline-flex items-center space-x-1.5 rounded-full bg-accent/20 border border-accent/30 px-3 py-1 text-xs font-semibold text-primary w-fit">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Our Credentials</span>
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl leading-tight">
                  Uncompromising Trust &amp; Sourcing Standards
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed">
                  We believe greenwashing hurts our planet. EarthCentric enforces strict verification, computes shipment carbon footprint offsets, and audits material life cycles so you can trade with absolute peace of mind.
                </p>

              </div>
            </FadeInStaggerItem>

            <FadeInStaggerItem className="flex justify-center lg:justify-end pr-0 lg:pr-24">
              <div className="relative flex items-center justify-center min-h-[250px] md:min-h-[400px] w-full max-w-[20rem] sm:max-w-[28rem] mx-auto pt-6 pb-20 md:py-0">
                <DisplayCards cards={highlightsCards} />
              </div>
            </FadeInStaggerItem>
          </FadeInStagger>
        </section>
      )
    },
    {
      id: "categories",
      badge: "Categories",
      content: (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-36 space-y-8 md:space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="primary">Curated Catalogs</Badge>
              <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                Shop by Sustainable Focus
              </h2>
            </div>
            <Link href={marketplaceHref} className="text-sm font-semibold text-primary hover:underline flex items-center space-x-1">
              <span>View all products</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <FadeInStagger className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {CATEGORIES.map((cat, idx) => (
              <FadeInStaggerItem key={cat.id}>
                <ScaleHover className="h-full">
                  <Card className="group relative h-64 sm:h-96 overflow-hidden rounded-2xl border-none">
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

                    <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8 space-y-2 sm:space-y-3 text-white">
                      <div>
                        <Badge variant="premium" className="bg-premium text-white border-none py-0.5 px-2 text-[10px]">
                          {cat.badge}
                        </Badge>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold">{cat.name}</h3>
                      <p className="text-sm text-gray-300 leading-relaxed max-w-md">
                        {cat.description}
                      </p>
                      <div className="pt-2">
                        <Link href={isBuyerVerified ? `/marketplace?category=${cat.id}` : `/auth/buyer-login?redirect_url=${encodeURIComponent(`/marketplace?category=${cat.id}`)}`}>
                          <Button variant="secondary" size="sm" className="bg-white text-primary hover:bg-gray-100 flex items-center space-x-1.5 border-none">
                            <span>Browse Products</span>
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                </ScaleHover>
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        </section>
      )
    },
    {
      id: "how-it-works",
      badge: "Verification",
      content: (
        <section className="w-full bg-primary py-16 md:py-24 text-white rounded-2xl md:rounded-3xl mx-auto max-w-7xl overflow-hidden px-5 sm:px-6 lg:px-12 my-8 md:my-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="bg-accent/20 text-accent border-accent/20">The Trust Standard</Badge>
              <h2 className="text-2xl font-extrabold sm:text-5xl tracking-tight leading-tight">
                We vet, so you can buy with confidence.
              </h2>
              <p className="text-gray-300 leading-relaxed text-base sm:text-lg">
                To eliminate misleading environmental claims, EarthCentric enforces an audit system on every seller profile. No brand is allowed on the catalog without submitting legal identification, GST records, and verified environmental credentials.
              </p>
              <div className="flex flex-col space-y-4 pt-2">
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent font-bold">1</div>
                  <span className="font-semibold text-sm">Business Identity & GST Registration Vetted</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent font-bold">2</div>
                  <span className="font-semibold text-sm">Material & Sourcing Sustainability Audits</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent font-bold">3</div>
                  <span className="font-semibold text-sm">Verified Environmental Impact & Carbon Offsetting</span>
                </div>
              </div>

            </div>

            <div className="relative h-56 sm:h-80 lg:h-full min-h-[200px] sm:min-h-[350px] rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&auto=format&fit=crop&q=80"
                alt="Nature Sustainability Gardening"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-primary/20" />
            </div>
          </div>
        </section>
      )
    },
    {
      id: "testimonials",
      badge: "Testimonials",
      content: <TestimonialsSection />,
    },
    {
      id: "vision-cta",
      badge: "Vision",
      content: (
        <div className="space-y-20 md:space-y-36 py-16 md:py-24">
          <section id="sustainability-mission" className="mx-auto max-w-4xl px-4 text-center space-y-6 py-8">
            <Badge variant="primary" className="text-xs">Our Pledge</Badge>
            <p className="text-xl sm:text-2xl md:text-3xl font-serif text-primary italic leading-relaxed">
              "We do not inherit the Earth from our ancestors; we borrow it from our children. EarthCentric exists to build a commerce architecture that restores balance, offering premium goods made by ethical hands."
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm font-semibold text-secondary">
              <Leaf className="h-4 w-4" />
              <span>Carbon-Neutral Operations Since Day One</span>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Card className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-border/60 bg-gradient-to-r from-accent/15 via-transparent to-accent/5 p-6 sm:p-8 md:p-16 flex flex-col items-center text-center space-y-4 sm:space-y-6">
              <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                Ready to change the way you source?
              </h2>
              <p className="text-muted-foreground max-w-lg leading-relaxed text-sm sm:text-base">
                Join thousands of conscious consumers and verified suppliers shifting to carbon-neutral purchasing today.
              </p>

              <p className="text-xs text-muted-foreground">
                Product reviews are shown only after a verified delivery.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <Link href={marketplaceHref}>
                  <LiquidButton size="lg" className="w-full sm:w-auto">
                    Explore Marketplace
                  </LiquidButton>
                </Link>
                <Link href="/auth/signup">
                  <Button size="lg" variant="cool" className="w-full sm:w-auto">
                    Create Free Account
                  </Button>
                </Link>
              </div>
            </Card>
          </section>
        </div>
      )
    }
  ];

  return (
    <>
      {addedItemName && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-primary text-primary-foreground border border-primary/20 px-4 py-3 shadow-lg flex items-center space-x-2 animate-bounce">
          <ShoppingBag className="h-4 w-4" />
          <span className="text-xs font-semibold">Added "{addedItemName}" to Cart!</span>
        </div>
      )}
      <ScrollGlobe sections={sections} />
    </>
  );
}
