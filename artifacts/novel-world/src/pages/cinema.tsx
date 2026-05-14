import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import {
  useListEvents, getListEventsQueryKey,
  useListCharacters, getListCharactersQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, ChevronLeft, ChevronRight, Volume2, VolumeX, Maximize2, Minimize2, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

function useEventDialogue(eventId: number | null, characters: any[]) {
  return useQuery({
    queryKey: ["event-dialogue", eventId],
    enabled: !!eventId && !!characters?.length,
    queryFn: async () => {
      if (!eventId || !characters?.length) return [];
      const allLines = await Promise.all(
        characters.map((c) => fetch(`/api/characters/${c.id}/lines`).then((r) => r.json())),
      );
      return (allLines.flat() as any[])
        .filter((l: any) => l.chapterNumber !== undefined)
        .sort((a: any, b: any) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0))
        .slice(0, 8);
    },
  });
}

export function Cinema() {
  const params = useParams();
  const novelId = Number(params.novelId);

  const { data: events, isLoading: eventsLoading } = useListEvents(novelId, {
    query: { enabled: !!novelId, queryKey: getListEventsQueryKey(novelId) },
  });
  const { data: characters } = useListCharacters(novelId, {
    query: { enabled: !!novelId, queryKey: getListCharactersQueryKey(novelId) },
  });

  const sortedEvents = [...(events ?? [])].sort((a, b) => {
    if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
    return (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0);
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playingLineId, setPlayingLineId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = sortedEvents[currentIndex];
  const { data: dialogue } = useEventDialogue(
    current?.id ?? null,
    (characters ?? []).filter((c) =>
      (current?.characters ?? []).includes(c.name),
    ),
  );

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, sortedEvents.length - 1));
    setPlayingLineId(null);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, [sortedEvents.length]);

  const goPrev = () => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
    setPlayingLineId(null);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  };

  // Auto-advance when playing
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setTimeout(goNext, 8000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, currentIndex, goNext]);

  const playLine = (lineId: number, audioUrl: string | null | undefined) => {
    if (!audioUrl || isMuted) return;
    if (playingLineId === lineId) {
      audioRef.current?.pause();
      setPlayingLineId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => setPlayingLineId(null);
    audio.play().catch(() => {});
    setPlayingLineId(lineId);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (eventsLoading) {
    return (
      <Layout novelId={novelId}>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center space-y-4">
            <Clapperboard className="w-12 h-12 mx-auto text-muted-foreground/30 animate-pulse" />
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">Loading scenes…</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!sortedEvents.length) {
    return (
      <Layout novelId={novelId}>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center border border-dashed border-border rounded-xl p-16 space-y-4">
            <Clapperboard className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground">No scenes found. Run analysis first.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout novelId={novelId}>
      <div ref={containerRef} className={cn("flex flex-col", isFullscreen ? "fixed inset-0 bg-background z-50" : "min-h-screen")}>

        {/* Main scene viewer */}
        <div className="relative flex-1 min-h-[60vh] bg-black overflow-hidden">
          {/* Ken Burns background image */}
          {current?.imageUrl && (
            <div
              key={current.id}
              className="absolute inset-0 scale-110 animate-ken-burns"
              style={{
                backgroundImage: `url(${current.imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-background/40" />

          {/* No image placeholder */}
          {!current?.imageUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-card to-background">
              <Clapperboard className="w-24 h-24 text-muted-foreground/10" />
            </div>
          )}

          {/* Scene info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
            <div className="max-w-4xl">
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="outline" className="font-mono text-xs bg-background/40 backdrop-blur border-border/50">
                  Ch. {current?.chapterNumber}
                </Badge>
                {current?.emotionalTone && (
                  <Badge variant="outline" className="font-mono text-xs bg-background/40 backdrop-blur border-border/50 capitalize">
                    {current.emotionalTone}
                  </Badge>
                )}
                {current?.location && (
                  <span className="text-xs font-mono text-muted-foreground/70">📍 {current.location}</span>
                )}
              </div>
              <h2 className="text-3xl md:text-5xl font-serif text-glow mb-3 leading-tight">{current?.title}</h2>
              {current?.description && (
                <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl line-clamp-3">{current.description}</p>
              )}
            </div>
          </div>

          {/* Controls overlay */}
          <div className="absolute top-4 right-4 flex gap-2">
            <Button size="icon" variant="ghost" className="bg-background/30 backdrop-blur hover:bg-background/50" onClick={() => setIsMuted((m) => !m)}>
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="bg-background/30 backdrop-blur hover:bg-background/50" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>

          {/* Prev / Next arrows */}
          <Button
            size="icon"
            variant="ghost"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/30 backdrop-blur hover:bg-background/50 h-12 w-12"
            onClick={goPrev}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/30 backdrop-blur hover:bg-background/50 h-12 w-12"
            onClick={goNext}
            disabled={currentIndex === sortedEvents.length - 1}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>

        {/* Bottom bar: playback controls + scene strip + dialogue */}
        <div className="border-t border-border bg-card/30 backdrop-blur">
          {/* Playback bar */}
          <div className="flex items-center gap-4 px-6 py-3 border-b border-border/50">
            <Button
              size="sm"
              variant={isPlaying ? "default" : "outline"}
              className="gap-2"
              onClick={() => setIsPlaying((p) => !p)}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? "Pause" : "Auto Play"}
            </Button>

            {/* Scene strip */}
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-2">
                {sortedEvents.map((event, i) => (
                  <button
                    key={event.id}
                    onClick={() => { setCurrentIndex(i); setPlayingLineId(null); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } }}
                    className={cn(
                      "shrink-0 w-16 h-10 rounded border overflow-hidden transition-all duration-300",
                      i === currentIndex ? "border-primary ring-1 ring-primary" : "border-border/50 opacity-50 hover:opacity-80",
                    )}
                  >
                    {event.imageUrl ? (
                      <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <span className="text-[8px] font-mono text-muted-foreground">{i + 1}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs font-mono text-muted-foreground shrink-0">
              {currentIndex + 1} / {sortedEvents.length}
            </span>
          </div>

          {/* Dialogue panel */}
          {dialogue && dialogue.length > 0 && (
            <div className="px-6 py-4">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/50 mb-3">Scene Dialogue</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {dialogue.slice(0, 6).map((line: any) => {
                  const char = characters?.find((c) => c.id === line.characterId);
                  const isPlaying = playingLineId === line.id;
                  return (
                    <div
                      key={line.id}
                      className={cn(
                        "shrink-0 max-w-xs p-3 rounded-lg border cursor-pointer transition-all duration-200",
                        line.audioUrl
                          ? isPlaying
                            ? "border-primary/60 bg-primary/5"
                            : "border-border/50 hover:border-primary/30 bg-card/40"
                          : "border-border/30 bg-card/20 opacity-60",
                      )}
                      onClick={() => playLine(line.id, line.audioUrl)}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: char?.color ?? "var(--primary)" }}
                        />
                        <span className="text-[10px] font-mono text-muted-foreground truncate">{char?.name ?? "?"}</span>
                        {line.audioUrl && (
                          <Volume2 className={cn("w-3 h-3 ml-auto shrink-0", isPlaying ? "text-primary animate-pulse" : "text-muted-foreground/40")} />
                        )}
                      </div>
                      <p className="text-xs text-foreground/80 font-serif leading-relaxed line-clamp-3">"{line.text}"</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
