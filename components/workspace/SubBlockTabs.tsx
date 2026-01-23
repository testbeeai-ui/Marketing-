import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { subBlocksApi, type SubBlock } from "@/lib/api";
import { toast } from "sonner";

interface SubBlockTabsProps {
  subBlocks: SubBlock[];
  activeSubBlockId: string | null;
  onSubBlockClick: (subBlockId: string | null) => void;
  onSubBlockCreate: (subBlock: SubBlock) => void;
  onSubBlockDelete: (subBlockId: string) => void;
  blockId: string;
}

// Export function to open create dialog (for external triggers)
let openCreateDialogFn: (() => void) | null = null;

export const SubBlockTabs = ({
  subBlocks,
  activeSubBlockId,
  onSubBlockClick,
  onSubBlockCreate,
  onSubBlockDelete,
  blockId,
}: SubBlockTabsProps) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSubBlockName, setNewSubBlockName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Expose function to open dialog
  useEffect(() => {
    openCreateDialogFn = () => setIsCreateDialogOpen(true);
    return () => {
      openCreateDialogFn = null;
    };
  }, []);

  const handleCreate = async () => {
    if (!newSubBlockName.trim()) {
      toast.error("Please enter a name for the sub-block");
      return;
    }

    setIsCreating(true);
    try {
      const subBlock = await subBlocksApi.create(blockId, newSubBlockName.trim());
      onSubBlockCreate(subBlock);
      setIsCreateDialogOpen(false);
      setNewSubBlockName("");
      toast.success("Sub-block created successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to create sub-block");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (subBlockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await subBlocksApi.delete(subBlockId);
      onSubBlockDelete(subBlockId);
      toast.success("Sub-block deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete sub-block");
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 overflow-x-auto">
        {/* New Sub-Block Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex-shrink-0 h-8 px-3 gap-2 hover:bg-primary/10"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs font-medium">New</span>
        </Button>

        {/* Sub-Block Tabs */}
        {subBlocks.map((subBlock) => {
          const isActive = activeSubBlockId === subBlock.id;
          return (
            <motion.div
              key={subBlock.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all flex-shrink-0 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-muted-foreground"
              }`}
              onClick={() => onSubBlockClick(subBlock.id)}
            >
              <span className="text-xs font-medium truncate max-w-[120px]">{subBlock.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className={`h-5 w-5 hover:bg-transparent ${
                  isActive ? "hover:text-primary-foreground/80" : "hover:text-foreground"
                }`}
                onClick={(e) => handleDelete(subBlock.id, e)}
              >
                <X className="w-3 h-3" />
              </Button>
            </motion.div>
          );
        })}
      </div>

      {/* Create Sub-Block Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Sub-Block</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Sub-Block Name</label>
              <Input
                value={newSubBlockName}
                onChange={(e) => setNewSubBlockName(e.target.value)}
                placeholder="e.g., Q1 Campaign, Product Launch, etc."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating) {
                    handleCreate();
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-2">
                Sub-blocks help organize your stories and platform formats
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newSubBlockName.trim() || isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Export function to programmatically open create dialog
export const openSubBlockCreateDialog = () => {
  if (openCreateDialogFn) {
    openCreateDialogFn();
  }
};
