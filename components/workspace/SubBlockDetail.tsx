import { motion } from "framer-motion";
import { ArrowLeft, Briefcase, Zap, BookOpen, Plus, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformStudio } from "./PlatformStudio";
import { subBlocksApi, type SubBlock } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { StoryEngine } from "./StoryEngine";
import { renderMarkdown } from "@/lib/markdown";

interface SubBlockDetailProps {
  subBlock: SubBlock;
  blockId: string;
  linkedDocuments?: number;
  onBack: () => void;
  onGenerateNew: () => void;
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

const getPlatformEntriesForVariation = (contents: Record<string, string> | undefined, variationId?: string): [string, string][] => {
  if (!contents) return [];
  const hasAnyPrefixed = Object.keys(contents).some(key => key.includes('.'));
  if (!variationId) {
    return hasAnyPrefixed ? [] : Object.entries(contents);
  }
  const prefix = `${variationId}.`;
  const prefixed = Object.entries(contents)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, value]) => [key.slice(prefix.length), value] as [string, string]);
  if (prefixed.length > 0) return prefixed;
  if (hasAnyPrefixed) return [];
  return Object.entries(contents).filter(([key]) => !key.includes('.'));
};

export const SubBlockDetail = ({ subBlock, blockId, linkedDocuments = 0, onBack, onGenerateNew }: SubBlockDetailProps) => {
  const queryClient = useQueryClient();
  const [selectedStory, setSelectedStory] = useState<{
    id: string;
    title: string;
    content: string;
    generationMode?: "text" | "image-first";
  } | null>(null);

  const hasStories = subBlock.storyVariations && subBlock.storyVariations.length > 0;
  const selectedVariation = subBlock.storyVariations?.find(v => v.id === subBlock.selectedVariationId);
  const platformEntries = getPlatformEntriesForVariation(subBlock.platformContents, subBlock.selectedVariationId);
  const hasPlatformContents = platformEntries.length > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="h-full flex flex-col p-6 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="hover:bg-secondary"
              title="Back to sub-blocks"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold">{subBlock.name}</h2>
              <p className="text-sm text-muted-foreground">
                {subBlock.prompt || "No prompt yet"}
              </p>
            </div>
          </div>
          {!hasStories && (
            <Button
              onClick={onGenerateNew}
              className="gradient-violet hover:opacity-90 text-white border-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              Generate Stories
            </Button>
          )}
          {hasStories && (
            <Button
              variant="outline"
              onClick={onGenerateNew}
              className="hover:bg-primary/10"
            >
              <Plus className="w-4 h-4 mr-2" />
              Generate New Stories
            </Button>
          )}
        </div>

        {hasStories ? (
          <>
            {/* Story Variations */}
            <div className="mb-6 flex-1 overflow-y-auto">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Story Variations</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 auto-rows-fr">
                {subBlock.storyVariations.map((variation) => {
                  const config = storyConfig.find(c => c.id === variation.id);
                  const isSelected = variation.id === subBlock.selectedVariationId;

                  return (
                    <motion.div
                      key={variation.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`glass-panel flex flex-col overflow-hidden border-t-4 ${config?.accent || "border-border"
                        } ${isSelected ? "ring-2 ring-primary" : ""}`}
                    >
                      {/* Card Header */}
                      <div className={`p-4 ${config?.accentBg || "bg-muted/50"} border-b border-border`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {config?.icon && (
                              <config.icon className={`w-5 h-5 ${config.accentText}`} />
                            )}
                            <h4 className="font-semibold text-foreground">{variation.title || config?.title}</h4>
                          </div>
                          {isSelected && (
                            <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">
                              Selected
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="flex-1 p-4 overflow-y-auto min-h-[200px] max-h-[400px]">
                        <div
                          className="text-sm text-foreground/90 leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(variation.content) }}
                          style={{
                            wordBreak: 'break-word',
                          }}
                        />
                      </div>

                      {/* Card Footer */}
                      <div className="p-4 border-t border-border">
                        {hasPlatformContents && isSelected ? (
                          <Button
                            onClick={() => setSelectedStory({
                              id: variation.id,
                              title: variation.title || config?.title || "",
                              content: variation.content,
                            })}
                            variant="outline"
                            className="w-full"
                          >
                            View Platform Formats
                          </Button>
                        ) : isSelected ? (
                          <Button
                            onClick={() => {
                              // Defaults to text mode (undefined generationMode)
                              setSelectedStory({
                                id: variation.id,
                                title: variation.title || config?.title || "",
                                content: variation.content,
                              });
                            }}
                            className="w-full gradient-primary hover:opacity-90 text-white border-0"
                          >
                            Generate Platform Formats
                          </Button>
                        ) : (
                          <Button
                            onClick={async () => {
                              try {
                                // Save selection
                                await subBlocksApi.update(subBlock.id, {
                                  selectedVariationId: variation.id,
                                });
                                toast.success("Story variation selected");
                                // Refresh sub-block data
                                queryClient.invalidateQueries({ queryKey: ['sub-block', subBlock.id] });
                                // Open Studio immediately
                                setSelectedStory({
                                  id: variation.id,
                                  title: variation.title || config?.title || "",
                                  content: variation.content,
                                });
                              } catch (error: any) {
                                toast.error(error.message || "Failed to select variation");
                              }
                            }}
                            variant="outline"
                            className="w-full"
                          >
                            Select This Variation
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Platform Contents Preview */}
            {hasPlatformContents && selectedVariation && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Platform Formats</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {platformEntries.map(([platform, content]) => {
                    // Skip metadata keys
                    if (platform === 'imagePrompt' || platform === 'imageContext' || platform === 'image') return null;

                    // Check if this is a platform image (format: platform_image)
                    const isPlatformImage = platform.endsWith('_image');
                    const basePlatform = isPlatformImage ? platform.replace('_image', '') : platform;

                    return (
                      <motion.div
                        key={platform}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-panel p-4 border border-border hover:border-primary transition-colors cursor-pointer relative group overflow-hidden"
                        onClick={() => setSelectedStory({
                          id: selectedVariation.id,
                          title: selectedVariation.title,
                          content: selectedVariation.content,
                        })}
                      >
                        <div className="text-xs font-medium text-muted-foreground mb-2 uppercase flex items-center gap-2">
                          {isPlatformImage && <ImageIcon className="w-3 h-3" />}
                          {basePlatform}
                        </div>

                        {isPlatformImage ? (
                          <div className="aspect-square rounded-md overflow-hidden bg-secondary/50 relative">
                            <img
                              src={content}
                              alt={`${basePlatform} visual`}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>
                        ) : (
                          <div
                            className="text-sm text-foreground/80 line-clamp-3 prose prose-sm max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                            style={{
                              wordBreak: 'break-word',
                            }}
                          />
                        )}
                      </motion.div>
                    )
                  })}

                  {/* Show placeholder only if no platform images exist */}
                  {!platformEntries.some(([key]) => key.endsWith('_image')) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="glass-panel p-4 border border-dashed border-border hover:border-primary transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary h-full min-h-[140px]"
                      onClick={() => setSelectedStory({
                        id: selectedVariation.id,
                        title: selectedVariation.title,
                        content: selectedVariation.content,
                      })}
                    >
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium">Generate Images</span>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          // Show story input when no stories exist
          <div className="flex-1 overflow-hidden">
            <StoryEngine
              blockId={blockId}
              linkedDocuments={linkedDocuments}
              subBlockId={subBlock.id}
              onStoriesGenerated={() => {
                queryClient.invalidateQueries({ queryKey: ['sub-block', subBlock.id] });
                // Refresh will happen automatically
              }}
            />
          </div>
        )}
      </motion.div>

      {/* Generation Mode Dialog */}


      {/* Platform Studio Modal */}
      {selectedStory && (
        <PlatformStudio
          isOpen={!!selectedStory}
          onClose={() => setSelectedStory(null)}
          story={selectedStory}
          storyId={undefined} // We don't have a storyId for saved sub-blocks
          subBlockId={subBlock.id}
          blockId={blockId}
          generationMode={selectedStory.generationMode}
        />
      )}
    </>
  );
};
