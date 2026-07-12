import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Toaster } from "sonner";
import SmoothScroll from "@/components/SmoothScroll";
import ChatbotWidget from "@/components/ChatbotWidget";

export const metadata: Metadata = {
  title: "EarthCentric | Premium Sustainable Marketplace",
  description:
    "Connecting conscious buyers with verified sustainable businesses, manufacturers, and eco-friendly brands. Carbon-neutral shopping.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <CartProvider>
            <SmoothScroll>
              <Navbar />
              <main className="flex-1 flex flex-col">{children}</main>
              <Footer />
              <Toaster position="bottom-right" richColors />
              <ChatbotWidget />
            </SmoothScroll>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
