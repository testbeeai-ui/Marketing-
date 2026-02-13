"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Copy, Check } from "lucide-react";

interface CreateInvitationDialogProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
}

export function CreateInvitationDialog({
  open,
  onClose,
  organizationId,
  organizationName,
}: CreateInvitationDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [invitationCode, setInvitationCode] = useState<string | null>(null);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Invitation sent to ${email}`);
        setInvitationCode(data.invitation_code);
        setInvitationUrl(data.invite_url);
        setEmail("");
      } else {
        toast.error(data.error || "Failed to send invitation");
      }
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast.error("Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setEmail("");
    setRole("member");
    setInvitationCode(null);
    setInvitationUrl(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation email to join <strong>{organizationName}</strong>. They'll receive a link to set up their account.
          </DialogDescription>
        </DialogHeader>

        {!invitationCode ? (
          <>
            <div className="space-y-4">
              <div>
                <Label htmlFor="invite-email">Email Address *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  disabled={sending}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  They'll receive an email with a signup link
                </p>
              </div>

              <div>
                <Label htmlFor="invite-role">Role</Label>
                <Select value={role} onValueChange={setRole} disabled={sending}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending || !email.trim()}>
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Invitation sent!</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Share this code or link with the team member:
                </p>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Invitation Code</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={invitationCode}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyToClipboard(invitationCode)}
                      >
                        {copied ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {invitationUrl && (
                    <div>
                      <Label className="text-xs">Invitation Link</Label>
                      <div className="flex gap-2 mt-1">
                        <Input value={invitationUrl} readOnly className="text-xs" />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyToClipboard(invitationUrl)}
                        >
                          {copied ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
