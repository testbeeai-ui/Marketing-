"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DemoRestrictionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function DemoRestrictionDialog({
  open,
  onOpenChange,
  title = "Request access to create content",
  description = "You're viewing the demo. To create blocks, generate content, and use the full platform, request access. Share your social handles so we can get you set up.",
}: DemoRestrictionDialogProps) {
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim() || undefined,
          details: {
            linkedin: linkedin.trim() || undefined,
            twitter: twitter.trim() || undefined,
            instagram: instagram.trim() || undefined,
            facebook: facebook.trim() || undefined,
            company_name: companyName.trim() || undefined,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || "Failed to submit request");
        return;
      }
      toast.success(data.message || "Request submitted. We'll be in touch.");
      onOpenChange(false);
      setLinkedin("");
      setTwitter("");
      setInstagram("");
      setFacebook("");
      setCompanyName("");
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid gap-2">
            <Label htmlFor="company">Company / practice name (optional)</Label>
            <Input
              id="company"
              placeholder="Acme Inc."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Social media handles (optional)</Label>
            <Input
              placeholder="LinkedIn profile or handle"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
            />
            <Input
              placeholder="Twitter / X handle"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
            />
            <Input
              placeholder="Instagram handle"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />
            <Input
              placeholder="Facebook page or profile"
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Tell us about your marketing goals..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
                </>
              ) : (
                "Submit request"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
