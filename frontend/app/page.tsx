"use client";

import { useAuth } from "@/components/ui/auth-provider";
import SkeletonDashboard from "./_components/skeleton-dashboard";
import LandingPage from "./_components/landing-page";
import AuthenticatedDashboard from "./_components/authenticated-dashboard";

export default function DashboardPage() {
  const { token, loading } = useAuth();

  if (loading) return <SkeletonDashboard />;

  if (!token) return <LandingPage />;

  return <AuthenticatedDashboard />;
}
