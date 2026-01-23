import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface CreateSubBlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, prompt?: string) => void;
  isCreating?: boolean;
  initialName?: string;
  initialPrompt?: string;
  isEdit?: boolean;
}

export const CreateSubBlockDialog = ({
  isOpen,
  onClose,
  onCreate,
  isCreating = false,
  initialName = "",
  initialPrompt = "",
  isEdit = false,
}: CreateSubBlockDialogProps) => {
  const [name, setName] = useState(initialName);
  const [prompt, setPrompt] = useState(initialPrompt);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setPrompt(initialPrompt);
    }
  }, [isOpen, initialName, initialPrompt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), prompt.trim() || undefined);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-50 w-full max-w-md glass-panel border border-border rounded-2xl shadow-xl p-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">
              {isEdit ? "Edit Sub-Block" : "Create New Sub-Block"}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              disabled={isCreating}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Sub-Block Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q1 Campaign, Product Launch, etc."
                disabled={isCreating}
                autoFocus
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt" className="text-sm font-medium">
                Initial Prompt (Optional)
              </Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What story are we telling in this sub-block?"
                disabled={isCreating}
                className="min-h-[100px] bg-secondary/50 resize-none"
              />
              <p className="text-xs text-muted-foreground">
                You can add a prompt now or generate stories later
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isCreating}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || isCreating}
                className="flex-1 gradient-violet hover:opacity-90 text-white border-0 disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isEdit ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  isEdit ? "Update" : "Create"
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
