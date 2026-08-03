"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  getAllConversationsForAdmin,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  MessageData,
  AdminConversationSummary,
  MessageAttachment,
  MessageReference,
} from "@/actions/messages";
import { Button, Card, Badge, Input } from "@/components/ui/shared";
import {
  Search,
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Check,
  CheckCheck,
  User,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
  Clock,
  Filter,
  ExternalLink,
  Package,
  ShoppingBag,
  AlertCircle,
  Tag,
  X,
  Loader2,
  ChevronRight,
  Maximize2,
  Leaf,
} from "lucide-react";

export function AdminMessagesView({
  onViewSellerProfile,
}: {
  onViewSellerProfile?: (sellerId: string) => void;
}) {
  const adminId = "admin-1";

  // Conversations State
  const [conversations, setConversations] = useState<AdminConversationSummary[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<AdminConversationSummary | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "unread" | "read" | "today">("all");

  // Input & Attachments
  const [inputContent, setInputContent] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [selectedReference, setSelectedReference] = useState<MessageReference | null>(null);
  const [showReferencePicker, setShowReferencePicker] = useState(false);

  // Media Lightbox
  const [activeImageModal, setActiveImageModal] = useState<string | null>(null);

  // Scroll ref
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial Load of Admin Conversations
  const fetchConversations = async (keepSelection = true) => {
    try {
      const list = await getAllConversationsForAdmin();
      setConversations(list);
      
      if (!keepSelection || !selectedSeller) {
        if (list.length > 0 && !selectedSeller) {
          setSelectedSeller(list[0]);
        }
      }
    } catch (e) {
      console.error("Error fetching conversations:", e);
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    fetchConversations(false);
  }, []);

  // 2. Load Messages for Selected Seller Conversation
  const fetchSelectedThread = async () => {
    if (!selectedSeller) return;
    try {
      const msgs = await getMessages(adminId, selectedSeller.sellerUserId);
      setMessages(msgs);
      await markMessagesAsRead(adminId, selectedSeller.sellerUserId);
      
      // Update local unread counter
      setConversations((prev) =>
        prev.map((c) =>
          c.sellerUserId === selectedSeller.sellerUserId ? { ...c, unreadCount: 0 } : c
        )
      );
    } catch (e) {
      console.error("Error fetching thread messages:", e);
    }
  };

  useEffect(() => {
    if (selectedSeller) {
      setLoadingMessages(true);
      fetchSelectedThread().then(() => setLoadingMessages(false));
    }
  }, [selectedSeller?.sellerUserId]);

  // 3. Real-Time 3-Second Live Polling Interval
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(true);
      if (selectedSeller) {
        getMessages(adminId, selectedSeller.sellerUserId).then((msgs) => {
          setMessages(msgs);
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedSeller?.sellerUserId]);

  // Auto-scroll to latest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Filtered Conversations List
  const filteredConversations = useMemo(() => {
    let list = [...conversations];

    // Search by Name, Company, Email, Phone
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.sellerName.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
      );
    }

    // Status Filter
    if (filterStatus === "unread") {
      list = list.filter((c) => c.unreadCount > 0);
    } else if (filterStatus === "read") {
      list = list.filter((c) => c.unreadCount === 0);
    } else if (filterStatus === "today") {
      const todayStr = new Date().toDateString();
      list = list.filter((c) => new Date(c.lastMessageTime).toDateString() === todayStr);
    }

    return list;
  }, [conversations, searchQuery, filterStatus]);

  // Handle Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() && pendingAttachments.length === 0 && !selectedReference) return;
    if (!selectedSeller) return;

    setSending(true);
    try {
      const res = await sendMessage(
        adminId,
        selectedSeller.sellerUserId,
        inputContent,
        pendingAttachments,
        selectedReference
      );

      if (res.success) {
        setInputContent("");
        setPendingAttachments([]);
        setSelectedReference(null);
        await fetchSelectedThread();
        await fetchConversations(true);
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  // Handle File Upload Attachment (Image / PDF, Max 10MB)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the maximum upload limit of 10 MB.`);
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

  // Helper for Date Grouping
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
    <div className="h-[calc(100vh-100px)] flex bg-white border border-[#e9ece6] rounded-3xl shadow-sm overflow-hidden animate-in fade-in duration-200">
      {/* --------------------------------------------------------------------------
          LEFT PANEL: CONVERSATIONS LIST
          -------------------------------------------------------------------------- */}
      <div className="w-full md:w-80 lg:w-96 border-r border-[#e9ece6] flex flex-col bg-[#fcfdfe]">
        {/* Header & Search */}
        <div className="p-4 border-b border-[#e9ece6] space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#1a3321]">Seller Messages</h2>
            <span className="text-[10px] font-bold bg-[#e8f3ec] text-[#2d4a36] px-2.5 py-0.5 rounded-full">
              {conversations.length} Active
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Seller Name, Store, Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-7 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2d4a36]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 border-none bg-transparent cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar pt-1">
            {[
              { id: "all", label: "All" },
              { id: "unread", label: "Unread" },
              { id: "read", label: "Read" },
              { id: "today", label: "Today" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterStatus(f.id as any)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold border cursor-pointer transition-all ${
                  filterStatus === f.id
                    ? "bg-[#1a3321] text-white border-[#1a3321]"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loadingConversations ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-400 text-xs">
              <Loader2 className="h-5 w-5 animate-spin text-[#1a3321]" />
              <span>Loading seller conversations...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-600">No conversations found</p>
              <p className="text-[11px]">No seller messages match your search filter.</p>
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = selectedSeller?.sellerUserId === c.sellerUserId;
              return (
                <div
                  key={c.sellerId}
                  onClick={() => setSelectedSeller(c)}
                  className={`p-3.5 cursor-pointer transition-all flex items-start space-x-3 text-left ${
                    isSelected
                      ? "bg-[#e8f3ec]/70 border-l-4 border-[#1a3321]"
                      : "hover:bg-slate-50 border-l-4 border-transparent"
                  }`}
                >
                  {/* Seller Avatar */}
                  <div className="relative shrink-0">
                    <div className="h-11 w-11 rounded-full border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center relative">
                      {c.avatarUrl && !c.avatarUrl.includes("unsplash") ? (
                        <img
                          src={c.avatarUrl}
                          alt={c.companyName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Leaf className="h-6 w-6 text-[#2d4a36]" />
                      )}
                    </div>
                    {c.isOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{c.sellerName}</h4>
                      <span className="text-[9px] text-slate-400 font-medium">
                        {new Date(c.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <p className="text-[10px] font-bold text-[#0F6E56] truncate mb-1">{c.companyName}</p>

                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-slate-500 truncate max-w-[170px] leading-snug">
                        {c.lastMessage}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ml-1">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* --------------------------------------------------------------------------
          RIGHT PANEL: CHAT CONVERSATION THREAD
          -------------------------------------------------------------------------- */}
      {selectedSeller ? (
        <div className="flex-1 flex flex-col bg-white h-full min-w-0">
          {/* Conversation Header */}
          <div className="p-4 border-b border-[#e9ece6] bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center space-x-3.5">
              <div className="h-12 w-12 rounded-full border-2 border-[#1a3321] overflow-hidden bg-white flex items-center justify-center shrink-0">
                {selectedSeller.avatarUrl && !selectedSeller.avatarUrl.includes("unsplash") ? (
                  <img
                    src={selectedSeller.avatarUrl}
                    alt={selectedSeller.companyName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Leaf className="h-6 w-6 text-[#2d4a36]" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-extrabold text-slate-900">{selectedSeller.sellerName}</h3>
                  <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] px-2 py-0.2 rounded-full font-bold">
                    {selectedSeller.companyName}
                  </Badge>
                  {selectedSeller.verificationStatus === "APPROVED" && (
                    <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                      ✓ Verified Seller
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-0.5">
                  <span className="flex items-center space-x-1">
                    <Mail className="h-3 w-3 text-slate-400" />
                    <span>{selectedSeller.email}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Phone className="h-3 w-3 text-[#0F6E56]" />
                    <span className="font-bold text-[#0F6E56]">{selectedSeller.phone}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Shortcut Button: View Seller Profile */}
            {onViewSellerProfile && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewSellerProfile(selectedSeller.sellerId)}
                className="text-xs font-bold text-[#1a3321] border-[#c3decb] hover:bg-[#e8f3ec] rounded-xl flex items-center space-x-1.5"
              >
                <User className="h-3.5 w-3.5" />
                <span>View Seller Profile</span>
                <ExternalLink className="h-3 w-3 ml-0.5" />
              </Button>
            )}
          </div>

          {/* Messages Thread Container */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-slate-50/30">
            {loadingMessages ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-[#1a3321]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs space-y-2">
                <Building2 className="h-8 w-8 text-slate-300" />
                <p className="font-semibold text-slate-600">No messages in this conversation yet.</p>
                <p>Start the conversation by typing a message below.</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isAdmin = msg.senderRole === "ADMIN" || msg.senderId === adminId;
                const prevMsg = messages[index - 1];
                const showDateHeader =
                  !prevMsg ||
                  new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

                return (
                  <React.Fragment key={msg.id}>
                    {/* Date Separator */}
                    {showDateHeader && (
                      <div className="flex items-center justify-center my-3">
                        <span className="bg-slate-200/80 text-slate-600 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs">
                          {formatMessageDateGroup(msg.createdAt)}
                        </span>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div className={`flex ${isAdmin ? "justify-end" : "justify-start"} group`}>
                      <div className="flex items-end space-x-2 max-w-[80%] md:max-w-[70%]">
                        {!isAdmin && (
                          <div className="h-7 w-7 rounded-full border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 mb-1">
                            {selectedSeller.avatarUrl && !selectedSeller.avatarUrl.includes("unsplash") ? (
                              <img
                                src={selectedSeller.avatarUrl}
                                alt={selectedSeller.companyName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Leaf className="h-4 w-4 text-[#2d4a36]" />
                            )}
                          </div>
                        )}
                        <div
                          className={`p-3.5 rounded-2xl text-xs space-y-2 shadow-xs transition-all ${
                            isAdmin
                              ? "bg-[#1a3321] text-white rounded-tr-xs"
                              : "bg-white border border-slate-200/80 text-slate-900 rounded-tl-xs"
                          }`}
                        >
                          {/* Sender Label */}
                          <div className="flex items-center justify-between gap-4 text-[10px] opacity-75 pb-1 border-b border-white/10">
                            <span className="font-bold">{isAdmin ? "Super Admin" : selectedSeller.sellerName}</span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>

                          {/* Reference Attachment Card */}
                          {msg.reference && (
                            <div className={`p-2.5 rounded-xl border text-xs flex items-center space-x-3 ${
                              isAdmin ? "bg-white/10 border-white/20 text-white" : "bg-emerald-50 border-emerald-200 text-[#1a3321]"
                            }`}>
                              {msg.reference.type === "order" ? (
                                <ShoppingBag className="h-5 w-5 shrink-0 text-amber-400" />
                              ) : msg.reference.type === "product" ? (
                                <Package className="h-5 w-5 shrink-0 text-emerald-400" />
                              ) : (
                                <Tag className="h-5 w-5 shrink-0 text-blue-400" />
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
                                        isAdmin ? "bg-white/20 hover:bg-white/30 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-800"
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

                          {/* Read Receipts for Admin */}
                          {isAdmin && (
                            <div className="flex justify-end items-center space-x-1 text-[10px] opacity-75">
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
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Pending Attachments Preview Bar */}
          {(pendingAttachments.length > 0 || selectedReference) && (
            <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs">
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

          {/* Message Input Footer Form */}
          <form onSubmit={handleSendMessage} className="p-3.5 bg-white border-t border-[#e9ece6] flex items-center space-x-2 shrink-0">
            {/* File Attachment Input Button */}
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
              className="h-10 w-10 p-0 rounded-xl flex items-center justify-center text-slate-500 hover:text-[#1a3321] border-slate-200 cursor-pointer"
              title="Attach Image or PDF (Max 10 MB)"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {/* Quick Reference Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowReferencePicker(!showReferencePicker)}
              className="h-10 px-3 rounded-xl flex items-center space-x-1 text-slate-600 text-xs font-bold border-slate-200 cursor-pointer"
              title="Attach Reference Card"
            >
              <ShoppingBag className="h-3.5 w-3.5 text-amber-600" />
              <span className="hidden sm:inline">Reference</span>
            </Button>

            {/* Reference Picker Dropdown */}
            {showReferencePicker && (
              <div className="absolute bottom-16 left-16 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-3 space-y-2 w-72 text-xs">
                <div className="flex justify-between items-center pb-1 border-b border-slate-100 font-bold text-[#1a3321]">
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

                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Products</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReference({
                        type: "product",
                        id: "p1",
                        title: "Organic Cotton Classic Tee",
                        subtitle: "SKU: PROD-8834 — ₹1,899",
                      });
                      setShowReferencePicker(false);
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-50 flex items-center space-x-2 cursor-pointer border-none bg-transparent"
                  >
                    <Package className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">Organic Cotton Tee</span>
                  </button>
                </div>
              </div>
            )}

            {/* Input Text Box */}
            <input
              type="text"
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              placeholder={`Type a message to ${selectedSeller.sellerName}...`}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a3321]"
              disabled={sending}
            />

            {/* Send Button */}
            <Button
              type="submit"
              disabled={sending || (!inputContent.trim() && pendingAttachments.length === 0 && !selectedReference)}
              className="bg-[#1a3321] hover:bg-[#122417] text-white rounded-2xl px-5 h-10 flex items-center justify-center space-x-1.5 text-xs font-extrabold shrink-0 border-none cursor-pointer shadow-xs disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs bg-slate-50/20">
          Select a seller conversation from the left panel to start messaging.
        </div>
      )}

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
