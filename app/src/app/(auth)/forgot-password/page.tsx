"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reset email";
      if (msg.includes("user-not-found")) {
        setError("No account found with this email");
      } else if (msg.includes("invalid-email")) {
        setError("Please enter a valid email address");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl brand-gradient shadow-lg premium-glow flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 512 512" fill="none">
              <path d="M128 160 L192 352 L256 220 L320 352 L384 160" stroke="white" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="256" cy="380" r="20" fill="#f59e0b" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {sent ? "Check your inbox" : "Enter your email to receive a reset link"}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        <Card>
          <CardContent className="p-6 space-y-4">
            {sent ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-success/10 mx-auto flex items-center justify-center">
                  <Mail className="w-6 h-6 text-success" />
                </div>
                <p className="text-sm text-foreground">
                  We&apos;ve sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Didn&apos;t receive it? Check your spam folder or try again.
                </p>
                <Button variant="outline" onClick={() => setSent(false)} className="w-full">
                  Try another email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {submitting ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="inline-flex items-center gap-1 font-medium text-brand hover:text-brand/80">
            <ArrowLeft className="w-3 h-3" /> Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
