"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThumbsUp, ThumbsDown, Send, Loader2, Sparkles, ScanSearch, Cloud, Brain, Check, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "@/components/storyteller/ChatMarkdown";
import { useAnalyticsChat } from "@/lib/contexts/AnalyticsChatContext";
import { ChatCornerQuestions } from "@/components/storyteller/ChatCornerQuestions";

const ONBOARDING_STEPS = [
  { label: "Understanding your information", icon: ScanSearch, duration: 1800 },
  { label: "Sending to AI", icon: Cloud, duration: 1500 },
  { label: "Framing questions", icon: Brain, duration: 1600 },
  { label: "Sending back to you", icon: MessageCircle, duration: 1200 },
] as const;

interface AnalyticsChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnalyticsChatPanel({ open, onOpenChange }: AnalyticsChatPanelProps) {
  const {
    messages,
    sendMessage,
    input,
    setInput,
    loading,
    suggestedQuestions,
    loadingContext,
    submitFeedback,
    feedbackPending,
    showOnboarding,
    onboardingStep,
    onboardingProgress,
    onboardingComplete,
    showWelcomeContent,
    welcomeVisibleLength,
    welcomeText,
    platformLabel,
  } = useAnalyticsChat();

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handleSuggestedClick = useCallback(
    (q: string) => sendMessage(q),
    [sendMessage]
  );

  const title = `${platformLabel} Analytics Assistant`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col overflow-hidden border-l bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:max-w-[520px] md:max-w-[600px] lg:max-w-[700px]"
      >
        {/* Header */}
        <SheetHeader className="space-y-1 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#1DA1F2] to-[#0d8bd9] text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold tracking-tight">
                {title}
              </SheetTitle>
              <p className="text-xs text-muted-foreground">
                AI-powered analytics guidance
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-5 pr-0">
            <ChatCornerQuestions />
            {/* First-time onboarding animation */}
            {showOnboarding && (
              <div className="flex flex-col gap-4 pr-4 sm:pr-8">
                <div className="rounded-2xl border border-[#1DA1F2]/20 bg-gradient-to-b from-[#1DA1F2]/5 to-transparent dark:from-[#1DA1F2]/10 dark:to-transparent p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#1DA1F2]/80 mb-4">Preparing your assistant</p>
                  <div className="space-y-4">
                    {ONBOARDING_STEPS.map((s, idx) => {
                      const StepIcon = s.icon;
                      const isComplete = idx < (onboardingStep ?? -1);
                      const isCurrent = idx === onboardingStep;
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                            isCurrent && "bg-[#1DA1F2]/10 dark:bg-[#1DA1F2]/15",
                            isComplete && "opacity-90"
                          )}
                        >
                          <div className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            isComplete && "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                            isCurrent && "bg-[#1DA1F2]/20 text-[#1DA1F2]",
                            !isComplete && !isCurrent && "bg-muted text-muted-foreground"
                          )}>
                            {isComplete ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <StepIcon className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              "text-sm font-medium",
                              isCurrent ? "text-foreground" : isComplete ? "text-foreground/90" : "text-muted-foreground"
                            )}>
                              {s.label}
                            </p>
                            {isCurrent && (
                              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                                <motion.div
                                  className="h-full rounded-full bg-[#1DA1F2]"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${onboardingProgress}%` }}
                                  transition={{ duration: 0.15 }}
                                />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Typewriter welcome - when chat is empty and onboarding done */}
            {messages.length === 0 && !showOnboarding && (
              <div className="flex flex-col gap-2 items-start pr-4 sm:pr-8">
                <div className="max-w-[95%] sm:max-w-[92%] rounded-2xl rounded-bl-md border border-border/50 bg-muted/50 dark:bg-muted/30 px-4 py-3 shadow-sm">
                  <p className="text-[15px] leading-relaxed text-foreground">
                    {welcomeText.slice(0, welcomeVisibleLength)}
                    {welcomeVisibleLength < welcomeText.length && (
                      <span className="inline-block w-0.5 h-4 ml-0.5 align-middle bg-[#1DA1F2] animate-pulse" aria-hidden />
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Suggested questions - when chat is empty and not in onboarding */}
            {messages.length === 0 && !showOnboarding && (
              loadingContext ? (
                <div className="space-y-3">
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-10 w-full animate-pulse rounded-xl bg-muted/60"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Suggested questions
                  </p>
                  <div className="flex flex-col gap-2">
                    {suggestedQuestions.length === 0 && !loadingContext && (
                      <p className="text-sm text-muted-foreground italic">Ask about your analytics in the input below.</p>
                    )}
                    {suggestedQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleSuggestedClick(q)}
                        className="group rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left text-sm text-foreground transition-all hover:border-[#1DA1F2]/40 hover:bg-[#1DA1F2]/5 dark:hover:border-[#1DA1F2]/50"
                      >
                        <span className="block leading-relaxed">{q}</span>
                        <span className="mt-1 block text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                          Click to ask
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* Message list */}
            <ScrollArea className="min-h-0 flex-1 -mx-1 px-1">
            <div className="flex flex-col gap-6 pb-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col gap-2",
                    m.role === "user" ? "items-end pl-4 sm:pl-8" : "items-start pr-4 sm:pr-8"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 shadow-sm",
                      m.role === "user"
                        ? "max-w-[90%] sm:max-w-[85%] rounded-br-md bg-[#1DA1F2] text-white"
                        : "max-w-[95%] sm:max-w-[92%] rounded-bl-md border border-border/50 bg-muted/50 dark:bg-muted/30"
                    )}
                  >
                    {m.role === "user" ? (
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</p>
                    ) : (
                      <ChatMarkdown content={m.content} />
                    )}
                  </div>
                  {m.role === "assistant" && (
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        aria-label="Helpful"
                        onClick={() => submitFeedback(m.id, "liked")}
                        disabled={feedbackPending.has(m.id)}
                        className={cn(
                          "rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-emerald-500",
                          m.feedback === "liked" && "text-emerald-500"
                        )}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Not helpful"
                        onClick={() => submitFeedback(m.id, "disliked")}
                        disabled={feedbackPending.has(m.id)}
                        className={cn(
                          "rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-red-400",
                          m.feedback === "disliked" && "text-red-400"
                        )}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-start gap-3 pr-4 sm:pr-8">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/50">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-2 w-48 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

            {/* Input area */}
            <div className="shrink-0 border-t pt-4">
            <div className="flex gap-2 rounded-xl border border-input bg-muted/30 p-2 focus-within:border-[#1DA1F2]/50 focus-within:ring-1 focus-within:ring-[#1DA1F2]/20 transition-colors">
              <Textarea
                placeholder="Ask about your Twitter analytics..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={2}
                className="min-h-[52px] max-h-32 resize-none border-0 bg-transparent px-3 py-2.5 text-[15px] shadow-none focus-visible:ring-0"
                disabled={loading}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="h-10 w-10 shrink-0 self-end rounded-lg bg-[#1DA1F2] hover:bg-[#1a8cd8]"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
