import Link from "next/link";
import { Leaf, ShoppingBag, Home } from "lucide-react";
import { Button } from "@/components/ui/shared";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-[#FBFBFA]">
      <div className="max-w-lg w-full bg-white rounded-3xl border border-[#d0c6b8]/50 p-8 sm:p-10 text-center space-y-6 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100/60 text-[#0F6E56] flex items-center justify-center mx-auto">
          <Leaf className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-[#0F6E56]">404 Not Found</span>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Eco Path Not Found</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The page or product you were looking for doesn&apos;t exist, has been relocated, or is undergoing certification auditing.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/marketplace" className="w-full sm:w-auto">
            <Button variant="cool" size="sm" className="w-full">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Explore Marketplace
            </Button>
          </Link>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full">
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

