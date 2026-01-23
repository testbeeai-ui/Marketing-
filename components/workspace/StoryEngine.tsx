import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, FileCheck, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StoryResults } from "./StoryResults";
import { SubBlockDetail } from "./SubBlockDetail";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { subBlocksApi } from "@/lib/api";

interface StoryEngineProps {
  blockId: string;
  linkedDocuments: number;
  subBlockId?: string;
  onStoriesGenerated?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

const loadingMessages = [
  "Scanning Vector DB...",
  "Retrieving Chunks...",
  "Generating Drafts...",
];

export const StoryEngine = ({ blockId, linkedDocuments, subBlockId, onStoriesGenerated, onBack, showBackButton = false }: StoryEngineProps) => {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [currentStoryId, setCurrentStoryId] = useState<string | undefined>(undefined);
  const [stories, setStories] = useState<{
    professional: string;
    viral: string;
    storyteller: string;
  } | null>(null);
  const [currentSubBlockId, setCurrentSubBlockId] = useState<string | undefined>(subBlockId);
  const [viewMode, setViewMode] = useState<"input" | "results" | "detail">("input");

  // Fetch sub-block data if subBlockId is provided
  const { data: currentSubBlock } = useQuery({
    queryKey: ['sub-block', currentSubBlockId],
    queryFn: () => currentSubBlockId ? subBlocksApi.getById(currentSubBlockId) : null,
    enabled: !!currentSubBlockId,
  });

  // Update view mode when subBlockId changes
  useEffect(() => {
    setCurrentSubBlockId(subBlockId);
    if (subBlockId) {
      // Check if sub-block has stories
      // We'll fetch it and check
    } else {
      setViewMode("input");
      setShowResults(false);
    }
  }, [subBlockId]);

  // Check sub-block content when it loads
  useEffect(() => {
    if (currentSubBlock) {
      if (currentSubBlock.storyVariations && currentSubBlock.storyVariations.length > 0) {
        setViewMode("detail");
      } else {
        setViewMode("input");
        if (currentSubBlock.prompt) {
          setPrompt(currentSubBlock.prompt);
        }
      }
    }
  }, [currentSubBlock]);

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingIndex((prev) => {
          if (prev >= loadingMessages.length - 1) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setLoadingIndex(0);
    setShowResults(false);

    try {
      const { storiesApi, subBlocksApi } = await import("@/lib/api");
      
      // If no sub-block is selected, create one automatically
      let targetSubBlockId = currentSubBlockId;
      if (!targetSubBlockId) {
        // Create a new sub-block with the prompt as the name (truncated)
        const subBlockName = prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt;
        const newSubBlock = await subBlocksApi.create(blockId, subBlockName, prompt);
        targetSubBlockId = newSubBlock.id;
        setCurrentSubBlockId(targetSubBlockId);
        // Invalidate sub-blocks list to refresh tabs
        queryClient.invalidateQueries({ queryKey: ['sub-blocks', blockId] });
      }
      
      const response = await storiesApi.generate(prompt, blockId, targetSubBlockId);
      setStories(response.stories);
      setCurrentStoryId(response.storyId);
      setIsLoading(false);
      setShowResults(true);
      
      // Refresh sub-block to show the new stories
      if (targetSubBlockId) {
        queryClient.invalidateQueries({ queryKey: ['sub-block', targetSubBlockId] });
        queryClient.invalidateQueries({ queryKey: ['sub-blocks', blockId] });
        // Notify parent that stories were generated
        if (onStoriesGenerated) {
          setTimeout(() => {
            onStoriesGenerated();
          }, 1000);
        }
      }
    } catch (error: any) {
      console.error('Error generating stories:', error);
      setIsLoading(false);
      // Show error stories
      setStories({
        professional: `Error: ${error.message || 'Failed to generate stories. Please check your API keys and try again.'}`,
        viral: `Error: ${error.message || 'Failed to generate stories. Please check your API keys and try again.'}`,
        storyteller: `Error: ${error.message || 'Failed to generate stories. Please check your API keys and try again.'}`,
      });
      setShowResults(true);
    }
  };

  const handleBack = () => {
    setShowResults(false);
    setPrompt("");
  };

  // Show sub-block detail view if we have a sub-block with stories
  if (viewMode === "detail" && currentSubBlock) {
    return (
      <SubBlockDetail
        subBlock={currentSubBlock}
        blockId={blockId}
        onBack={() => setViewMode("input")}
        onGenerateNew={() => {
          setViewMode("input");
          setPrompt(currentSubBlock.prompt || "");
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <AnimatePresence mode="wait">
        {showResults && stories ? (
          <StoryResults 
            key="results" 
            prompt={prompt} 
            stories={stories} 
            storyId={currentStoryId}
            subBlockId={currentSubBlockId}
            blockId={blockId}
            onBack={handleBack} 
          />
        ) : (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8"
          >
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 mx-auto rounded-full gradient-violet flex items-center justify-center glow-violet"
                >
                  <Loader2 className="w-8 h-8 text-white" />
                </motion.div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={loadingIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-lg font-medium text-foreground"
                  >
                    {loadingMessages[loadingIndex]}
                  </motion.p>
                </AnimatePresence>
                <div className="flex justify-center gap-2">
                  {loadingMessages.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        i <= loadingIndex ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="w-full max-w-2xl space-y-6">
                {/* Back Button (if in sub-block context) */}
                {showBackButton && onBack && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex justify-start mb-4"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onBack}
                      className="hover:bg-secondary"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Sub-Blocks
                    </Button>
                  </motion.div>
                )}

                {/* Context Pill */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border-primary/30">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium text-foreground">
                      Active Context:{" "}
                      <span className="text-primary">{linkedDocuments} Documents Linked</span>
                    </span>
                    <FileCheck className="w-4 h-4 text-status-ready" />
                  </div>
                </motion.div>

                {/* Input Area */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="What story are we telling today?"
                    className="min-h-[180px] text-lg bg-card/50 border-border focus:border-primary resize-none p-6"
                  />
                </motion.div>

                {/* Generate Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex justify-center"
                >
                  <Button
                    onClick={handleGenerate}
                    disabled={!prompt.trim()}
                    className="h-14 px-10 text-lg font-semibold gradient-violet hover:opacity-90 text-white border-0 glow-violet disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Stories
                  </Button>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
