"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { XDeepDiveContent } from "@/components/storyteller/XDeepDiveContent";
import { LinkedInDeepDiveContent } from "@/components/storyteller/LinkedInDeepDiveContent";
import { InstagramDeepDiveContent } from "@/components/storyteller/InstagramDeepDiveContent";
import { FacebookDeepDiveContent } from "@/components/storyteller/FacebookDeepDiveContent";

export default function PlatformDeepDivePage() {
  const params = useParams();
  const platform = (params?.platform as string) || "";

  if (!["x", "linkedin", "instagram", "facebook"].includes(platform)) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="pt-24 pb-12 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-4">Platform not found</h1>
            <Button asChild variant="outline">
              <Link href="/storyteller">Back to StoryTeller</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (platform === "x") return <XDeepDiveContent />;
  if (platform === "linkedin") return <LinkedInDeepDiveContent />;
  if (platform === "instagram") return <InstagramDeepDiveContent />;
  if (platform === "facebook") return <FacebookDeepDiveContent />;

  return null;
}
