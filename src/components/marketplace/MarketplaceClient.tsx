"use client";

import React, { useState, useEffect, startTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { getProducts, ProductItem, ProductFilter } from "@/actions/products";
import { getWishlistIds } from "@/actions/wishlist";
import { getAllBrands } from "@/actions/sellers";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { Button, Card, Badge, Input } from "@/components/ui/shared";
import { FadeInStagger, FadeInStaggerItem, ScaleHover } from "@/components/FramerComponents";
import {
  Search,
  SlidersHorizontal,
  Star,
  ChevronDown,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Flame,
  X
} from "lucide-react";

import ImpactCounterBar from "@/components/marketplace/ImpactCounterBar";
import TopSellersSection from "@/components/marketplace/SellerCard";
import TestimonialsSection from "@/components/marketplace/TestimonialsSection";
import QuickViewModal from "@/components/marketplace/QuickViewModal";
import ProductCard from "@/components/marketplace/ProductCard";


const CERTIFICATIONS = [
  "GOTS Organic",
  "Fair Trade Certified",
  "FSC Recycled",
  "USDA Biobased",
  "RoHS Compliant",
  "Carbon Trust",
  "B Corp Certified"
];

const CAROUSEL_SLIDES = [
  {
    image: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1600&auto=format&fit=crop&q=80",
    title: "ECO HOME SHOPPING SPREE",
    tagline: "Starting from ₹99 | Extra up to ₹150 Cashback on verified sustainable brands",
    buttonText: "Shop Deals",
    category: "eco-home-goods"
  },
  {
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=1600&auto=format&fit=crop&q=80",
    title: "REVAMP YOUR WARDROBE",
    tagline: "Up to 30% Off GOTS-certified Organic Apparel & Hemp clothing",
    buttonText: "Explore Apparel",
    category: "organic-apparel"
  },
  {
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1600&auto=format&fit=crop&q=80",
    title: "DEALS ON HOME ESSENTIALS",
    tagline: "Zero-waste living made easy | Biodegradable Moso Bamboo starting at ₹49",
    buttonText: "Browse Zero-Waste",
    category: "zero-waste-living"
  }
];

const GRID_CARDS = [
  {
    title: "Organic Apparel & Linen | Up to 30% off",
    category: "organic-apparel",
    items: [
      { name: "Organic Hemp Tee", slug: "organic-hemp-tee", image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400&q=80", price: "₹1,899" },
      { name: "Linen Lounge Pants", slug: "linen-lounge-pants", image: "https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=400&q=80", price: "₹2,499" },
      { name: "Organic Cotton Tee", slug: "organic-cotton-classic-tee", image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&q=80", price: "₹1,899" },
      { name: "Minimalist Backpack", slug: "minimalist-hemp-backpack", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80", price: "₹4,999" }
    ],
    linkText: "Shop Organic Apparel"
  },
  {
    title: "Zero-Waste Living | Deals from ₹49",
    category: "zero-waste-living",
    items: [
      { name: "Bamboo Cutlery", slug: "zero-waste-bamboo-cutlery", image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&q=80", price: "₹699" },
      { name: "Upcycled Tote", slug: "zero-waste-cotton-tote", image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=400&q=80", price: "₹499" },
      { name: "Glass Water Bottle", slug: "upcycled-glass-bottle", image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&q=80", price: "₹1,299" },
      { name: "Eco Straws & Kits", slug: "zero-waste-bamboo-cutlery", image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=400&q=80", price: "₹699" }
    ],
    linkText: "Browse Zero-Waste Shop"
  },
  {
    title: "Renewable Energy | Solar Chargers",
    category: "renewable-energy",
    items: [
      { name: "Solar Chargers", slug: "solar-portable-charger", image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&q=80", price: "₹3,499" },
      { name: "Solar Power Bank", slug: "solar-portable-charger", image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=400&q=80", price: "₹3,499" },
      { name: "Solar Lanterns", slug: "solar-portable-charger", image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&q=80", price: "Starting ₹99" },
      { name: "Outdoor Solar Gear", slug: "solar-portable-charger", image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&q=80", price: "Up to 20% off" }
    ],
    linkText: "Explore Renewable Energy"
  },
  {
    title: "Eco Home Goods | Upcycled Wood",
    category: "eco-home-goods",
    items: [
      { name: "Cooling Sheets", slug: "bamboo-cooling-sheets", image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&q=80", price: "₹3,499" },
      { name: "Duvet Cover", slug: "tencel-duvet-cover", image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400&q=80", price: "₹4,999" },
      { name: "Hemp Bath Towels", slug: "hemp-bath-towels", image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&q=80", price: "₹1,299" },
      { name: "Wood Board", slug: "solid-oak-cutting-board", image: "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=400&q=80", price: "₹2,799" }
    ],
    linkText: "Shop Eco Home Goods"
  }
];

function ProductSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(8)].map((_, index) => (
        <Card key={index} className="h-[360px] animate-pulse border border-border/40 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-muted h-48 w-full" />
            <div className="p-4 space-y-3">
              <div className="h-3 bg-muted rounded w-1/4" />
              <div className="h-5 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          </div>
          <div className="p-4 pt-0">
            <div className="h-8 bg-muted rounded-xl w-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 sm:p-16 border border-dashed border-border/60 rounded-3xl bg-card space-y-6 max-w-lg mx-auto my-12">
      <div className="h-16 w-16 rounded-full bg-emerald-600/10 text-emerald-700 flex items-center justify-center border border-emerald-600/20 shadow-inner">
        <SlidersHorizontal className="h-7 w-7" />
      </div>
      <div className="space-y-2">
        <h3 className="font-extrabold text-lg text-primary">No products match your filters</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          We couldn't find any sustainable items matching your selections. Try resetting the filters or modifying your search values.
        </p>
      </div>
      <Button
        onClick={onClear}
        variant="cool"
        className="font-bold text-xs py-2.5 px-6"
      >
        Reset Filters
      </Button>
    </div>
  );
}

export default function MarketplaceClient() {
  const searchParams = useSearchParams();
  
  // Read initial states from URL parameters
  const initialCategory = searchParams.get("category") || "all";
  const initialSearch = searchParams.get("search") || "";
  const initialPricePreset = searchParams.get("pricePreset") || "all";
  const initialVerified = searchParams.get("verified") === "true";
  const initialSort = (searchParams.get("sort") || "newest") as ProductFilter["sortBy"] | "best-rated";
  const initialDealsOnly = searchParams.get("deals") === "true";
  const initialNewArrivalsOnly = searchParams.get("newArrivals") === "true";

  // Filter States
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [selectedBrand, setSelectedBrand] = useState<string>(searchParams.get("brand") || "all");
  const [brandsList, setBrandsList] = useState<{ id: string; companyName: string }[]>([]);
  const [pricePreset, setPricePreset] = useState<string>(initialPricePreset);
  const [minPrice, setMinPrice] = useState<string>(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState<string>(searchParams.get("maxPrice") || "");
  const [sortBy, setSortBy] = useState<ProductFilter["sortBy"] | "best-rated">(initialSort);
  const [dealsOnly, setDealsOnly] = useState(initialDealsOnly);
  const [newArrivalsOnly, setNewArrivalsOnly] = useState(initialNewArrivalsOnly);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Custom Storefront state
  const [showCatalogExplicitly, setShowCatalogExplicitly] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Cart Actions & Wishlist
  const { addToCart } = useCart();
  const [addedItemName, setAddedItemName] = useState<string | null>(null);

  // Quick View Modal State
  const [selectedProductForQuickView, setSelectedProductForQuickView] = useState<ProductItem | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  const [navCategories, setNavCategories] = useState<{id: string; name: string; slug: string}[]>([]);

  // Fetch live categories & brands from API/DB
  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then(data => setNavCategories(data.categories || []))
      .catch(() => {});

    getAllBrands().then(list => {
      const sorted = [...(list || [])].sort((a, b) => a.companyName.localeCompare(b.companyName));
      setBrandsList(sorted);
    });
  }, []);

  // Synchronize state with URL change
  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) {
      setCategory(cat);
      setShowCatalogExplicitly(true);
    }
    const q = searchParams.get("search");
    if (q !== null) {
      setSearch(q);
      setShowCatalogExplicitly(true);
    }
    const deals = searchParams.get("deals");
    if (deals !== null) {
      setDealsOnly(deals === "true");
      setShowCatalogExplicitly(true);
    }
    const newArrivals = searchParams.get("newArrivals");
    if (newArrivals !== null) {
      setNewArrivalsOnly(newArrivals === "true");
      setShowCatalogExplicitly(true);
    }
  }, [searchParams]);

  // Sync state to URL search parameters for sharing/SEO history
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);
    if (selectedBrand !== "all") params.set("brand", selectedBrand);
    if (pricePreset !== "all") params.set("pricePreset", pricePreset);
    if (pricePreset === "custom") {
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
    }
    if (sortBy !== "newest") params.set("sort", sortBy as string);
    if (dealsOnly) params.set("deals", "true");
    if (newArrivalsOnly) params.set("newArrivals", "true");
    
    const url = `/marketplace?${params.toString()}`;
    window.history.pushState({ path: url }, "", url);
  }, [category, search, selectedBrand, pricePreset, minPrice, maxPrice, sortBy, dealsOnly, newArrivalsOnly]);

  // Load wishlist from database on mount
  const { user } = useAuth();
  useEffect(() => {
    if (user?.id) {
      getWishlistIds(user.id).then((ids) => setWishlistIds(ids));
    } else {
      setWishlistIds([]);
    }
  }, [user]);

  // Fetch products from Prisma DB (or mock fallback) based on filters
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      
      // Map price presets to numeric values
      let priceRange: [number, number] | undefined = undefined;
      if (pricePreset === "under-500") priceRange = [0, 500];
      else if (pricePreset === "500-2000") priceRange = [500, 2000];
      else if (pricePreset === "above-2000") priceRange = [2000, 1000000];
      else if (pricePreset === "custom") {
        const min = minPrice ? parseFloat(minPrice) : 0;
        const max = maxPrice ? parseFloat(maxPrice) : 1000000;
        priceRange = [min, max];
      }

      // Pass standard Prisma sorting parameters if they exist
      const isDbSort = ["newest", "popular", "rating", "price-asc", "price-desc"].includes(sortBy as string);
      
      const filters: ProductFilter = {
        search: search || undefined,
        category: category !== "all" ? category : undefined,
        minSustainabilityScore: undefined,
        priceRange: priceRange,
        sortBy: isDbSort ? (sortBy as ProductFilter["sortBy"]) : undefined,
        dealsOnly: dealsOnly,
        newArrivalsOnly: newArrivalsOnly,
      };

      try {
        const result = await getProducts(filters);
        
        startTransition(() => {
          let sortedResults = [...result];
          
          if (selectedBrand !== "all") {
            sortedResults = sortedResults.filter(
              (p) => p.seller.companyName.toLowerCase() === selectedBrand.toLowerCase()
            );
          }

          // Apply custom client-side sorting overrides if requested
          if (sortBy === "best-rated") {
            sortedResults.sort((a, b) => b.rating - a.rating);
          }
          
          setProducts(sortedResults);
          setLoading(false);
        });
      } catch (e) {
        console.error("Failed to load products", e);
        setLoading(false);
      }
    };

    const timer = setTimeout(loadProducts, 300); // Debouncing queries
    return () => clearTimeout(timer);
  }, [search, category, selectedBrand, pricePreset, minPrice, maxPrice, sortBy, dealsOnly, newArrivalsOnly]);

  // Carousel slide timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentSlide((prev) => (prev - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length);
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
  };

  const handleAddToCartAction = (e: React.MouseEvent | null, p: ProductItem) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    addToCart({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.images[0] || "",
      sellerName: p.seller.companyName,
      sellerId: p.sellerId,
    }, 1);

    setAddedItemName(p.name);
    setTimeout(() => setAddedItemName(null), 2000);
  };

  const handleToggleWishlistAction = async (p: ProductItem) => {
    if (!user?.id) return;
    const { toggleWishlist } = await import("@/actions/wishlist");
    const res = await toggleWishlist(user.id, p.id);
    if (res.success) {
      if (res.isWishlisted) {
        setWishlistIds([...wishlistIds, p.id]);
      } else {
        setWishlistIds(wishlistIds.filter(id => id !== p.id));
      }
    }
  };

  const handleOpenQuickView = (p: ProductItem) => {
    setSelectedProductForQuickView(p);
    setIsQuickViewOpen(true);
  };

  const handleClearAllFilters = () => {
    setSearch("");
    setCategory("all");
    setSelectedBrand("all");
    setPricePreset("all");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("newest");
    setDealsOnly(false);
    setNewArrivalsOnly(false);
  };

  // Compute active filters count
  let activeFiltersCount = 0;
  if (category !== "all") activeFiltersCount++;
  if (search.trim() !== "") activeFiltersCount++;
  if (pricePreset !== "all") activeFiltersCount++;
  if (selectedBrand !== "all") activeFiltersCount++;
  if (dealsOnly) activeFiltersCount++;
  if (newArrivalsOnly) activeFiltersCount++;

  const showStorefront = !showCatalogExplicitly && category === "all" && search === "";

  return (
    <div className="w-full min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden">
      
      {/* JSON-LD Structured Data Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Sustainable Marketplace India | Verified Eco Products | EarthCentric",
            "description": "Shop 500+ verified sustainable products from ethical Indian manufacturers. Carbon-neutral delivery.",
            "url": "https://earthcentric.com/marketplace",
            "about": {
              "@type": "Thing",
              "name": "Sustainable Products"
            }
          })
        }}
      />

      {/* Toast Notification for Cart */}
      {addedItemName && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-primary text-primary-foreground border border-primary/20 px-4 py-3 shadow-lg flex items-center space-x-2 animate-bounce">
          <ShoppingBag className="h-4 w-4" />
          <span className="text-xs font-semibold">Added "{addedItemName}" to Cart!</span>
        </div>
      )}



      {showStorefront ? (
        <div className="space-y-10 pb-16">
          {/* Hero Carousel */}
          <div className="relative h-[280px] sm:h-[360px] md:h-[440px] w-full overflow-hidden bg-slate-950">
            {/* Slide Container */}
            <div className="relative h-full w-full">
              {CAROUSEL_SLIDES.map((slide, idx) => (
                <div
                  key={idx}
                  className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                    idx === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                  }`}
                >
                  <Image
                    src={slide.image}
                    alt={slide.title}
                    fill
                    sizes="100vw"
                    priority={idx === 0}
                    className="object-cover opacity-60"
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-black/10 to-black/45" />
                  
                  {/* Banner Text Content */}
                  <div className="absolute bottom-20 sm:bottom-28 md:bottom-36 left-4 md:left-12 max-w-xl text-white space-y-2 md:space-y-3 text-left">
                    <span className="inline-block bg-emerald-600 text-[10px] md:text-xs font-bold tracking-widest uppercase px-2.5 py-1 rounded-sm shadow-md">
                      Verified Sustainable
                    </span>
                    <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight drop-shadow-md leading-tight text-white uppercase">
                      {slide.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-200 drop-shadow-sm font-medium">
                      {slide.tagline}
                    </p>
                    <div className="pt-2">
                      <Button
                        variant="cool"
                        size="sm"
                        onClick={() => {
                          setCategory(slide.category);
                          setShowCatalogExplicitly(true);
                        }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2 px-4 shadow-sm"
                      >
                        {slide.buttonText}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Slide Navigation Controls */}
            <button
              onClick={handlePrevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all focus:outline-none cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleNextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all focus:outline-none cursor-pointer"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Slide Index Indicators */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex space-x-2">
              {CAROUSEL_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-1.5 w-1.5 rounded-full transition-all ${
                    idx === currentSlide ? "bg-emerald-500 w-3" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* 2. Trust Strip — Certification Logos */}
          <div className="w-full bg-[#F7F4ED] py-6 border-b border-border/40 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex gap-4 overflow-x-auto whitespace-nowrap py-1 scrollbar-none justify-start md:justify-center">
                {CERTIFICATIONS.map((cert) => (
                  <span 
                    key={cert}
                    className="inline-block bg-white text-[#0F6E56] border border-[#0F6E56]/30 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm"
                  >
                    🌱 {cert}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Top Verified Sellers Section */}
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <TopSellersSection />
          </div>

          {/* Layered Category Cards Grid */}
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12 relative z-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {GRID_CARDS.map((card, cardIdx) => (
                <Card 
                  key={cardIdx} 
                  className="bg-card border border-border/40 p-5 rounded-2xl shadow-lg flex flex-col justify-between space-y-4 hover:shadow-xl transition-shadow duration-300"
                >
                  <div className="text-left">
                    <h3 className="font-extrabold text-sm sm:text-base text-primary tracking-tight leading-tight line-clamp-2">
                      {card.title}
                    </h3>
                    
                    {/* 2x2 Sub-items grid */}
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {card.items.map((item, itemIdx) => (
                        <Link 
                          key={itemIdx}
                          href={`/marketplace?category=${card.category}`}
                          className="flex flex-col space-y-1 group cursor-pointer"
                        >
                          <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
                            <Image 
                              src={item.image || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600"} 
                              alt={item.name} 
                              fill
                              sizes="(max-width: 768px) 25vw, 10vw"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          </div>
                          <span className="text-[10px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {item.name}
                          </span>
                          <span className="text-[9px] text-emerald-600 font-semibold">
                            {item.price}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setCategory(card.category);
                      setShowCatalogExplicitly(true);
                    }}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline pt-2 border-t border-border/10 text-left w-fit cursor-pointer"
                  >
                    {card.linkText}
                  </button>
                </Card>
              ))}
            </div>
          </div>

          {/* Horizontally Scrolling Product Shelf */}
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8 mt-12">
            {products.length > 0 && (
              <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border/20 pb-3">
                  <h3 className="text-lg font-bold text-primary flex items-center space-x-2">
                    <Flame className="h-5 w-5 text-amber-500 fill-amber-500/20" />
                    <span>Trending Sustainable Essentials</span>
                  </h3>
                  <button
                    onClick={() => {
                      setCategory("all");
                      setShowCatalogExplicitly(true);
                    }}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <span>See all products</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                
                {/* Product horizontal scroll shelf using ProductCard */}
                <div className="flex gap-6 overflow-x-auto pb-4 pt-2 scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-secondary scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
                  {products.slice(0, 8).map((p) => (
                    <div key={p.id} className="min-w-[200px] sm:min-w-[240px]">
                      <ProductCard
                        product={p}
                        onAddToCart={handleAddToCartAction}
                        onQuickView={handleOpenQuickView}
                        initialWishlisted={wishlistIds.includes(p.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Banners */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="rounded-2xl border border-border/40 bg-gradient-to-r from-emerald-950 to-primary p-6 md:p-8 text-white flex flex-col justify-between min-h-[160px] text-left">
                <div className="space-y-2 max-w-sm">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Carbon offset pledge</span>
                  <h4 className="text-lg md:text-xl font-bold">Shop Green, Breathe Green</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    We compute and offset 100% of the greenhouse gases generated by shipping. Rest assured, your purchase is completely neutral.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setCategory("all");
                    setShowCatalogExplicitly(true);
                  }}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-350 flex items-center space-x-1 mt-4 w-fit cursor-pointer"
                >
                  <span>Explore Catalog products</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="rounded-2xl border border-border/40 bg-gradient-to-r from-amber-950 to-secondary p-6 md:p-8 text-white flex flex-col justify-between min-h-[160px] text-left">
                <div className="space-y-2 max-w-sm">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Verified seller audit</span>
                  <h4 className="text-lg md:text-xl font-bold">Only Certified Makers</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    We vet every vendor before letting them sell. Legal identity, business registrations, and sustainable materials audits are strictly mandatory.
                  </p>
                </div>

              </div>
            </div>
          </div>

          {/* 6. Testimonials Section */}
          <TestimonialsSection />
        </div>
      ) : (
        <div className="w-full pb-16 space-y-8 text-left pt-8">

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            
            {/* Horizontal Sub-category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
              {[
                { id: "all", name: "All" },
                { id: "bagasse-trays", name: "Bagasse Trays" },
                { id: "delivery-containers", name: "Delivery Containers" },
                { id: "clamshells", name: "Clamshells" },
                { id: "tableware", name: "Tableware" },
                { id: "paper-products", name: "Paper Products" },
                { id: "cutlery", name: "Cutlery" },
                { id: "housekeeping", name: "Housekeeping" },
                { id: "disposable", name: "Disposable" },
              ].map((cat) => {
                const isSelected = category.toLowerCase().replace(/[^a-z0-9]+/g, "-") === cat.id || (cat.id === "all" && category === "all");
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.id === "all" ? "all" : cat.name);
                      setSearch(""); // clear search
                    }}
                    className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all border cursor-pointer shrink-0 ${
                      isSelected
                        ? "bg-[#0F6E56] border-[#0F6E56] text-white shadow-sm"
                        : "bg-white border-slate-100 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Mobile Filter Toggle */}
            <div className="lg:hidden pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="w-full flex items-center justify-center space-x-2 border-slate-200"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>{showMobileFilters ? 'Hide Filters' : 'Show Filters'}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
              </Button>
            </div>

            {/* Filters and Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start pt-2">
              
              {/* Sidebar Filters */}
              <div className={`lg:col-span-1 space-y-6 text-left ${showMobileFilters ? 'block' : 'hidden lg:block'}`}>
                <div className="rounded-3xl border border-slate-100 bg-white p-6 space-y-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-extrabold text-sm text-slate-800 flex items-center space-x-1.5">
                      <SlidersHorizontal className="h-4 w-4 text-[#0F6E56]" />
                      <span>Filters</span>
                    </h3>
                    <button
                      onClick={handleClearAllFilters}
                      className="text-xs font-bold text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
                    >
                      Clear all
                    </button>
                  </div>

                  {/* Sidebar Search */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Search Products</span>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Type keywords..."
                        className="pl-9 text-xs border-slate-200 focus:ring-[#0F6E56] rounded-xl"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Category Filter - live from DB */}
                  <div className="space-y-2.5 border-t border-slate-100 pt-4 text-left">
                    <label htmlFor="category-select" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Category</label>
                    <select
                      id="category-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:border-[#0F6E56] transition-all cursor-pointer shadow-sm"
                    >
                      <option value="all">All Products</option>
                      {navCategories.map((cat) => (
                        <option key={cat.slug} value={cat.slug}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Deals & Offers Toggle */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="space-y-0.5 pr-2 text-left">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Deals & Discounts Only
                      </span>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Only show discounted products and bulk offers.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={dealsOnly}
                      onChange={(e) => setDealsOnly(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-slate-300 text-[#0F6E56] focus:ring-[#0F6E56] cursor-pointer"
                    />
                  </div>

                  {/* New Arrivals Toggle */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="space-y-0.5 pr-2 text-left">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        New Arrivals Only
                      </span>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Only show products launched today.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={newArrivalsOnly}
                      onChange={(e) => setNewArrivalsOnly(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-slate-300 text-[#0F6E56] focus:ring-[#0F6E56] cursor-pointer"
                    />
                  </div>

                  {/* Price Range Filter */}
                  <div className="space-y-2.5 border-t border-slate-100 pt-4 text-left">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Price Range</span>
                    <div className="space-y-1.5">
                      {[
                        { id: "all", label: "All Prices" },
                        { id: "under-500", label: "Under ₹500" },
                        { id: "500-2000", label: "₹500 – ₹2,000" },
                        { id: "above-2000", label: "Above ₹2,000" },
                        { id: "custom", label: "Custom Range" },
                      ].map((preset) => (
                        <div key={preset.id}>
                          <label
                            className={`flex items-center space-x-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all text-xs font-semibold ${
                              pricePreset === preset.id
                                ? "bg-[#ebf5f0] text-[#0F6E56]"
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                              pricePreset === preset.id
                                ? "border-[#0F6E56]"
                                : "border-slate-300"
                            }`}>
                              {pricePreset === preset.id && (
                                <span className="h-2 w-2 rounded-full bg-[#0F6E56]" />
                              )}
                            </span>
                            <input
                              type="radio"
                              name="price-filter"
                              value={preset.id}
                              checked={pricePreset === preset.id}
                              onChange={() => setPricePreset(preset.id)}
                              className="sr-only"
                            />
                            <span>{preset.label}</span>
                          </label>

                          {preset.id === "custom" && pricePreset === "custom" && (
                            <div className="pt-2 pb-1 px-1 space-y-2">
                              <div className="flex items-center space-x-2">
                                <div className="flex-1">
                                  <label className="text-[10px] font-bold text-slate-500 mb-1 block">Min (₹)</label>
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={minPrice}
                                    onChange={(e) => setMinPrice(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0F6E56]"
                                    min={0}
                                  />
                                </div>
                                <span className="text-slate-400 text-xs font-bold pt-4">–</span>
                                <div className="flex-1">
                                  <label className="text-[10px] font-bold text-slate-500 mb-1 block">Max (₹)</label>
                                  <input
                                    type="number"
                                    placeholder="Max"
                                    value={maxPrice}
                                    onChange={(e) => setMaxPrice(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0F6E56]"
                                    min={0}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>


                  {/* Seller Brands Dropdown Filter */}
                  <div className="space-y-2 border-t border-slate-100 pt-4 text-left">
                    <label htmlFor="brand-select" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                      Brand / Seller Company
                    </label>
                    <select
                      id="brand-select"
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] focus:border-[#0F6E56] transition-all cursor-pointer shadow-sm"
                    >
                      <option value="all">All Brands &amp; Sellers</option>
                      {brandsList.map((brand) => (
                        <option key={brand.id || brand.companyName} value={brand.companyName}>
                          {brand.companyName}
                        </option>
                      ))}
                    </select>
                  </div>


                </div>
              </div>

              {/* Product Grid Area */}
              <div className="lg:col-span-3 space-y-6">
                
                {/* 4. Smart Filter + Sort Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 shadow-inner">
                  
                  {/* Left: Showing Products Label */}
                  <div className="text-left select-none">
                    <span className="text-xs font-bold text-slate-500">
                      Showing <span className="text-[#0F6E56] font-black">{products.length}</span> products
                    </span>
                  </div>

                  {/* Right side: Sorting & Badge Count */}
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    
                    {/* Active Filter Count Badge */}
                    {activeFiltersCount > 0 && (
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="bg-[#0F6E56] text-white text-[10px] font-black rounded-full px-2 py-0.5 shadow-sm">
                          {activeFiltersCount} Active
                        </span>
                        <button
                          onClick={handleClearAllFilters}
                          className="text-[10px] font-black uppercase text-red-500 hover:text-red-750 hover:underline cursor-pointer border-none bg-transparent"
                        >
                          Clear
                        </button>
                      </div>
                    )}

                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-slate-400 font-medium shrink-0">Sort by:</span>
                      <select
                        value={sortBy}
                        onChange={(e: any) => setSortBy(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0F6E56] text-xs font-semibold cursor-pointer text-slate-800"
                      >
                        <option value="newest">Newest Additions</option>
                        <option value="popular">Popularity</option>
                        <option value="rating">Review Count</option>
                        <option value="best-rated">Highest Rated</option>
                        <option value="price-asc">Price: Low to High</option>
                        <option value="price-desc">Price: High to Low</option>

                      </select>
                    </div>
                  </div>

                </div>

                {/* Catalog grid / Skeletons */}
                {loading ? (
                  <ProductSkeleton />
                ) : products.length === 0 ? (
                  <EmptyState onClear={handleClearAllFilters} />
                ) : (
                  <FadeInStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {products.map((p) => (
                      <FadeInStaggerItem key={p.id}>
                        <ProductCard
                          product={p}
                          onAddToCart={handleAddToCartAction}
                          onQuickView={handleOpenQuickView}
                        />
                      </FadeInStaggerItem>
                    ))}
                  </FadeInStagger>
                )}
              </div>

            </div>

          </div>

          {/* Testimonials Section */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            <TestimonialsSection />
          </div>

        </div>
      )}

      {/* 8. Quick View Modal */}
      <QuickViewModal
        product={selectedProductForQuickView}
        isOpen={isQuickViewOpen}
        onClose={() => setIsQuickViewOpen(false)}
        onAddToCart={(p) => {
          handleAddToCartAction(null, p);
          setIsQuickViewOpen(false);
        }}
        onToggleWishlist={handleToggleWishlistAction}
        isWishlisted={selectedProductForQuickView ? wishlistIds.includes(selectedProductForQuickView.id) : false}
      />
    </div>
  );
}
