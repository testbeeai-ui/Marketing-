"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { OrganizationProvider } from "@/lib/contexts/OrganizationContext";
import { Navbar } from "@/components/layout/Navbar";
import { OnboardingTourWrapper } from "@/components/onboarding/OnboardingTourWrapper";

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    router.replace("/auth");
                    return;
                }

                setIsAuthorized(true);
            } catch (error) {
                console.error("Auth check error:", error);
                router.replace("/auth");
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                router.replace("/auth");
            } else {
                setIsAuthorized(true);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return null;
    }

    return (
        <OrganizationProvider>
            <OnboardingTourWrapper>
                <div className="min-h-screen bg-background">
                    <Navbar />
                    <main className="pt-16">
                        {children}
                    </main>
                </div>
            </OnboardingTourWrapper>
        </OrganizationProvider>
    );
}
