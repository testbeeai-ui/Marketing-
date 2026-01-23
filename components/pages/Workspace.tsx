"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { WorkspaceTabs } from "@/components/workspace/WorkspaceTabs";
import { SubBlockCard } from "@/components/workspace/SubBlockCard";
import { CreateSubBlockDialog } from "@/components/workspace/CreateSubBlockDialog";
import { KnowledgeBase } from "@/components/workspace/KnowledgeBase";
import { StoryEngine } from "@/components/workspace/StoryEngine";
import { SubBlockDetail } from "@/components/workspace/SubBlockDetail";
import { WorkspaceSkeleton } from "@/components/workspace/WorkspaceSkeleton";
import { blocksApi, filesApi, subBlocksApi, type FileItem, type SubBlock } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProcessingFile {
  id: string;
  name: string;
  status: "uploading" | "processing" | "indexing" | "completed" | "error";
  progress?: number;
}

const Workspace = () => {
  const params = useParams();
  const blockId = params?.blockId as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: block, isLoading, isError } = useQuery({
    queryKey: ['blocks', blockId],
    queryFn: () => blocksApi.getById(blockId!),
    enabled: !!blockId,
  });

  const { data: subBlocks = [], refetch: refetchSubBlocks } = useQuery({
    queryKey: ['sub-blocks', blockId],
    queryFn: () => subBlocksApi.getByBlockId(blockId!),
    enabled: !!blockId,
  });

  const [tabs, setTabs] = useState<Array<{ id: string; name: string }>>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [activeSubBlockId, setActiveSubBlockId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "detail" | "input">("cards");
  const [processingFiles, setProcessingFiles] = useState<ProcessingFile[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSubBlock, setSelectedSubBlock] = useState<SubBlock | null>(null);

  useEffect(() => {
    if (block) {
      const tab = { id: block.id, name: block.name };
      setTabs([tab]);
      setActiveTabId(block.id);
    }
  }, [block]);

  // Update view mode based on sub-blocks and selection
  useEffect(() => {
    if (activeSubBlockId) {
      const selectedSubBlock = subBlocks.find(sb => sb.id === activeSubBlockId);
      if (selectedSubBlock && selectedSubBlock.storyVariations && selectedSubBlock.storyVariations.length > 0) {
        setViewMode("detail");
      } else {
        setViewMode("input");
      }
    } else {
      setViewMode("cards");
    }
  }, [activeSubBlockId, subBlocks]);

  const handleTabClose = (id: string) => {
    if (tabs.length === 1) {
      router.push("/");
      return;
    }
    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const { data: files = [] } = useQuery({
    queryKey: ['files', blockId],
    queryFn: () => filesApi.list(blockId!),
    enabled: !!blockId,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, blockId, fileId }: { file: File; blockId: string; fileId: string }) =>
      filesApi.upload(file, blockId),
    onMutate: ({ fileId, file }) => {
      // Set status to uploading
      setProcessingFiles((prev) => [
        ...prev,
        { id: fileId, name: file.name, status: "uploading", progress: 0 },
      ]);

      // Simulate upload progress
      setTimeout(() => {
        setProcessingFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: "processing", progress: 30 } : f
          )
        );
      }, 300);

      setTimeout(() => {
        setProcessingFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: "indexing", progress: 70 } : f
          )
        );
      }, 800);
    },
    onSuccess: (data, variables) => {
      console.log('[Workspace] Upload successful for file:', variables.file.name, data);

      // Mark as completed
      setProcessingFiles((prev) =>
        prev.map((f) =>
          f.id === variables.fileId
            ? { ...f, status: "completed", progress: 100 }
            : f
        )
      );

      // Increment completed count
      setCompletedCount((prev) => prev + 1);

      // Show success toast
      toast.success(`File "${variables.file.name}" uploaded successfully`, {
        duration: 3000,
      });

      // Remove from processing after 2 seconds
      setTimeout(() => {
        setProcessingFiles((prev) => prev.filter((f) => f.id !== variables.fileId));
      }, 2000);

      queryClient.invalidateQueries({ queryKey: ['files', blockId] });
      queryClient.invalidateQueries({ queryKey: ['blocks', blockId] });
    },
    onError: (error: Error, variables) => {
      console.error('[Workspace] Upload error for file:', variables.file.name, error);
      // Mark as error
      setProcessingFiles((prev) =>
        prev.map((f) =>
          f.id === variables.fileId ? { ...f, status: "error" } : f
        )
      );

      // Remove from processing after 5 seconds (longer to see the error)
      setTimeout(() => {
        setProcessingFiles((prev) => prev.filter((f) => f.id !== variables.fileId));
      }, 5000);

      const errorMessage = error.message || 'Failed to upload file';
      console.error('[Workspace] Error message:', errorMessage);
      toast.error(errorMessage, {
        duration: 5000,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: filesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', blockId] });
      queryClient.invalidateQueries({ queryKey: ['blocks', blockId] });
      toast.success('File deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete file');
    },
  });

  const handleFileUpload = async (fileList: FileList) => {
    console.log('[Workspace] handleFileUpload called with', fileList.length, 'files');
    if (!blockId) {
      console.error('[Workspace] No blockId, cannot upload files');
      toast.error('No block selected. Please select a block first.');
      return;
    }

    const filesToUpload = Array.from(fileList);
    console.log('[Workspace] Uploading', filesToUpload.length, 'files to block:', blockId);
    setCompletedCount(0); // Reset completed count for new batch

    // Upload files sequentially with unique IDs
    filesToUpload.forEach((file, index) => {
      const fileId = `${Date.now()}-${index}-${file.name}`;
      console.log('[Workspace] Starting upload for file:', file.name, 'with ID:', fileId);
      uploadMutation.mutate({ file, blockId, fileId });
    });
  };

  const handleFileDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const createSubBlockMutation = useMutation({
    mutationFn: ({ name, prompt }: { name: string; prompt?: string }) =>
      subBlocksApi.create(blockId!, name, prompt),
    onSuccess: (subBlock) => {
      queryClient.invalidateQueries({ queryKey: ['sub-blocks', blockId] });
      setIsCreateDialogOpen(false);
      toast.success("Sub-block created successfully");
      setActiveSubBlockId(subBlock.id);
      setViewMode("input");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create sub-block");
    },
  });

  const updateSubBlockMutation = useMutation({
    mutationFn: ({ id, name, prompt }: { id: string; name: string; prompt?: string }) =>
      subBlocksApi.update(id, { name, prompt: prompt || "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-blocks', blockId] });
      setIsEditDialogOpen(false);
      setSelectedSubBlock(null);
      toast.success("Sub-block updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update sub-block");
    },
  });

  const handleSubBlockCreate = (name: string, prompt?: string) => {
    createSubBlockMutation.mutate({ name, prompt });
  };

  const handleSubBlockModify = (subBlock: SubBlock) => {
    setSelectedSubBlock(subBlock);
    setIsEditDialogOpen(true);
  };

  const handleSubBlockUpdate = (name: string, prompt?: string) => {
    if (selectedSubBlock) {
      // Note: The current API doesn't support updating the name
      // We'll update the prompt for now
      updateSubBlockMutation.mutate({ id: selectedSubBlock.id, name, prompt });
    }
  };

  const handleSubBlockDelete = async (subBlockId: string) => {
    try {
      await subBlocksApi.delete(subBlockId);
      queryClient.invalidateQueries({ queryKey: ['sub-blocks', blockId] });
      if (activeSubBlockId === subBlockId) {
        setActiveSubBlockId(null);
        setViewMode("cards");
      }
      toast.success("Sub-block deleted");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete sub-block";
      toast.error(errorMessage);
    }
  };

  const handleSubBlockClick = (subBlockId: string) => {
    setActiveSubBlockId(subBlockId);
    const selectedSubBlock = subBlocks.find(sb => sb.id === subBlockId);
    if (selectedSubBlock && selectedSubBlock.storyVariations && selectedSubBlock.storyVariations.length > 0) {
      setViewMode("detail");
    } else {
      setViewMode("input");
    }
  };

  const readyFilesCount = block?.fileCount || 0;
  const usagePercent = Math.min(Math.round((readyFilesCount / 20) * 100), 100);

  if (isLoading) {
    return <WorkspaceSkeleton />;
  }

  if (isError || !block) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-500 font-medium">Error loading workspace</p>
          <p className="text-muted-foreground text-sm">
             The block could not be found or you don't have permission to access it.
          </p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background flex flex-col"
    >
      <Navbar />

      <div className="pt-16 flex-1 flex flex-col">
        <WorkspaceTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onTabClick={setActiveTabId}
          onTabClose={handleTabClose}
        />

        <div className="flex-1 flex overflow-hidden">
          {/* Knowledge Base Sidebar */}
          <div className="w-80 border-r border-border flex-shrink-0">
            <KnowledgeBase
              files={files}
              onFileUpload={handleFileUpload}
              onFileDelete={handleFileDelete}
              usagePercent={usagePercent}
              processingFiles={processingFiles}
              completedCount={completedCount}
              totalProcessing={processingFiles.length}
            />
          </div>

          {/* Story Engine Main Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
              {viewMode === "cards" ? (
                // Show sub-blocks as cards
                <div className="h-full overflow-y-auto p-6 flex flex-col">
                  {/* Header with Create Button */}
                  <div className="flex items-center justify-between mb-6 flex-shrink-0">
                    <div>
                      <h2 className="text-2xl font-semibold text-foreground">Sub-Blocks</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Organize your stories and platform formats
                      </p>
                    </div>
                    <Button
                      onClick={() => setIsCreateDialogOpen(true)}
                      className="gradient-violet hover:opacity-90 text-white border-0"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New Sub-Block
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {subBlocks.length === 0 ? (
                      // Empty state
                      <div className="h-full flex items-center justify-center min-h-[400px]">
                        <div className="text-center space-y-4 max-w-md">
                          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                            <Plus className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold mb-2">No sub-blocks yet</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              Create your first sub-block to organize your stories and platform formats.
                            </p>
                            <p className="text-xs text-muted-foreground mb-4">
                              You can also start generating stories - a sub-block will be created automatically.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Sub-blocks grid - responsive with proper spacing
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-fr">
                        {subBlocks.map((subBlock) => (
                          <SubBlockCard
                            key={subBlock.id}
                            subBlock={subBlock}
                            onClick={() => handleSubBlockClick(subBlock.id)}
                            onDelete={() => handleSubBlockDelete(subBlock.id)}
                            onModify={() => handleSubBlockModify(subBlock)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : viewMode === "detail" && activeSubBlockId ? (
                // Show sub-block detail view
                <SubBlockDetail
                  subBlock={subBlocks.find(sb => sb.id === activeSubBlockId)!}
                  blockId={blockId!}
                  linkedDocuments={readyFilesCount}
                  onBack={() => {
                    setActiveSubBlockId(null);
                    setViewMode("cards");
                  }}
                  onGenerateNew={() => {
                    setViewMode("input");
                  }}
                />
              ) : (
                // Show story input/generation
                <StoryEngine
                  key={activeSubBlockId || "no-sub-block"}
                  blockId={blockId!}
                  linkedDocuments={readyFilesCount}
                  subBlockId={activeSubBlockId || undefined}
                  showBackButton={!!activeSubBlockId}
                  onBack={() => {
                    setActiveSubBlockId(null);
                    setViewMode("cards");
                  }}
                  onStoriesGenerated={() => {
                    // After stories are generated, switch to detail view
                    queryClient.invalidateQueries({ queryKey: ['sub-blocks', blockId] });
                    setTimeout(() => {
                      setViewMode("detail");
                    }, 500);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Sub-Block Dialog */}
      <CreateSubBlockDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleSubBlockCreate}
        isCreating={createSubBlockMutation.isPending}
      />

      {/* Edit Sub-Block Dialog */}
      <CreateSubBlockDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSelectedSubBlock(null);
        }}
        onCreate={handleSubBlockUpdate}
        isCreating={updateSubBlockMutation.isPending}
        initialName={selectedSubBlock?.name || ""}
        initialPrompt={selectedSubBlock?.prompt || ""}
        isEdit={true}
      />
    </motion.div>
  );
};

export default Workspace;

