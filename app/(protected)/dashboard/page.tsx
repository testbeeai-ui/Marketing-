"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Dashboard from "@/components/pages/Dashboard";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { PUBLIC_DEMO_ORGANIZATION_ID } from "@/lib/constants";

export default function DashboardPage() {
    const router = useRouter();
    const { activeOrganization, isDemoMode, loading } = useOrganization();

    const isMemberInNonDemoOrg =
      activeOrganization?.role === "member" &&
      activeOrganization?.id !== PUBLIC_DEMO_ORGANIZATION_ID;

    useEffect(() => {
        if (loading) return;
        if (isDemoMode) {
            router.replace("/workspace");
            return;
        }
        if (isMemberInNonDemoOrg) {
            router.replace("/storyteller");
        }
    }, [loading, isDemoMode, isMemberInNonDemoOrg, router]);

    if (loading || isDemoMode || isMemberInNonDemoOrg) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">{loading ? "Loading..." : "Redirecting..."}</p>
                </div>
            </div>
        );
    }

    return <Dashboard />;
}
