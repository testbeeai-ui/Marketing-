"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { TicketCheck } from "lucide-react";

export default function InviteCodeEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Please enter your invitation code");
      return;
    }
    router.push(`/invite/${encodeURIComponent(trimmed.toUpperCase())}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <TicketCheck className="w-6 h-6 text-primary" />
            <CardTitle>Enter invitation code</CardTitle>
          </div>
          <CardDescription>
            Paste the invitation code you received to join an organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="code">Invitation code</Label>
              <Input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. RDM-2026-DIGTV"
                className="font-mono uppercase"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full">
              Continue
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
