"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, Input, Label, Badge } from "@/components/ui/shared";
import { Leaf, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    startTransition(async () => {
      await login(email, password);
    });
  };

  return (
    <div className="flex-1 flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-accent/5 to-transparent">
      <Card className="max-w-md w-full border-border/40 p-8 space-y-6 bg-card rounded-2xl shadow-lg">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
            <Leaf className="h-6 w-6 fill-accent stroke-primary" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-primary">Welcome back</h2>
          <p className="text-xs text-muted-foreground">
            Sign in to access your dashboard and explore verified sustainable goods.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground/50" />
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label>Password</Label>
              <Link href="/auth/forgot-password" className="text-[10px] text-muted-foreground hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground/50" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10 pr-10 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4.5 w-4.5" />
                ) : (
                  <Eye className="h-4.5 w-4.5" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" variant="cool" className="w-full py-3 flex items-center justify-center space-x-1.5" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground border-t border-border/20 pt-4">
          Don't have an account?{" "}
          <Link href="/auth/signup" className="font-bold text-primary hover:underline">
            Register for free
          </Link>
        </div>
      </Card>
    </div>
  );
}
