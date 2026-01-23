import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { toast } from "sonner";

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const LoginDialog = ({ isOpen, onClose, onSuccess }: LoginDialogProps) => {
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Auto-generate userId on mount (simple implementation)
  useEffect(() => {
    if (isOpen && !userId) {
      // Generate a simple user ID based on timestamp
      const generatedId = Math.floor(Date.now() / 1000);
      setUserId(generatedId.toString());
    }
  }, [isOpen, userId]);

  const handleLogin = async () => {
    if (!userId || isNaN(Number(userId))) {
      toast.error('Please enter a valid user ID');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.login(Number(userId));
      await authService.refreshProfile(); // Update local state
      toast.success('Welcome! Your preferences will be saved.');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoLogin = async () => {
    // Auto-login with generated ID
    const autoId = Math.floor(Date.now() / 1000);
    setIsLoading(true);
    try {
      const response = await authApi.login(autoId);
      await authService.refreshProfile();
      toast.success('Auto-logged in! Your preferences will be saved.');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to auto-login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm"
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md pointer-events-auto"
            >
              <div className="glass-panel p-8 glow-violet mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg gradient-violet flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Welcome</h2>
                      <p className="text-sm text-muted-foreground">
                        Login to save your preferences
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    We'll create a profile for you to save your style preferences and learn from your feedback.
                  </p>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      User ID (optional - we'll generate one for you)
                    </label>
                    <Input
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder="Auto-generated"
                      className="bg-secondary/50 border-border focus:border-primary h-12"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={isLoading}
                      className="flex-1 h-12 border-border hover:bg-secondary disabled:opacity-50"
                    >
                      Skip
                    </Button>
                    <Button
                      type="button"
                      onClick={handleAutoLogin}
                      disabled={isLoading}
                      className="flex-1 h-12 gradient-violet hover:opacity-90 text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Auto Login
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
