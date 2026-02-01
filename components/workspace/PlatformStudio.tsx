import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Linkedin, Twitter, Instagram, Facebook, Copy, Check, Loader2, RefreshCw, ThumbsUp, ThumbsDown, Image as ImageIcon, Download, ArrowRight, MessageSquare, Repeat2, Heart, Share, AlertCircle, Bookmark, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { contentApi, subBlocksApi, imagesApi } from "@/lib/api";
import { authService } from "@/lib/auth";
import { toast } from "sonner";
import { renderMarkdown, getPlainText } from "@/lib/markdown";
import { saveImage, getImageUrl, urlToBlob, getImagesForStory } from "@/lib/storage";
import { LogoEditor, LogoPosition, LogoInstance } from "./LogoEditor";
export type GenerationMode = "text" | "image-first";

interface PlatformStudioProps {
  isOpen: boolean;
  onClose: () => void;
  story: {
    id: string; // This is the variation ID (e.g., 'professional')
    title: string;
    content: string;
  } | null;
  storyId?: string; // This is the main story ID from the cache
  subBlockId?: string;
  blockId?: string;
  generationMode?: GenerationMode;
}

const platforms = [
  { id: "linkedin", name: "LinkedIn", icon: Linkedin, maxChars: 3000 },
  { id: "twitter", name: "Twitter/X", icon: Twitter, maxChars: 25000 },
  { id: "instagram", name: "Instagram", icon: Instagram, maxChars: 2200 },
  { id: "facebook", name: "Facebook", icon: Facebook, maxChars: 63206 },
];

const imagePlatforms: string[] = ['linkedin', 'twitter', 'instagram', 'facebook'];

