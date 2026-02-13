import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Briefcase, Zap, BookOpen, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformStudio } from "./PlatformStudio";
import { storiesApi, subBlocksApi } from "@/lib/api";
import { authService } from "@/lib/auth";
import { toast } from "sonner";
import { renderMarkdown } from "@/lib/markdown";
import { useOrganization } from "@/lib/contexts/OrganizationContext";

interface StoryResultsProps {
  prompt: string;
  stories: {
    professional: string;
    viral: string;
    storyteller: string;
  };
  storyId?: string;
  subBlockId?: string;
  blockId?: string;
  onBack: () => void;
}

const storyConfig = [
  {
    id: "professional",
    title: "The Professional",
    icon: Briefcase,
    accent: "border-primary",
    accentBg: "bg-primary/10",
    accentText: "text-primary",
  },
  {
    id: "viral",
    title: "The Viral",
    icon: Zap,
    accent: "border-pink-500",
    accentBg: "bg-pink-500/10",
    accentText: "text-pink-500",
  },
  {
    id: "storyteller",
    title: "The Storyteller",
    icon: BookOpen,
    accent: "border-accent",
    accentBg: "bg-accent/10",
    accentText: "text-accent",
  },
];

export const StoryResults = ({ prompt, stories, storyId, subBlockId, blockId, onBack }: StoryResultsProps) => {
  const { isDemoMode } = useOrganization();
  const [selectedStory, setSelectedStory] = useState<{
    id: string;
    title: string;
    content: string;
  } | null>(null);
  const [likedStories, setLikedStories] = useState<Set<string>>(new Set());
  const [dislikedStories, setDislikedStories] = useState<Set<string>>(new Set());
  const [processingFeedback, setProcessingFeedback] = useState<Set<string>>(new Set());

  const handleLike = async (variationId: string, content: string, styleType: 'professional' | 'viral' | 'storyteller') => {
    const key = `${storyId || 'temp'}-${variationId}`;
    if (processingFeedback.has(key)) return;

    setProcessingFeedback(prev => new Set(prev).add(key));
    setLikedStories(prev => new Set(prev).add(key));
    setDislikedStories(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (isDemoMode) {
      toast.success('Thanks! In a real account, this feedback improves future stories.');
      setProcessingFeedback(prev => { const n = new Set(prev); n.delete(key); return n; });
      return;
    }
    if (!authService.isAuthenticated()) {
      toast.info('Please login to provide feedback');
      setLikedStories(prev => { const n = new Set(prev); n.delete(key); return n; });
      setProcessingFeedback(prev => { const n = new Set(prev); n.delete(key); return n; });
      return;
    }

    try {
      const idToUse = storyId || variationId;
      await storiesApi.like(idToUse, content, styleType);
      toast.success('Thanks for your feedback! We\'ll use this to improve future stories.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save feedback');
      setLikedStories(prev => { const n = new Set(prev); n.delete(key); return n; });
    } finally {
      setProcessingFeedback(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const handleDislike = async (variationId: string, content: string, styleType: 'professional' | 'viral' | 'storyteller') => {
    const key = `${storyId || 'temp'}-${variationId}`;
    if (processingFeedback.has(key)) return;

    setProcessingFeedback(prev => new Set(prev).add(key));
    setDislikedStories(prev => new Set(prev).add(key));
    setLikedStories(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    if (isDemoMode) {
      toast.success('Noted. In a real account, this feedback improves future stories.');
      setProcessingFeedback(prev => { const n = new Set(prev); n.delete(key); return n; });
      return;
    }
    if (!authService.isAuthenticated()) {
      toast.info('Please login to provide feedback');
      setDislikedStories(prev => { const n = new Set(prev); n.delete(key); return n; });
      setProcessingFeedback(prev => { const n = new Set(prev); n.delete(key); return n; });
      return;
    }

    try {
      const idToUse = storyId || variationId;
      await storiesApi.dislike(idToUse, content, styleType);
      toast.success('Thanks for your feedback! We\'ll avoid this style in the future.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save feedback');
      setDislikedStories(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } finally {
      setProcessingFeedback(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="h-full flex flex-col p-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="hover:bg-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Your Stories</h2>
            </div>
            <p className="text-sm text-muted-foreground">Choose your narrative style</p>
          </div>
        </div>

        {/* Results Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-auto pb-6">
          {storyConfig.map((config, index) => {
            const content = stories[config.id as keyof typeof stories];
            return (
              <motion.div
                key={config.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
                className={`glass-panel flex flex-col overflow-hidden border-t-4 ${config.accent}`}
              >
                {/* Card Header */}
                <div className={`p-4 ${config.accentBg} border-b border-border`}>
                  <div className="flex items-center gap-3">
                    <config.icon className={`w-5 h-5 ${config.accentText}`} />
                    <h3 className="font-semibold text-foreground">{config.title}</h3>
                  </div>
                </div>

                {/* Card Content */}
                <div className="flex-1 p-5 overflow-y-auto">
                  <div 
                    className="text-sm text-foreground/90 leading-relaxed prose prose-sm max-w-none dark:prose-invert break-words"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                  />
                </div>

                {/* Card Footer */}
                <div className="p-4 border-t border-border space-y-3">
                  {/* Like/Dislike Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLike(config.id, content, config.id as 'professional' | 'viral' | 'storyteller')}
                      disabled={processingFeedback.has(`${storyId || 'temp'}-${config.id}`)}
                      className={`flex-1 ${
                        likedStories.has(`${storyId || 'temp'}-${config.id}`) 
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                          : ''
                      }`}
                    >
                      <ThumbsUp className={`w-4 h-4 mr-2 ${likedStories.has(`${storyId || 'temp'}-${config.id}`) ? 'fill-current' : ''}`} />
                      Like
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDislike(config.id, content, config.id as 'professional' | 'viral' | 'storyteller')}
                      disabled={processingFeedback.has(`${storyId || 'temp'}-${config.id}`)}
                      className={`flex-1 ${
                        dislikedStories.has(`${storyId || 'temp'}-${config.id}`) 
                          ? 'bg-destructive/10 border-destructive text-destructive' 
                          : ''
                      }`}
                    >
                      <ThumbsDown className={`w-4 h-4 mr-2 ${dislikedStories.has(`${storyId || 'temp'}-${config.id}`) ? 'fill-current' : ''}`} />
                      Dislike
                    </Button>
                  </div>
                  
                  {/* Format Button */}
                  <Button
                    onClick={async () => {
                      if (subBlockId && !isDemoMode) {
                        try {
                          await subBlocksApi.update(subBlockId, {
                            selectedVariationId: config.id,
                          });
                        } catch (error) {
                          console.error("Failed to save selected variation:", error);
                        }
                      }
                      setSelectedStory({ id: config.id, title: config.title, content });
                    }}
                    className="w-full gradient-primary hover:opacity-90 text-white border-0"
                  >
                    Format for Platform
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <PlatformStudio
        key={selectedStory ? `platform-studio-${selectedStory.id}` : "platform-studio-closed"}
        isOpen={!!selectedStory}
        onClose={() => setSelectedStory(null)}
        story={selectedStory}
        storyId={storyId}
        subBlockId={subBlockId}
        blockId={blockId}
        generationMode="image-first"
      />
    </>
  );
};
