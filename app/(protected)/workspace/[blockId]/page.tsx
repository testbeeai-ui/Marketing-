"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Workspace from "@/components/pages/Workspace";
import { useOrganization } from "@/lib/contexts/OrganizationContext";

export default function WorkspacePage() {
    const router = useRouter();
    const { activeOrganization, isDemoMode } = useOrganization();

    useEffect(() => {
        if (activeOrganization?.role === "member" && !isDemoMode) {
            router.replace("/storyteller");
        }
    }, [activeOrganization?.role, isDemoMode, router]);

    if (activeOrganization?.role === "member" && !isDemoMode) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Redirecting...</p>
                </div>
            </div>
        );
    }

    return <Workspace />;
}
