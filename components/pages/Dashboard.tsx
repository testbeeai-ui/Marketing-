"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { BlockCard, CreateBlockCard } from "@/components/dashboard/BlockCard";
import { BlockSkeleton } from "@/components/dashboard/BlockSkeleton";
import { CreateBlockDialog } from "@/components/dashboard/CreateBlockDialog";
import { EditBlockDialog } from "@/components/dashboard/EditBlockDialog";
import { CacheCleanupBanner } from "@/components/CacheCleanupBanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { blocksApi, type Block } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { DemoRestrictionDialog } from "@/components/DemoRestrictionDialog";

const Dashboard = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeOrganization, isDemoMode } = useOrganization();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showDemoRestriction, setShowDemoRestriction] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("");

  // Get current user and their name
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          // Get name from user_metadata, or fallback to email username
          const name =
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.user_metadata?.display_name ||
            session.user.email?.split('@')[0] ||
            'User';
          setUserName(name);
        }
      } catch (error) {
        console.error("Error getting user:", error);
        setUserName("User");
      }
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        const name =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.user_metadata?.display_name ||
          session.user.email?.split('@')[0] ||
          'User';
        setUserName(name);
      } else {
        setUser(null);
        setUserName("");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const { data: blocks = [], isLoading, error: fetchError } = useQuery({
    queryKey: ['blocks', activeOrganization?.id],
    queryFn: () => {
      if (!activeOrganization?.id) {
        throw new Error('No active organization');
      }
      return blocksApi.getAll(activeOrganization.id);
    },
    enabled: !!activeOrganization?.id,
    retry: 2,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) => {
      if (!activeOrganization?.id) {
        throw new Error('No active organization');
      }
      return blocksApi.create(name, description, activeOrganization.id);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['blocks', activeOrganization?.id] });
      setIsDialogOpen(false);
      toast.success('Block created successfully!', {
        description: `"${data.name}" is ready to use.`,
      });
    },
    onError: (error: Error) => {
      console.error('Error creating block:', error);
      const errorMessage = error.message || 'Please check your connection and try again.';
      toast.error('Failed to create block', {
        description: errorMessage,
        duration: 5000,
      });
    },
    onSettled: () => {
      // This runs whether success or error - allows dialog to close/reset
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description: string }) => {
      if (!activeOrganization?.id) {
        throw new Error('No active organization');
      }
      return blocksApi.update(id, name, description, activeOrganization.id);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['blocks', activeOrganization?.id] });
      setIsEditDialogOpen(false);
      setSelectedBlock(null);
      toast.success('Block updated successfully!', {
        description: `"${data.name}" has been updated.`,
      });
    },
    onError: (error: Error) => {
      console.error('Error updating block:', error);
      const errorMessage = error.message || 'Please check your connection and try again.';
      toast.error('Failed to update block', {
        description: errorMessage,
        duration: 5000,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!activeOrganization?.id) {
        throw new Error('No active organization');
      }
      return blocksApi.delete(id, activeOrganization.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', activeOrganization?.id] });
      setIsDeleteDialogOpen(false);
      setSelectedBlock(null);
      toast.success('Block deleted successfully!', {
        description: 'The block and all its data have been removed.',
      });
    },
    onError: (error: Error) => {
      console.error('Error deleting block:', error);
      const errorMessage = error.message || 'Please check your connection and try again.';
      toast.error('Failed to delete block', {
        description: errorMessage,
        duration: 5000,
      });
    },
  });

  const handleCreateBlock = (name: string, description: string) => {
    if (!name.trim()) {
      toast.error('Block name is required', {
        description: 'Please enter a name for your block.',
      });
      return;
    }
    createMutation.mutate({ name: name.trim(), description: description.trim() });
  };

  // Show error if fetching blocks fails
  if (fetchError) {
    toast.error('Failed to load blocks', {
      description: 'Please refresh the page or check your connection.',
    });
  }

  const handleBlockClick = (block: Block) => {
    router.push(`/workspace/${block.id}`);
  };

  const handleRename = (block: Block) => {
    setSelectedBlock(block);
    setIsEditDialogOpen(true);
  };

  const handleModify = (block: Block) => {
    setSelectedBlock(block);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (block: Block) => {
    setSelectedBlock(block);
    setIsDeleteDialogOpen(true);
  };

  const handleEditSave = (name: string, description: string) => {
    if (selectedBlock) {
      updateMutation.mutate({ id: selectedBlock.id, name, description });
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedBlock) {
      deleteMutation.mutate(selectedBlock.id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-12 pb-16 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Cache Cleanup Banner */}
          <CacheCleanupBanner />

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-16"
          >
            <div className="space-y-2">
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground">
                Welcome back, <span className="text-gradient-blue">{userName || "User"}</span>
              </h1>
              <p className="text-lg lg:text-xl text-muted-foreground">
                Select a Context Block to continue your work
              </p>
            </div>
          </motion.div>

          {/* Grid with improved spacing and visual balance */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
          >
            <CreateBlockCard
              onClick={() => {
                if (isDemoMode) setShowDemoRestriction(true);
                else setIsDialogOpen(true);
              }}
            />
            {isLoading ? (
              // Show skeletons while loading
              Array.from({ length: 3 }).map((_, i) => (
                <BlockSkeleton key={i} />
              ))
            ) : blocks.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No blocks yet. Create your first block to get started!
              </div>
            ) : (
              blocks.map((block, index) => (
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
                    onClick={() => handleBlockClick(block)}
                    onRename={() => handleRename(block)}
                    onModify={() => handleModify(block)}
                    onDelete={() => handleDelete(block)}
                  />
                </motion.div>
              ))
            )}
          </motion.div>
        </div>
      </main>

      <DemoRestrictionDialog
        open={showDemoRestriction}
        onOpenChange={setShowDemoRestriction}
      />
      <CreateBlockDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onCreate={handleCreateBlock}
        isCreating={createMutation.isPending}
      />

      <EditBlockDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedBlock(null);
        }}
        onSave={handleEditSave}
        initialName={selectedBlock?.name || ""}
        initialDescription={selectedBlock?.description || ""}
        isSaving={updateMutation.isPending}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Block</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedBlock?.name}"? This action cannot be undone and will permanently delete the block and all associated files, stories, and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;

