"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  feedback?: "liked" | "disliked" | null;
}

interface AnalyticsChatContextValue {
  messages: Message[];
  sendMessage: (text: string) => void;
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  suggestedQuestions: string[];
  loadingContext: boolean;
  exploreMoreQuestions: string[];
  exploreMoreLoading: boolean;
  fetchExploreMoreQuestions: () => void;
  refreshSuggestedQuestions: () => void;
  handleExploreQuestionClick: (q: string) => void;
  submitFeedback: (messageId: string, feedback: "liked" | "disliked") => void;
  feedbackPending: Set<string>;
  conversationId: string | null;
  hasConversation: boolean;
  lastIsAssistant: boolean;
  showOnboarding: boolean;
  onboardingStep: number | null;
  onboardingProgress: number;
  onboardingComplete: boolean;
  showWelcomeContent: boolean;
  welcomeVisibleLength: number;
  welcomeText: string;
  platform: string;
  platformLabel: string;
  demoMode: boolean;
}

const AnalyticsChatContext = createContext<AnalyticsChatContextValue | null>(null);

const ONBOARDING_STEPS = [
  { label: "Understanding your information", icon: "ScanSearch", duration: 1800 },
  { label: "Sending to AI", icon: "Cloud", duration: 1500 },
  { label: "Framing questions", icon: "Brain", duration: 1600 },
  { label: "Sending back to you", icon: "MessageCircle", duration: 1200 },
] as const;

