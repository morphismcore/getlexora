"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/ui/auth-provider";
import SkeletonDashboard from "./_components/skeleton-dashboard";
import LandingPage from "./_components/landing-page";

export default function DashboardPage() {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && token) {
      router.replace("/arama");
    }
  }, [loading, token, router]);

  if (loading || token) return <SkeletonDashboard />;

  return <LandingPage />;
}
