"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { blocksApi } from "@/lib/api";
import { motion } from "framer-motion";
import { BlockCard } from "@/components/dashboard/BlockCard";
import { BlockSkeleton } from "@/components/dashboard/BlockSkeleton";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { PUBLIC_DEMO_ORGANIZATION_ID } from "@/lib/constants";

export default function WorkspaceIndexPage() {
  const router = useRouter();
  const { activeOrganization, isDemoMode, loading } = useOrganization();
  const isDemoOrg = activeOrganization?.id === PUBLIC_DEMO_ORGANIZATION_ID;

  const isMemberInNonDemoOrg =
    activeOrganization?.role === "member" &&
    activeOrganization?.id !== PUBLIC_DEMO_ORGANIZATION_ID;

  useEffect(() => {
    if (!loading && isMemberInNonDemoOrg) {
      router.replace("/storyteller");
    }
  }, [loading, isMemberInNonDemoOrg, router]);

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['blocks', activeOrganization?.id],
    queryFn: () => blocksApi.getAll(activeOrganization!.id),
    enabled: !!activeOrganization?.id,
  });

  // If no blocks and not demo org, redirect to dashboard. For demo org, show empty state so new users can use "Link to my account".
  useEffect(() => {
    if (!isLoading && blocks.length === 0 && !isDemoOrg) {
      router.replace('/dashboard');
    }
  }, [blocks.length, isLoading, isDemoOrg, router]);

  // Demo users: land directly in the first block's workspace (main page for them). They cannot go back to "Select a Workspace" or dashboard.
  const firstBlockId = blocks[0]?.id;
  useEffect(() => {
    if (isDemoOrg && !isLoading && firstBlockId) {
      router.replace(`/workspace/${firstBlockId}`);
    }
  }, [isDemoOrg, isLoading, firstBlockId, router]);

  const handleBlockClick = (blockId: string) => {
    router.push(`/workspace/${blockId}`);
  };

  if (loading || isMemberInNonDemoOrg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{loading ? "Loading..." : "Redirecting..."}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-16 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-3">
              Select a Workspace
            </h1>
            <p className="text-lg text-muted-foreground">
              Choose a block to open its workspace
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <BlockSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (blocks.length === 0 && !isDemoOrg) {
    return null; // Will redirect
  }

  // Demo org with blocks: redirect to first block (they never see "Select a Workspace")
  if (isDemoOrg && blocks.length > 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Opening your workspace...</p>
        </div>
      </div>
    );
  }

  // Demo org with no blocks (e.g. before admin published): show empty state so new users see the org and can use "Link to my account"
  if (blocks.length === 0 && isDemoOrg) {
    return (
      <div className="min-h-screen bg-background pt-12 pb-16 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-3">
            {activeOrganization?.name ?? "Organization"}
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            No blocks in this organization yet. Use the organization menu to request access to create and edit content.
          </p>
          <div className="rounded-lg border border-border bg-muted/30 p-8 text-center text-muted-foreground">
            No workspace blocks to show yet.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-12 pb-16 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-3">
            Select a Workspace
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground">
            Choose a block to open its workspace and continue your work
          </p>
        </motion.div>

        {/* Blocks Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {blocks.map((block, index) => (
            <motion.div
              key={block.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: 0.15 + index * 0.08,
                type: "spring",
                stiffness: 100,
                damping: 15
              }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="h-full"
            >
              <BlockCard
                name={block.name}
                description={block.description}
                fileCount={block.fileCount}
                lastUpdated={block.lastUpdated}
                status={block.status}
                onClick={() => handleBlockClick(block.id)}
                onRename={() => {}}
                onModify={() => {}}
                onDelete={() => {}}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
