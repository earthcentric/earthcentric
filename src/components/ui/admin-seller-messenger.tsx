"use client";

import React, { useState, useEffect } from "react";
import { getMessages, sendMessage, markMessagesAsRead, MessageData } from "@/actions/messages";
import { Button, Input } from "@/components/ui/shared";
import { Send, Activity } from "lucide-react";

export function AdminSellerMessenger({ 
  sellerId, 
  adminId 
}: { 
  sellerId: string; 
  adminId: string; 
}) {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, [sellerId, adminId]);

  const fetchMessages = async () => {
    try {
      const msgs = await getMessages(adminId, sellerId);
      setMessages(msgs);
      await markMessagesAsRead(adminId, sellerId);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      await sendMessage(adminId, sellerId, content);
      setContent("");
      fetchMessages();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-card border border-border/40 rounded-xl overflow-hidden mt-4">
      <div className="p-4 bg-muted/20 border-b border-border/40 font-bold text-sm">
        Messages with Seller
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-accent/5">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Activity className="h-5 w-5 animate-spin text-primary/50" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-muted-foreground text-xs">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isAdmin = msg.senderId === adminId;
            return (
              <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] p-3 rounded-xl text-sm ${isAdmin ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-white border border-border/40 shadow-sm rounded-tl-sm"}`}>
                  <p className="whitespace-pre-wrap leading-relaxed text-[13px]">{msg.content}</p>
                  <p className={`text-[9px] mt-1 text-right opacity-70`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="p-3 bg-white border-t border-border/40 flex items-center gap-2">
        <Input 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 text-sm bg-muted/20 border-transparent focus-visible:ring-1"
          disabled={sending}
        />
        <Button type="submit" size="sm" disabled={sending || !content.trim()} className="rounded-lg w-10 h-10 p-0 flex items-center justify-center">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
