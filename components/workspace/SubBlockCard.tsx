import { motion } from "framer-motion";
import { FileText, Sparkles, Calendar, MoreVertical, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { type SubBlock } from "@/lib/api";
// Simple date formatting function
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

const getPlatformEntriesForVariation = (contents: Record<string, string> | undefined, variationId?: string): [string, string][] => {
  if (!contents) return [];
  const hasAnyPrefixed = Object.keys(contents).some(key => key.includes('.'));
  if (!variationId) {
    return hasAnyPrefixed ? [] : Object.entries(contents);
  }
  const prefix = `${variationId}.`;
  const prefixed = Object.entries(contents)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, value]) => [key.slice(prefix.length), value] as [string, string]);
  if (prefixed.length > 0) return prefixed;
  if (hasAnyPrefixed) return [];
  return Object.entries(contents).filter(([key]) => !key.includes('.'));
};

interface SubBlockCardProps {
  subBlock: SubBlock;
  onClick: () => void;
  onDelete: () => void;
  onModify?: () => void;
}

export const SubBlockCard = ({ subBlock, onClick, onDelete, onModify }: SubBlockCardProps) => {
  const hasStories = subBlock.storyVariations && subBlock.storyVariations.length > 0;
  const platformEntries = getPlatformEntriesForVariation(subBlock.platformContents, subBlock.selectedVariationId);
  const platformEntryCount = platformEntries.filter(([key]) => key !== 'imagePrompt' && key !== 'imageContext' && key !== 'image').length;
  const hasPlatformContents = platformEntryCount > 0;
  const selectedVariation = subBlock.storyVariations?.find(v => v.id === subBlock.selectedVariationId);

  const handleContextMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleMenuItemClick = (e: React.MouseEvent, action?: () => void) => {
    e.stopPropagation();
    action?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="h-full min-h-[280px]"
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Card
            className="cursor-pointer hover:border-primary transition-all h-full flex flex-col group min-h-[280px]"
            onClick={onClick}
          >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg mb-1 truncate group-hover:text-primary transition-colors">
                {subBlock.name}
              </h3>
              {subBlock.prompt && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {subBlock.prompt}
                </p>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col">
          {/* Status Indicators */}
          <div className="space-y-2 mb-4">
            {hasStories ? (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">
                  {subBlock.storyVariations.length} story variation{subBlock.storyVariations.length > 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-muted" />
                <span className="text-muted-foreground">No stories yet</span>
              </div>
            )}

            {hasPlatformContents && (
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">
                  {platformEntryCount} platform format{platformEntryCount > 1 ? 's' : ''}
                </span>
              </div>
            )}

            {selectedVariation && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-accent" />
                <span className="text-muted-foreground">
                  Selected: {selectedVariation.title}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>
                  {formatRelativeTime(subBlock.updatedAt)}
                </span>
              </div>
              {hasStories && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  Ready
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      </ContextMenuTrigger>
      <ContextMenuContent onClick={handleContextMenuClick} className="w-48">
        <ContextMenuItem
          onClick={(e) => handleMenuItemClick(e, onModify)}
          className="cursor-pointer"
        >
          <Edit className="w-4 h-4 mr-2" />
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
    </motion.div>
  );
};
