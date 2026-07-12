"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, Calendar, Leaf, User } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui/shared";

const ARTICLES = [
  {
    id: "understanding-gots",
    title: "Understanding GOTS Certification: Why It Matters for Apparel",
    description: "The Global Organic Textile Standard (GOTS) is the worldwide leading textile processing standard for organic fibers. Here is why we enforce it for all clothing sellers.",
    content: "When you purchase an organic cotton or linen garment, you want to be sure it wasn't grown using harmful pesticides or manufactured using forced labor. The GOTS standard guarantees ecological and social criteria are met along the entire supply chain.",
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop&q=80",
    readTime: "5 min read",
    date: "June 12, 2026",
    category: "Certifications",
    author: "Elena Rostova"
  },
  {
    id: "calculating-carbon-offsets",
    title: "How We Compute & Offset 100% of Shipment Emissions",
    description: "Go behind the scenes of our cargo footprint tracking. Learn how we calculate mileage and partner with certified forestry initiatives.",
    content: "Every package sent through EarthCentric is mapped dynamically. We track transit distances and vehicle types, convert the payload weight into CO₂ equivalents, and purchase certified carbon offsets from audited global reforestation projects.",
    image: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&auto=format&fit=crop&q=80",
    readTime: "7 min read",
    date: "May 28, 2026",
    category: "Operations",
    author: "Marcus Chen"
  },
  {
    id: "zero-waste-lifestyle-guide",
    title: "The Rise of Zero-Waste Lifestyles: Replaces Single-Use Plastics",
    description: "Eliminating residential plastic waste is easier than you think. Explore our circular materials guide and learn to substitute household items.",
    content: "Transitioning to zero-waste isn't about perfection; it is about making intentional daily choices. Replacing a plastic toothbrush with FSC-certified bamboo, or choosing solid shampoo bars, diverts kilograms of plastic from landfill heaps.",
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80",
    readTime: "4 min read",
    date: "April 15, 2026",
    category: "Lifestyle",
    author: "Ananya Iyer"
  }
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[#F7F4ED] text-[#173528] py-16 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="space-y-4 border-b border-[#d0c6b8]/40 pb-8 text-left">
          <Link href="/" className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#6a7b6e] hover:text-[#173528] transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-primary">
                <BookOpen className="h-6 w-6 text-emerald-600" />
                <h1 className="text-3xl font-extrabold tracking-tight">The Eco Bulletin</h1>
              </div>
              <p className="text-sm text-muted-foreground">Curated sustainability stories, operational updates, and certification audit insights.</p>
            </div>
            <div className="flex items-center space-x-2">
              <Leaf className="h-4 w-4 text-emerald-600 animate-bounce" />
              <span className="text-xs font-semibold uppercase tracking-wider bg-emerald-600/10 text-emerald-700 px-3 py-1 rounded-full">Carbon-Neutral Blog</span>
            </div>
          </div>
        </div>

        {/* Featured Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {ARTICLES.map((article) => (
            <Card key={article.id} className="group overflow-hidden bg-card border border-border/40 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between text-left">
              <div>
                <div className="aspect-video relative overflow-hidden bg-muted/20">
                  <img
                    src={article.image || "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600"}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3">
                    <Badge variant="primary" className="bg-[#173528]/90 text-white font-extrabold uppercase py-0.5 px-2 rounded text-[8px] tracking-wider">
                      {article.category}
                    </Badge>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-center space-x-4 text-[10px] text-muted-foreground font-semibold">
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{article.date}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{article.readTime}</span>
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold tracking-tight group-hover:text-emerald-600 transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {article.description}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-0">
                <div className="border-t border-[#d0c6b8]/20 pt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-[10px] font-bold text-primary">
                    <div className="h-5 w-5 rounded-full bg-emerald-600/10 flex items-center justify-center">
                      <User className="h-3 w-3 text-emerald-600" />
                    </div>
                    <span>{article.author}</span>
                  </div>
                  
                  <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline">
                    Read Article
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
