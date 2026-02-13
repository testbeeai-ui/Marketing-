"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Dashboard from "@/components/pages/Dashboard";
import { useOrganization } from "@/lib/contexts/OrganizationContext";

export default function DashboardPage() {
    const router = useRouter();
    const { activeOrganization, isDemoMode } = useOrganization();

    // Demo users never see the dashboard (context block selection). Send them straight to workspace.
    useEffect(() => {
        if (isDemoMode) {
            router.replace("/workspace");
            return;
        }
        if (activeOrganization?.role === "member") {
            router.replace("/storyteller");
        }
    }, [activeOrganization?.role, isDemoMode, router]);

    if (isDemoMode || (activeOrganization?.role === "member" && !isDemoMode)) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Redirecting...</p>
                </div>
            </div>
        );
    }

    return <Dashboard />;
}
