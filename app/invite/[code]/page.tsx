"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";

type Step = "confirm_email" | "password" | "create_account";

export default function InviteSignupPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string)?.toUpperCase();

  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("confirm_email");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Fetch invitation details
  useEffect(() => {
    async function fetchInvitation() {
      if (!code) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("organization_invitations")
          .select("*, organization:organizations(name, id)")
          .eq("invitation_code", code)
          .eq("status", "pending")
          .single();

        if (error || !data) {
          toast.error("Invalid or expired invitation code");
          setTimeout(() => router.push("/auth"), 2000);
          setLoading(false);
          return;
        }

        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          toast.error("This invitation has expired");
          setTimeout(() => router.push("/auth"), 2000);
          setLoading(false);
          return;
        }

        setInvitation(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching invitation:", error);
        toast.error("Failed to load invitation");
        setTimeout(() => router.push("/auth"), 2000);
        setLoading(false);
      }
    }

    fetchInvitation();
  }, [code, router]);

  const redirectAfterJoin = (role: string) => {
    if (role === "member") {
      router.push("/storyteller");
    } else {
      router.push("/dashboard");
    }
  };

  const handleJoinAndRedirect = async () => {
    if (!invitation) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/organizations/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_code: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error?.includes("Already a member")) {
          toast.success("You're already a member.");
          redirectAfterJoin(invitation.role || "member");
          return;
        }
        toast.error(data.error || "Failed to join organization");
        setSubmitting(false);
        return;
      }
      toast.success(`Welcome! You've joined ${invitation.organization.name}`);
      redirectAfterJoin(invitation.role || "member");
    } catch (error) {
      console.error("Join error:", error);
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation?.email || !password.trim()) {
      toast.error("Please enter your password");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: invitation.email.trim(),
        password: password.trim(),
      });

      if (error) {
        if (error.message.toLowerCase().includes("invalid login") || error.message.toLowerCase().includes("invalid credentials")) {
          setStep("create_account");
          setPassword("");
          setConfirmPassword("");
          toast.info("No account found for this email. Create one below.");
        } else {
          toast.error(error.message);
        }
        setSubmitting(false);
        return;
      }

      await handleJoinAndRedirect();
    } catch (err) {
      console.error("Sign in error:", err);
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation?.email) return;
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email.trim(),
        password: password,
        options: {
          emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/dashboard`,
        },
      });

      if (authError) {
        toast.error(authError.message);
        setSubmitting(false);
        return;
      }

      if (!authData.user) {
        toast.error("Failed to create account");
        setSubmitting(false);
        return;
      }

      const userId = authData.user.id;

      await supabase.from("user_profiles").insert({
        user_id: userId,
        email: invitation.email.trim(),
      });

      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: invitation.organization.id,
          user_id: userId,
          role: invitation.role || "member",
        });

      if (memberError) {
        toast.error("Failed to join organization");
        setSubmitting(false);
        return;
      }

      await supabase
        .from("organization_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          uses_count: (invitation.uses_count || 0) + 1,
        })
        .eq("id", invitation.id);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email.trim(),
        password: password,
      });

      if (signInError) {
        toast.error("Account created. Please log in.");
        router.push("/auth");
        setSubmitting(false);
        return;
      }

      toast.success(`Welcome! You've joined ${invitation.organization.name}`);
      redirectAfterJoin(invitation.role || "member");
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation code is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/auth")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No email on invitation: fallback to simple message or auth
  if (!invitation.email || !invitation.email.trim()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation has no email</CardTitle>
            <CardDescription>
              This invitation does not specify an email. Please contact the person who invited you or use the login page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/auth")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const orgName = invitation.organization?.name ?? "the organization";
  const invitedEmail = invitation.email.trim();

  // Step: Confirm email
  if (step === "confirm_email") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-6 h-6 text-primary" />
              <CardTitle>Is this your email?</CardTitle>
            </div>
            <CardDescription>
              You've been invited to join <strong className="text-foreground">{orgName}</strong>. This invitation is for:
            </CardDescription>
            <p className="font-medium text-foreground mt-2">{invitedEmail}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setStep("password")}
              className="w-full"
            >
              Yes, continue
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                toast.error(`This invitation is only for ${invitedEmail}. Please use that email or request a new invitation.`);
              }}
              className="w-full"
            >
              No
            </Button>
            <p className="text-center">
              <button
                type="button"
                onClick={() => router.push("/auth")}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Back to login
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step: Password (sign in)
  if (step === "password") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Enter your password</CardTitle>
            <CardDescription>
              Sign in with your account for <strong className="text-foreground">{invitedEmail}</strong> to join {orgName}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={submitting}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in & join"
                )}
              </Button>
              <p className="text-center">
                <button
                  type="button"
                  onClick={() => setStep("confirm_email")}
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                >
                  Back
                </button>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step: Create account (no account found)
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            No account found for <strong className="text-foreground">{invitedEmail}</strong>. Create one to join {orgName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateAccountSubmit} className="space-y-4">
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                minLength={8}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground mt-1">Must be at least 8 characters</p>
            </div>
            <div>
              <Label>Confirm password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                disabled={submitting}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account & join"
              )}
            </Button>
            <p className="text-center">
              <button
                type="button"
                onClick={() => setStep("password")}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Back to sign in
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
