"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MessageSquare, X, Send, Leaf, HelpCircle, ArrowRight, ShieldCheck, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface QA {
  keywords: string[];
  question: string;
  answer: string;
}

const QA_DATABASE: QA[] = [
  {
    keywords: ["become", "seller", "sell", "vendor", "registration", "onboard", "join", "supplier"],
    question: "How do I become a seller on EarthCentric?",
    answer: "Our seller verification and registration process is currently undergoing a complete update to enhance vendor onboarding standards. Please check back soon or contact support for seller inquiries."
  },
  {
    keywords: ["eco", "score", "ecoscore", "sustainability", "rating", "points", "impact"],
    question: "What is the Eco Score and how is it calculated?",
    answer: "The Eco Score is a metric from 1 to 100 assigned to listings based on their carbon footprint, organic/biobased materials, zero-plastic packaging, and circularity. A score of 98 or above awards the product an 'EarthCentric Verified' badge, ensuring maximum eco-friendliness."
  },
  {
    keywords: ["shipping", "offset", "carbon", "delivery", "emissions", "neutral", "green", "transport"],
    question: "How does EarthCentric offset shipping emissions?",
    answer: "We compute the logistical emissions for every order based on shipment distance and vehicle type. 100% of these carbon emissions are offset by investing in certified reforestation and clean energy initiatives, keeping your deliveries fully carbon-neutral."
  },
  {
    keywords: ["profit", "reforestation", "tree", "plant", "revenue", "donation", "ngo"],
    question: "Where do EarthCentric's profits go?",
    answer: "We donate exactly 10% of all transaction profits to global reforestation NGOs. You can track the live count of trees planted on the homepage's global Impact Tracker panel."
  },
  {
    keywords: ["payout", "withdraw", "money", "settle", "earnings", "revenue", "commission", "bank"],
    question: "How do sellers request payouts?",
    answer: "Sellers request payouts via the 'Payments' tab in the Seller Dashboard. After the admin audits and approves the transaction records, payouts are processed directly to the seller's bank account, minus a standard 10% platform commission."
  },
  {
    keywords: ["dispute", "refund", "return", "complaint", "order", "buyer", "cancel", "refunds"],
    question: "How are refunds and customer disputes handled?",
    answer: "Buyers can file a complaint or enquiry from their order panel. Sellers can chat directly with the buyer to coordinate replacements or returns. If unresolved, the Super Admin steps in to arbitrate the dispute and issue refunds via the Admin panel."
  },
  {
    keywords: ["badge", "badges", "verified", "sustainable", "premium", "quality"],
    question: "What do the seller quality badges mean?",
    answer: "Quality badges indicate audited seller status: \n- **Verified Business**: Active legal registration verified. \n- **Verified Sustainable Manufacturer**: Eco-friendly factory practices verified. \n- **Premium Verified**: Outstanding seller rating with average 98+ Eco Scores."
  },
  {
    keywords: ["password", "reset", "change", "resetting", "forgot"],
    question: "How do I change or reset my password?",
    answer: "Go to the login screen and click 'Forgot Password'. You will receive a reset token via email. Enter the token and your new password to update it. Passwords are encrypted and securely hashed using SHA-256 in the database before storage."
  },
  {
    keywords: ["cart", "wishlist", "add", "remove", "save", "sync", "guest"],
    question: "Are my cart and wishlist saved?",
    answer: "Yes! EarthCentric automatically saves and persists your cart and wishlist to the database. If you log in from a different browser or switch accounts, your active cart and wishlist will sync automatically, merging any guest items seamlessly."
  },
  {
    keywords: ["payment", "razorpay", "upi", "card", "netbanking", "buy"],
    question: "What payment methods are accepted?",
    answer: "We support secure payments integrated with Razorpay, allowing you to pay using UPI (GPay, PhonePe, Paytm), major Credit/Debit Cards, NetBanking, and mobile wallets."
  },
  {
    keywords: ["approval", "admin", "product", "listing", "pending"],
    question: "Why is my product not showing up in the marketplace?",
    answer: "Newly created products require approval. If you are a new/unverified seller, your product goes into 'pending' and requires Super Admin approval in the Product Approval panel. Once approved, it goes live. For verified sellers (status APPROVED), new listings bypass audits and are auto-approved instantly!"
  },
  {
    keywords: ["packaging", "material", "bagasse", "bamboo", "paper", "cardboard", "plastic-free"],
    question: "What packaging materials are used?",
    answer: "We enforce strict plastic-free policies. Products and packaging are crafted from certified raw materials like sugarcane bagasse (compostable food containers), Moso bamboo (durable utensils), recycled cardboard, and organic hemp fibers."
  },
  {
    keywords: ["moq", "minimum", "order", "wholesale", "bulk", "quantity"],
    question: "What is MOQ and wholesale pricing?",
    answer: "MOQ stands for Minimum Order Quantity. For bulk/wholesale orders, sellers can specify a minimum quantity (MOQ) and a discounted wholesale price per unit, helping commercial clients and restaurants source eco-friendly goods in bulk."
  },
  {
    keywords: ["contact", "support", "email", "help", "address", "phone"],
    question: "How can I contact EarthCentric support?",
    answer: "You can reach our support team by emailing support@earthcentric.com or raising an enquiry from the product details page. Our team is available 24/7 to assist conscious buyers and verified eco-partners."
  }
];

