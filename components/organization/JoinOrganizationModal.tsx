"use client";

import { useState } from "react";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface JoinOrganizationModalProps {
  open: boolean;
  onClose: () => void;
}

export function JoinOrganizationModal({
  open,
  onClose,
}: JoinOrganizationModalProps) {
  const { refreshOrganizations } = useOrganization();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) {
      toast.error("Please enter an invitation code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/organizations/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_code: code.toUpperCase().trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Joined ${data.organization.name}!`);
        await refreshOrganizations();
        setCode("");
        onClose();
      } else {
        toast.error(data.error || "Invalid invitation code");
      }
    } catch (error) {
      console.error("Error joining organization:", error);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setCode("");
        onClose();
      }
    }}>
      <DialogContent className="z-[100] max-w-md">
        <DialogHeader>
          <DialogTitle>Join Organization</DialogTitle>
          <DialogDescription>
            Enter an invitation code to join an organization. You can get this code from your team admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="invite-code">Invitation Code</Label>
            <Input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="RDM-2025-ABC123"
              className="font-mono"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.trim()) {
                  handleJoin();
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter the code provided by your organization admin
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleJoin} disabled={loading || !code.trim()}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Joining...
              </>
            ) : (
              "Join Organization"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
