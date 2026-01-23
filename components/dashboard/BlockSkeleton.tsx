import { Skeleton } from "@/components/ui/skeleton";

export const BlockSkeleton = () => {
  return (
    <div className="glass-panel p-6 border-2 border-border/50 h-[180px] flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <Skeleton className="h-6 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-2/3 rounded-md" />
      </div>
      
      <div className="flex items-center gap-4 pt-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-12 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
};
