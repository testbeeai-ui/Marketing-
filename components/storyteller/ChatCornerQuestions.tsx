"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalyticsChat } from "@/lib/contexts/AnalyticsChatContext";

/**
 * Corner tab on the chat panel: "Curious to learn more?" with arrow.
 * Click to expand and see follow-up questions. Chat history stays as main content.
 */
export function ChatCornerQuestions() {
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    hasConversation,
    lastIsAssistant,
    exploreMoreQuestions,
    exploreMoreLoading,
    fetchExploreMoreQuestions,
    handleExploreQuestionClick,
  } = useAnalyticsChat();

  if (!hasConversation || !lastIsAssistant) return null;

  return (
    <div className="absolute top-0 right-0 z-10 flex flex-col items-end">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((p) => !p)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded((p) => !p);
          }
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-bl-lg border-l border-b border-[#1DA1F2]/30 bg-background/95 backdrop-blur px-2.5 py-2 shadow-sm",
          "hover:bg-muted/50 cursor-pointer transition-colors",
          isExpanded && "rounded-b-none"
        )}
        aria-expanded={isExpanded}
      >
        <motion.span
          animate={{ rotate: isExpanded ? -90 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
        </motion.span>
        <span className="text-xs font-medium text-foreground">
          Questions for your analytics
        </span>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden w-72 max-w-[calc(100vw-2rem)] rounded-bl-lg border-l border-b border-[#1DA1F2]/30 bg-background shadow-lg"
          >
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Tap a question to keep going.
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchExploreMoreQuestions();
                  }}
                  disabled={exploreMoreLoading}
                  aria-label="Refresh questions"
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-[#1DA1F2] disabled:opacity-50"
                  title="Refresh with your latest screenshots"
                >
                  <RefreshCw
                    className={cn("w-3.5 h-3.5", exploreMoreLoading && "animate-spin")}
                  />
                </button>
              </div>
              {exploreMoreLoading ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded-lg bg-muted/60"
                    />
                  ))}
                </div>
              ) : exploreMoreQuestions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {exploreMoreQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleExploreQuestionClick(q)}
                      className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-left text-[13px] text-foreground transition-colors hover:border-[#1DA1F2]/40 hover:bg-[#1DA1F2]/5"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">
                  No follow-up questions. Refresh after new uploads.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
