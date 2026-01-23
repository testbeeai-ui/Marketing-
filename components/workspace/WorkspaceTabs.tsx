import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  name: string;
}

interface WorkspaceTabsProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
}

export const WorkspaceTabs = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
}: WorkspaceTabsProps) => {
  return (
    <div className="h-12 bg-card/50 border-b border-border flex items-end px-2 gap-1">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <motion.div
            key={tab.id}
            layoutId={`tab-${tab.id}`}
            onClick={() => onTabClick(tab.id)}
            className={cn(
              "relative h-10 px-4 flex items-center gap-2 rounded-t-lg cursor-pointer transition-colors group",
              isActive
                ? "bg-background border border-b-0 border-border"
                : "bg-secondary/30 hover:bg-secondary/50"
            )}
          >
            <span
              className={cn(
                "text-sm font-medium transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {tab.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className={cn(
                "w-5 h-5 rounded flex items-center justify-center transition-all",
                isActive
                  ? "hover:bg-secondary"
                  : "opacity-0 group-hover:opacity-100 hover:bg-secondary/50"
              )}
            >
              <X className="w-3 h-3" />
            </button>
            {isActive && (
              <motion.div
                layoutId="active-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
};
