import { useParams } from "wouter";
import { 
  useListEvents, getListEventsQueryKey,
  useGenerateEventImage
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, Image as ImageIcon, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export function EventsTimeline() {
  const params = useParams();
  const novelId = Number(params.novelId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useListEvents(novelId, {
    query: {
      enabled: !!novelId,
      queryKey: getListEventsQueryKey(novelId)
    }
  });

  const generateImage = useGenerateEventImage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(novelId) });
        toast({ title: "Scene image generated" });
      },
      onError: () => {
        toast({ title: "Generation failed", variant: "destructive" });
      }
    }
  });

  // Group events by chapter
  const groupedEvents = events?.reduce((acc, event) => {
    const ch = event.chapterNumber;
    if (!acc[ch]) acc[ch] = [];
    acc[ch].push(event);
    return acc;
  }, {} as Record<number, typeof events>);

  const sortedChapters = Object.keys(groupedEvents || {}).map(Number).sort((a, b) => a - b);

  return (
    <Layout novelId={novelId}>
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <header className="mb-16 border-b border-border pb-6">
          <h1 className="text-4xl font-serif text-glow mb-2">Chronology</h1>
          <p className="text-muted-foreground font-light">The sequence of major events and scenes.</p>
        </header>

        {isLoading ? (
          <div className="space-y-12">
            {[1, 2].map(i => (
              <div key={i} className="space-y-4">
                <div className="w-32 h-6 bg-muted rounded animate-pulse" />
                <div className="h-64 bg-card/50 rounded-xl border border-border/50 animate-pulse" />
              </div>
            ))}
          </div>
        ) : !events?.length ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-xl">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
            No events found for this novel.
          </div>
        ) : (
          <div className="space-y-20 relative">
            {/* Timeline line */}
            <div className="absolute left-4 md:left-[8.5rem] top-2 bottom-0 w-px bg-border hidden sm:block" />

            {sortedChapters.map(chapter => (
              <div key={chapter} className="relative">
                <div className="sticky top-4 z-10 bg-background/80 backdrop-blur py-2 mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 hidden sm:flex z-10 relative md:ml-32">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <h2 className="text-2xl font-serif text-primary/80">Chapter {chapter}</h2>
                  </div>
                </div>

                <div className="space-y-12 sm:pl-16 md:pl-44">
                  {groupedEvents?.[chapter].map(event => (
                    <div key={event.id} className="relative group">
                      <div className="bg-card/20 border border-border hover:border-primary/30 rounded-xl overflow-hidden transition-all duration-500 hover:bg-card/40">
                        {event.imageUrl ? (
                          <div className="w-full aspect-[21/9] bg-muted relative border-b border-border/50">
                            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                            
                            <div className="absolute bottom-4 left-6 right-6">
                              <h3 className="text-2xl font-serif text-foreground text-glow">{event.title}</h3>
                            </div>
                          </div>
                        ) : (
                          <div className="p-6 border-b border-border/50 bg-muted/10 flex justify-between items-start gap-4">
                            <h3 className="text-2xl font-serif text-foreground">{event.title}</h3>
                            <Button 
                              onClick={() => generateImage.mutate({ eventId: event.id })}
                              disabled={generateImage.isPending && generateImage.variables?.eventId === event.id}
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                            >
                              {generateImage.isPending && generateImage.variables?.eventId === event.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <ImageIcon className="w-4 h-4 mr-2" />
                              )}
                              Generate Scene Image
                            </Button>
                          </div>
                        )}

                        <div className="p-6 md:p-8 space-y-6">
                          <p className="text-muted-foreground leading-relaxed text-lg">
                            {event.description}
                          </p>
                          {event.visualDescription && (
                            <p className="text-sm text-muted-foreground/60 italic border-l-2 border-primary/20 pl-4 leading-relaxed">
                              {event.visualDescription}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-4 pt-4 border-t border-border/50">
                            {event.location && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono bg-background/50 px-3 py-1.5 rounded-md border border-border/50">
                                <MapPin className="w-4 h-4 text-primary/70" />
                                {event.location}
                              </div>
                            )}
                            
                            {event.emotionalTone && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono bg-background/50 px-3 py-1.5 rounded-md border border-border/50">
                                <span className="text-primary/70">Tone:</span> {event.emotionalTone}
                              </div>
                            )}
                          </div>

                          {event.characters && event.characters.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                              {event.characters.map((char, i) => (
                                <Badge key={i} variant="secondary" className="font-mono text-xs bg-muted/50 hover:bg-muted text-muted-foreground">
                                  {char}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}