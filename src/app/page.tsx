
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button, Card, Badge, LiquidButton, MetalButton } from "@/components/ui/shared";
import { FadeIn, FadeInStagger, FadeInStaggerItem, ScaleHover } from "@/components/FramerComponents";
import { ShieldCheck, Award, Leaf, ArrowRight, ArrowUpRight, RefreshCw, ChevronRight, Star, MessageSquare, ShoppingBag, MapPin, CheckCircle } from "lucide-react";
import DisplayCards from "@/components/ui/display-cards";
import ScrollGlobe from "@/components/ui/scroll-globe";
import { useCart } from "@/context/CartContext";
import { getProducts, ProductItem } from "@/actions/products";
import { getVerifiedSellers } from "@/actions/sellers";

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

const FEATURED_PRODUCTS = [
  {
    id: "prod-1",
    name: "Biodegradable Bamboo Toothbrush",
    category: "Zero-Waste Living",
    price: 149,
    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400",
    sustainabilityScore: 98,
    sellerName: "EcoStore India",
    sellerId: "seller-1",
  },
  {
    id: "prod-2",
    name: "Organic Raw Cotton Shirt",
    category: "Organic Apparel",
    price: 1299,
    image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400",
    sustainabilityScore: 92,
    sellerName: "Organic Apparel Co.",
    sellerId: "seller-2",
  },
  {
    id: "prod-3",
    name: "Solar Powered Utility Lamp",
    category: "Renewable Energy",
    price: 849,
    image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800",
    sustainabilityScore: 95,
    sellerName: "SunTech Solar",
    sellerId: "seller-3",
  },
  {
    id: "prod-4",
    name: "Recycled Waste Paper Notebook",
    category: "Eco Home Goods",
    price: 249,
    image: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400",
    sustainabilityScore: 88,
    sellerName: "KraftPaper Ltd.",
    sellerId: "seller-4",
  },
  {
    id: "prod-5",
    name: "Zero-Waste Solid Shampoo Bar",
    category: "Zero-Waste Living",
    price: 299,
    image: "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=400",
    sustainabilityScore: 96,
    sellerName: "GreenCare Essentials",
    sellerId: "seller-5",
  },
  {
    id: "prod-6",
    name: "Hemp Fiber Laptop Sleeve",
    category: "Organic Apparel",
    price: 949,
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=400",
    sustainabilityScore: 91,
    sellerName: "BioWeave Textiles",
    sellerId: "seller-6",
  },
  {
    id: "prod-7",
    name: "Upcycled Coconut Shell Bowls (Set of 2)",
    category: "Eco Home Goods",
    price: 399,
    image: "https://images.unsplash.com/photo-1533038590840-1cde6b66b706?w=400",
    sustainabilityScore: 94,
    sellerName: "EarthHome Crafts",
    sellerId: "seller-7",
  },
  {
    id: "prod-8",
    name: "Portable Solar Cooker Oven",
    category: "Renewable Energy",
    price: 4499,
    image: "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?w=400",
    sustainabilityScore: 97,
    sellerName: "EcoSolar Labs",
    sellerId: "seller-8",
  },
  {
    id: "prod-9",
    name: "Recycled Ocean Plastic Sunglasses",
    category: "Zero-Waste Living",
    price: 1899,
    image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400",
    sustainabilityScore: 78,
    sellerName: "OceanGuard Eyewear",
    sellerId: "seller-9",
  },
  {
    id: "prod-10",
    name: "Bamboo Fiber Coffee Travel Mug",
    category: "Eco Home Goods",
    price: 499,
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400",
    sustainabilityScore: 85,
    sellerName: "BambooPure Products",
    sellerId: "seller-10",
  },
  {
    id: "prod-11",
    name: "Organic Cotton Canvas Tote Bag",
    category: "Organic Apparel",
    price: 299,
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=400",
    sustainabilityScore: 68,
    sellerName: "LoomCraft Textiles",
    sellerId: "seller-11",
  },
  {
    id: "prod-12",
    name: "Solar Powered Outdoor Power Bank",
    category: "Renewable Energy",
    price: 1499,
    image: "https://images.unsplash.com/photo-1624996379697-f01d168b1a52?w=400",
    sustainabilityScore: 74,
    sellerName: "SolTech Outdoors",
    sellerId: "seller-12",
  }
];

