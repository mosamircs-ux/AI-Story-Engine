import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { 
  useGetCharacter, getGetCharacterQueryKey,
  useGenerateCharacterImage,
  useListCharacterLines, getListCharacterLinesQueryKey,
  useGenerateLineAudio
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Image as ImageIcon, Play, Loader2, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

export function CharacterDetail() {
  const params = useParams();
  const novelId = Number(params.novelId);
  const characterId = Number(params.characterId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: character, isLoading: charLoading } = useGetCharacter(characterId, {
    query: {
      enabled: !!characterId,
      queryKey: getGetCharacterQueryKey(characterId)
    }
  });

  const { data: lines, isLoading: linesLoading } = useListCharacterLines(characterId, {
    query: {
      enabled: !!characterId,
      queryKey: getListCharacterLinesQueryKey(characterId)
    }
  });

  const generateImage = useGenerateCharacterImage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(characterId) });
        toast({ title: "Portrait generated" });
      },
      onError: () => {
        toast({ title: "Generation failed", variant: "destructive" });
      }
    }
  });

  const generateAudio = useGenerateLineAudio({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCharacterLinesQueryKey(characterId) });
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

  const isLoading = charLoading;

  if (isLoading) {
    return (
      <Layout novelId={novelId}>
        <div className="p-12 animate-pulse space-y-8 max-w-4xl mx-auto">
          <div className="h-64 bg-muted rounded-xl" />
          <div className="h-8 bg-muted w-1/3 rounded" />
          <div className="h-4 bg-muted w-full rounded" />
          <div className="h-4 bg-muted w-full rounded" />
        </div>
      </Layout>
    );
  }

  if (!character) return <Layout novelId={novelId}><div className="p-12">Character not found</div></Layout>;

  const charColor = character.color || 'var(--primary)';

  return (
    <Layout novelId={novelId}>
      <div className="flex flex-col lg:flex-row min-h-[100dvh]">
        {/* Left Column: Portrait & Stats */}
        <div className="lg:w-[400px] xl:w-[500px] shrink-0 border-r border-border bg-card/10 relative">
          <div className="sticky top-0 h-screen overflow-y-auto hidden-scrollbar flex flex-col">
            <div className="aspect-[3/4] relative bg-muted border-b border-border">
              {character.imageUrl ? (
                <img src={character.imageUrl} alt={character.name} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-card to-background p-8 text-center">
                  <Users className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground text-sm mb-6">No portrait available</p>
                  <Button 
                    onClick={() => generateImage.mutate({ characterId })} 
                    disabled={generateImage.isPending}
                    variant="outline"
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {generateImage.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4 mr-2" />
                    )}
                    Generate Portrait
                  </Button>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
              
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: charColor }} />
                  <Badge variant="outline" className="font-mono text-xs uppercase tracking-widest bg-background/50 backdrop-blur">
                    {character.role}
                  </Badge>
                </div>
                <h1 className="text-4xl font-serif text-glow leading-tight" style={{ textShadow: `0 0 30px ${charColor}40` }}>
                  {character.name}
                </h1>
              </div>
            </div>

            <div className="p-8 space-y-8 flex-1 bg-background/50 backdrop-blur-sm">
              {character.aliases && character.aliases.length > 0 && (
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Also known as</h4>
                  <div className="flex flex-wrap gap-2">
                    {character.aliases.map((alias, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded border border-border/50 bg-muted/30 text-muted-foreground font-mono">
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {character.voiceStyle && (
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Voice Style</h4>
                  <p className="text-sm text-foreground/80 italic">"{character.voiceStyle}"</p>
                </div>
              )}
              
              {character.physicalDescription && (
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Appearance</h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">{character.physicalDescription}</p>
                </div>
              )}

              {character.personality && (
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Personality</h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">{character.personality}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Bio & Dialogue */}
        <div className="flex-1 p-8 md:p-12 lg:p-16 max-w-4xl">
          <div className="prose prose-invert prose-p:text-muted-foreground mb-16">
            <h2 className="font-serif text-2xl border-b border-border pb-4 mb-6">Profile</h2>
            <p className="text-lg leading-relaxed">{character.description || "No description available."}</p>
          </div>

          {character.relationships && (() => {
            let rels: Record<string, string> = {};
            try { rels = JSON.parse(character.relationships); } catch { return null; }
            const entries = Object.entries(rels);
            if (!entries.length) return null;
            return (
              <div className="mb-16">
                <h2 className="font-serif text-2xl border-b border-border pb-4 mb-8">Relationships</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {entries.map(([name, rel]) => (
                    <div key={name} className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card/20">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="font-serif text-sm font-bold text-primary">{name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{name}</p>
                        <p className="text-xs text-muted-foreground font-mono capitalize">{rel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div>
            <h2 className="font-serif text-2xl border-b border-border pb-4 mb-8 flex items-center gap-3">
              <Quote className="w-6 h-6 text-primary/50" />
              Dialogue Lines
              <Badge variant="secondary" className="ml-auto font-mono">{character.dialogueCount || 0}</Badge>
            </h2>

            {linesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />)}
              </div>
            ) : !lines?.length ? (
              <p className="text-muted-foreground italic">No dialogue found for this character.</p>
            ) : (
              <div className="space-y-6">
                {lines.map((line) => {
                  const isGenerating = generateAudio.isPending && generateAudio.variables?.lineId === line.id;
                  const isPlaying = playingId === line.id;
                  
                  return (
                    <div 
                      key={line.id} 
                      className={cn(
                        "p-6 rounded-xl border transition-all duration-300 relative overflow-hidden group",
                        isPlaying 
                          ? "border-primary/50 bg-primary/5" 
                          : "border-border/50 bg-card/20 hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "shrink-0 rounded-full w-10 h-10 transition-colors",
                            line.audioUrl 
                              ? isPlaying ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-primary/10 text-primary hover:bg-primary/20"
                              : "bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10"
                          )}
                          onClick={() => handlePlayLine(line.id, line.audioUrl)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </Button>
                        
                        <div className="flex-1">
                          <p className="text-lg font-serif leading-relaxed text-foreground/90">"{line.text}"</p>
                          {(line.context || line.chapterNumber || line.addressedTo) && (
                            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground font-mono">
                              {line.chapterNumber && <span>CH. {line.chapterNumber}</span>}
                              {line.pageNumber && <span>PG. {line.pageNumber}</span>}
                              {line.addressedTo && (
                                <span className="border border-border/50 px-2 py-0.5 rounded-full">
                                  to {line.addressedTo}
                                </span>
                              )}
                              {line.context && <span className="italic line-clamp-1 border-l border-border pl-3">Context: {line.context}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}