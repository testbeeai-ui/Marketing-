"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const STORAGE_KEY_STEP = "storyteller-onboarding-step";
const STORAGE_KEY_DISMISSED = "storyteller-onboarding-dismissed";

export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5;

interface OnboardingTourContextType {
  step: OnboardingStep;
  setStep: (s: OnboardingStep) => void;
  nextStep: () => void;
  dismiss: () => void;
  /** Restart the guide from step 1 (for demo users who want to see it again). */
  restartTour: () => void;
  isDismissed: boolean;
  /** Only true when tour is active (demo mode and not dismissed). */
  isActive: boolean;
}

const OnboardingTourContext = createContext<OnboardingTourContextType | undefined>(undefined);

function readStep(): OnboardingStep {
  if (typeof window === "undefined") return 1;
  const v = localStorage.getItem(STORAGE_KEY_STEP);
  const n = parseInt(v ?? "1", 10);
  if (n >= 0 && n <= 5) return n as OnboardingStep;
  return 1;
}

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY_DISMISSED) === "true";
}

export function OnboardingTourProvider({
  children,
  isDemoMode,
}: {
  children: ReactNode;
  isDemoMode: boolean;
}) {
  const [step, setStepState] = useState<OnboardingStep>(1);
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setStepState(readStep());
    setIsDismissed(readDismissed());
  }, []);

  const setStep = useCallback((s: OnboardingStep) => {
    setStepState(s);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_STEP, String(s));
    }
  }, []);

  const nextStep = useCallback(() => {
    setStepState((prev) => {
      const next = Math.min(5, prev + 1) as OnboardingStep;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_STEP, String(next));
      }
      return next;
    });
  }, []);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_DISMISSED, "true");
    }
  }, []);

  const restartTour = useCallback(() => {
    setIsDismissed(false);
    setStepState(1);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_DISMISSED, "false");
      localStorage.setItem(STORAGE_KEY_STEP, "1");
    }
  }, []);

  const isActive = mounted && isDemoMode && !isDismissed && step >= 1 && step <= 5;

  return (
    <OnboardingTourContext.Provider
      value={{
        step,
        setStep,
        nextStep,
        dismiss,
        restartTour,
        isDismissed,
        isActive,
      }}
    >
      {children}
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour() {
  const ctx = useContext(OnboardingTourContext);
  if (ctx === undefined) {
    return {
      step: 0 as OnboardingStep,
      setStep: () => {},
      nextStep: () => {},
      dismiss: () => {},
      restartTour: () => {},
      isDismissed: true,
      isActive: false,
    };
  }
  return ctx;
}
