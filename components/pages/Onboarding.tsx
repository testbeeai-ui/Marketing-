"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Navbar } from "@/components/layout/Navbar";
import { authService } from "@/lib/auth";
import { toast } from "sonner";

export const Onboarding = () => {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userInput, setUserInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!userInput.trim()) {
      toast.error("Please tell us about your content style");
      return;
    }

    setIsProcessing(true);
    try {
      // Store the input for later use in preference extraction
      localStorage.setItem('story_weaver_onboarding_input', userInput.trim());
      localStorage.setItem('story_weaver_onboarding_seen', 'true');

      // The preference extraction happens automatically on first story generation
      toast.success("Welcome! Your preferences will be learned as you use the platform.");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to complete onboarding");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('story_weaver_onboarding_seen', 'true');
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-12 px-6">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl gradient-violet flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">
                Welcome to Story Weaver Studio
              </h1>
              <p className="text-muted-foreground text-lg">
                Let's learn your content style to create personalized stories
              </p>
            </div>

            {/* Step 1: Story of the Dashboard */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-panel p-8 space-y-6"
              >
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-foreground">
                    Your Story Creation Journey
                  </h2>
                  <div className="space-y-4 text-muted-foreground">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-primary">1</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">Upload Your PDFs with Drag & Drop</p>
                        <p className="text-sm">Simply drag and drop your PDFs into the Knowledge Base sidebar. Our system will automatically extract and index the content, making it ready for story generation.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-primary">2</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">Tell Your Story</p>
                        <p className="text-sm">Enter your story idea or prompt. Our AI will scrape through your uploaded PDFs to find relevant context and generate personalized stories.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-primary">3</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">Pick Your Style</p>
                        <p className="text-sm">Choose from multiple story formats - Professional, Viral, or Storyteller. Each style is optimized for different audiences and platforms.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-primary">4</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">Format for Platforms</p>
                        <p className="text-sm">Transform your story into platform-specific formats - Twitter, Instagram (in Blinker format), LinkedIn, and more. Copy the text with one click.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-primary">5</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">Generate Images (Optional)</p>
                        <p className="text-sm">Create custom images to accompany your stories. Generate visuals that match your content style and brand.</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-foreground font-medium mb-2">✨ Everything is drag-and-drop friendly for the most user-friendly experience!</p>
                    <p className="text-xs text-muted-foreground">Your preferences are learned automatically as you use the platform - no manual setup required.</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    className="flex-1 h-12"
                  >
                    Skip Introduction
                  </Button>
                  <Button
                    onClick={() => {
                      localStorage.setItem('story_weaver_onboarding_seen', 'true');
                      router.push("/dashboard");
                    }}
                    className="flex-1 h-12 gradient-violet hover:opacity-90 text-white border-0"
                  >
                    Start Creating Stories
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Style Input */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-panel p-8 space-y-6"
              >
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-foreground">
                    Tell Us About Your Content Style
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Share a sample of your writing, describe your brand voice, or tell us what kind of content you create.
                    This helps us personalize stories for you.
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-1">
                    💡 <strong>Don't worry!</strong> You can skip this step - we'll learn your style automatically as you use the platform.
                  </p>

                  {/* Privacy Notice */}
                  <div className="mt-4 p-4 bg-secondary/50 border border-border rounded-lg space-y-2">
                    <p className="text-xs font-medium text-foreground">🔒 Privacy & Data Usage</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li><strong>Text Analysis:</strong> We analyze your writing style (tone, formality, emoji usage) to create personalized brand voices. We don't store your actual text content.</li>
                      <li><strong>PDF Processing:</strong> PDFs are processed locally on your machine using Docling. Only text chunks are extracted and stored in a local vector database for story generation.</li>
                      <li><strong>No Cloud Storage:</strong> Your documents and preferences are stored locally unless you configure Supabase (optional).</li>
                      <li><strong>Learning Data:</strong> When you like/dislike stories, we only store style patterns, not your actual content.</li>
                    </ul>
                  </div>
                </div>

                {/* Quick Prompt Templates */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">💡 Not sure what to write? Try one of these:</p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      {
                        label: "Business Professional",
                        text: "I create professional LinkedIn content for B2B SaaS companies. My style is concise, data-driven, and uses minimal emojis. I focus on actionable insights and thought leadership."
                      },
                      {
                        label: "Social Media Creator",
                        text: "I make viral social media content. I use lots of emojis, short punchy sentences, and engaging hooks. My audience loves relatable, funny, and shareable content."
                      },
                      {
                        label: "Educational Content",
                        text: "I write educational blog posts and tutorials. My style is clear, step-by-step, and beginner-friendly. I use examples and avoid jargon."
                      },
                      {
                        label: "Personal Brand",
                        text: "I share personal stories and experiences. My writing is authentic, emotional, and inspiring. I connect with my audience through vulnerability and relatability."
                      },
                      {
                        label: "Just Describe Your Content",
                        text: "I write about [your topic]. My audience is [who you write for]. I want my content to be [funny/serious/inspiring/etc.]."
                      }
                    ].map((template, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setUserInput(template.text)}
                        className="text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-sm"
                      >
                        <span className="font-medium text-foreground">{template.label}</span>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.text}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <Textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Or write your own description... 

Examples:
• 'I write about tech startups and use a casual, friendly tone'
• 'My content is professional and data-driven for business audiences'
• 'I create fun, emoji-rich posts for Gen Z on Instagram'
• 'I write educational content in a clear, simple style'

You can also just describe what you write about - we'll learn your style as you use the platform!"
                  className="min-h-[200px] bg-secondary/50 border-border focus:border-primary resize-none"
                />

                <p className="text-xs text-muted-foreground">
                  💡 <strong>Tip:</strong> Don't worry if you're not sure! You can skip this step and we'll learn your style automatically as you generate stories and provide feedback.
                </p>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1 h-12"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSkip}
                    variant="ghost"
                    className="h-12"
                  >
                    Skip
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!userInput.trim() || isProcessing}
                    className="flex-1 h-12 gradient-violet hover:opacity-90 text-white border-0 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Onboarding;

