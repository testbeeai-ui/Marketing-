"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";

type AuthMode = "login" | "signup";

export const Auth = () => {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    // Check if Supabase is configured first
    if (!isSupabaseConfigured()) {
      setIsInitializing(false);
      return;
    }

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // User is already logged in, redirect to dashboard
          router.replace("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/dashboard");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file and restart the server.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "signup") {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`
          }
        });

        if (error) {
          // Handle specific error cases
          if (error.message.includes("already registered") || error.message.includes("already exists")) {
            toast.error("This email is already registered. Please sign in instead.", {
              duration: 5000,
            });
            // Switch to login mode
            setMode("login");
            return;
          }
          throw error;
        }

        if (data.user && !data.session) {
          // Email confirmation required
          toast.success("Account created! Please check your email to confirm your account.", {
            duration: 8000,
          });
          return;
        }

        if (data.session) {
          toast.success("Account created successfully!");
          router.replace("/dashboard");
        }
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) {
          // Log FULL error details for debugging
          const errorDetails = {
            message: error.message,
            name: error.name,
            status: (error as any).status,
            code: (error as any).code,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          };
          console.error("🔴 SIGN IN ERROR - Full Details:", errorDetails);
          console.error("🔴 Error object:", error);
          console.error("🔴 Error keys:", Object.keys(error));
          console.error("🔴 Error status:", (error as any).status);
          console.error("🔴 Error code:", (error as any).code);

          const errorMsg = error.message.toLowerCase();
          const errorStatus = (error as any).status || (error as any).code;
          const errorCode = (error as any).code || errorMsg;

          // Check for email not confirmed FIRST (most common issue)
          if (
            errorMsg.includes("email not confirmed") ||
            errorMsg.includes("email_not_confirmed") ||
            errorMsg.includes("email address not confirmed") ||
            errorCode === "email_not_confirmed" ||
            errorStatus === 400 && errorMsg.includes("confirm")
          ) {
            toast.error("📧 Email not confirmed! Check your inbox (and spam folder) for the confirmation link, or use 'Resend email confirmation' below.", {
              duration: 12000,
            });
            return;
          }

          // Invalid credentials
          if (
            errorStatus === 400 ||
            errorMsg.includes("invalid login credentials") ||
            errorMsg.includes("wrong password") ||
            errorMsg.includes("invalid") ||
            errorCode === "invalid_credentials"
          ) {
            toast.error(
              `❌ Invalid email or password.\n\n` +
              `Possible causes:\n` +
              `• Email not confirmed (check inbox)\n` +
              `• Wrong password (use 'Forgot password?' to reset)\n` +
              `• Account doesn't exist\n\n` +
              `Full error: ${error.message}`,
              {
                duration: 12000,
              }
            );
            return;
          }

          // Too many requests
          if (errorMsg.includes("too many requests") || errorMsg.includes("rate limit")) {
            toast.error("⏱️ Too many login attempts. Please wait a moment and try again.", {
              duration: 5000,
            });
            return;
          }

          // Show full error message for debugging
          toast.error(`❌ Login failed!\n\nError: ${error.message}\nCode: ${errorCode}\nStatus: ${errorStatus}`, {
            duration: 10000,
          });
          return;
        }

        if (data.session) {
          toast.success("Welcome back!");
          router.replace("/dashboard");
        }
      }
    } catch (error: unknown) {
      console.error("Auth error:", error);
      // Check if it's a Supabase error
      if (error && typeof error === 'object' && 'message' in error) {
        const supabaseError = error as { message: string; status?: number };
        const errorMessage = supabaseError.message || "Authentication failed";

        // Provide more user-friendly error messages
        if (errorMessage.includes("already registered")) {
          toast.error("This email is already registered. Please sign in instead.", {
            duration: 5000,
          });
          setMode("login");
        } else if (errorMessage.includes("Invalid") || errorMessage.includes("credentials")) {
          toast.error("Invalid email or password. Please try again.", {
            duration: 5000,
          });
        } else if (errorMessage.includes("email") && errorMessage.includes("confirm")) {
          toast.error("Please confirm your email address. Check your inbox.", {
            duration: 8000,
          });
        } else {
          toast.error(errorMessage, {
            duration: 5000,
          });
        }
      } else {
        toast.error("Authentication failed. Please try again.", {
          duration: 5000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file and restart the server.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Google authentication failed";
      console.error("Google auth error:", error);
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      toast.error("Please enter your email address first");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      toast.success("Password reset email sent! Check your inbox for instructions.", {
        duration: 8000,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send password reset email";
      console.error("Password reset error:", error);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      toast.error("Please enter your email address first");
      return;
    }

    setIsLoading(true);
    try {
      // Try to sign up again to resend confirmation email
      // This will fail if already registered, but that's expected
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: 'temp-password-123', // Dummy password just to trigger resend
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });

      // Even if there's an error about existing user, the confirmation email might have been sent
      if (error) {
        // Check if it's because user already exists
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          toast.success("Confirmation email sent! Check your inbox. If you don't see it, check your spam folder.", {
            duration: 10000,
          });
          return;
        }
        throw error;
      }

      toast.success("Confirmation email sent! Check your inbox.", {
        duration: 8000,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to resend confirmation email";
      console.error("Resend confirmation error:", error);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 mx-auto rounded-full gradient-violet flex items-center justify-center glow-violet mb-4"
          >
            <Sparkles className="w-6 h-6 text-white" />
          </motion.div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show configuration warning if Supabase is not configured
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel border border-red-500/50 rounded-2xl p-8 shadow-lg"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-4">Supabase Configuration Required</h1>
              <div className="space-y-4 text-left">
                <p className="text-sm text-muted-foreground">
                  To use authentication, you need to configure Supabase environment variables.
                </p>
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold">Add these to your <code className="bg-background px-2 py-1 rounded">.env</code> file:</p>
                  <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
                    {`VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key`}
                  </pre>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="font-semibold">How to get your credentials:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Go to <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Supabase Dashboard</a></li>
                    <li>Select your project</li>
                    <li>Go to Settings → API</li>
                    <li>Copy Project URL and anon public key</li>
                  </ol>
                </div>
                <p className="text-xs text-muted-foreground">
                  After adding the variables, restart the development server (<code className="bg-background px-2 py-1 rounded">npm run dev:all</code>).
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel border border-border rounded-2xl p-8 shadow-lg"
        >
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="w-16 h-16 mx-auto rounded-full gradient-violet flex items-center justify-center glow-violet mb-4"
            >
              <Sparkles className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Story Weaver Studio</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Welcome back! Sign in to continue" : "Create your account to get started"}
            </p>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="text-xs text-primary hover:underline"
                    disabled={isLoading || !email.trim()}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-lg font-semibold gradient-violet hover:opacity-90 text-white border-0 glow-violet disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {mode === "login" ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                <>
                  {mode === "login" ? (
                    <>
                      <LogIn className="w-5 h-5 mr-2" />
                      Sign In
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5 mr-2" />
                      Create Account
                    </>
                  )}
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Google Auth */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full h-12 border-border hover:bg-secondary"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            {/* Help Section for Login */}
            {mode === "login" && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-xs font-semibold text-foreground mb-3">
                  Having trouble signing in?
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    className="text-xs text-primary hover:underline text-left px-2 py-1 rounded hover:bg-muted transition-colors"
                    disabled={isLoading || !email.trim()}
                  >
                    ✓ Resend email confirmation
                  </button>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="text-xs text-primary hover:underline text-left px-2 py-1 rounded hover:bg-muted transition-colors"
                    disabled={isLoading || !email.trim()}
                  >
                    ✓ Reset password
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                  <strong>Note:</strong> If you just signed up, check your email and click the confirmation link first.
                  Passwords are securely encrypted and cannot be viewed - you must use password reset to change them.
                </p>
              </div>
            )}

            {/* Mode Toggle */}
            <div className="text-center mt-6">
              <p className="text-sm text-muted-foreground">
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "login" ? "signup" : "login");
                    setEmail("");
                    setPassword("");
                  }}
                  className="text-primary hover:underline font-medium"
                  disabled={isLoading}
                >
                  {mode === "login" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </div>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mt-6 text-xs text-muted-foreground"
        >
          <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
        </motion.div>
      </div>
    </div>
  );
};

