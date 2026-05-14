import { useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetNovel, getGetNovelQueryKey,
  useListEvents, getListEventsQueryKey,
  useListCharacters, getListCharactersQueryKey,
  useComposeMovie,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Film, Download, Loader2, Play, Image as ImageIcon,
  Volume2, CheckCircle2, AlertCircle, Clapperboard, LayoutGrid
} from "lucide-react";
import { cn } from "@/lib/utils";

export function MovieComposer() {
  const params = useParams();
  const novelId = Number(params.novelId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: novel, isLoading: novelLoading } = useGetNovel(novelId, {
    query: {
      enabled: !!novelId,
      queryKey: getGetNovelQueryKey(novelId),
      refetchInterval: (q) => {
        const d = q.state.data;
        return d?.movieStatus === "processing" ? 4000 : false;
      },
    },
  });

  const { data: events } = useListEvents(novelId, {
    query: { enabled: !!novelId, queryKey: getListEventsQueryKey(novelId) },
  });
  const { data: characters } = useListCharacters(novelId, {
    query: { enabled: !!novelId, queryKey: getListCharactersQueryKey(novelId) },
  });

  const compose = useComposeMovie({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetNovelQueryKey(novelId), data);
        if (data.movieStatus === "processing") {
          toast({ title: "Composing movie…", description: "This takes a few minutes. Stay on this page." });
        }
      },
      onError: () => {
        toast({ title: "Failed to start composition", variant: "destructive" });
      },
    },
  });

  // When movieStatus transitions to ready, show toast
  useEffect(() => {
    if (novel?.movieStatus === "ready" && novel?.movieUrl) {
      toast({ title: "🎬 Movie ready!", description: "Your movie has been composed." });
    }
  }, [novel?.movieStatus]);

  const sceneCount = events?.length ?? 0;
  const scenesWithImages = events?.filter(e => e.imageUrl).length ?? 0;
  const charsWithAudio = characters?.filter(c => (c.dialogueCount ?? 0) > 0).length ?? 0;
  const isProcessing = novel?.movieStatus === "processing" || compose.isPending;
  const isReady = novel?.movieStatus === "ready" && !!novel?.movieUrl;
  const hasError = novel?.movieStatus === "error";

  const sortedEvents = [...(events ?? [])].sort((a, b) => {
    if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
    return (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0);
  });

  return (
    <Layout novelId={novelId}>
      <div className="max-w-4xl mx-auto px-6 py-10 md:py-16 space-y-12">

        {/* Header */}
        <header className="border-b border-border pb-6">
          <h1 className="text-4xl font-serif text-glow mb-1 flex items-center gap-3">
            <Film className="w-8 h-8 text-primary/60" />
            Movie Composer
          </h1>
          <p className="text-muted-foreground font-light">
            Combine scene images and character voices into a downloadable MP4 film.
          </p>
        </header>

        {/* Requirements checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat
            icon={ImageIcon}
            label="Scenes with Images"
            value={`${scenesWithImages} / ${sceneCount}`}
            ok={scenesWithImages > 0}
            hint={scenesWithImages === 0 ? "Generate scene images first" : undefined}
          />
          <Stat
            icon={Volume2}
            label="Characters with Voice"
            value={String(charsWithAudio)}
            ok={charsWithAudio > 0}
            hint={charsWithAudio === 0 ? "Generate audio in Dialogue page first" : undefined}
          />
          <Stat
            icon={Film}
            label="Movie Status"
            value={novel?.movieStatus ?? "not started"}
            ok={isReady}
            processing={isProcessing}
          />
        </div>

        {/* Compose action card */}
        <div className={cn(
          "rounded-2xl border p-8 md:p-10 space-y-6 transition-all duration-500",
          isReady ? "border-primary/40 bg-primary/5" :
          hasError ? "border-destructive/30 bg-destructive/5" :
          isProcessing ? "border-amber-500/30 bg-amber-500/5" :
          "border-border bg-card/20"
        )}>

          {/* Status banner */}
          {isProcessing && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin shrink-0" />
              <div>
                <p className="font-medium text-amber-400">Composing your movie…</p>
                <p className="text-sm text-amber-500/70">
                  ffmpeg is assembling {scenesWithImages} scenes into one MP4. This takes 1–3 minutes.
                  The page will update automatically when done.
                </p>
              </div>
            </div>
          )}

          {isReady && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-primary">Movie ready</p>
                <p className="text-sm text-muted-foreground">Your film has been composed and is ready to download.</p>
              </div>
            </div>
          )}

          {hasError && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/5">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <p className="font-medium text-destructive">Composition failed</p>
                <p className="text-sm text-destructive/70">Make sure at least some scenes have generated images, then try again.</p>
              </div>
            </div>
          )}

          {/* Main action */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!isReady && (
              <Button
                size="lg"
                onClick={() => compose.mutate({ novelId })}
                disabled={isProcessing || scenesWithImages === 0 || novelLoading}
                className="gap-2 flex-1 font-serif text-lg"
              >
                {isProcessing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Composing…</>
                ) : (
                  <><Film className="w-5 h-5" /> Compose Movie</>
                )}
              </Button>
            )}

            {isReady && novel?.movieUrl && (
              <>
                <a href={novel.movieUrl} download={`${novel?.title ?? "movie"}.mp4`} className="flex-1">
                  <Button size="lg" className="w-full gap-2 font-serif text-lg">
                    <Download className="w-5 h-5" />
                    Download MP4
                  </Button>
                </a>
                <a href={novel.movieUrl} target="_blank" rel="noreferrer">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Play className="w-4 h-4" />
                    Preview
                  </Button>
                </a>
                <Button
                  size="lg"
                  variant="ghost"
                  className="gap-2 text-muted-foreground"
                  onClick={() => compose.mutate({ novelId: novelId })}
                  disabled={isProcessing}
                >
                  Recompose
                </Button>
              </>
            )}
          </div>

          {/* Tip */}
          {!isProcessing && !isReady && (
            <p className="text-xs text-muted-foreground/60 font-mono">
              Tip — generate more scene images and dialogue audio before composing for a richer film.
              Each scene with an image gets 8 seconds of screen time.
            </p>
          )}
        </div>

        {/* Scene preview strip */}
        {sortedEvents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-serif text-foreground/70">
                Scene Lineup
                <span className="ml-3 text-sm font-sans font-normal text-muted-foreground/50">
                  {scenesWithImages} of {sceneCount} scenes will appear in the film
                </span>
              </h2>
              <Link href={`/novels/${novelId}/storyboard`}>
                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Full Storyboard
                </Button>
              </Link>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {sortedEvents.map((event, i) => (
                <div
                  key={event.id}
                  className={cn(
                    "shrink-0 w-28 rounded-lg border overflow-hidden transition-all duration-200",
                    event.imageUrl
                      ? "border-border/60 hover:border-primary/40"
                      : "border-border/30 opacity-40"
                  )}
                >
                  <div className="relative w-full aspect-video bg-muted">
                    {event.imageUrl ? (
                      <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute top-1 left-1">
                      <span className="text-[8px] font-mono bg-background/60 backdrop-blur px-1 py-0.5 rounded">
                        {i + 1}
                      </span>
                    </div>
                  </div>
                  <p className="text-[9px] font-mono text-muted-foreground/60 px-1.5 py-1 truncate">
                    {event.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pipeline progress */}
        <div>
          <h2 className="text-lg font-serif text-foreground/70 mb-4">Production Pipeline</h2>
          <div className="space-y-3">
            <PipelineStep done label="PDF Upload & Text Extraction" />
            <PipelineStep done label="LLM Story Analyzer — characters, scenes, dialogue" />
            <PipelineStep done={scenesWithImages > 0} label={`Image Generator — ${scenesWithImages} scene images generated`} />
            <PipelineStep done={charsWithAudio > 0} label={`Voice Generator — ${charsWithAudio} characters with voice`} />
            <PipelineStep done={isReady} processing={isProcessing} label="Movie Composer — ffmpeg MP4 export" />
          </div>
        </div>

      </div>
    </Layout>
  );
}

function Stat({
  icon: Icon, label, value, ok, processing, hint,
}: {
  icon: any; label: string; value: string; ok: boolean; processing?: boolean; hint?: string;
}) {
  return (
    <div className={cn(
      "rounded-xl border p-5 transition-all duration-300",
      ok ? "border-primary/30 bg-primary/5" :
      processing ? "border-amber-500/30 bg-amber-500/5" :
      "border-border/50 bg-card/20"
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", ok ? "text-primary" : processing ? "text-amber-500" : "text-muted-foreground/50")} />
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">{label}</p>
      </div>
      <p className={cn("text-2xl font-serif", ok ? "text-primary" : processing ? "text-amber-400" : "text-foreground/70")}>
        {value}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono">{hint}</p>}
    </div>
  );
}

function PipelineStep({ done, processing, label }: { done: boolean; processing?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300",
        done ? "border-primary bg-primary/20" :
        processing ? "border-amber-500 bg-amber-500/10" :
        "border-border/50 bg-card/20"
      )}>
        {done ? (
          <CheckCircle2 className="w-3 h-3 text-primary" />
        ) : processing ? (
          <Loader2 className="w-2.5 h-2.5 text-amber-500 animate-spin" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-border/60" />
        )}
      </div>
      <p className={cn(
        "text-sm font-mono transition-colors duration-300",
        done ? "text-foreground/80" :
        processing ? "text-amber-400" :
        "text-muted-foreground/50"
      )}>
        {label}
      </p>
      {done && <Badge variant="outline" className="ml-auto text-[9px] font-mono text-primary border-primary/30 shrink-0">Done</Badge>}
      {processing && <Badge variant="outline" className="ml-auto text-[9px] font-mono text-amber-500 border-amber-500/30 shrink-0 animate-pulse">Running</Badge>}
    </div>
  );
}
