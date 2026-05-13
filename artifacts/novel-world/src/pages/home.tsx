import { useState, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Upload, Book, AlertCircle, Loader2 } from "lucide-react";
import { useListNovels, useUploadNovel, getListNovelsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function HomePage() {
  const { data: novels, isLoading } = useListNovels();

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-24">
        <header className="mb-16 text-center max-w-2xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-serif mb-6 text-glow">Novel World</h1>
          <p className="text-lg md:text-xl text-muted-foreground font-light leading-relaxed">
            Upload a PDF and watch it come alive. Every character has a face, a voice, and a story.
          </p>
        </header>

        <UploadZone />

        <div className="mt-24">
          <h2 className="text-2xl font-serif mb-8 text-foreground/80 border-b border-border pb-4">Your Library</h2>
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Card key={i} className="h-64 animate-pulse bg-muted/50 border-border/50" />
              ))}
            </div>
          ) : !novels?.length ? (
            <div className="text-center py-20 border border-dashed border-border rounded-lg bg-card/30">
              <Book className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Your library is empty. Upload a novel to begin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {novels.map(novel => (
                <Link key={novel.id} href={`/novels/${novel.id}`}>
                  <Card className="group overflow-hidden bg-card/80 border-border/50 hover:border-primary/50 transition-all duration-500 cursor-pointer flex flex-col h-full hover-elevate">
                    <div className="aspect-[2/3] relative bg-muted flex items-center justify-center overflow-hidden">
                      {novel.coverImageUrl ? (
                        <img 
                          src={novel.coverImageUrl} 
                          alt={novel.title} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-muted-foreground/10 to-background flex items-center justify-center">
                          <Book className="w-16 h-16 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                    </div>
                    
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-serif text-lg font-semibold leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {novel.title}
                      </h3>
                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <StatusBadge status={novel.status} />
                        <span className="text-xs text-muted-foreground">
                          {novel.characterCount || 0} characters
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    uploaded: { label: "Uploaded", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    analyzing: { label: "Analyzing...", color: "bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse" },
    ready: { label: "Ready", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    error: { label: "Error", color: "bg-destructive/20 text-destructive-foreground border-destructive/30" },
  };
  
  const conf = map[status] || { label: status, color: "bg-muted text-muted-foreground" };
  
  return (
    <span className={cn("px-2 py-1 rounded-sm text-[10px] uppercase tracking-wider font-semibold border", conf.color)}>
      {conf.label}
    </span>
  );
}

function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const uploadNovel = useUploadNovel({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListNovelsQueryKey() });
        toast({ title: "Upload complete", description: "Novel is ready for analysis." });
        setLocation(`/novels/${data.id}`);
      },
      onError: () => {
        toast({ title: "Upload failed", description: "Something went wrong.", variant: "destructive" });
        setFile(null);
      }
    }
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      handleFile(droppedFile);
    } else {
      toast({ title: "Invalid file", description: "Please upload a PDF file.", variant: "destructive" });
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFile(selectedFile);
  };

  const handleFile = (selectedFile: File) => {
    setFile(selectedFile);
    
    // Auto upload
    const formData = new FormData();
    formData.append("file", selectedFile);
    
    // Need to cast to any because the generated hook expects NovelUpload but uses FormData internally
    uploadNovel.mutate({ data: { file: selectedFile as any, title: selectedFile.name.replace('.pdf', '') } });
  };

  return (
    <div 
      className={cn(
        "relative max-w-2xl mx-auto rounded-xl border-2 border-dashed p-12 text-center transition-all duration-300",
        isDragging 
          ? "border-primary bg-primary/5 scale-[1.02] shadow-[0_0_30px_rgba(200,160,50,0.1)]" 
          : "border-border/60 hover:border-primary/40 bg-card/30 hover:bg-card/50",
        uploadNovel.isPending ? "pointer-events-none opacity-80" : "cursor-pointer"
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="application/pdf" 
        className="hidden" 
      />
      
      {uploadNovel.isPending ? (
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <h3 className="text-xl font-serif text-foreground">Uploading Manuscript...</h3>
          <p className="text-sm text-muted-foreground mt-2">{file?.name}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-background border border-border flex items-center justify-center mb-6 shadow-xl">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-serif text-foreground mb-2">Drop your novel here</h3>
          <p className="text-sm text-muted-foreground mb-6">PDF format only. We'll handle the rest.</p>
          <Button variant="outline" className="border-border/60 hover:text-primary">
            Browse Files
          </Button>
        </div>
      )}
    </div>
  );
}