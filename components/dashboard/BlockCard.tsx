import { motion } from "framer-motion";
import { FileText, Clock, Plus, Edit, Trash2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface BlockCardProps {
  name: string;
  description?: string;
  fileCount: number;
  lastUpdated: string;
  status: "ready" | "indexing";
  onClick: () => void;
  onRename?: () => void;
  onModify?: () => void;
  onDelete?: () => void;
}

export const BlockCard = ({
  name,
  description,
  fileCount,
  lastUpdated,
  status,
  onClick,
  onRename,
  onModify,
  onDelete,
}: BlockCardProps) => {
  const handleContextMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleMenuItemClick = (e: React.MouseEvent, action?: () => void) => {
    e.stopPropagation();
    action?.();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          whileHover={{ y: -4, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClick}
          className="glass-panel-hover p-6 cursor-pointer group relative overflow-hidden"
        >
      {/* Status indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {status === "ready" ? "Ready" : "Indexing"}
        </span>
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full",
            status === "ready" ? "status-ready" : "status-indexing animate-pulse"
          )}
        />
      </div>

      {/* Content */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground group-hover:text-gradient-blue transition-colors">
          {name}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}

        <div className="flex items-center gap-4 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="w-3.5 h-3.5" />
            <span>{fileCount} files</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>{lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
      </div>
      </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent onClick={handleContextMenuClick} className="w-48">
        <ContextMenuItem
          onClick={(e) => handleMenuItemClick(e, onRename)}
          className="cursor-pointer"
        >
          <Edit className="w-4 h-4 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          onClick={(e) => handleMenuItemClick(e, onModify)}
          className="cursor-pointer"
        >
          <MoreVertical className="w-4 h-4 mr-2" />
          Modify
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={(e) => handleMenuItemClick(e, onDelete)}
          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export const CreateBlockCard = ({ onClick }: { onClick: () => void }) => {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glass-panel p-6 cursor-pointer group border-dashed border-2 border-border hover:border-primary/50 transition-all min-h-[180px] flex flex-col items-center justify-center gap-4"
    >
      <motion.div
        whileHover={{ rotate: 90 }}
        transition={{ duration: 0.3 }}
        className="w-14 h-14 rounded-full border-2 border-dashed border-muted-foreground group-hover:border-primary flex items-center justify-center transition-colors"
      >
        <Plus className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
      </motion.div>
      <div className="text-center">
        <p className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          Create New Block
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Start a new context workspace
        </p>
      </div>
    </motion.div>
  );
};
