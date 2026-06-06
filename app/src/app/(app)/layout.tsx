"use client";

import { useAuth } from "@/providers/AuthProvider";
import { useData } from "@/providers/DataProvider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import MainLayout from "@/components/MainLayout";
import { RouteTransition } from "@/components/ui/RouteTransition";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const { onboardingComplete } = useData();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Onboarding gate
  useEffect(() => {
    if (!loading && user && onboardingComplete === false && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [loading, user, onboardingComplete, pathname, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  // Show onboarding page without MainLayout wrapper
  if (pathname === "/onboarding") return <>{children}</>;

  return (
    <MainLayout>
      <RouteTransition>{children}</RouteTransition>
    </MainLayout>
  );
}
