"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalyticsChatOptional } from "@/lib/contexts/AnalyticsChatContext";

interface CuriousToLearnMoreCollapsibleProps {
  onOpenChat?: () => void;
  className?: string;
}

export function CuriousToLearnMoreCollapsible({
  onOpenChat,
  className,
}: CuriousToLearnMoreCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const ctx = useAnalyticsChatOptional();

  if (!ctx || !ctx.hasConversation || !ctx.lastIsAssistant) return null;

  const {
    exploreMoreQuestions,
    exploreMoreLoading,
    fetchExploreMoreQuestions,
    handleExploreQuestionClick,
  } = ctx;

  const handleQuestionClick = (q: string) => {
    handleExploreQuestionClick(q);
    onOpenChat?.();
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20 overflow-hidden",
        className
      )}
    >
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
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 shrink-0 text-[#1DA1F2]" />
          <span className="text-sm font-medium text-foreground">
            Curious to learn more?
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fetchExploreMoreQuestions();
            }}
            disabled={exploreMoreLoading}
            aria-label="Refresh questions"
            className="rounded p-1.5 text-muted-foreground hover:bg-violet-200/50 hover:text-[#1DA1F2] disabled:opacity-50"
            title="Refresh with your latest screenshots"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5", exploreMoreLoading && "animate-spin")}
            />
          </button>
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-muted-foreground shrink-0"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2">
              <p className="text-xs text-muted-foreground">
                Tap a question to keep going. Refresh after new uploads.
              </p>
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
                      onClick={() => handleQuestionClick(q)}
                      className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5 text-left text-[13px] text-foreground transition-colors hover:border-[#1DA1F2]/40 hover:bg-[#1DA1F2]/5"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
