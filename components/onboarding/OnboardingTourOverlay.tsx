"use client";

import { useEffect, useState } from "react";
import { useOnboardingTour } from "@/lib/contexts/OnboardingTourContext";
import { Button } from "@/components/ui/button";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STEP_MESSAGES: Record<number, string> = {
  1: "Click here to see your content as platform formats (LinkedIn, Twitter/X, Instagram, Facebook).",
  2: "Click \"...see more\" to view the full LinkedIn post in context.",
  3: "Click **Image** to see generated images for each platform.",
  4: "", // Step 4 is a modal inside PlatformStudio, not this overlay
  5: "Send a request to your client for approval of the social media content you generated. Try it with demo data!",
};

/** When step 1 target isn't on screen (user is on Sub-Blocks list), tell them where to go. */
const STEP1_HINT = "Open a sub-block below (e.g. Generative or Marketing) and look for the \"View Platform Formats\" button on the selected story.";

export function OnboardingTourOverlay() {
  const { step, nextStep, dismiss, isActive } = useOnboardingTour();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number } | null>(null);

  // Step 4 is handled by PlatformStudio modal; overlay doesn't show for step 4
  const showOverlay = isActive && step !== 4 && step >= 1 && step <= 5 && STEP_MESSAGES[step];

  useEffect(() => {
    if (!showOverlay) {
      setTargetRect(null);
      setCardPosition(null);
      return;
    }
    const el = document.querySelector(`[data-onboarding-step="${step}"]`);
    const padding = 16;
    const cardWidth = 320;
    const cardHeight = 160;
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      let top = rect.bottom + padding;
      let left = rect.left + rect.width / 2 - cardWidth / 2;
      if (top + cardHeight > window.innerHeight) {
        top = rect.top - cardHeight - padding;
      }
      if (left < padding) left = padding;
      if (left + cardWidth > window.innerWidth - padding) left = window.innerWidth - cardWidth - padding;
      setCardPosition({ top, left });
    } else {
      setTargetRect(null);
      // Fallback: always show the card (e.g. step 1 when user is on Sub-Blocks list and target isn't on screen)
      const W = typeof window !== "undefined" ? window.innerWidth : 0;
      const H = typeof window !== "undefined" ? window.innerHeight : 0;
      if (W > 0 && H > 0) {
        setCardPosition({
          left: Math.max(padding, W - cardWidth - padding),
          top: Math.max(padding, H - cardHeight - padding - 24),
        });
      } else {
        setCardPosition(null);
      }
    }
  }, [showOverlay, step]);

  if (!showOverlay) return null;

  const message = STEP_MESSAGES[step];
  if (!message) return null;

  // Four panels around the target so the target area stays clickable
  const W = typeof window !== "undefined" ? window.innerWidth : 0;
  const H = typeof window !== "undefined" ? window.innerHeight : 0;
  const panels =
    targetRect &&
    W > 0 &&
    H > 0
      ? [
          { top: 0, left: 0, width: W, height: targetRect.top },
          { top: targetRect.top, left: 0, width: targetRect.left, height: targetRect.height },
          { top: targetRect.top, left: targetRect.right, width: W - targetRect.right, height: targetRect.height },
          { top: targetRect.bottom, left: 0, width: W, height: H - targetRect.bottom },
        ]
      : [];

  return (
    <div className="fixed inset-0 z-[100]" aria-hidden>
      {/* Dimmed area: do NOT dismiss on click — guide stays until user clicks "Skip tour" or "Got it" on step 5 */}
      {panels.length > 0 ? (
        panels.map((p, i) => (
          <div
            key={i}
            className="absolute bg-black/25 pointer-events-none"
            style={{ top: p.top, left: p.left, width: p.width, height: p.height }}
          />
        ))
      ) : (
        <div className="absolute inset-0 bg-black/25 pointer-events-none" />
      )}
      {/* Highlight ring around target */}
      {targetRect && (
        <div
          className="absolute pointer-events-none rounded-lg border-2 border-primary bg-transparent ring-2 ring-primary/30"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}
      {/* Card with message - always show when overlay is active (fallback position if target not found) */}
      {cardPosition && (
        <div
          className="absolute z-[101] w-[320px] rounded-xl bg-card border border-border shadow-xl p-4 pointer-events-auto"
          style={{ top: cardPosition.top, left: cardPosition.left }}
        >
          {step === 1 && (
            <p className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Quick guide — one time</p>
          )}
          <p className="text-sm text-foreground mb-2 whitespace-pre-line">
            {message.replace(/\*\*(.*?)\*\*/g, "$1")}
          </p>
          {step === 1 && !targetRect && (
            <p className="text-xs text-muted-foreground mb-4">{STEP1_HINT}</p>
          )}
          {!(step === 1 && !targetRect) && <div className="mb-4" />}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={dismiss} className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" />
              Skip tour
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (step === 5) dismiss();
                else nextStep();
              }}
            >
              {step === 5 ? "Got it" : "Next"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