const SELLERS = [
  {
    name: "OrganoCraft Exports",
    location: "India",
    category: "Organic Apparel & Cotton",
    score: 96,
    productCount: 142,
    image: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400",
    description: "Specializing in GOTS-certified organic raw cotton cultivation and weaving.",
  },
  {
    name: "Hanseatic Green Brands",
    location: "Germany",
    category: "Zero-Waste Packaging",
    score: 98,
    productCount: 48,
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400",
    description: "Carbon-neutral local distribution networks utilizing compostable raw materials.",
  },
  {
    name: "Pacific Eco Manufacturers",
    location: "USA",
    category: "Renewable Energy Devices",
    score: 94,
    productCount: 89,
    image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400",
    description: "High-grade solar cells and monocrystalline solar equipment manufacturing.",
  },
  {
    name: "BioWeave Textiles",
    location: "India",
    category: "Hemp & Flax Apparel",
    score: 91,
    productCount: 64,
    image: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400",
    description: "Chemical-free linen, hemp, and bamboo fiber yarn manufacturers.",
  },
  {
    name: "EarthHome Repurposers",
    location: "Germany",
    category: "Upcycled Timber Goods",
    score: 89,
    productCount: 37,
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400",
    description: "Repurposed premium architectural waste and circular interior design items.",
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
  const [addedItemName, setAddedItemName] = useState<string | null>(null);
  const [selectedWowItemId, setSelectedWowItemId] = useState<string | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(50);
  const [verifiedSellers, setVerifiedSellers] = useState<any[]>([]);
  const [homeCategories, setHomeCategories] = useState<{id: string; name: string; slug: string; productCount: number}[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then(data => setHomeCategories(data.categories || []))
      .catch(() => {});
  }, []);

  // Convert FEATURED_PRODUCTS to a compatible format for initial rendering
  const initialProducts: ProductItem[] = FEATURED_PRODUCTS.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    description: "",
    price: p.price,
    stock: 10,
    sustainabilityScore: p.sustainabilityScore,
    sustainabilityDetail: "",
    images: [p.image],
    category: p.category,
    categoryId: "",
    isApproved: true,
    sellerId: p.sellerId,
    seller: {
      id: p.sellerId,
      companyName: p.sellerName,
      badges: [],
    },
    certifications: [],
    rating: 4.8,
    reviewsCount: 12,
  }));

  const [products, setProducts] = useState<ProductItem[]>(initialProducts);

  // Dynamically map products to sustainability intelligence items
  const sustainabilityItems = products.map((prod) => {
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
      // Proportional fallback based on sustainability score
      const score = prod.sustainabilityScore || 75;
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
      score: `${prod.sustainabilityScore}/100`,
      certs,
      desc: prod.description || `Eco-friendly option sourced directly from audited partners. Featuring a high sustainability rating of ${prod.sustainabilityScore}/100.`,
      color: "text-emerald-600"
    };
  });

  const activeWowItem = sustainabilityItems.find(item => item.id === selectedWowItemId) || sustainabilityItems[0];

  // Dynamically map verifiedSellers to matching format for the scrolling globe panel
  const mappedSellers = (verifiedSellers && verifiedSellers.length > 0 ? verifiedSellers : SELLERS).map((s) => {
    const name = s.companyName || s.name || "Eco Brand";
    const logo = s.logoUrl || s.image || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400";
    const description = s.description || "Verified Sustainable Supplier committed to environmental excellence and auditing.";
    const score = s.sustainabilityScore || s.score || 90;
    
    // Fallbacks for fields that might not be in DB profile mapping:
    const location = s.location || "India";
    const category = s.category || "Eco-Friendly Products";
    const productCount = s.productCount || 12;

    return {
      name,
      location,
      category: category.toUpperCase(),
      score,
      productCount,
      image: logo,
      description,
      id: s.id || null
    };
  });

  useEffect(() => {
    async function loadData() {
      try {
        const fetchedProducts = await getProducts();
        if (fetchedProducts && fetchedProducts.length > 0) {
          setProducts(fetchedProducts);
        }
        const fetchedSellers = await getVerifiedSellers();
        if (fetchedSellers && fetchedSellers.length > 0) {
          setVerifiedSellers(fetchedSellers);
        }
      } catch (err) {
        console.error("Failed to load data from DB:", err);
      }
    }
    loadData();
  }, []);

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
                  <Link href="/marketplace" className="w-full sm:w-auto">
                    <LiquidButton size="lg" className="w-full sm:w-auto flex items-center justify-center space-x-2">
                      <span>Explore Marketplace</span>
                      <ArrowRight className="h-4 w-4" />
                    </LiquidButton>
                  </Link>
                </div>

                <div className="pt-6 border-t border-[#d0c6b8]/30 max-w-xl grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs text-muted-foreground font-semibold">
                  <div>
                    <span className="block text-lg font-black text-primary">{verifiedSellers.length > 0 ? verifiedSellers.length : '1'}</span>
                    <span>Verified Sellers</span>
                  </div>
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 md:mt-36 space-y-8">
            <div className="text-center md:text-left space-y-2 max-w-xl">
              <div className="inline-flex items-center space-x-1.5 rounded-full bg-accent/20 border border-accent/30 px-3 py-1 text-[10px] font-bold text-primary uppercase tracking-wider">
                <span>Featured Catalog Preview</span>
              </div>
              <h2 className="text-3xl font-extrabold text-primary tracking-tight">Eco Essentials</h2>
              <p className="text-sm text-muted-foreground">Handpicked items from verified manufacturers featuring lifetime carbon offsetting.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {products.slice(0, 12).map((item) => {
                const itemImage = item.images?.[0] || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400";
                const sellerName = item.seller?.companyName || "Earth Centric";
                return (
                  <div 
                    key={item.id}
                    className="group relative bg-card border border-border/40 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_12px_24px_rgba(23,53,40,0.1),0_0_15px_rgba(34,197,94,0.1)] flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-square relative overflow-hidden bg-muted/20">
                        <img 
                          src={itemImage} 
                          alt={item.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute top-2 left-2 flex flex-col gap-1.5 items-start">
                          <span className="bg-[#173528]/95 text-white text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider shadow-sm">
                            {item.category}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 space-y-1.5 text-left">
                        <p className="text-[9px] font-bold text-accent uppercase tracking-wider">{sellerName}</p>
                        <Link href={`/products/${item.id}`}>
                          <h4 className="text-xs font-bold text-primary line-clamp-2 group-hover:text-emerald-600 transition-colors cursor-pointer min-h-[32px]">{item.name}</h4>
                        </Link>
                        <p className="text-sm font-black text-primary">₹{item.price.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="px-4 pb-4 pt-0">
                      <Button 
                        onClick={() => {
                          addToCart({
                            id: item.id,
                            name: item.name,
                            price: item.price,
                            image: itemImage,
                            sustainabilityScore: item.sustainabilityScore,
                            sellerName: sellerName,
                            sellerId: item.sellerId,
                          }, 1);
                          setAddedItemName(item.name);
                          setTimeout(() => setAddedItemName(null), 2000);
                        }}
                        size="sm"
                        variant="cool"
                        className="w-full text-[9px] font-bold py-1.5 flex items-center justify-center space-x-1"
                      >
                        <ShoppingBag className="h-3 w-3" />
                        <span>Add to Cart</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
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
                      <button
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
                    Every item passes direct third-party lab documentation verification before achieving its Eco Score. Look for verified badges on the marketplace.
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
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-none py-1 px-3 text-xs font-bold rounded-full">
                        Eco Score: {activeWowItem.score}
                      </Badge>
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
            <Link href="/marketplace" className="flex items-center text-sm font-bold text-emerald-600 hover:text-emerald-700 hover:underline space-x-1 shrink-0">
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
                  href={`/marketplace?category=${cat.slug}`}
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
      id: "verified-sellers-section",
      badge: "Sellers",
      content: (
        <section id="verified-sellers" className="w-full bg-slate-50 py-16 md:py-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-12 md:mt-24 border-t border-slate-200">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div className="space-y-2">
              <Badge variant="primary">Verified Network</Badge>
              <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                Verified Sellers
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                These brands have passed our rigorous 5-step verification process ensuring absolute sustainability and zero greenwashing.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {verifiedSellers.map((seller) => (
              <Card key={seller.id} className="p-6 space-y-4 hover:shadow-lg transition-all duration-300 border-border/40 hover:-translate-y-1">
                <div className="flex items-start justify-between">
                  <img src={seller.logoUrl} alt={seller.companyName} className="h-16 w-16 rounded-full object-cover border border-border/40" />
                  <Badge variant="accent" className="text-[10px] font-bold px-2 py-0.5">
                    Score: {seller.sustainabilityScore}
                  </Badge>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-primary truncate" title={seller.companyName}>{seller.companyName}</h3>
                  <div className="flex items-center space-x-1 mt-1 text-emerald-600">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Verified Business</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                  {seller.description}
                </p>
                <div className="pt-2 border-t border-border/40">
                  <Link href={`/marketplace?seller=${seller.id}`}>
                    <Button variant="cool" size="sm" className="w-full text-xs">
                      View Seller
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
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
            <Link href="/marketplace" className="text-sm font-semibold text-primary hover:underline flex items-center space-x-1">
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
                        <Link href={`/marketplace?category=${cat.id}`}>
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
      id: "verified-sellers",
      badge: "Sellers",
      content: (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-36 space-y-12">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center space-x-1.5 rounded-full bg-accent/20 border border-accent/30 px-3 py-1 text-[10px] font-bold text-primary uppercase tracking-wider">
              <Award className="h-3 w-3 text-emerald-600 animate-pulse" />
              <span>Direct Verification Badge</span>
            </div>
            <h2 className="text-3xl font-extrabold text-primary tracking-tight sm:text-4xl">
              Verified Ethical Suppliers
            </h2>
            <p className="text-sm text-muted-foreground">
              Meet our partner manufacturers and carbon-neutral sellers who have completed our 5-stage certification audits.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pt-4">
            {mappedSellers.slice(0, 6).map((s, idx) => (
              <div 
                key={idx}
                className="glass-card bg-card border border-border/40 rounded-3xl p-6 flex flex-col justify-between space-y-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
              >
                <div className="space-y-4 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm block">🏢</span>
                      <h3 className="font-extrabold text-base text-primary tracking-tight truncate max-w-[180px]" title={s.name}>{s.name}</h3>
                    </div>
                    <Badge variant="premium" className="bg-emerald-600 text-white border-none py-0.5 px-2 text-[9px] font-bold">
                      Score: {s.score}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center space-x-1 bg-muted/40 rounded-full px-2.5 py-1 text-[10px] text-muted-foreground font-semibold">
                      <MapPin className="h-3 w-3 text-[#8B5E3C]" />
                      <span>{s.location}</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 bg-muted/40 rounded-full px-2.5 py-1 text-[10px] text-muted-foreground font-semibold">
                      <span>{s.productCount} Products</span>
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 min-h-[48px]">
                    {s.description}
                  </p>
                  
                  <div className="text-[10px] font-bold text-accent uppercase tracking-wider truncate">
                    Category: <span className="text-primary">{s.category}</span>
                  </div>
                </div>

                <div className="border-t border-[#d0c6b8]/20 pt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-1 text-[10px] text-emerald-700 font-bold">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Audit Status: Passed</span>
                  </div>
                  <Link href={s.id ? `/marketplace?seller=${s.id}` : `/marketplace?search=${encodeURIComponent(s.name)}`}>
                    <Button variant="cool" size="sm" className="text-[10px] py-1.5 px-3">
                      View Profile
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )
    },
    {
      id: "testimonials",
      badge: "Testimonials",
      content: (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-36 space-y-12">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center space-x-1.5 rounded-full bg-accent/20 border border-accent/30 px-3 py-1 text-[10px] font-bold text-primary uppercase tracking-wider">
              <MessageSquare className="h-3 w-3 text-emerald-600 animate-pulse" />
              <span>Social Proof &amp; Impact</span>
            </div>
            <h2 className="text-3xl font-extrabold text-primary tracking-tight sm:text-4xl">
              Trusted by Eco Conscious Partners
            </h2>
            <p className="text-sm text-muted-foreground">
              See how verified brands, manufacturers, and buyers are changing the world with EarthCentric.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
            {[
              {
                quote: "Finding verified suppliers who actually possess genuine GOTS and FSC certifications used to take us weeks. EarthCentric has streamlined our entire supply chain verification down to minutes.",
                author: "Elena Rostova",
                role: "Sustainability Director, Veda Goods",
                location: "Germany",
                avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120",
                impact: "Saved 4.2 Tons CO₂",
                rating: 5,
              },
              {
                quote: "The transparency is unmatched. Being able to see the exact eco audit logs and GST registrations of suppliers before placing bulk orders has completely eliminated greenwashing risks for our retail brand.",
                author: "Marcus Chen",
                role: "Founder, Loop Apparel",
                location: "USA",
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120",
                impact: "Reduced 840 kg Plastic",
                rating: 5,
              },
              {
                quote: "As a small-scale ethical manufacturer in India, getting noticed was incredibly hard. EarthCentric's verification badge gave us immediate trust and connected us with international buyers looking for organic cotton.",
                author: "Ananya Iyer",
                role: "Managing Director, EarthCraft Exports",
                location: "India",
                avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120",
                impact: "100% Upcycled Sourcing",
                rating: 5,
              }
            ].map((t, idx) => (
              <div 
                key={idx}
                className="glass-card bg-card border border-border/40 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
              >
                <div className="space-y-4">
                  {/* Rating Stars */}
                  <div className="flex items-center space-x-1">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 stroke-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm italic text-muted-foreground leading-relaxed">
                    "{t.quote}"
                  </p>
                </div>

                <div className="flex items-center space-x-4 border-t border-[#d0c6b8]/20 pt-4">
                  <img 
                    src={t.avatar} 
                    alt={t.author} 
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-600/10"
                  />
                  <div className="text-left">
                    <h4 className="text-sm font-bold text-primary leading-tight">{t.author}</h4>
                    <p className="text-[10px] text-muted-foreground">{t.role} ({t.location})</p>
                    <div className="inline-flex items-center space-x-1 mt-1 bg-emerald-600/10 rounded-full px-2 py-0.5 text-[8px] font-extrabold text-emerald-700 uppercase tracking-wide">
                      <span>{t.impact}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )
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

              {/* Visual Social Proof Element */}
              <div className="flex flex-col items-center space-y-2 mt-2">
                <div className="flex -space-x-2 overflow-hidden">
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-card object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80" alt="User" />
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-card object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80" alt="User" />
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-card object-cover" src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80" alt="User" />
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-card object-cover" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80" alt="User" />
                </div>
                <div className="flex items-center space-x-1.5 text-xs">
                  <div className="flex text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current text-amber-500" />
                    ))}
                  </div>
                  <span className="text-muted-foreground font-semibold">
                    4.9/5 stars from 2,300+ verified buyers & suppliers
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <Link href="/marketplace">
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
      <ScrollGlobe sections={sections} sellerCount={verifiedSellers.length > 0 ? verifiedSellers.length : 1} />
    </>
  );
}
