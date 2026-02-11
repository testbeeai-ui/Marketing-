"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Sparkles,
  CloudUpload,
  ScanSearch,
  Server,
  Database,
  Check,
  FileImage,
} from "lucide-react";

interface AnalyzingOverlayProps {
  currentIndex: number;
  totalCount: number;
}

const STEPS = [
  {
    id: "upload",
    label: "Uploading",
    shortLabel: "Upload",
    description: "Sending your screenshots",
    icon: CloudUpload,
  },
  {
    id: "scan",
    label: "AI scanning",
    shortLabel: "Scan",
    description: "Reading metrics from each image",
    icon: ScanSearch,
  },
  {
    id: "server",
    label: "Sending to server",
    shortLabel: "Server",
    description: "Uploading to our servers",
    icon: Server,
  },
  {
    id: "supabase",
    label: "Syncing to Supabase",
    shortLabel: "Sync",
    description: "Saving to your secure storage",
    icon: Database,
  },
  {
    id: "insights",
    label: "Generating insights",
    shortLabel: "Insights",
    description: "AI combining past & present data",
    icon: Brain,
  },
] as const;

const STEP_DURATION_MS = 1400;
const INTRO_STEPS = 4; // show steps 0..3 then stay on 4

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AnalyzingOverlay({ currentIndex, totalCount }: AnalyzingOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const [phaseStep, setPhaseStep] = useState(0); // 0..4 pipeline intro
  const [showInsightsPhase, setShowInsightsPhase] = useState(false); // true = we're on step 5 with real progress

  // Elapsed timer
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 100);
    return () => clearInterval(id);
  }, []);

  // Auto-advance pipeline steps 0 → 3, then switch to "insights" phase (step 4)
  useEffect(() => {
    if (showInsightsPhase) return;
    const t = setTimeout(() => {
      setPhaseStep((prev) => {
        if (prev >= INTRO_STEPS - 1) {
          setShowInsightsPhase(true);
          return INTRO_STEPS;
        }
        return prev + 1;
      });
    }, STEP_DURATION_MS);
    return () => clearTimeout(t);
  }, [phaseStep, showInsightsPhase]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const activeStepIndex = showInsightsPhase ? INTRO_STEPS : phaseStep;
  const currentStep = STEPS[activeStepIndex];
  const StepIcon = currentStep?.icon ?? Brain;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 27, 75, 0.98) 45%, rgba(15, 23, 42, 0.98) 100%)",
        cursor: "wait",
        pointerEvents: "auto",
      }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      {/* Gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-1/2 -left-1/2 w-[80%] h-[80%] bg-[#7C3AED]/25 rounded-full blur-[140px]"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-1/2 -right-1/2 w-[80%] h-[80%] bg-[#1DA1F2]/20 rounded-full blur-[140px]"
        />
      </div>

      <div className="relative z-10 w-full max-w-lg mx-auto px-6 flex flex-col items-center">
        {/* Step pipeline pills */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
          {STEPS.map((step, i) => {
            const isComplete = i < activeStepIndex;
            const isActive = i === activeStepIndex;
            const Icon = step.icon;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center"
              >
                <motion.div
                  className={`
                    flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 sm:px-3 sm:py-2
                    border transition-colors duration-300
                    ${isComplete ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : ""}
                    ${isActive ? "bg-violet-500/25 border-violet-400/50 text-white shadow-lg shadow-violet-500/20" : ""}
                    ${!isComplete && !isActive ? "bg-white/5 border-white/10 text-slate-500" : ""}
                  `}
                  animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" strokeWidth={2.5} />
                  ) : (
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  <span className="hidden sm:inline text-xs font-medium">{step.shortLabel}</span>
                </motion.div>
                {i < STEPS.length - 1 && (
                  <motion.div
                    className="w-3 sm:w-6 h-0.5 mx-0.5 rounded-full bg-white/10"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isComplete ? 1 : 0.3 }}
                    transition={{ duration: 0.4 }}
                    style={{ originX: 0 }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Central hero: icon + title + description */}
        <div className="flex flex-col items-center text-center mb-8">
          <motion.div
            key={currentStep?.id ?? "insights"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="relative"
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                opacity: [0.92, 1, 0.92],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative inline-flex items-center justify-center"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-600 to-[#1DA1F2] blur-xl opacity-50" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-violet-600 to-[#1DA1F2] flex items-center justify-center shadow-2xl shadow-violet-500/30 border border-white/20">
                <StepIcon className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="absolute -top-1 -right-1"
              >
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 drop-shadow-sm" />
              </motion.div>
            </motion.div>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep?.id ?? "insights"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="mt-6"
            >
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {showInsightsPhase
                  ? "Analyzing through AI"
                  : currentStep?.label ?? "Processing"}
              </h2>
              <p className="text-sm text-slate-400 mt-1.5 max-w-xs mx-auto">
                {showInsightsPhase
                  ? "Extracting metrics and insights from your screenshots"
                  : currentStep?.description ?? "Preparing your data"}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Stats row: elapsed + screenshots */}
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-4 mb-6"
        >
          <div className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm min-w-[88px]">
            <span className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-white">
              {formatElapsed(elapsed)}
            </span>
            <p className="text-xs text-slate-500 mt-1">elapsed</p>
          </div>
          <div className="h-12 w-px bg-white/10" />
          <div className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm min-w-[88px]">
            <span className="text-2xl font-bold tabular-nums text-violet-300">
              {currentIndex} / {totalCount}
            </span>
            <p className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1">
              <FileImage className="w-3.5 h-3.5" />
              screenshots
            </p>
          </div>
        </motion.div>

        {/* Progress bar */}
        <div className="w-full max-w-xs h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 via-violet-500 to-[#1DA1F2]"
            initial={{ width: "0%" }}
            animate={{
              width:
                totalCount > 0
                  ? `${Math.min(100, (activeStepIndex / INTRO_STEPS) * 40 + (showInsightsPhase ? (currentIndex / totalCount) * 60 : 0))}%`
                  : "0%",
            }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </div>

        {/* Loading dots */}
        <div className="flex gap-2 mt-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-violet-400"
              animate={{
                opacity: [0.35, 1, 0.35],
                scale: [1, 1.25, 1],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-24 h-24 sm:w-32 sm:h-32 border-l-2 border-t-2 border-violet-500/20 rounded-tl-xl" />
      <div className="absolute bottom-0 right-0 w-24 h-24 sm:w-32 sm:h-32 border-r-2 border-b-2 border-[#1DA1F2]/20 rounded-br-xl" />
    </motion.div>
  );
}
