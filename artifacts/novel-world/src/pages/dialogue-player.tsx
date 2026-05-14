import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { 
  useListCharacters, getListCharactersQueryKey,
  useGenerateLineAudio
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Play, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
function useAllNovelDialogue(novelId: number, characters: any[]) {
  return useQuery({
    queryKey: ['all-dialogue', novelId],
    enabled: !!characters?.length,
    queryFn: async () => {
      const promises = characters.map(c => 
        fetch(`/api/characters/${c.id}/lines`).then(r => r.json())
      );
      const results = await Promise.all(promises);
      
      // Flatten and sort by chapter then page
      const allLines = results.flat() as any[];
      return allLines.sort((a, b) => {
        if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
        if ((a.sequenceOrder ?? 0) !== (b.sequenceOrder ?? 0)) return (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0);
        if (a.pageNumber !== b.pageNumber) return (a.pageNumber || 0) - (b.pageNumber || 0);
        return a.id - b.id;
      });
    }
  });
}

export function DialoguePlayer() {
  const params = useParams();
  const novelId = Number(params.novelId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: characters } = useListCharacters(novelId, {
    query: { enabled: !!novelId, queryKey: getListCharactersQueryKey(novelId) }
  });

  const { data: lines, isLoading } = useAllNovelDialogue(novelId, characters || []);

  const generateAudio = useGenerateLineAudio({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['all-dialogue', novelId] });
      },
      onError: () => {
        toast({ title: "Audio generation failed", variant: "destructive" });
      }
    }
  });

  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handlePlayLine = (lineId: number, audioUrl?: string | null) => {
    if (!audioUrl) {
      generateAudio.mutate({ lineId });
      return;
    }

    if (playingId === lineId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.onended = () => setPlayingId(null);
    audio.play().catch(e => {
      console.error(e);
      toast({ title: "Playback failed", variant: "destructive" });
      setPlayingId(null);
    });
    
    setPlayingId(lineId);
  };

  // Group by chapter
  const groupedLines = lines?.reduce((acc, line) => {
    const ch = line.chapterNumber || 0;
    if (!acc[ch]) acc[ch] = [];
    acc[ch].push(line);
    return acc;
  }, {} as Record<number, typeof lines>);

  const sortedChapters = Object.keys(groupedLines || {}).map(Number).sort((a, b) => a - b);

  return (
    <Layout novelId={novelId}>
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-24">
        <header className="mb-16 text-center">
          <h1 className="text-4xl font-serif text-glow mb-4">Script & Voices</h1>
          <p className="text-muted-foreground font-light font-mono text-sm uppercase tracking-widest">
            Interactive Playback
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !lines?.length ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No dialogue lines found.</p>
          </div>
        ) : (
          <div className="space-y-16">
            {sortedChapters.map(chapter => (
              <div key={chapter}>
                <div className="text-center mb-10">
                  <span className="inline-block px-4 py-1.5 border border-border/50 bg-card/30 backdrop-blur rounded-full text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Chapter {chapter}
                  </span>
                </div>

                <div className="space-y-6">
                  {groupedLines?.[chapter].map((line: any) => {
                    const char = characters?.find(c => c.id === line.characterId);
                    const isGenerating = generateAudio.isPending && generateAudio.variables?.lineId === line.id;
                    const isPlaying = playingId === line.id;
                    const charColor = char?.color || 'var(--primary)';

                    return (
                      <div 
                        key={line.id} 
                        className={cn(
                          "flex gap-4 md:gap-6 p-4 md:p-6 rounded-xl transition-all duration-300",
                          isPlaying ? "bg-card border border-border shadow-lg" : "hover:bg-card/40 border border-transparent"
                        )}
                        style={{ '--line-color': charColor } as React.CSSProperties}
                      >
                        <div className="flex flex-col items-center gap-3 pt-1 shrink-0 w-16 md:w-20">
                          <div className="w-12 h-12 rounded-full overflow-hidden border-2" style={{ borderColor: 'var(--line-color)' }}>
                            {char?.imageUrl ? (
                              <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <span className="font-serif text-lg font-bold" style={{ color: 'var(--line-color)' }}>
                                  {char?.name?.charAt(0)}
                                </span>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider text-center truncate w-full">
                            {char?.name?.split(' ')[0]}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-lg md:text-xl font-serif leading-relaxed text-foreground/90">
                            "{line.text}"
                          </p>
                          {line.addressedTo && (
                            <p className="text-xs font-mono text-muted-foreground/60 mt-1">
                              → {line.addressedTo}
                            </p>
                          )}
                          {line.context && (
                            <p className="text-sm text-muted-foreground/70 italic mt-2 border-l-2 pl-3" style={{ borderColor: 'var(--line-color)' }}>
                              {line.context}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 pt-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                              "rounded-full w-10 h-10 transition-colors",
                              line.audioUrl 
                                ? isPlaying ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-primary/10 text-primary hover:bg-primary/20"
                                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                            )}
                            onClick={() => handlePlayLine(line.id, line.audioUrl)}
                            disabled={isGenerating}
                          >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}