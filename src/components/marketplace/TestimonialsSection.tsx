"use client";

import React, { useEffect, useState } from "react";
import { Star, CheckCircle } from "lucide-react";
import { getVerifiedProductReviews, ProductReviewItem } from "@/actions/products";

export default function TestimonialsSection() {
  const [reviews, setReviews] = useState<ProductReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getVerifiedProductReviews(undefined, 6)
      .then((result) => {
        if (isMounted) setReviews(result);
      })
      .catch((error) => {
        console.error("Failed to load verified reviews for the landing page:", error);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="w-full py-16 md:py-24 border-t border-border/40 bg-muted/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#0F6E56] bg-[#0F6E56]/10 px-3 py-1 rounded-full">
            Buyer Voices
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-primary tracking-tight">
            Verified Customer Reviews
          </h2>
          <p className="text-sm text-muted-foreground">
            Reviews from customers whose orders were delivered.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading verified reviews...</p>
        ) : reviews.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No verified product reviews yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="bg-card border border-border/40 border-l-4 border-l-[#0F6E56] rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-md transition-all duration-300 text-left"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= review.rating
                              ? "fill-amber-400 stroke-amber-400"
                              : "stroke-muted-foreground/30"
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-foreground ml-1">{review.rating}.0</span>
                    </div>
                    <span className="inline-flex items-center space-x-1 bg-emerald-600/10 text-emerald-700 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide">
                      <CheckCircle className="h-2.5 w-2.5" />
                      <span>Verified Purchase</span>
                    </span>
                  </div>

                  <p className="text-sm italic text-muted-foreground leading-relaxed">
                    “{review.comment}”
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#d0c6b8]/20">
                  <div className="flex items-center space-x-3">
                    <div className="h-9 w-9 rounded-full bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-600/20 shrink-0">
                      {review.userName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <h4 className="text-xs font-bold text-primary leading-tight">{review.userName}</h4>
                      <p className="text-[9px] text-muted-foreground">Verified buyer</p>
                    </div>
                  </div>
                  <div className="text-right max-w-[160px] sm:max-w-none">
                    <span className="text-[8px] font-bold text-accent uppercase tracking-wider block">Purchased:</span>
                    <span className="text-[10px] font-bold text-primary truncate block max-w-[150px] sm:max-w-none">
                      {review.productName || "Product"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
