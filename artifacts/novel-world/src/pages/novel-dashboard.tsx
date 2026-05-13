import { useParams, Link } from "wouter";
import { 
  useGetNovel, getGetNovelQueryKey, 
  useGetNovelSummary, getGetNovelSummaryQueryKey,
  useAnalyzeNovel 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Book, Wand2, Users, Clock, MessageSquare, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function NovelDashboard() {
  const params = useParams();
  const novelId = Number(params.novelId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: novel, isLoading: novelLoading } = useGetNovel(novelId, {
    query: {
      enabled: !!novelId,
      queryKey: getGetNovelQueryKey(novelId),
      refetchInterval: (query) => {
        // Safe access for React Query v5
        const currentData = query.state.data;
        return currentData?.status === "analyzing" ? 3000 : false;
      }
    }
  });

  const { data: summary, isLoading: summaryLoading } = useGetNovelSummary(novelId, {
    query: {
      enabled: !!novelId && novel?.status === "ready",
      queryKey: getGetNovelSummaryQueryKey(novelId)
    }
  });

  const analyzeNovel = useAnalyzeNovel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetNovelQueryKey(novelId) });
        toast({ title: "Analysis started", description: "This might take a few minutes." });
      },
      onError: () => {
        toast({ title: "Analysis failed", description: "Could not start analysis.", variant: "destructive" });
      }
    }
  });

  const handleAnalyze = () => {
    analyzeNovel.mutate({ novelId });
  };

  const isLoading = novelLoading || (novel?.status === "ready" && summaryLoading);

  return (
    <Layout novelId={novelId}>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-16 h-24 bg-muted mb-4 rounded" />
            <div className="w-48 h-4 bg-muted rounded" />
          </div>
        </div>
      ) : !novel ? (
        <div className="p-12 text-center text-muted-foreground">Novel not found.</div>
      ) : (
        <div className="max-w-6xl mx-auto px-6 py-12 md:py-24">
          <header className="flex flex-col md:flex-row gap-8 items-start mb-16">
            <div className="w-48 md:w-64 aspect-[2/3] shrink-0 rounded-lg overflow-hidden bg-muted relative border border-border/50 shadow-2xl">
              {novel.coverImageUrl ? (
                <img src={novel.coverImageUrl} alt={novel.title} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-card to-background">
                  <Book className="w-16 h-16 text-muted-foreground/30" />
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <h1 className="text-4xl md:text-5xl font-serif text-glow">{novel.title}</h1>
                <Badge variant={novel.status === "error" ? "destructive" : "outline"} className={cn(
                  "font-mono text-xs uppercase tracking-wider",
                  novel.status === "ready" && "text-primary border-primary/50",
                  novel.status === "analyzing" && "text-amber-400 border-amber-400/50 animate-pulse"
                )}>
                  {novel.status}
                </Badge>
              </div>
              
              <div className="flex gap-6 text-sm text-muted-foreground font-mono mb-8">
                {novel.pageCount && <span>{novel.pageCount} Pages</span>}
                {novel.wordCount && <span>{novel.wordCount.toLocaleString()} Words</span>}
                {novel.language && <span className="uppercase">{novel.language}</span>}
              </div>

              {novel.status === "uploaded" && (
                <div className="bg-card/50 border border-border rounded-xl p-8 max-w-xl">
                  <h3 className="text-xl font-serif mb-2">Ready for Analysis</h3>
                  <p className="text-muted-foreground mb-6">
                    We will extract characters, locations, timelines, and dialogue from the manuscript.
                  </p>
                  <Button onClick={handleAnalyze} disabled={analyzeNovel.isPending} size="lg" className="w-full font-serif text-lg gap-2 group border-primary/20 hover:border-primary/50 bg-primary/10 text-primary hover:bg-primary/20">
                    <Wand2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    {analyzeNovel.isPending ? "Starting..." : "Analyze Novel"}
                  </Button>
                </div>
              )}

              {novel.status === "analyzing" && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-8 max-w-xl flex items-start gap-4">
                  <Wand2 className="w-6 h-6 text-amber-500 animate-spin mt-1" />
                  <div>
                    <h3 className="text-lg font-serif text-amber-500 mb-1">Analysis in Progress</h3>
                    <p className="text-amber-500/70 text-sm">
                      Our AI is currently reading the manuscript. This may take a few minutes. 
                      The page will automatically update when finished.
                    </p>
                  </div>
                </div>
              )}

              {novel.status === "error" && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 max-w-xl flex items-start gap-4">
                  <AlertTriangle className="w-6 h-6 text-destructive mt-1" />
                  <div>
                    <h3 className="text-lg font-serif text-destructive mb-1">Analysis Failed</h3>
                    <p className="text-destructive/80 text-sm mb-4">Something went wrong while analyzing the manuscript.</p>
                    <Button onClick={handleAnalyze} disabled={analyzeNovel.isPending} variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {novel.status === "ready" && summary && (
                <div className="prose prose-invert prose-p:text-muted-foreground max-w-3xl">
                  <h3 className="text-xl font-serif text-foreground/80 border-b border-border pb-2 mb-4">Synopsis</h3>
                  <p className="leading-relaxed whitespace-pre-wrap">{novel.synopsis || "No synopsis available."}</p>
                </div>
              )}
            </div>
          </header>

          {novel.status === "ready" && summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <Link href={`/novels/${novelId}/characters`}>
                <div className="bg-card/30 border border-border hover:border-primary/50 transition-colors p-6 rounded-xl cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-serif mb-1 group-hover:text-primary transition-colors">{summary.characterCount}</h3>
                  <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">Characters</p>
                </div>
              </Link>
              
              <Link href={`/novels/${novelId}/events`}>
                <div className="bg-card/30 border border-border hover:border-primary/50 transition-colors p-6 rounded-xl cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-serif mb-1 group-hover:text-primary transition-colors">{summary.eventCount}</h3>
                  <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">Story Events</p>
                </div>
              </Link>

              <Link href={`/novels/${novelId}/dialogue`}>
                <div className="bg-card/30 border border-border hover:border-primary/50 transition-colors p-6 rounded-xl cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <MessageSquare className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-serif mb-1 group-hover:text-primary transition-colors">{summary.dialogueCount}</h3>
                  <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">Dialogue Lines</p>
                </div>
              </Link>
            </div>
          )}

          {novel.status === "ready" && summary?.topCharacters && summary.topCharacters.length > 0 && (
            <div className="mb-16">
              <div className="flex items-end justify-between mb-8 pb-4 border-b border-border">
                <h2 className="text-2xl font-serif text-foreground/80">Key Characters</h2>
                <Link href={`/novels/${novelId}/characters`} className="text-sm text-primary hover:underline">View All</Link>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {summary.topCharacters.slice(0, 5).map(char => (
                  <Link key={char.id} href={`/novels/${novelId}/characters/${char.id}`}>
                    <div className="group cursor-pointer text-center">
                      <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted mb-4 border border-border/50 group-hover:border-primary/50 transition-all">
                        {char.imageUrl ? (
                          <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-card to-background">
                            <Users className="w-8 h-8 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <h4 className="font-serif font-medium group-hover:text-primary transition-colors truncate px-2">{char.name}</h4>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">{char.role}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}