"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  MessageData,
  MessageAttachment,
  MessageReference,
} from "@/actions/messages";
import { Button, Card, Badge } from "@/components/ui/shared";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Check,
  CheckCheck,
  ShoppingBag,
  Package,
  Tag,
  X,
  Loader2,
  Maximize2,
  ExternalLink,
  ShieldCheck,
  Building2,
  Leaf,
} from "lucide-react";

export function SellerMessagesView({ sellerId }: { sellerId: string }) {
  const { user } = useAuth();
  const adminId = "admin-1";

  // Effective seller ID candidate
  const effectiveSellerId = sellerId && sellerId.trim() !== "" ? sellerId : (user?.id || user?.email || "seller-1");

  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [selectedReference, setSelectedReference] = useState<MessageReference | null>(null);
  const [showReferencePicker, setShowReferencePicker] = useState(false);
  const [activeImageModal, setActiveImageModal] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    import("@/actions/sellers").then(({ getSellerProfile }) => {
      getSellerProfile(effectiveSellerId).then((p) => {
        if (p?.logoUrl) {
          setLogoUrl(p.logoUrl);
        }
      });
    });
  }, [effectiveSellerId]);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial Load & Fetch Messages Thread
  const fetchThread = async () => {
    try {
      const msgs = await getMessages(effectiveSellerId, adminId);
      setMessages(msgs);
      await markMessagesAsRead(effectiveSellerId, adminId);
    } catch (e) {
      console.error("Error fetching seller messages:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThread();
  }, [effectiveSellerId]);

  // 2. Real-Time 3-Second Live Polling Interval
  useEffect(() => {
    const interval = setInterval(() => {
      getMessages(effectiveSellerId, adminId).then((msgs) => {
        setMessages(msgs);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [effectiveSellerId]);

  // Auto-scroll to latest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Handle Send Message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && pendingAttachments.length === 0 && !selectedReference) return;

    setSending(true);
    try {
      const res = await sendMessage(
        effectiveSellerId,
        adminId,
        content,
        pendingAttachments,
        selectedReference
      );

      if (res.success) {
        setContent("");
        setPendingAttachments([]);
        setSelectedReference(null);
        await fetchThread();
        toast.success("Message sent to Super Admin!");
      } else {
        toast.error(res.error || "Failed to send message.");
      }
    } catch (err: any) {
      console.error("Error sending seller message:", err);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Handle Attachment Upload (Max 10MB)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the maximum upload size of 10 MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const isPdf = file.type.includes("pdf") || file.name.endsWith(".pdf");
        const newAttachment: MessageAttachment = {
          name: file.name,
          url: url,
          type: isPdf ? "pdf" : "image",
          size: file.size,
        };
        setPendingAttachments((prev) => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Helper for Date Headers
  const formatMessageDateGroup = (date: Date) => {
    const msgDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (msgDate.toDateString() === today.toDateString()) return "Today";
    if (msgDate.toDateString() === yesterday.toDateString()) return "Yesterday";
    return msgDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#2d4a36]">Support & Admin Messages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Direct two-way channel with EarthCentric Super Admin team for verification, payouts, and inquiries.
          </p>
        </div>

        <Badge className="bg-[#2d4a36] text-white px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center space-x-1.5 w-fit">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          <span>Super Admin Help Desk</span>
        </Badge>
      </div>

      {/* Main Chat Box Container */}
      <Card className="max-w-4xl mx-auto h-[600px] bg-white border border-[#e9ece6] shadow-sm rounded-3xl overflow-hidden flex flex-col">
        {/* Chat Box Header */}
        <div className="p-4 bg-gradient-to-r from-[#1a3321] to-[#2d4a36] text-white flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-amber-500 text-white font-black flex items-center justify-center text-sm shadow-inner border border-white/20">
              SA
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Super Admin Support</h3>
              <p className="text-[10px] text-emerald-200 font-semibold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online — Typical response time: Instant</span>
              </p>
            </div>
          </div>

          <span className="text-[10px] font-bold bg-white/10 text-white px-2.5 py-1 rounded-full border border-white/20">
            Encrypted Channel
          </span>
        </div>

        {/* Message Thread Area */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-400 text-xs">
              <Loader2 className="h-6 w-6 animate-spin text-[#2d4a36]" />
              <span>Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs space-y-2">
              <Building2 className="h-8 w-8 text-slate-300" />
              <p className="font-semibold text-slate-600">No message history yet.</p>
              <p>Send a message below to reach out to the Super Admin team.</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isSellerSender = msg.senderRole === "SELLER" || msg.senderId === sellerId;
              const prevMsg = messages[index - 1];
              const showDateHeader =
                !prevMsg ||
                new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

              return (
                <React.Fragment key={msg.id}>
                  {/* Date Separator */}
                  {showDateHeader && (
                    <div className="flex items-center justify-center my-3">
                      <span className="bg-slate-200 text-slate-600 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                        {formatMessageDateGroup(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`flex ${isSellerSender ? "justify-end" : "justify-start"}`}>
                    <div className="flex items-end space-x-2 max-w-[85%] md:max-w-[75%]">
                      {!isSellerSender && (
                        <div className="h-7 w-7 rounded-full bg-amber-500 text-white font-extrabold flex items-center justify-center text-[9px] mb-1 shrink-0">
                          SA
                        </div>
                      )}

                      <div
                        className={`p-3.5 rounded-2xl text-xs space-y-2 shadow-xs ${
                          isSellerSender
                            ? "bg-[#2d4a36] text-white rounded-tr-xs"
                            : "bg-white border border-slate-200 text-slate-900 rounded-tl-xs"
                        }`}
                      >
                        {/* Sender Header Label */}
                        <div className="flex items-center justify-between gap-4 text-[10px] opacity-75 pb-1 border-b border-white/10">
                          <span className="font-bold">{isSellerSender ? "You (Seller)" : "Super Admin"}</span>
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>

                        {/* Reference Attachment Card */}
                        {msg.reference && (
                          <div className={`p-2.5 rounded-xl border text-xs flex items-center space-x-3 ${
                            isSellerSender ? "bg-white/10 border-white/20 text-white" : "bg-emerald-50 border-emerald-200 text-[#2d4a36]"
                          }`}>
                            {msg.reference.type === "order" ? (
                              <ShoppingBag className="h-5 w-5 shrink-0 text-amber-400" />
                            ) : (
                              <Package className="h-5 w-5 shrink-0 text-emerald-400" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-extrabold text-[11px] truncate">{msg.reference.title}</p>
                              {msg.reference.subtitle && (
                                <p className="text-[10px] opacity-80 truncate">{msg.reference.subtitle}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Text Content */}
                        {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="space-y-2 pt-1">
                            {msg.attachments.map((att, attIdx) => (
                              <div key={attIdx} className="overflow-hidden rounded-xl border border-white/20">
                                {att.type === "image" ? (
                                  <div className="relative group cursor-pointer" onClick={() => setActiveImageModal(att.url)}>
                                    <img src={att.url} alt={att.name} className="max-h-48 rounded-lg object-cover w-full" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                      <Maximize2 className="h-5 w-5" />
                                    </div>
                                  </div>
                                ) : (
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center space-x-2 p-2 rounded-lg text-xs font-semibold ${
                                      isSellerSender ? "bg-white/20 hover:bg-white/30 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                                    }`}
                                  >
                                    <FileText className="h-4 w-4 shrink-0 text-red-400" />
                                    <span className="truncate flex-1">{att.name}</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Read Receipts */}
                        {isSellerSender && (
                          <div className="flex justify-end items-center space-x-1 text-[10px] opacity-75 pt-0.5">
                            {msg.isRead ? (
                              <span className="flex items-center text-emerald-300 font-bold">
                                <CheckCheck className="h-3 w-3 mr-0.5" /> Read
                              </span>
                            ) : (
                              <span className="flex items-center text-slate-300">
                                <Check className="h-3 w-3 mr-0.5" /> Delivered
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {isSellerSender && (
                        <div className="h-7 w-7 rounded-full border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center mb-1 shrink-0">
                          {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                          ) : (
                            <Leaf className="h-4 w-4 text-[#2d4a36]" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
                );
              })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Attachments Preview Bar */}
        {(pendingAttachments.length > 0 || selectedReference) && (
          <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs shrink-0">
            <span className="font-bold text-slate-600 text-[10px] uppercase tracking-wider">Attachments:</span>

            {selectedReference && (
              <div className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-full flex items-center space-x-1.5 font-bold text-[11px]">
                <span>Ref: {selectedReference.title}</span>
                <button onClick={() => setSelectedReference(null)} className="hover:text-red-600 border-none bg-transparent cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {pendingAttachments.map((att, idx) => (
              <div key={idx} className="bg-white border border-slate-300 px-2.5 py-1 rounded-full flex items-center space-x-1.5 font-medium text-[11px]">
                {att.type === "image" ? <ImageIcon className="h-3 w-3 text-blue-500" /> : <FileText className="h-3 w-3 text-red-500" />}
                <span className="truncate max-w-[120px]">{att.name}</span>
                <button onClick={() => setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-600 border-none bg-transparent cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Form Footer */}
        <form onSubmit={handleSend} className="p-3.5 bg-white border-t border-[#e9ece6] flex items-center space-x-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="image/*,application/pdf"
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 p-0 rounded-xl flex items-center justify-center text-slate-500 hover:text-[#2d4a36] border-slate-200 cursor-pointer"
            title="Attach Image or PDF (Max 10 MB)"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* Quick Reference Picker Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowReferencePicker(!showReferencePicker)}
            className="h-10 px-3 rounded-xl flex items-center space-x-1 text-slate-600 text-xs font-bold border-slate-200 cursor-pointer"
            title="Attach Order or Product Card"
          >
            <ShoppingBag className="h-3.5 w-3.5 text-amber-600" />
            <span className="hidden sm:inline">Reference</span>
          </Button>

          {/* Reference Dropdown Modal */}
          {showReferencePicker && (
            <div className="absolute bottom-16 left-16 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-3 space-y-2 w-72 text-xs">
              <div className="flex justify-between items-center pb-1 border-b border-slate-100 font-bold text-[#2d4a36]">
                <span>Attach Reference Card</span>
                <button onClick={() => setShowReferencePicker(false)} className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Recent Orders</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReference({
                      type: "order",
                      id: "ord-8834a",
                      title: "Order #EC-ORD-8834A",
                      subtitle: "Organic Cotton Classic Tee — ₹1,899",
                    });
                    setShowReferencePicker(false);
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-slate-50 flex items-center space-x-2 cursor-pointer border-none bg-transparent"
                >
                  <ShoppingBag className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">#EC-ORD-8834A (₹1,899)</span>
                </button>
              </div>
            </div>
          )}

          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your message to Super Admin..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2d4a36]"
            disabled={sending}
          />

          <Button
            type="submit"
            disabled={sending || (!content.trim() && pendingAttachments.length === 0 && !selectedReference)}
            className="bg-[#2d4a36] hover:bg-[#1e3425] text-white rounded-2xl px-5 h-10 flex items-center justify-center space-x-1.5 text-xs font-extrabold shrink-0 border-none cursor-pointer shadow-xs disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Send</span>
          </Button>
        </form>
      </Card>

      {/* Image Lightbox Modal */}
      {activeImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs" onClick={() => setActiveImageModal(null)}>
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl">
            <img src={activeImageModal} alt="Preview Attachment" className="w-full h-full object-contain" />
            <button
              onClick={() => setActiveImageModal(null)}
              className="absolute top-4 right-4 bg-black/60 text-white rounded-full p-2 hover:bg-black border-none cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
