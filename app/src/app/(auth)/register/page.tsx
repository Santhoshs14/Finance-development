"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const { signUp, signInWithGoogle, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  if (!loading && user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setSubmitting(true);
    try {
      await signUp(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign-up failed");
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
          <h1 className="text-3xl font-bold brand-gradient-text">
            WealthFlow
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Create your account</p>
        </div>

        {error && (
          <div className="rounded-lg bg-danger/10 border border-danger/20 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        <Card>
          <CardContent className="p-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                <Input id="confirmPassword" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {submitting ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
            </div>

            <button onClick={handleGoogle} className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
              <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:text-brand/80">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