interface Message {
  sender: "bot" | "user";
  text: string;
  timestamp: Date;
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hello! 🌿 I am Eco-Bot, your virtual EarthCentric guide. I can answer any questions about our marketplace, eco-verification, shipping offsets, or account setup. How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen]);

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    // Add user message
    const userMsg: Message = { sender: "user", text: query, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");

    // Simulate bot thinking/typing
    setTimeout(() => {
      const responseText = processQuery(query);
      const botMsg: Message = { sender: "bot", text: responseText, timestamp: new Date() };
      setMessages((prev) => [...prev, botMsg]);
    }, 600);
  };

  const processQuery = (query: string): string => {
    const cleanTokens = query
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (cleanTokens.length === 0) {
      return "I'm here to help! Could you ask a question using complete keywords like 'seller', 'eco score', 'packaging', or 'shipping'?";
    }

    // Check Greetings
    const greetings = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "yo", "hallo"];
    if (cleanTokens.some((t) => greetings.includes(t))) {
      return "Hello! 🌱 I'm Eco-Bot. How can I assist you with your EarthCentric experience today?";
    }

    // Check Thanks
    const thanks = ["thanks", "thank you", "appreciate", "helpful", "perfect", "great", "nice"];
    if (cleanTokens.some((t) => thanks.includes(t))) {
      return "You're very welcome! Let me know if you have any other questions. Let's make the planet greener together! 🌍";
    }

    // Search QA Database
    let bestQA: QA | null = null;
    let highestScore = 0;

    QA_DATABASE.forEach((qa) => {
      let score = 0;
      cleanTokens.forEach((token) => {
        if (qa.keywords.includes(token)) {
          score += 3;
        } else if (qa.keywords.some((k) => token.includes(k) || k.includes(token))) {
          score += 1.5;
        }
      });

      if (score > highestScore) {
        highestScore = score;
        bestQA = qa;
      }
    });

    if (highestScore > 1.5 && bestQA) {
      return (bestQA as QA).answer;
    }

    // Fallback response with topic guidance
    return "I couldn't find a direct match for that query. I can answer questions about:\n\n• **Seller Account**: Registration, Auditing & Approvals\n• **Eco-Ratings**: How the Eco Score is evaluated\n• **Offsets**: Carbon-neutral shipping\n• **Transactions**: Payments via Razorpay, Wishlists & Payouts\n\nTry rephrasing your question or click one of the quick suggestions below!";
  };

  const sampleQuestions = [
    "How to become a seller?",
    "What is the Eco Score?",
    "How does shipping offset work?",
    "How are disputes resolved?",
    "What packaging is accepted?"
  ];

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 font-sans max-w-[calc(100vw-32px)]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="w-[calc(100vw-32px)] sm:w-96 h-[480px] sm:h-[520px] rounded-3xl bg-white dark:bg-[#121c15] border border-slate-200 dark:border-emerald-950 shadow-2xl flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-[#0c3c26] text-white p-4 flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-3 text-left">
                <div className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                  <Leaf className="h-5 w-5 text-emerald-400 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">Eco-Bot</h4>
                  <div className="flex items-center space-x-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                    <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Always Online</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer border-none bg-transparent"
                aria-label="Close Chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-black/20 scrollbar-thin">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs text-left leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-[#0F6E56] text-white rounded-tr-none shadow-sm"
                        : "bg-white dark:bg-emerald-950/60 border border-slate-200/50 dark:border-emerald-900/40 text-slate-800 dark:text-slate-100 rounded-tl-none shadow-sm whitespace-pre-line"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions Shelf */}
            <div className="px-4 py-2 border-t border-slate-100 dark:border-emerald-950/40 bg-white dark:bg-[#121c15] overflow-x-auto whitespace-nowrap scrollbar-none flex gap-2">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-[10px] font-bold text-slate-600 dark:text-emerald-300 rounded-full border border-slate-200 dark:border-emerald-900/30 transition-all cursor-pointer inline-block shrink-0 animate-fade-in"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 border-t border-slate-200 dark:border-emerald-950/60 bg-white dark:bg-[#121c15] flex items-center space-x-2"
            >
              <input
                type="text"
                placeholder="Ask Eco-Bot anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-black/25 border border-slate-250 dark:border-emerald-900/30 rounded-full px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#0F6E56] dark:focus:ring-emerald-500 text-slate-850 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-emerald-700/60"
              />
              <button
                type="submit"
                className="h-9 w-9 bg-[#0F6E56] hover:bg-[#0c5a46] text-white rounded-full flex items-center justify-center transition-colors cursor-pointer border-none shrink-0"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Launcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full bg-[#0F6E56] hover:bg-[#0c5a46] text-white flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border-none relative group"
        aria-label="Open virtual guide"
      >
        <Leaf className="h-6 w-6 text-white group-hover:rotate-12 transition-transform duration-300" />
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 border border-white text-[9px] font-black text-white animate-bounce">
          1
        </span>
      </button>
    </div>
  );
}
