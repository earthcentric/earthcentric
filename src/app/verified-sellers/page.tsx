import React from "react";
import Link from "next/link";
import { getVerifiedSellers } from "@/actions/sellers";
import { Award, ShieldCheck, CheckCircle, Leaf, ArrowRight, ArrowLeft } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui/shared";

export const metadata = {
  title: "Verified Sustainable Network | EarthCentric",
  description: "Browse audited, certified sustainable manufacturers vetted through EarthCentric's 5-stage verification standard.",
};

export default async function VerifiedSellersPage() {
  const sellers = await getVerifiedSellers();
  const verifiedList = Array.isArray(sellers) ? sellers : [];

  return (
    <div className="min-h-screen bg-[#faf8f5] text-slate-800 pt-8 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-muted-foreground font-semibold">
          <Link href="/" className="hover:text-emerald-700 transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            <span>Home</span>
          </Link>
          <span>/</span>
          <span className="text-primary font-bold">Verified Network</span>
        </div>

        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">
            <Award className="h-4 w-4 text-emerald-600 animate-pulse" />
            <span>5-Stage Platform Audit</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#173528] tracking-tight">
            Verified Sustainable Network
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Every participating manufacturer and supplier is audited directly by EarthCentric. We verify GSTIN registration, business credentials, and sustainable manufacturing standards to prevent greenwashing.
          </p>
        </div>

        {/* Sellers Grid */}
        {verifiedList.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-3xl p-8 space-y-4 max-w-xl mx-auto">
            <Leaf className="h-10 w-10 text-emerald-600 mx-auto" />
            <h3 className="text-base font-bold text-[#173528]">Sellers Audit in Progress</h3>
            <p className="text-xs text-slate-500">
              New sustainable manufacturers are currently completing the 5-stage EarthCentric verification audit.
            </p>
            <Link href="/marketplace">
              <Button variant="cool" size="sm" className="mt-2 text-xs">
                Browse Marketplace Products
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {verifiedList.map((seller: any, idx: number) => {
              const name = seller.companyName || seller.name || `EarthCentric Certified Supplier #${idx + 1}`;
              const logo = seller.logoUrl || seller.image;
              const badges = seller.badges || ["Direct Sustainable Marketplace"];

              return (
                <Card
                  key={seller.id || idx}
                  className="bg-white border border-slate-200/80 rounded-3xl p-6 flex flex-col justify-between space-y-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="h-16 w-16 rounded-2xl border border-slate-100 overflow-hidden bg-slate-50 flex items-center justify-center p-2">
                        {logo ? (
                          <img
                            src={logo}
                            alt={name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <Leaf className="h-8 w-8 text-emerald-700" />
                        )}
                      </div>
                      <Badge variant="accent" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold px-2 py-0.5">
                        <CheckCircle className="h-3 w-3 mr-1 text-emerald-600 inline" />
                        Verified
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-bold text-lg text-[#173528] truncate" title={name}>
                        {name}
                      </h3>
                      <div className="flex items-center space-x-1 mt-1 text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Vetted Supplier & Audited GSTIN
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-3 min-h-[48px] leading-relaxed">
                      {seller.description || "Certified sustainable supplier compliant with EarthCentric environmental and manufacturing standards."}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {badges.slice(0, 2).map((b: string, bIdx: number) => (
                        <span
                          key={bIdx}
                          className="bg-slate-100 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded-full"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-emerald-800">
                      Standard: 100% Audited
                    </span>
                    <Link href={`/marketplace?seller=${seller.id}`}>
                      <Button variant="cool" size="sm" className="text-xs py-1.5 px-3 flex items-center gap-1">
                        <span>View Catalog</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Back to Marketplace CTA */}
        <div className="text-center pt-8">
          <Link href="/marketplace">
            <Button size="lg" variant="cool" className="font-bold text-sm px-8">
              Explore All Marketplace Products
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
