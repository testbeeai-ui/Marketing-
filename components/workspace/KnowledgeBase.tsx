import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Trash2, Upload, Database, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface FileItem {
  id: string;
  name: string;
  status: "ready" | "indexing" | "error";
  fileSize?: number;
  uploadedAt?: string;
}

interface ProcessingFile {
  id: string;
  name: string;
  status: "uploading" | "processing" | "indexing" | "completed" | "error";
  progress?: number;
}

interface KnowledgeBaseProps {
  files: FileItem[];
  onFileUpload: (files: FileList) => void;
  onFileDelete: (id: string) => void;
  usagePercent: number;
  processingFiles?: ProcessingFile[];
  completedCount?: number;
  totalProcessing?: number;
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const KnowledgeBase = ({
  files,
  onFileUpload,
  onFileDelete,
  usagePercent,
  processingFiles = [],
  completedCount = 0,
  totalProcessing = 0,
}: KnowledgeBaseProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [completedMessages, setCompletedMessages] = useState<string[]>([]);

  // Show completion messages
  useEffect(() => {
    if (completedCount > 0 && completedCount <= totalProcessing) {
      const message = `${completedCount} ${completedCount === 1 ? 'note' : 'notes'} completed`;
      setCompletedMessages((prev) => {
        if (!prev.includes(message)) {
          return [...prev, message];
        }
        return prev;
      });

      // Remove message after 3 seconds
      setTimeout(() => {
        setCompletedMessages((prev) => prev.filter((m) => m !== message));
      }, 3000);
    }
  }, [completedCount, totalProcessing]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      onFileUpload(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const isProcessing = processingFiles.length > 0;
  const readyFiles = files.filter((f) => f.status === "ready");
  const indexingFiles = files.filter((f) => f.status === "indexing");

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-foreground">Knowledge Base</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {readyFiles.length} {readyFiles.length === 1 ? 'document' : 'documents'} indexed
            </p>
          </div>
        </div>
      </div>

      {/* Processing Status Banner */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-6 py-4 bg-primary/5 border-b border-primary/20"
          >
            <div className="space-y-3">
              {processingFiles.map((file, index) => (
                <div key={file.id} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Loader2 className={cn(
                      "w-4 h-4 animate-spin",
                      file.status === "completed" ? "text-emerald-500" : "text-primary"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {file.status === "uploading" && "Uploading..."}
                        {file.status === "processing" && "Processing document..."}
                        {file.status === "indexing" && "Creating embeddings..."}
                        {file.status === "completed" && "✓ Completed"}
                        {file.status === "error" && "✗ Failed"}
                      </p>
                    </div>
                    {file.status === "completed" && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    )}
                    {file.status === "error" && (
                      <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                    )}
                  </div>
                  {file.status !== "completed" && file.status !== "error" && (
                    <div className="h-1 bg-primary/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: file.progress ? `${file.progress}%` : "60%" }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Completion Counter */}
            {completedCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 pt-3 border-t border-primary/10"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {completedCount} {completedCount === 1 ? 'note' : 'notes'} completed
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion Toast Messages */}
      <AnimatePresence>
        {completedMessages.map((message, index) => (
          <motion.div
            key={message}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="mx-6 mt-4 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {message}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Upload Zone */}
      <div className="px-6 py-5">
      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        animate={{
          borderColor: isDragOver ? "hsl(217 91% 60%)" : "hsl(217 33% 17%)",
            backgroundColor: isDragOver ? "hsl(217 91% 60% / 0.05)" : "transparent",
        }}
        className={cn(
            "relative border-2 border-dashed rounded-xl transition-all cursor-pointer overflow-hidden",
            isDragOver && "border-primary bg-primary/5"
        )}
      >
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center pointer-events-none">
            <motion.div
              animate={isDragOver ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Upload className={cn(
                "w-10 h-10 mb-3 transition-colors",
                isDragOver ? "text-primary" : "text-muted-foreground"
              )} />
            </motion.div>
            <p className="text-sm font-medium text-foreground mb-1">
              {isDragOver ? "Drop files here" : "Upload files"}
            </p>
            <p className="text-xs text-muted-foreground">
              Drag & drop or click to browse
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              🔒 Processed locally • Only text extracted • No cloud upload
          </p>
        </div>
        <input
          type="file"
          multiple
          onChange={(e) => e.target.files && onFileUpload(e.target.files)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </motion.div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-1">
        {files.length === 0 && !isProcessing && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-slate-600 dark:text-slate-400">No documents yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Upload files to start building your knowledge base
            </p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {files.map((file, index) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: index * 0.03 }}
              className="group flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/50 transition-all cursor-pointer"
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                file.status === "ready" ? "bg-emerald-500/10" : "bg-primary/10"
              )}>
                {file.status === "ready" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : file.status === "indexing" ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <FileText className="w-5 h-5 text-primary" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                {file.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {formatFileSize(file.fileSize)}
                  </span>
                  {file.status === "indexing" && (
                    <>
                      <span className="text-xs text-slate-600 dark:text-slate-400">•</span>
                      <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                        Indexing...
              </span>
                    </>
                )}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFileDelete(file.id);
                }}
                className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-all flex-shrink-0"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Storage Meter */}
      <div className="px-6 py-4 border-t border-border/50 bg-card/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground">Context Usage</span>
          <span className="text-xs font-semibold text-foreground">{usagePercent}%</span>
        </div>
        <div className="relative">
          <Progress value={usagePercent} className="h-2" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-medium text-muted-foreground">
              {readyFiles.length} / 20 documents
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