const getPlatformEntriesForVariation = (contents: Record<string, string>, variationId?: string): [string, string][] => {
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

const prefixPlatformContents = (contents: Record<string, string>, variationId?: string): Record<string, string> => {
  if (!variationId) return contents;
  const prefix = `${variationId}.`;
  return Object.fromEntries(Object.entries(contents).map(([key, value]) => [`${prefix}${key}`, value]));
};

// Platform image specifications with recommended dimensions and aspect ratios
const platformImageSpecs: Record<string, { width: number; height: number; label: string; ratio: string; color: string }> = {
  linkedin: { width: 1200, height: 627, label: "1200×627", ratio: "1.91:1", color: "#0A66C2" },
  twitter: { width: 1600, height: 900, label: "1600×900", ratio: "16:9", color: "#1DA1F2" },
  instagram: { width: 1080, height: 1080, label: "1080×1080", ratio: "1:1", color: "#E1306C" },
  facebook: { width: 1200, height: 630, label: "1200×630", ratio: "1.91:1", color: "#1877F2" }
};

export const PlatformStudio = ({ isOpen, onClose, story, storyId, subBlockId, blockId, generationMode }: PlatformStudioProps) => {
  const [viewMode, setViewMode] = useState<'text' | 'image'>('text'); // Toggle between text and image views
  const [activePlatform, setActivePlatform] = useState("linkedin");
  const [selectedImagePlatform, setSelectedImagePlatform] = useState<string>("linkedin");
  const [copied, setCopied] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPlatforms, setLoadingPlatforms] = useState<Set<string>>(new Set());
  const [likedCaptions, setLikedCaptions] = useState<Set<string>>(new Set());
  const [dislikedCaptions, setDislikedCaptions] = useState<Set<string>>(new Set());
  const [processingFeedback, setProcessingFeedback] = useState<Set<string>>(new Set());
  const [twitterExpanded, setTwitterExpanded] = useState(false); // For Twitter Pro long-form
  const [linkedinExpanded, setLinkedinExpanded] = useState(false); // For LinkedIn 210-char truncate
  const [instagramExpanded, setInstagramExpanded] = useState(false); // For Instagram 125-char truncate

  // Image Prompt & Modal State
  const [promptExpanded, setPromptExpanded] = useState(false); // For collapsible image prompts
  const [imageModalOpen, setImageModalOpen] = useState(false); // For fullscreen image modal
  const [zoomedPlatform, setZoomedPlatform] = useState<string | null>(null); // Which platform's image is zoomed

  // Image Generation State
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<{ url: string; prompt: string; enhancedPrompt: string } | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Image-First Mode State
  const [platformImages, setPlatformImages] = useState<Record<string, { enhancedPrompt: string; imageUrl?: string; imageId?: string }>>({});
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [imageFirstPhase, setImageFirstPhase] = useState<"text" | "prompts" | "images">("text"); // "text" -> "prompts" -> "images"
  const [currentGeneratingPlatform, setCurrentGeneratingPlatform] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<Record<string, 'pending' | 'generating' | 'success' | 'error'>>({});
  // Per-platform image prompts (editable by user)
  const [platformImagePrompts, setPlatformImagePrompts] = useState<Record<string, string>>({});
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});

  const { toast: toastHook } = useToast();

  const isImageFirstMode = generationMode === "image-first";

  // Track the last loaded variation to prevent unnecessary regeneration
  const [lastLoadedVariationId, setLastLoadedVariationId] = useState<string | null>(null);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);

  // Modify Caption State
  const [showModifyDialog, setShowModifyDialog] = useState(false);
  const [modifyInstructions, setModifyInstructions] = useState("");
  const [isModifying, setIsModifying] = useState(false);

  // Modify Image State
  const [showModifyImageDialog, setShowModifyImageDialog] = useState(false);
  const [modifyImageInstructions, setModifyImageInstructions] = useState("");
  const [isModifyingImage, setIsModifyingImage] = useState(false);
  const [uploadedLogo, setUploadedLogo] = useState<{ base64: string; mimeType: string } | null>(null);
  const [showLogoEditor, setShowLogoEditor] = useState(false);
  const [editingImage, setEditingImage] = useState<{ url: string; platform: string; prompt: string } | null>(null);

  // Load cached content from sub-block (only if it matches current variation)
  const loadCachedContent = async () => {
    if (!subBlockId) return null;

    try {
      const subBlock = await subBlocksApi.getById(subBlockId);
      const platformContents = subBlock.platformContents || {};
      const entries = getPlatformEntriesForVariation(platformContents, story?.id);
      const hasPrefixedForCurrent = !!(story?.id && Object.keys(platformContents).some(key => key.startsWith(`${story.id}.`)));
      const hasAnyPrefixed = Object.keys(platformContents).some(key => key.includes('.'));
      const hasLegacy = Object.keys(platformContents).some(key => !key.includes('.'));

      if (hasAnyPrefixed && !hasPrefixedForCurrent) {
        return null;
      }

      if (!hasPrefixedForCurrent && hasLegacy && story?.id && subBlock.selectedVariationId !== story.id) {
        console.log(`[PlatformStudio] Cache mismatch: cached variation "${subBlock.selectedVariationId}" != current "${story.id}". Regenerating.`);
        return null;
      }

      if (entries.length > 0) {
        const textContent: Record<string, string> = {};
        const cachedImages: Record<string, { enhancedPrompt: string; imageUrl?: string }> = {};
        const cachedPrompts: Record<string, string> = {};

        entries.forEach(([key, value]) => {
          // Check for platform images (e.g., linkedin_image, twitter_image)
          if (key.endsWith('_image')) {
            const platform = key.replace('_image', '');
            if (imagePlatforms.includes(platform) && value) {
              cachedImages[platform] = {
                enhancedPrompt: '',
                imageUrl: value
              };
              console.log(`[PlatformStudio] Loaded cached image for ${platform}`);
            }
          }
          // Check for platform image prompts (e.g., linkedin_imagePrompt)
          else if (key.endsWith('_imagePrompt')) {
            const platform = key.replace('_imagePrompt', '');
            if (imagePlatforms.includes(platform) && value) {
              cachedPrompts[platform] = value;
              // Update the enhancedPrompt if we already have an image
              if (cachedImages[platform]) {
                cachedImages[platform].enhancedPrompt = value;
              }
            }
          }
          // Regular text content (not image-related)
          else if (!key.endsWith('_image') && key !== 'imageContext' && key !== 'image' && key !== 'imagePrompt') {
            textContent[key] = value;
          }
        });

        // Load cached images into state
        if (Object.keys(cachedImages).length > 0) {
          setPlatformImages(cachedImages);
          console.log(`[PlatformStudio] Loaded ${Object.keys(cachedImages).length} cached platform images`);
        }

        // Load cached prompts into state
        if (Object.keys(cachedPrompts).length > 0) {
          setPlatformImagePrompts(cachedPrompts);
          console.log(`[PlatformStudio] Loaded ${Object.keys(cachedPrompts).length} cached image prompts`);
        }

        if (Object.keys(textContent).length > 0) {
          setGeneratedContent(textContent);
        }

        // Return all loaded data so caller can make decisions
        return {
          textContent: Object.keys(textContent).length > 0 ? textContent : null,
          cachedImages: Object.keys(cachedImages).length > 0 ? cachedImages : null,
          cachedPrompts: Object.keys(cachedPrompts).length > 0 ? cachedPrompts : null,
        };
      }
    } catch (error) {
      console.error("Failed to load cached content:", error);
    }
    return null;
  };

  useEffect(() => {
    if (isOpen && story) {
      // Check if this is the same variation we already loaded
      const variationKey = `${storyId}-${story.id}`;

      if (lastLoadedVariationId === variationKey && Object.keys(generatedContent).length > 0) {
        // Same variation and we have content - don't regenerate
        return;
      }

      // NEW VARIATION - Clear all previous state
      setGeneratedContent({});
      setPlatformImagePrompts({}); // Clear old image prompts
      setPlatformImages({}); // Clear old images
      setGenerationProgress({});
      setLastLoadedVariationId(variationKey);
      setHasLoadedCache(false);

      // Try to load cached content for THIS variation first
      // Try to load cached content for THIS variation first
      const initializeContent = async () => {
        const cachedData = await loadCachedContent();
        setHasLoadedCache(true);

        if (isImageFirstMode) {
          if (cachedData) {
            // We have cached data! Check what we loaded
            const hasCachedImages = !!cachedData.cachedImages;
            const hasCachedPrompts = !!cachedData.cachedPrompts;
            const hasTextContent = !!cachedData.textContent;

            if (hasCachedImages) {
              // We have cached images - go directly to images phase
              console.log('[PlatformStudio] Found cached images, showing directly');
              setImageFirstPhase("images");
            } else if (hasCachedPrompts) {
              // We have cached prompts but no images - go to prompts phase  
              console.log('[PlatformStudio] Found cached prompts, showing prompts');
              setImageFirstPhase("prompts");
            } else if (hasTextContent) {
              // No cached prompts - generate from text content
              console.log('[PlatformStudio] No cached prompts, generating from text');
              setImageFirstPhase("prompts");

              // Populate prompts from cached text content
              const platformStyles: Record<string, string> = {
                linkedin: "Professional, clean, corporate style with business elements",
                twitter: "Bold, eye-catching, high contrast with quick visual impact",
                instagram: "Vibrant, visually stunning, aesthetic with rich colors",
                facebook: "Engaging, shareable, warm and community-focused",
              };

              const prompts: Record<string, string> = {};
              imagePlatforms.forEach(platform => {
                const text = cachedData.textContent?.[platform];
                if (text && text.length > 20 && !text.toLowerCase().includes("failed")) {
                  const style = platformStyles[platform] || "";
                  const contentSummary = text.substring(0, 150).replace(/\n/g, ' ').trim();
                  prompts[platform] = `${style}. Illustrating: ${contentSummary}`;
                } else {
                  // Fallback
                  const style = platformStyles[platform] || "";
                  prompts[platform] = `${style}. Create an image for: ${story.title}`;
                }
              });

              if (Object.keys(prompts).length > 0) {
                setPlatformImagePrompts(prompts);
              }
            } else {
              // No cache at all -> Start Step 1: Text Generation
              setImageFirstPhase("text");
              generateContent();
            }
          } else {
            // No cache -> Start Step 1: Text Generation
            setImageFirstPhase("text");
            generateContent();
          }
        } else {
          // TEXT ONLY MODE: Generate text content
          if (!cachedData?.textContent) {
            generateContent();
          }
          setImagePrompt(`A professional illustration for a story about: ${story.title}`);
        }
      };

      initializeContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, storyId, story?.id]);

  // Sync generated text to image prompts
  useEffect(() => {
    if (isOpen && viewMode === 'image') {
      const newPrompts = { ...platformImagePrompts };
      let hasChanges = false;

      platforms.forEach(p => {
        const platformId = p.id;
        // If we have text content but no image prompt, generate one
        if (!newPrompts[platformId] && generatedContent[platformId]) {
          const text = generatedContent[platformId];
          const summary = text.length > 200 ? text.substring(0, 197) + "..." : text;

          const styles: Record<string, string> = {
            linkedin: "Professional corporate aesthetic",
            twitter: "Bold high-contrast visual",
            instagram: "Aesthetic lifestyle composition",
            facebook: "Engaging community-focused image"
          };

          newPrompts[platformId] = `${styles[platformId] || "Professional image"} for post: "${summary}"`;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setPlatformImagePrompts(newPrompts);
      }
    }
  }, [isOpen, viewMode, generatedContent]);

  // Hydrate images from IndexedDB on mount
  useEffect(() => {
    const hydrateImagesFromStorage = async () => {
      if (!storyId) return;

      try {
        const storedImages = await getImagesForStory(storyId);
        if (storedImages.length > 0) {
          const hydratedImages: Record<string, { enhancedPrompt: string; imageUrl?: string; imageId?: string }> = {};

          for (const meta of storedImages) {
            if (meta.platform) {
              const localUrl = await getImageUrl(meta.id);
              if (localUrl) {
                hydratedImages[meta.platform] = {
                  enhancedPrompt: '', // We don't store prompts in IndexedDB metadata
                  imageUrl: localUrl,
                  imageId: meta.id,
                };
              }
            }
          }

          if (Object.keys(hydratedImages).length > 0) {
            setPlatformImages(prev => ({ ...prev, ...hydratedImages }));
            console.log('[Storage] Hydrated images from IndexedDB:', Object.keys(hydratedImages));
          }
        }
      } catch (error) {
        console.warn('[Storage] Failed to hydrate images:', error);
      }
    };

    if (isOpen && storyId) {
      hydrateImagesFromStorage();
    }
  }, [isOpen, storyId]);

  // Auto-generate image prompt for the CURRENT platform when switching tabs
  useEffect(() => {
    const generatePromptForCurrentPlatform = async () => {
      // Only generate for social platforms (not "image" tab)
      if (
        activePlatform !== "image" &&
        imagePlatforms.includes(activePlatform) &&
        generatedContent[activePlatform] && // Has text for this platform
        !platformImagePrompts[activePlatform] && // No prompt yet
        !isGeneratingPrompts
      ) {
        // Set loading state for this platform
        setIsGeneratingPrompts(true);

        try {
          // Call AI to generate studio quality prompt
          const captionText = generatedContent[activePlatform];
          const result = await imagesApi.generatePrompt(captionText, activePlatform);

          setPlatformImagePrompts(prev => ({
            ...prev,
            [activePlatform]: result.prompt
          }));
        } catch (err) {
          console.warn(`Failed to generate AI prompt for ${activePlatform}, using fallback`);
          // Fallback to simple template
          const platformStyles: Record<string, string> = {
            linkedin: "Professional, clean, corporate style with business elements",
            twitter: "Bold, eye-catching, high contrast with quick visual impact",
            instagram: "Vibrant, visually stunning, aesthetic with rich colors",
            facebook: "Engaging, shareable, warm and community-focused",
          };
          const captionText = generatedContent[activePlatform];
          const style = platformStyles[activePlatform] || "";
          const contentSummary = captionText.substring(0, 150).replace(/\n/g, ' ').trim();

          setPlatformImagePrompts(prev => ({
            ...prev,
            [activePlatform]: `${style}. Illustrating: ${contentSummary}`
          }));
        } finally {
          setIsGeneratingPrompts(false);
        }
      }
    };

    generatePromptForCurrentPlatform();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlatform, generatedContent]);

  const generateAllPlatformImages = async () => {
    if (Object.keys(platformImagePrompts).length === 0 && !imagePrompt.trim()) return;
    if (!story) return;

    setIsGeneratingImages(true);

    // Initialize progress tracking
    const initialProgress: Record<string, 'pending' | 'generating' | 'success' | 'error'> = {};
    imagePlatforms.forEach(p => { initialProgress[p] = 'pending'; });
    setGenerationProgress(initialProgress);
    setPlatformImages({});

    const results: Record<string, { enhancedPrompt: string; imageUrl?: string }> = {};

    try {
      // Generate images one by one using per-platform prompts
      for (const platform of imagePlatforms) {
        setCurrentGeneratingPlatform(platform);
        setGenerationProgress(prev => ({ ...prev, [platform]: 'generating' }));

        // Use platform-specific prompt or fall back to general prompt
        const promptForPlatform = platformImagePrompts[platform] || imagePrompt;

        try {
          const result = await imagesApi.generate(promptForPlatform, undefined, undefined, platform);
          results[platform] = {
            enhancedPrompt: result.enhancedPrompt,
            imageUrl: result.imageUrl,
          };
          setPlatformImages(prev => ({ ...prev, [platform]: results[platform] }));
          setGenerationProgress(prev => ({ ...prev, [platform]: result.imageUrl ? 'success' : 'error' }));

          if (result.imageUrl) {
            toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} image generated!`);
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
          console.error(`Failed to generate ${platform} image:`, errorMessage);
          setGenerationProgress(prev => ({ ...prev, [platform]: 'error' }));
          results[platform] = {
            enhancedPrompt: '',
            imageUrl: undefined,
          };
        }
      }

      // Save images to sub-block if subBlockId is provided
      if (subBlockId) {
        try {
          const subBlock = await subBlocksApi.getById(subBlockId);
          const currentContents = subBlock.platformContents || {};
          const prefix = story?.id ? `${story.id}.` : "";

          const updatedContents: Record<string, string> = { ...currentContents };
          Object.entries(results).forEach(([platform, imageData]) => {
            if (imageData.imageUrl) {
              updatedContents[`${prefix}${platform}_image`] = imageData.imageUrl;
            }
          });
          updatedContents[`${prefix}imageContext`] = JSON.stringify(results);

          await subBlocksApi.update(subBlockId, {
            platformContents: updatedContents,
          });
        } catch (error) {
          console.error("Failed to save images to sub-block:", error);
        }
      }

      const successCount = Object.values(results).filter(r => r.imageUrl).length;
      if (successCount > 0) {
        toast.success(`Successfully generated ${successCount}/${imagePlatforms.length} images!`);
      } else {
        toast.error("Failed to generate any images. Please check your connection and try again.");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate images";
      console.error("Failed to generate images:", error);
      toast.error(errorMessage);
    } finally {
      setIsGeneratingImages(false);
      setCurrentGeneratingPlatform(null);
    }
  };

  // Generate image prompts from platform texts
  const generateImagePromptsFromText = async () => {
    setIsGeneratingPrompts(true);
    const prompts: Record<string, string> = {};

    try {
      // Platform-specific prompt templates (Fallback only)
      const platformStyles: Record<string, string> = {
        linkedin: "Professional, clean, corporate style with business elements",
        twitter: "Bold, eye-catching, high contrast with quick visual impact",
        instagram: "Vibrant, visually stunning, aesthetic with rich colors",
        facebook: "Engaging, shareable, warm and community-focused",
      };

      // Generate prompts in parallel
      const promptPromises = imagePlatforms.map(async (platform) => {
        const captionText = generatedContent[platform];

        const hasValidContent = captionText &&
          !captionText.toLowerCase().includes("failed") &&
          !captionText.toLowerCase().includes("error") &&
          captionText.length > 50;

        if (hasValidContent) {
          try {
            // Call AI to generate studio quality prompt
            const result = await imagesApi.generatePrompt(captionText, platform);
            prompts[platform] = result.prompt;
          } catch (err) {
            console.warn(`Failed to generate AI prompt for ${platform}, falling back to template`);
            // Fallback
            const style = platformStyles[platform] || "";
            const contentSummary = captionText.substring(0, 150).replace(/\n/g, ' ').trim();
            prompts[platform] = `${style}. Illustrating: ${contentSummary}`;
          }
        } else {
          // Fallback to story title
          const style = platformStyles[platform] || "";
          const storyTitle = story?.title || "professional business content";
          prompts[platform] = `${style}. Create an image for ${platform} about: ${storyTitle}`;
        }
      });

      await Promise.all(promptPromises);

      setPlatformImagePrompts(prompts);
      setImageFirstPhase("prompts");
      toast.success("Studio-quality prompts generated! Review them below.");
    } catch (error) {
      console.error("Failed to generate image prompts:", error);
      // Still proceed with basic prompts via simplistic templates
      for (const platform of imagePlatforms) {
        prompts[platform] = `Create a ${platform} optimized image for: ${story?.title || "professional content"}`;
      }
      setPlatformImagePrompts(prompts);
      setImageFirstPhase("prompts");
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  const generateContent = async () => {
    if (!storyId && !story) return;

    setIsLoading(true);
    // Filter out image platform from text generation
    const platformsToGenerate = platforms
      .filter(p => p.id !== 'image')
      .map(p => p.id);

    setLoadingPlatforms(new Set(platformsToGenerate));

    // Use image context if in image-first mode and images exist
    const imageContextForContent = isImageFirstMode && Object.keys(platformImages).length > 0
      ? platformImages
      : undefined;

    try {
      let content: Record<string, string>;

      if (storyId) {
        // Request content for all platforms using storyId
        content = await contentApi.generate(storyId, platformsToGenerate, undefined, imageContextForContent);
      } else if (story?.content) {
        // Generate from story content directly using AI
        content = await contentApi.generate(undefined, platformsToGenerate, story.content, imageContextForContent);
      } else {
        // Final fallback: use story content as-is
        content = {
          linkedin: story?.content || '',
          twitter: story?.content.substring(0, 280) || '',
          instagram: story?.content || '',
          facebook: story?.content || '',
        };
      }

      // Simulate progressive loading for better UX
      const platformEntries = Object.entries(content);
      const newContent: Record<string, string> = {};

      for (let i = 0; i < platformEntries.length; i++) {
        const [platform, platformContent] = platformEntries[i];
        // Small delay to show progressive loading
        await new Promise(resolve => setTimeout(resolve, 300));
        newContent[platform] = platformContent;
        setGeneratedContent({ ...newContent });
        setLoadingPlatforms(prev => {
          const next = new Set(prev);
          next.delete(platform);
          return next;
        });
      }

      // Save platform contents to sub-block if subBlockId is provided
      if (subBlockId && story) {
        try {
          const subBlock = await subBlocksApi.getById(subBlockId);
          const currentContents = subBlock.platformContents || {};
          const prefixedContent = prefixPlatformContents(content, story.id);
          await subBlocksApi.update(subBlockId, {
            selectedVariationId: story.id,
            platformContents: {
              ...currentContents,
              ...prefixedContent,
            },
          });
        } catch (error) {
          console.error("Failed to save platform contents to sub-block:", error);
          // Don't show error to user, this is a background operation
        }
      }
    } catch (error) {
      console.error("Failed to generate content:", error);
      toastHook({
        variant: "destructive",
        title: "Generation failed",
        description: "Could not generate platform-specific content."
      });
      // Fallback
      if (story) {
        setGeneratedContent({
          linkedin: story.content,
          twitter: story.content.substring(0, 280),
          instagram: story.content,
          facebook: story.content,
        });
      }
      setLoadingPlatforms(new Set());
    } finally {
      setIsLoading(false);
      setLoadingPlatforms(new Set());
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;

    setIsGeneratingImage(true);
    try {
      // Pass activePlatform to ensure style matching (LinkedIn vs Twitter etc)
      const result = await imagesApi.generate(imagePrompt, undefined, undefined, activePlatform);
      if (result.imageUrl) {
        // Construct full URL if relative
        const fullUrl = result.imageUrl.startsWith('http')
          ? result.imageUrl
          : result.imageUrl;

        setGeneratedImage({
          url: fullUrl,
          prompt: imagePrompt,
          enhancedPrompt: result.enhancedPrompt
        });

        // Save image URL to sub-block if subBlockId is provided
        if (subBlockId) {
          try {
            // Fetch current sub-block first to merge with existing contents
            const subBlock = await subBlocksApi.getById(subBlockId);
            const currentContents = subBlock.platformContents || {};
            const prefix = story?.id ? `${story.id}.` : "";

            await subBlocksApi.update(subBlockId, {
              selectedVariationId: story?.id,
              platformContents: {
                ...currentContents,
                [`${prefix}image`]: fullUrl,
                [`${prefix}imagePrompt`]: imagePrompt
              }
            });
          } catch (error) {
            console.error("Failed to save image to sub-block:", error);
          }
        }

        toast.success("Image generated successfully!");
      } else {
        toast.error("Failed to generate image URL.");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate image";
      console.error("Image generation failed:", error);
      toast.error(errorMessage);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!generatedImage?.url) return;

    try {
      const response = await fetch(generatedImage.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `story-image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Image downloaded!");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download image. Try right-clicking to save.");
      // Fallback: open in new tab
      window.open(generatedImage.url, '_blank');
    }
  };

  const handleLikeImage = async () => {
    if (!generatedImage) return;
    if (!authService.isAuthenticated()) {
      toast.info('Please login to provide feedback');
      return;
    }
    try {
      await imagesApi.like(generatedImage.enhancedPrompt);
      toast.success("We'll generate more images like this!");
    } catch (error) {
      toast.error("Failed to save preference");
    }
  };

  const handleDislikeImage = async () => {
    if (!generatedImage) return;
    if (!authService.isAuthenticated()) {
      toast.info('Please login to provide feedback');
      return;
    }
    try {
      await imagesApi.dislike(generatedImage.enhancedPrompt);
      toast.success("We'll avoid this style in the future.");
    } catch (error) {
      toast.error("Failed to save preference");
    }
  };

  // Save platform image to database for persistence
  const savePlatformImageToDatabase = async (platform: string, imageUrl: string, imagePrompt: string) => {
    if (!subBlockId || !story?.id) {
      console.warn('[PlatformStudio] Cannot save image: missing subBlockId or story.id');
      return;
    }

    try {
      const subBlock = await subBlocksApi.getById(subBlockId);
      const currentContents = subBlock.platformContents || {};
      const prefix = `${story.id}.`;

      await subBlocksApi.update(subBlockId, {
        selectedVariationId: story.id,
        platformContents: {
          ...currentContents,
          [`${prefix}${platform}_image`]: imageUrl,
          [`${prefix}${platform}_imagePrompt`]: imagePrompt,
        },
      });
      console.log(`[PlatformStudio] Saved ${platform} image to database`);
    } catch (error) {
      console.error(`[PlatformStudio] Failed to save ${platform} image:`, error);
    }
  };

  const platform = platforms.find((p) => p.id === activePlatform);
  const currentContent = generatedContent[activePlatform] || "";
  const charCount = currentContent.length;
  const isOverLimit = platform ? (currentContent.length > platform.maxChars) : false;
  const isApproachingLimit = platform ? (currentContent.length > platform.maxChars * 0.9 && !isOverLimit) : false;
  const percentage = platform ? Math.min((currentContent.length / platform.maxChars) * 100, 100) : 0;

  const handleCopy = async () => {
    // Copy the original markdown text (with **) so users get the format when pasting
    await navigator.clipboard.writeText(currentContent);
    setCopied(true);
    toastHook({
      title: "Copied to clipboard!",
      description: `Your ${platform?.name || 'platform'} content is ready to paste.`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleModify = async () => {
    if (!modifyInstructions.trim() || !currentContent) return;

    // Store values before closing dialog
    const instructions = modifyInstructions;
    const targetPlatform = activePlatform;
    const contentToModify = currentContent;

    // Close dialog immediately and reset inputs
    setShowModifyDialog(false);
    setModifyInstructions("");

    // Show modifying state
    setIsModifying(true);

    try {
      const modifiedCaption = await contentApi.modify(contentToModify, targetPlatform, instructions);

      // Update the generated content with the modified caption
      setGeneratedContent(prev => ({
        ...prev,
        [targetPlatform]: modifiedCaption
      }));

      // Also regenerate the image prompt based on the new caption
      try {
        console.log('[PlatformStudio] Regenerating image prompt for modified caption...');
        const promptResult = await imagesApi.generatePrompt(modifiedCaption, targetPlatform);

        if (promptResult.prompt) {
          console.log('[PlatformStudio] New prompt generated:', promptResult.prompt.substring(0, 50) + '...');

          // Update image prompt for this platform
          setPlatformImagePrompts(prev => ({
            ...prev,
            [targetPlatform]: promptResult.prompt
          }));

          // Also update platformImages if it exists to keep in sync
          setPlatformImages(prev => ({
            ...prev,
            [targetPlatform]: {
              ...prev[targetPlatform],
              enhancedPrompt: promptResult.prompt
            }
          }));

          // Force expand the prompt so user sees the change
          setPromptExpanded(true);
          toast.success("Image prompt updated to match caption");
        }
      } catch (promptError) {
        console.error("Failed to regenerate image prompt:", promptError);
        toast.warning("Caption updated, but failed to refresh image prompt");
      }

      // Save to sub-block if available
      if (subBlockId && story) {
        try {
          const subBlock = await subBlocksApi.getById(subBlockId);
          const currentContents = subBlock.platformContents || {};
          const prefix = story.id ? `${story.id}.` : "";

          await subBlocksApi.update(subBlockId, {
            platformContents: {
              ...currentContents,
              [`${prefix}${targetPlatform}`]: modifiedCaption,
            },
          });
        } catch (error) {
          console.error("Failed to save modified caption to sub-block:", error);
        }
      }

      toast.success("Caption & image prompt updated!");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to modify caption";
      toast.error(errorMessage);
    } finally {
      setIsModifying(false);
    }
  };

  const handleModifyImage = async () => {
    if (!modifyImageInstructions.trim()) return;

    const currentImageData = platformImages[activePlatform];
    if (!currentImageData?.imageUrl) {
      toast.error("No image to modify");
      return;
    }

    // Store values before closing dialog
    const instructions = modifyImageInstructions;
    const logoData = uploadedLogo;
    const targetPlatform = activePlatform;

    // Close dialog immediately and reset inputs
    setShowModifyImageDialog(false);
    setModifyImageInstructions("");
    setUploadedLogo(null);

    // Show generating state on the image
    setIsModifyingImage(true);
    setGenerationProgress(prev => ({ ...prev, [targetPlatform]: 'generating' }));

    try {
      const result = await imagesApi.modify(
        currentImageData.imageUrl,
        currentImageData.enhancedPrompt || platformImagePrompts[targetPlatform] || "",
        instructions,
        targetPlatform,
        logoData?.base64,
        logoData?.mimeType
      );

      // Update the platform images with the new image
      setPlatformImages(prev => ({
        ...prev,
        [targetPlatform]: {
          ...prev[targetPlatform],
          imageUrl: result.imageUrl,
          enhancedPrompt: result.enhancedPrompt
        }
      }));

      // Also update the prompt
      setPlatformImagePrompts(prev => ({
        ...prev,
        [targetPlatform]: result.enhancedPrompt
      }));

      setGenerationProgress(prev => ({ ...prev, [targetPlatform]: 'success' }));
      toast.success("Image modified successfully!");

      // Save modified image to database for persistence
      if (result.imageUrl?.startsWith('http')) {
        savePlatformImageToDatabase(targetPlatform, result.imageUrl, result.enhancedPrompt);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to modify image";
      setGenerationProgress(prev => ({ ...prev, [targetPlatform]: 'error' }));
      toast.error(errorMessage);
    } finally {
      setIsModifyingImage(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 data (remove data:image/...;base64, prefix)
      const base64 = result.split(',')[1];
      const mimeType = file.type || 'image/png';
      setUploadedLogo({ base64, mimeType });
      // Show the interactive logo editor
      setShowLogoEditor(true);
      setShowModifyImageDialog(false); // Close the modify dialog
    };
    reader.readAsDataURL(file);
  };

  // Handle logo editor apply - composite multiple logos at user-specified positions
  const handleLogoApply = async (logos: LogoInstance[]) => {
    if (!logos.length || !editingImage) {
      toast.error("No logos to apply or image missing");
      return;
    }

    const { url, platform, prompt } = editingImage;

    setShowLogoEditor(false);
    setIsModifyingImage(true);
    setGenerationProgress(prev => ({ ...prev, [platform]: 'generating' }));

    try {
      // Send all logos to the API
      const result = await imagesApi.modify(
        url,
        prompt || "",
        "add logo(s)", // Simple instruction
        platform,
        undefined, // No single logo
        undefined, // No single mimeType
        undefined, // No single logoPosition
        logos // Multiple logos array
      );

      // Update the platform images with the new image
      setPlatformImages(prev => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          imageUrl: result.imageUrl,
          enhancedPrompt: result.enhancedPrompt
        }
      }));

      // Save to database for persistence
      if (result.imageUrl?.startsWith('http')) {
        savePlatformImageToDatabase(platform, result.imageUrl, result.enhancedPrompt);
      }

      setGenerationProgress(prev => ({ ...prev, [platform]: 'success' }));
      toast.success(`${logos.length} logo${logos.length > 1 ? 's' : ''} added successfully!`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add logos";
      setGenerationProgress(prev => ({ ...prev, [platform]: 'error' }));
      toast.error(errorMessage);
    } finally {
      setIsModifyingImage(false);
      setUploadedLogo(null);
      setEditingImage(null);
    }
  };

  const handleLikeCaption = async (platformId: string, caption: string) => {
    if (!authService.isAuthenticated()) {
      toast.info('Please login to provide feedback');
      return;
    }

    const key = `${platformId}-${caption.substring(0, 50)}`;
    if (processingFeedback.has(key)) return;

    setProcessingFeedback(prev => new Set(prev).add(key));
    setLikedCaptions(prev => new Set(prev).add(key));
    setDislikedCaptions(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    try {
      await contentApi.like(caption, platformId);
      toast.success('Thanks! We\'ll use this style for future ' + platformId + ' content.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save feedback';
      toast.error(errorMessage);
      setLikedCaptions(prev => {
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

  const handleDislikeCaption = async (platformId: string, caption: string) => {
    if (!authService.isAuthenticated()) {
      toast.info('Please login to provide feedback');
      return;
    }

    const key = `${platformId}-${caption.substring(0, 50)}`;
    if (processingFeedback.has(key)) return;

    setProcessingFeedback(prev => new Set(prev).add(key));
    setDislikedCaptions(prev => new Set(prev).add(key));
    setLikedCaptions(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    try {
      await contentApi.dislike(caption, platformId);
      toast.success('Thanks! We\'ll avoid this style for future ' + platformId + ' content.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save feedback';
      toast.error(errorMessage);
      setDislikedCaptions(prev => {
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
    <AnimatePresence>
      {isOpen && story && (
        <>
          {/* Interactive Logo Editor */}
          {showLogoEditor && uploadedLogo && editingImage && (
            <LogoEditor
              key={`${editingImage.platform}-${editingImage.url}`}
              imageUrl={editingImage.url}
              logoBase64={uploadedLogo.base64}
              logoMimeType={uploadedLogo.mimeType}
              platform={editingImage.platform}
              onApply={handleLogoApply}
              onCancel={() => {
                setShowLogoEditor(false);
                setUploadedLogo(null);
                setEditingImage(null);
              }}
            />
          )}

          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />

          {/* Right-side Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[75vw] md:w-[60vw] lg:w-[50vw] xl:w-[45vw] max-w-[700px] bg-background/95 backdrop-blur-md border-l border-border rounded-l-2xl overflow-hidden shadow-2xl"
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Platform Studio</h2>
                    <p className="text-sm text-muted-foreground">
                      Optimize for your audience
                    </p>
                    {story && (
                      <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 bg-primary/10 rounded-md text-xs font-medium text-primary">
                        <span>Using:</span>
                        <span className="font-semibold">{story.title}</span>
                      </div>
                    )}
                  </div>

                  {/* Image/Text Toggle */}
                  <div className="flex items-center gap-1 p-1.5 bg-secondary/50 rounded-xl">
                    <button
                      onClick={() => setViewMode('text')}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all font-semibold text-sm",
                        viewMode === 'text'
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      )}
                    >
                      <Copy className="w-4 h-4" />
                      Text
                    </button>
                    <button
                      onClick={() => setViewMode('image')}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all font-semibold text-sm",
                        viewMode === 'image'
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      )}
                    >
                      <ImageIcon className="w-4 h-4" />
                      Image
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        // Force regenerate content
                        setGeneratedContent({});
                        setLastLoadedVariationId(null);
                        if (viewMode === 'image') {
                          // Regenerate image prompts via API
                          setIsGeneratingPrompts(true);
                          toast.info("Regenerating image prompts...");

                          const storyContent = story?.content || story?.title || "professional marketing content";
                          const generatedCaption = generatedContent[selectedImagePlatform] || storyContent;

                          try {
                            // Generate prompt for currently selected platform using AI
                            const promptResult = await imagesApi.generatePrompt(generatedCaption, selectedImagePlatform);

                            if (promptResult.prompt) {
                              setPlatformImagePrompts(prev => ({
                                ...prev,
                                [selectedImagePlatform]: promptResult.prompt
                              }));
                              toast.success(`Image prompt regenerated for ${selectedImagePlatform}!`);
                            }
                          } catch (error) {
                            console.error("Failed to regenerate image prompt:", error);
                            toast.error("Failed to regenerate image prompt");
                          } finally {
                            setIsGeneratingPrompts(false);
                          }
                        } else {
                          // Clear image state when regenerating text
                          setPlatformImagePrompts({});
                          setPlatformImages({});
                          generateContent();
                          toast.info("Regenerating platform content...");
                        }
                      }}
                      disabled={isLoading || isGeneratingPrompts}
                      className="w-10 h-10 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors disabled:opacity-50"
                      title="Regenerate Content"
                      aria-label="Regenerate Content"
                    >
                      <RefreshCw className={cn("w-5 h-5", (isLoading || isGeneratingPrompts) && "animate-spin")} />
                    </button>
                    <button
                      onClick={onClose}
                      className="w-10 h-10 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                      title="Close Platform Studio"
                      aria-label="Close Platform Studio"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Platform Tabs - Only show in text mode */}
                {viewMode === 'text' && (
                  <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg overflow-x-auto">
                    {platforms.map((p) => {
                      const isPlatformLoading = loadingPlatforms.has(p.id);
                      const hasContent = !!generatedContent[p.id];

                      return (
                        <button
                          key={p.id}
                          onClick={() => setActivePlatform(p.id)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md transition-all font-medium text-sm relative whitespace-nowrap",
                            activePlatform === p.id
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {isPlatformLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <p.icon className="w-4 h-4" />
                          )}
                          {p.name}
                          {hasContent && !isPlatformLoading && (
                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Image Platform Sub-tabs - Only show in image mode */}
                {viewMode === 'image' && (
                  <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg overflow-x-auto">
                    {imagePlatforms.map((platformId) => {
                      const platformInfo = platforms.find(p => p.id === platformId);
                      const Icon = platformInfo?.icon;
                      const hasImage = platformImages[platformId]?.imageUrl;

                      return (
                        <button
                          key={platformId}
                          onClick={() => setSelectedImagePlatform(platformId)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md transition-all font-medium text-sm relative whitespace-nowrap",
                            selectedImagePlatform === platformId
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {Icon && <Icon className="w-4 h-4" />}
                          {platformInfo?.name}
                          {hasImage && (
                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                {viewMode === 'text' ? (
                  // TEXT VIEW
                  isLoading && !generatedContent[activePlatform] ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p>Generating content for {platforms.find(p => p.id === activePlatform)?.name}...</p>
                    </div>
                  ) : (
                    <div className="space-y-6 relative">
                      {isModifying && (
                        <div className="absolute inset-0 z-50 bg-background/50 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
                          <div className="bg-primary text-primary-foreground shadow-lg px-4 py-2 rounded-full flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm font-medium">Modifying...</span>
                          </div>
                        </div>
                      )}
                      {/* Generated Text Display */}
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {activePlatform === 'twitter' ? (
                          // Twitter/X Themed View (Blue #1DA1F2, 280-char truncation preview)
                          <div className="space-y-3">
                            <div className="rounded-xl border border-[#1DA1F2]/20 bg-background overflow-hidden">
                              {/* Twitter Header */}
                              <div className="flex items-center gap-3 p-4 border-b border-border/50">
                                <div className="w-12 h-12 rounded-full bg-[#1DA1F2]/10 flex items-center justify-center text-[#1DA1F2] font-bold text-sm">
                                  You
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-sm">Your Name</span>
                                    <svg className="w-4 h-4 text-[#1DA1F2]" viewBox="0 0 22 22" fill="currentColor">
                                      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681.132-.637.075-1.299-.165-1.903.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                                    </svg>
                                  </div>
                                  <div className="text-sm text-muted-foreground">@your_handle</div>
                                </div>
                                <button className="text-muted-foreground hover:text-foreground">•••</button>
                              </div>
                              {/* Twitter Content */}
                              <div className="p-4">
                                {(() => {
                                  const content = generatedContent[activePlatform] || '';
                                  const isLong = content.length > 280;
                                  const displayContent = (!twitterExpanded && isLong)
                                    ? content.substring(0, 280) + '...'
                                    : content;

                                  return (
                                    <>
                                      <div
                                        className="prose prose-sm dark:prose-invert max-w-none"
                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(displayContent) }}
                                      />
                                      {isLong && (
                                        <button
                                          onClick={() => setTwitterExpanded(!twitterExpanded)}
                                          className="text-[#1DA1F2] hover:underline text-sm font-medium mt-2 block"
                                        >
                                          {twitterExpanded ? 'Show less' : 'Show more'}
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              {/* Twitter Actions */}
                              <div className="flex items-center justify-around py-2 px-4 border-t border-border/50 text-muted-foreground">
                                <button className="flex items-center gap-1.5 hover:text-[#1DA1F2] p-2 rounded-full hover:bg-[#1DA1F2]/10 transition-colors">
                                  <MessageSquare className="w-5 h-5" />
                                  <span className="text-xs">Reply</span>
                                </button>
                                <button className="flex items-center gap-1.5 hover:text-emerald-500 p-2 rounded-full hover:bg-emerald-500/10 transition-colors">
                                  <Repeat2 className="w-5 h-5" />
                                  <span className="text-xs">Repost</span>
                                </button>
                                <button className="flex items-center gap-1.5 hover:text-pink-500 p-2 rounded-full hover:bg-pink-500/10 transition-colors">
                                  <Heart className="w-5 h-5" />
                                  <span className="text-xs">Like</span>
                                </button>
                                <button className="flex items-center gap-1.5 hover:text-[#1DA1F2] p-2 rounded-full hover:bg-[#1DA1F2]/10 transition-colors">
                                  <Share className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                            {/* Character Count */}
                            <div className="flex justify-end">
                              <span className={cn(
                                "text-xs font-medium",
                                (generatedContent[activePlatform]?.length || 0) > 25000
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              )}>
                                {generatedContent[activePlatform]?.length || 0} / 25,000
                              </span>
                            </div>
                          </div>
                        ) : activePlatform === 'linkedin' ? (
                          // LinkedIn Themed View (Blue #0A66C2, 210-char truncation)
                          <div className="space-y-3">
                            <div className="rounded-lg border border-[#0A66C2]/20 bg-background overflow-hidden">
                              {/* LinkedIn Header */}
                              <div className="flex items-center gap-3 p-4 border-b border-border/50">
                                <div className="w-12 h-12 rounded-full bg-[#0A66C2]/20 flex items-center justify-center text-[#0A66C2] font-bold text-sm">
                                  You
                                </div>
                                <div>
                                  <div className="font-semibold text-sm">Your Name</div>
                                  <div className="text-xs text-muted-foreground">Headline · 1st</div>
                                  <div className="text-xs text-muted-foreground">Just now · 🌐</div>
                                </div>
                              </div>
                              {/* LinkedIn Content */}
                              <div className="p-4">
                                {(() => {
                                  const content = generatedContent[activePlatform] || '';
                                  const isLong = content.length > 210;
                                  const displayContent = (!linkedinExpanded && isLong)
                                    ? content.substring(0, 210) + '...'
                                    : content;
                                  return (
                                    <>
                                      <div
                                        className="prose prose-sm dark:prose-invert max-w-none"
                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(displayContent) }}
                                      />
                                      {isLong && (
                                        <button
                                          onClick={() => setLinkedinExpanded(!linkedinExpanded)}
                                          className="text-[#0A66C2] hover:underline text-sm font-medium mt-1"
                                        >
                                          {linkedinExpanded ? '...show less' : '...see more'}
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              {/* LinkedIn Actions */}
                              <div className="flex items-center justify-around py-2 border-t border-border/50 text-muted-foreground text-sm">
                                <button className="flex items-center gap-1 hover:text-[#0A66C2] px-4 py-2 rounded hover:bg-secondary/50">
                                  <ThumbsUp className="w-4 h-4" /> Like
                                </button>
                                <button className="flex items-center gap-1 hover:text-[#0A66C2] px-4 py-2 rounded hover:bg-secondary/50">
                                  <MessageSquare className="w-4 h-4" /> Comment
                                </button>
                                <button className="flex items-center gap-1 hover:text-[#0A66C2] px-4 py-2 rounded hover:bg-secondary/50">
                                  <Repeat2 className="w-4 h-4" /> Repost
                                </button>
                                <button className="flex items-center gap-1 hover:text-[#0A66C2] px-4 py-2 rounded hover:bg-secondary/50">
                                  <Share className="w-4 h-4" /> Send
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : activePlatform === 'instagram' ? (
                          // Instagram Themed View (Gradient Pink/Purple, 125-char truncation)
                          <div className="space-y-3">
                            <div className="rounded-xl border-2 border-transparent bg-gradient-to-br from-[#833AB4]/10 via-[#FD1D1D]/10 to-[#F77737]/10 overflow-hidden">
                              {/* Instagram Header */}
                              <div className="flex items-center gap-3 p-3 border-b border-border/30">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] p-0.5">
                                  <div className="w-full h-full rounded-full bg-background flex items-center justify-center text-xs font-bold">
                                    You
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-sm">your_handle</div>
                                </div>
                                <button className="text-muted-foreground">•••</button>
                              </div>
                              {/* Instagram Content */}
                              <div className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-semibold text-sm">your_handle</span>
                                </div>
                                {(() => {
                                  const content = generatedContent[activePlatform] || '';
                                  const isLong = content.length > 125;
                                  const displayContent = (!instagramExpanded && isLong)
                                    ? content.substring(0, 125)
                                    : content;
                                  return (
                                    <>
                                      <div
                                        className="prose prose-sm dark:prose-invert max-w-none text-sm"
                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(displayContent) }}
                                      />
                                      {isLong && !instagramExpanded && (
                                        <button
                                          onClick={() => setInstagramExpanded(true)}
                                          className="text-muted-foreground hover:text-foreground text-sm"
                                        >
                                          ...more
                                        </button>
                                      )}
                                      {instagramExpanded && isLong && (
                                        <button
                                          onClick={() => setInstagramExpanded(false)}
                                          className="text-muted-foreground hover:text-foreground text-sm block mt-1"
                                        >
                                          ...less
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              {/* Instagram Actions */}
                              <div className="flex items-center justify-between px-4 py-2 border-t border-border/30">
                                <div className="flex items-center gap-4">
                                  <button className="hover:text-[#FD1D1D]"><Heart className="w-6 h-6" /></button>
                                  <button className="hover:text-foreground"><MessageSquare className="w-6 h-6" /></button>
                                  <button className="hover:text-foreground"><Share className="w-6 h-6" /></button>
                                </div>
                                <button className="hover:text-foreground"><Bookmark className="w-6 h-6" /></button>
                              </div>
                            </div>
                          </div>
                        ) : activePlatform === 'facebook' ? (
                          // Facebook Themed View (Blue #1877F2, no truncation needed)
                          <div className="space-y-3">
                            <div className="rounded-lg border border-[#1877F2]/20 bg-background overflow-hidden">
                              {/* Facebook Header */}
                              <div className="flex items-center gap-3 p-4">
                                <div className="w-10 h-10 rounded-full bg-[#1877F2]/20 flex items-center justify-center text-[#1877F2] font-bold text-sm">
                                  You
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-sm">Your Name</div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    Just now · 🌐
                                  </div>
                                </div>
                                <button className="text-muted-foreground hover:bg-secondary/50 p-2 rounded-full">•••</button>
                              </div>
                              {/* Facebook Content - No truncation needed (63k limit) */}
                              <div className="px-4 pb-4">
                                <div
                                  className="prose prose-sm dark:prose-invert max-w-none"
                                  dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedContent[activePlatform]) }}
                                />
                              </div>
                              {/* Facebook Actions */}
                              <div className="flex items-center justify-around py-2 border-t border-border/50 text-muted-foreground text-sm">
                                <button className="flex items-center gap-2 hover:text-[#1877F2] px-6 py-2 rounded hover:bg-secondary/50 font-medium">
                                  <ThumbsUp className="w-5 h-5" /> Like
                                </button>
                                <button className="flex items-center gap-2 hover:text-[#1877F2] px-6 py-2 rounded hover:bg-secondary/50 font-medium">
                                  <MessageSquare className="w-5 h-5" /> Comment
                                </button>
                                <button className="flex items-center gap-2 hover:text-[#1877F2] px-6 py-2 rounded hover:bg-secondary/50 font-medium">
                                  <Share className="w-5 h-5" /> Share
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Fallback Generic View
                          <div
                            className="p-4 rounded-lg bg-background border border-border min-h-[200px] prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedContent[activePlatform]) }}
                          />
                        )}
                      </div>

                      {/* Footer Actions - Redesigned (Copy Left, Feedback Right) */}
                      <div className="flex items-center justify-between pt-5 border-t border-border mt-auto">
                        {/* Left: Copy Button (Prominent) */}
                        <Button
                          size="sm"
                          onClick={handleCopy}
                          disabled={!currentContent || isOverLimit}
                          className={cn(
                            "h-10 px-6 shadow-md transition-all font-semibold text-sm",
                            copied ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "gradient-primary text-white hover:opacity-90"
                          )}
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Copied to Clipboard
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-2" />
                              Copy to Clipboard
                            </>
                          )}
                        </Button>

                        {/* Modify Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowModifyDialog(true)}
                          disabled={!currentContent || isModifying}
                          className="h-10 px-4 font-semibold text-sm border-border bg-secondary/50 hover:bg-primary hover:text-white hover:border-primary text-foreground transition-colors"
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Modify
                        </Button>

                        {/* Right: Stats & Feedback */}
                        <div className="flex items-center gap-3">
                          {/* Character Count */}
                          <div className={cn(
                            "text-xs font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 border border-border/50",
                            isOverLimit ? "text-destructive bg-destructive/10 border-destructive/20" : isApproachingLimit ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground"
                          )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", isOverLimit ? "bg-destructive" : isApproachingLimit ? "bg-amber-500" : "bg-emerald-500")} />
                            {currentContent?.length || 0} / {platform?.maxChars || 0}
                          </div>

                          <div className="flex items-center gap-1 bg-secondary/30 p-1.5 rounded-lg border border-border/50">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLikeCaption(activePlatform, generatedContent[activePlatform])}
                              className={cn(
                                "h-9 px-4 min-w-[60px] text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors rounded-md",
                                likedCaptions.has(`${activePlatform}-${generatedContent[activePlatform]?.substring(0, 50)}`) && "text-emerald-500 bg-emerald-500/10"
                              )}
                              title="Like this variation"
                            >
                              <ThumbsUp className="w-5 h-5" />
                            </Button>
                            <div className="w-px h-5 bg-border/50" />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDislikeCaption(activePlatform, generatedContent[activePlatform])}
                              className={cn(
                                "h-9 px-4 min-w-[60px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded-md",
                                dislikedCaptions.has(`${activePlatform}-${generatedContent[activePlatform]?.substring(0, 50)}`) && "text-destructive bg-destructive/10"
                              )}
                              title="Dislike this variation"
                            >
                              <ThumbsDown className="w-5 h-5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  // IMAGE VIEW
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="text-center mb-2">
                      <h3 className="text-lg font-semibold mb-1">Generate Platform Images</h3>
                      <p className="text-xs text-muted-foreground">
                        Select a platform and generate its image
                      </p>
                    </div>

                    {/* Selected Platform Content */}
                    {(() => {
                      const currentPlatform = selectedImagePlatform;
                      const platformInfo = platforms.find(p => p.id === currentPlatform);
                      const Icon = platformInfo?.icon;
                      const hasImage = platformImages[currentPlatform]?.imageUrl;
                      const imageStatus = generationProgress[currentPlatform];
                      const hasText = generatedContent[currentPlatform];

                      // Auto-generate prompt if text exists but no prompt
                      if (!platformImagePrompts[currentPlatform]) {
                        // If no prompt, generate one based on story title (default) or text if available
                        const storyTitle = story?.title || "content";
                        const contentSummary = hasText ? hasText.substring(0, 150).replace(/\n/g, ' ').trim() : storyTitle;

                        const platformStyles: Record<string, string> = {
                          linkedin: "Professional, clean, corporate style with business elements",
                          twitter: "Bold, eye-catching, high contrast with quick visual impact",
                          instagram: "Vibrant, visually stunning, aesthetic with rich colors",
                          facebook: "Engaging, shareable, warm and community-focused",
                        };
                        const style = platformStyles[currentPlatform] || "";

                        // We set this in a useEffect or similar usually, but for render safety we display default if empty
                        // Ideally we update state, but here we just render placeholders if empty
                      }

                      return (
                        <div className="space-y-4">
                          {/* Platform Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {Icon && <Icon className="w-5 h-5" />}
                              <span className="font-semibold capitalize">{currentPlatform} Image</span>
                            </div>
                            {hasImage && (
                              <span className="text-xs text-emerald-500 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Generated
                              </span>
                            )}
                          </div>

                          {/* Image Prompt - Collapsible */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                              Image Prompt
                              {isGeneratingPrompts && (
                                <span className="text-xs text-primary flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Generating studio prompt...
                                </span>
                              )}
                            </label>
                            <div className="relative">
                              {/* Collapsible Prompt Display (when not editing) */}
                              {!isGeneratingPrompts && platformImagePrompts[currentPlatform] && platformImagePrompts[currentPlatform].length > 180 && !promptExpanded ? (
                                <div
                                  className="p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                                  onClick={() => setPromptExpanded(true)}
                                >
                                  <p className="text-sm text-foreground/80 leading-relaxed">
                                    {platformImagePrompts[currentPlatform].substring(0, 180)}...
                                  </p>
                                  <button className="text-primary text-xs font-medium mt-2 hover:underline">
                                    Show more
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <Textarea
                                    value={platformImagePrompts[currentPlatform] || ''}
                                    onChange={(e) => setPlatformImagePrompts(prev => ({
                                      ...prev,
                                      [currentPlatform]: e.target.value
                                    }))}
                                    placeholder={isGeneratingPrompts ? "AI is crafting a detailed image prompt..." : `Describe the ${currentPlatform} image you want to generate...`}
                                    className="min-h-[120px] text-sm resize-y"
                                    disabled={isGeneratingPrompts}
                                    onBlur={() => {
                                      // Collapse if long and user clicks away
                                      if (platformImagePrompts[currentPlatform]?.length > 180) {
                                        setPromptExpanded(false);
                                      }
                                    }}
                                  />
                                  {platformImagePrompts[currentPlatform]?.length > 180 && (
                                    <button
                                      onClick={() => setPromptExpanded(false)}
                                      className="text-primary text-xs font-medium mt-1 hover:underline"
                                    >
                                      Show less
                                    </button>
                                  )}
                                </>
                              )}
                              {isGeneratingPrompts && (
                                <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] rounded-md flex items-center justify-center">
                                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    <span className="text-xs">Analyzing your content...</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Generated Image Preview with Platform Frame */}
                          {hasImage && (() => {
                            const specs = platformImageSpecs[currentPlatform];
                            const aspectRatio = specs.width / specs.height;

                            return (
                              <div className="space-y-3">
                                {/* Platform Frame */}
                                <div
                                  className="relative rounded-xl overflow-hidden cursor-zoom-in transition-all hover:scale-[1.02] hover:shadow-lg"
                                  style={{
                                    border: `3px solid ${specs.color}`,
                                    boxShadow: `0 0 20px ${specs.color}20`
                                  }}
                                  onClick={() => {
                                    setZoomedPlatform(currentPlatform);
                                    setImageModalOpen(true);
                                  }}
                                >
                                  {/* Platform Badge - Top Left */}
                                  <div
                                    className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-xs font-semibold shadow-lg backdrop-blur-sm"
                                    style={{ backgroundColor: `${specs.color}ee` }}
                                  >
                                    {Icon && <Icon className="w-3.5 h-3.5" />}
                                    <span className="capitalize">{currentPlatform}</span>
                                  </div>

                                  {/* Aspect Ratio Badge - Top Right */}
                                  <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
                                    {specs.ratio} · {specs.label}
                                  </div>

                                  {/* Image */}
                                  {/* Image with Error Handling */}
                                  <div style={{ aspectRatio: `${aspectRatio}` }} className="bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative bg-pattern">
                                    {/* Fallback Error State */}
                                    {imageLoadErrors[currentPlatform] ? (
                                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-4 text-center animate-in fade-in">
                                        <AlertCircle className="w-8 h-8 mb-2 text-destructive" />
                                        <p className="text-sm font-medium">Failed to load image</p>
                                        <button
                                          onClick={() => setImageLoadErrors(prev => ({ ...prev, [currentPlatform]: false }))}
                                          className="text-xs text-primary hover:underline mt-2"
                                        >
                                          Retry
                                        </button>
                                        <p className="text-[10px] opacity-50 mt-2 font-mono break-all max-w-[80%]">
                                          {platformImages[currentPlatform].imageUrl?.slice(0, 60)}...
                                        </p>
                                      </div>
                                    ) : (
                                      /* Actual Image */
                                      platformImages[currentPlatform].imageUrl ? (
                                        <img
                                          src={platformImages[currentPlatform].imageUrl}
                                          alt={`${currentPlatform} generated content`}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            console.error(`Image failed to load: ${platformImages[currentPlatform].imageUrl}`);
                                            setImageLoadErrors(prev => ({ ...prev, [currentPlatform]: true }));
                                          }}
                                        />
                                      ) : (
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                          <Loader2 className="w-8 h-8 animate-spin" />
                                          <span className="text-xs">Loading image...</span>
                                        </div>
                                      )
                                    )}
                                  </div>

                                  {/* Hover Overlay */}
                                  <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                    <div className="bg-white/90 rounded-full p-3 shadow-lg">
                                      <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>

                                {/* Download Button */}
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const imageUrl = platformImages[currentPlatform].imageUrl;
                                    if (!imageUrl) return;

                                    try {
                                      const response = await fetch(imageUrl);
                                      const blob = await response.blob();
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `${currentPlatform}-image-${Date.now()}.png`;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      URL.revokeObjectURL(url);
                                      toast.success('Image downloaded!');
                                    } catch (error) {
                                      console.error('Download failed:', error);
                                      toast.error('Failed to download image');
                                    }
                                  }}
                                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors text-sm font-medium"
                                >
                                  <Download className="w-4 h-4" />
                                  Download Image ({specs.label})
                                </button>
                              </div>
                            );
                          })()}

                          {/* Action Buttons - Side by Side when image exists */}
                          <div className={cn("flex gap-3", hasImage ? "flex-row" : "")}>
                            {/* Generate/Regenerate Button */}
                            <Button
                              onClick={async () => {
                                const prompt = platformImagePrompts[currentPlatform];
                                if (!prompt?.trim()) {
                                  toast.error("Please enter an image prompt first");
                                  return;
                                }

                                setGenerationProgress(prev => ({ ...prev, [currentPlatform]: 'generating' }));
                                try {
                                  const result = await imagesApi.generate(prompt, undefined, undefined, currentPlatform);
                                  if (result.imageUrl) {
                                    const fullUrl = result.imageUrl.startsWith('http')
                                      ? result.imageUrl
                                      : result.imageUrl;

                                    try {
                                      const imageId = `${storyId || 'temp'}-${currentPlatform}-${Date.now()}`;
                                      const blob = await urlToBlob(fullUrl);
                                      await saveImage(imageId, blob, currentPlatform, storyId);
                                      const localUrl = await getImageUrl(imageId);

                                      const shouldUseRemoteUrl = fullUrl.startsWith('http');
                                      setPlatformImages(prev => ({
                                        ...prev,
                                        [currentPlatform]: {
                                          enhancedPrompt: result.enhancedPrompt,
                                          imageUrl: shouldUseRemoteUrl ? fullUrl : (localUrl || fullUrl),
                                          imageId
                                        }
                                      }));
                                    } catch (storageError) {
                                      console.warn('[Storage] Failed to cache image:', storageError);
                                      setPlatformImages(prev => ({
                                        ...prev,
                                        [currentPlatform]: { enhancedPrompt: result.enhancedPrompt, imageUrl: fullUrl }
                                      }));
                                    }

                                    const updatedPrompt = result.enhancedPrompt?.trim() ? result.enhancedPrompt : prompt;
                                    setPlatformImagePrompts(prev => ({
                                      ...prev,
                                      [currentPlatform]: updatedPrompt
                                    }));
                                    setGenerationProgress(prev => ({ ...prev, [currentPlatform]: 'success' }));
                                    toast.success(`${currentPlatform} image generated!`);

                                    // Save to database for persistence across sessions
                                    const finalImageUrl = fullUrl.startsWith('http') ? fullUrl : (result.imageUrl || '');
                                    if (finalImageUrl) {
                                      savePlatformImageToDatabase(currentPlatform, finalImageUrl, updatedPrompt);
                                    }
                                  } else {
                                    setGenerationProgress(prev => ({ ...prev, [currentPlatform]: 'error' }));
                                    toast.error("Failed to generate image");
                                  }
                                } catch (error) {
                                  console.error("Image generation failed:", error);
                                  setGenerationProgress(prev => ({ ...prev, [currentPlatform]: 'error' }));
                                  toast.error("Image generation failed");
                                }
                              }}
                              disabled={!platformImagePrompts[currentPlatform]?.trim() || imageStatus === 'generating'}
                              className={cn(
                                "gradient-primary text-white h-12",
                                hasImage ? "flex-1" : "w-full"
                              )}
                            >
                              {imageStatus === 'generating' ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Generating...
                                </>
                              ) : hasImage ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Regenerate
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="w-4 h-4 mr-2" />
                                  Generate {currentPlatform} Image
                                </>
                              )}
                            </Button>

                            {/* Modify Image Button - Only visible when image exists */}
                            {hasImage && (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingImage({
                                    url: platformImages[currentPlatform]!.imageUrl!,
                                    platform: currentPlatform,
                                    prompt: platformImagePrompts[currentPlatform] || platformImages[currentPlatform]!.enhancedPrompt
                                  });
                                  setShowModifyImageDialog(true);
                                }}
                                disabled={imageStatus === 'generating' || isModifyingImage}
                                className="flex-1 h-12 border-border bg-secondary/50 hover:bg-primary hover:text-white hover:border-primary transition-colors"
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Modify
                              </Button>
                            )}
                          </div>

                          {/* View Text Link */}
                          <button
                            onClick={() => {
                              setViewMode('text');
                              setActivePlatform(currentPlatform);
                            }}
                            className="w-full text-center text-xs text-primary hover:underline py-2"
                          >
                            ← View {currentPlatform} text
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              {/* Footer actions integrated into views */}
            </div>
          </motion.div>

          {/* Fullscreen Image Zoom Modal */}
          {imageModalOpen && zoomedPlatform && platformImages[zoomedPlatform]?.imageUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col"
              onClick={() => {
                setImageModalOpen(false);
                setZoomedPlatform(null);
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setImageModalOpen(false);
                  setZoomedPlatform(null);
                }}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              {/* Platform Badge - Top Left */}
              {(() => {
                const specs = platformImageSpecs[zoomedPlatform];
                const platformInfo = platforms.find(p => p.id === zoomedPlatform);
                const Icon = platformInfo?.icon;
                return (
                  <div
                    className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm font-semibold"
                    style={{ backgroundColor: `${specs.color}ee` }}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span className="capitalize">{zoomedPlatform}</span>
                    <span className="opacity-70">·</span>
                    <span className="opacity-70">{specs.ratio}</span>
                  </div>
                );
              })()}

              {/* Image Container */}
              <div
                className="flex-1 flex items-center justify-center p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={platformImages[zoomedPlatform].imageUrl}
                  alt={`${zoomedPlatform} image zoomed`}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  style={{
                    maxHeight: 'calc(100vh - 120px)',
                    cursor: 'zoom-out'
                  }}
                  onClick={() => {
                    setImageModalOpen(false);
                    setZoomedPlatform(null);
                  }}
                />
              </div>

              {/* Bottom Bar */}
              <div className="flex items-center justify-between px-6 py-4 bg-black/50">
                <div className="text-white/70 text-sm">
                  {platformImageSpecs[zoomedPlatform].label} · {platformImageSpecs[zoomedPlatform].ratio}
                </div>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const imageUrl = platformImages[zoomedPlatform].imageUrl;
                    if (!imageUrl) return;

                    try {
                      const response = await fetch(imageUrl);
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${zoomedPlatform}-image-${Date.now()}.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      toast.success('Image downloaded!');
                    } catch (error) {
                      console.error('Download failed:', error);
                      toast.error('Failed to download image');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </motion.div>
          )}

          {/* Modify Caption Dialog */}
          {showModifyDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowModifyDialog(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
              >
                {/* Dialog Header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Pencil className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Modify Caption</h3>
                      <p className="text-xs text-muted-foreground">
                        Editing {platform?.name || activePlatform} content
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModifyDialog(false)}
                    className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Dialog Content */}
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      What changes would you like?
                    </label>
                    <Textarea
                      placeholder="e.g., Make it shorter, add more emojis, make it more formal, add a call to action..."
                      value={modifyInstructions}
                      onChange={(e) => setModifyInstructions(e.target.value)}
                      className="min-h-[100px] resize-none"
                      autoFocus
                    />
                  </div>

                  <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3">
                    <strong>Tip:</strong> Be specific about what you want to change. For example:
                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                      <li>"Make it 50% shorter"</li>
                      <li>"Add 3-4 relevant emojis"</li>
                      <li>"Make the tone more casual and friendly"</li>
                      <li>"Add a question at the end"</li>
                    </ul>
                  </div>
                </div>

                {/* Dialog Footer */}
                <div className="p-4 border-t border-border flex items-center justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowModifyDialog(false);
                      setModifyInstructions("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleModify}
                    disabled={!modifyInstructions.trim() || isModifying}
                    className="gradient-primary text-white"
                  >
                    {isModifying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Modifying...
                      </>
                    ) : (
                      <>
                        <Pencil className="w-4 h-4 mr-2" />
                        Apply Changes
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Modify Image Dialog */}
          {showModifyImageDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowModifyImageDialog(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
              >
                {/* Dialog Header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Modify Image</h3>
                      <p className="text-xs text-muted-foreground">
                        Editing {platform?.name || activePlatform} image
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModifyImageDialog(false)}
                    className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Dialog Content */}
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      What changes would you like?
                    </label>
                    <Textarea
                      placeholder="e.g., Add my logo in the corner, change background to blue, make it more vibrant..."
                      value={modifyImageInstructions}
                      onChange={(e) => setModifyImageInstructions(e.target.value)}
                      className="min-h-[100px] resize-none"
                      autoFocus
                    />
                  </div>

                  {/* Logo Upload */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Upload Logo/Element (Optional)
                    </label>
                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                      {uploadedLogo ? (
                        <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded bg-background flex items-center justify-center overflow-hidden border">
                              <img
                                src={`data:${uploadedLogo.mimeType};base64,${uploadedLogo.base64}`}
                                alt="Uploaded logo"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-green-600 dark:text-green-400">Logo uploaded</span>
                              <span className="text-[10px] text-muted-foreground">Exact Overlay (Bottom-Right)</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setUploadedLogo(null)}
                            className="text-sm text-destructive hover:underline px-2"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                          <div className="flex flex-col items-center gap-2 py-2">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              Click to upload logo or image element
                            </span>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3">
                    <strong>Examples:</strong>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                      <li>"Add my logo in the bottom-right corner"</li>
                      <li>"Change the background to a gradient"</li>
                      <li>"Make the colors more vibrant"</li>
                      <li>"Add text overlay saying 'SALE'"</li>
                    </ul>
                  </div>
                </div>

                {/* Dialog Footer */}
                <div className="p-4 border-t border-border flex items-center justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowModifyImageDialog(false);
                      setModifyImageInstructions("");
                      setUploadedLogo(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleModifyImage}
                    disabled={!modifyImageInstructions.trim() || isModifyingImage}
                    className="gradient-primary text-white"
                  >
                    {isModifyingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Modifying Image...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Apply Changes
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </>
      )
      }
    </AnimatePresence >
  );
};
