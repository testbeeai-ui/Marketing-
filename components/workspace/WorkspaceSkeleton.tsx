import { Skeleton } from "@/components/ui/skeleton";

export const WorkspaceSkeleton = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar Skeleton */}
      <div className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="h-full max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Skeleton className="h-8 w-32 rounded-md" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>
      </div>

      <div className="pt-16 flex-1 flex flex-col">
        {/* Tabs Skeleton */}
        <div className="h-12 border-b border-border bg-muted/30 px-6 flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-t-md" />
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Skeleton */}
          <div className="w-80 border-r border-border p-6 space-y-6">
            <Skeleton className="h-8 w-40 rounded-md" />
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className="flex-1 p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <Skeleton className="h-8 w-48 rounded-md mb-2" />
                <Skeleton className="h-4 w-64 rounded-md" />
              </div>
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-panel p-6 h-[200px] border border-border/50">
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-3/4 rounded-md" />
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-2/3 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