export function AnalyticsChatProvider({
  children,
  platform = "x",
  demoMode = false,
  panelOpen = false,
  screenshotsUploadedTrigger = 0,
}: {
  children: ReactNode;
  platform?: string;
  demoMode?: boolean;
  panelOpen?: boolean;
  screenshotsUploadedTrigger?: number;
}) {
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [feedbackPending, setFeedbackPending] = useState<Set<string>>(new Set());
  const [exploreMoreQuestions, setExploreMoreQuestions] = useState<string[]>([]);
  const [exploreMoreLoading, setExploreMoreLoading] = useState(false);
  const [welcomeVisibleLength, setWelcomeVisibleLength] = useState(0);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [onboardingProgress, setOnboardingProgress] = useState(0);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const platformLabel = platform === "x" ? "Twitter" : platform.charAt(0).toUpperCase() + platform.slice(1);
  const welcomeText = `Hello I am ${platformLabel} deep analysis bot.`;
  const hasConversation = messages.length > 0;
  const lastIsAssistant = hasConversation && messages[messages.length - 1].role === "assistant";

  const fetchContext = useCallback(async () => {
    setLoadingContext(true);
    try {
      const params = new URLSearchParams({ platform, demo: String(demoMode) });
      const res = await fetch(`/api/analytics-chat/context?${params}`);
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data?.suggestedQuestions) ? data.suggestedQuestions : [];
      setSuggestedQuestions(list);
    } catch {
      setSuggestedQuestions([]);
    } finally {
      setLoadingContext(false);
    }
  }, [platform, demoMode]);

  const refreshSuggestedQuestions = useCallback(() => {
    fetchContext();
  }, [fetchContext]);

  const fetchHistory = useCallback(async () => {
    if (demoMode) return;
    try {
      const params = new URLSearchParams({ platform, demo: String(demoMode) });
      const res = await fetch(`/api/analytics-chat?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.conversationId) setConversationId(data.conversationId);
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: { id: string; role: string; content: string; feedback?: string | null }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              feedback: m.feedback ?? null,
            }))
          );
        }
      }
    } catch {
      /* ignore */
    }
  }, [platform, demoMode]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setInput("");
      const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await fetch("/api/analytics-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationId: conversationId ?? undefined,
            platform,
            demo: demoMode,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to send");
        }
        const data = await res.json();
        setConversationId(data.conversationId ?? conversationId);
        const assistantMsg: Message = {
          id: data.messageId ?? `assistant-${Date.now()}`,
          role: "assistant",
          content: data.reply ?? "",
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const assistantMsg: Message = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Sorry, something went wrong: ${err instanceof Error ? err.message : "Please try again."}`,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } finally {
        setLoading(false);
      }
    },
    [loading, conversationId, platform, demoMode]
  );

  const fetchExploreMoreQuestions = useCallback(async () => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastAssistant) return;

    setExploreMoreLoading(true);
    setExploreMoreQuestions([]);
    try {
      const res = await fetch("/api/analytics-chat/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastUserMessage: lastUser?.content ?? "",
          lastAssistantMessage: lastAssistant.content,
          platform,
          demo: demoMode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setExploreMoreQuestions(data.questions ?? []);
      }
    } catch {
      setExploreMoreQuestions([
        "Can you break that down further?",
        "What specific steps should I take next?",
      ]);
    } finally {
      setExploreMoreLoading(false);
    }
  }, [messages, platform, demoMode]);

  const handleExploreQuestionClick = useCallback(
    (q: string) => {
      sendMessage(q);
    },
    [sendMessage]
  );

  const submitFeedback = useCallback(
    async (messageId: string, feedback: "liked" | "disliked") => {
      if (feedbackPending.has(messageId)) return;
      setFeedbackPending((prev) => new Set(prev).add(messageId));
      try {
        const params = new URLSearchParams({ feedback, messageId, platform });
        await fetch(`/api/analytics-chat?${params}`, { method: "POST" });
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, feedback } : m))
        );
      } catch {
        /* ignore */
      } finally {
        setFeedbackPending((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      }
    },
    [platform, feedbackPending]
  );

  useEffect(() => {
    if (panelOpen && !demoMode) {
      fetchHistory();
    }
  }, [panelOpen, demoMode, fetchHistory]);

  useEffect(() => {
    if (messages.length > 0) return;
    fetchContext();
  }, [messages.length, fetchContext]);

  useEffect(() => {
    if (hasConversation && lastIsAssistant) {
      fetchExploreMoreQuestions();
    }
  }, [hasConversation, lastIsAssistant, fetchExploreMoreQuestions]);

  useEffect(() => {
    if (screenshotsUploadedTrigger > 0) {
      fetchContext();
      fetchExploreMoreQuestions();
    }
  }, [screenshotsUploadedTrigger, fetchContext, fetchExploreMoreQuestions]);

  const showOnboarding = panelOpen && messages.length === 0 && onboardingStep !== null;
  const showWelcomeContent = panelOpen && messages.length === 0 && onboardingComplete;

  useEffect(() => {
    if (!panelOpen || messages.length > 0) {
      setOnboardingStep(null);
      setOnboardingProgress(0);
      setOnboardingComplete(false);
      return;
    }
    setOnboardingStep(0);
    setOnboardingProgress(0);
    setOnboardingComplete(false);
  }, [panelOpen, messages.length]);

  useEffect(() => {
    if (!showOnboarding || onboardingStep === null) return;
    const step = ONBOARDING_STEPS[onboardingStep];
    if (!step) {
      setOnboardingStep(null);
      return;
    }
    const duration = step.duration;
    const start = Date.now();
    const tick = 50;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setOnboardingProgress(Math.min(100, (elapsed / duration) * 100));
      if (elapsed >= duration) {
        clearInterval(interval);
        const isLastStep = onboardingStep >= ONBOARDING_STEPS.length - 1;
        if (isLastStep) {
          setOnboardingStep(null);
          setOnboardingComplete(true);
        } else {
          setOnboardingStep((prev) => (prev === null ? null : prev + 1));
        }
        setOnboardingProgress(0);
      }
    }, tick);
    return () => clearInterval(interval);
  }, [showOnboarding, onboardingStep]);

  useEffect(() => {
    if (!showWelcomeContent) {
      setWelcomeVisibleLength(0);
      return;
    }
    setWelcomeVisibleLength(0);
    const fullLen = welcomeText.length;
    const interval = setInterval(() => {
      setWelcomeVisibleLength((prev) => {
        if (prev >= fullLen) {
          clearInterval(interval);
          return fullLen;
        }
        return prev + 1;
      });
    }, 55);
    return () => clearInterval(interval);
  }, [showWelcomeContent, welcomeText]);

  const value: AnalyticsChatContextValue = {
    messages,
    sendMessage,
    loading,
    input,
    setInput,
    suggestedQuestions,
    loadingContext,
    exploreMoreQuestions,
    exploreMoreLoading,
    fetchExploreMoreQuestions,
    refreshSuggestedQuestions,
    handleExploreQuestionClick,
    submitFeedback,
    feedbackPending,
    conversationId,
    hasConversation,
    lastIsAssistant,
    showOnboarding,
    onboardingStep,
    onboardingProgress,
    onboardingComplete,
    showWelcomeContent,
    welcomeVisibleLength,
    welcomeText,
    platform,
    platformLabel,
    demoMode,
  };

  return (
    <AnalyticsChatContext.Provider value={value}>
      {children}
    </AnalyticsChatContext.Provider>
  );
}

export function useAnalyticsChat() {
  const ctx = useContext(AnalyticsChatContext);
  if (!ctx) throw new Error("useAnalyticsChat must be used within AnalyticsChatProvider");
  return ctx;
}

export function useAnalyticsChatOptional() {
  return useContext(AnalyticsChatContext);
}
