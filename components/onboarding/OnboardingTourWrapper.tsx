"use client";

import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { OnboardingTourProvider } from "@/lib/contexts/OnboardingTourContext";
import { OnboardingTourOverlay } from "./OnboardingTourOverlay";

export function OnboardingTourWrapper({ children }: { children: React.ReactNode }) {
  const { isDemoMode } = useOrganization();
  return (
    <OnboardingTourProvider isDemoMode={isDemoMode}>
      <OnboardingTourOverlay />
      {children}
    </OnboardingTourProvider>
  );
}
