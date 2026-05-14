import { useState } from "react";
import { useParams } from "wouter";
import {
  useListLocations, getListLocationsQueryKey,
  useGenerateLocationImage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, string> = {
  city: "🏙", castle: "🏰", village: "🏘", forest: "🌲",
  desert: "🏜", palace: "🏯", market: "🛒", house: "🏠",
  prison: "⛓", battlefield: "⚔", sea: "🌊", other: "📍",
};

export function LocationsGallery() {
  const params = useParams();
  const novelId = Number(params.novelId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);

  const { data: locs, isLoading } = useListLocations(novelId, {
    query: {
      enabled: !!novelId,
      queryKey: getListLocationsQueryKey(novelId),
    },
  });

  const generateImage = useGenerateLocationImage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey(novelId) });
        toast({ title: "Location image generated" });
      },
      onError: () => {
        toast({ title: "Generation failed", variant: "destructive" });
      },
    },
  });

  const selectedLoc = selected != null ? locs?.find((l) => l.id === selected) : null;

  return (
    <Layout novelId={novelId}>
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <header className="mb-16 border-b border-border pb-6">
          <h1 className="text-4xl font-serif text-glow mb-2">World Map</h1>
          <p className="text-muted-foreground font-light">Every place in the story, brought to life.</p>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-card/50 rounded-xl border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : !locs?.length ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No locations found. Run analysis first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locs.map((loc) => {
              const icon = CATEGORY_ICONS[loc.category ?? "other"] ?? "📍";
              const isGenerating = generateImage.isPending && generateImage.variables?.locationId === loc.id;

              return (
                <div
                  key={loc.id}
                  className={cn(
                    "group rounded-xl border overflow-hidden transition-all duration-500 cursor-pointer",
                    selected === loc.id
                      ? "border-primary/60 shadow-lg shadow-primary/10"
                      : "border-border/50 hover:border-primary/30",
                  )}
                  onClick={() => setSelected(selected === loc.id ? null : loc.id)}
                >
                  {/* Image */}
                  <div className="relative aspect-[16/9] bg-muted">
                    {loc.imageUrl ? (
                      <>
                        <img
                          src={loc.imageUrl}
                          alt={loc.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-card to-background/80 gap-3">
                        <span className="text-5xl opacity-30">{icon}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary/30 text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateImage.mutate({ locationId: loc.id });
                          }}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          ) : (
                            <ImageIcon className="w-3 h-3 mr-1.5" />
                          )}
                          Generate Image
                        </Button>
                      </div>
                    )}

                    {/* Title overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{icon}</span>
                        {loc.category && (
                          <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-widest bg-background/40 backdrop-blur border-border/50">
                            {loc.category}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-xl font-serif text-foreground text-glow">{loc.name}</h3>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {selected === loc.id && (
                    <div className="p-5 bg-card/30 border-t border-border/50 space-y-3">
                      {loc.atmosphere && (
                        <p className="text-xs font-mono text-primary/70 uppercase tracking-widest">{loc.atmosphere}</p>
                      )}
                      {loc.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{loc.description}</p>
                      )}
                      {loc.appearsInChapters && loc.appearsInChapters.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {loc.appearsInChapters.map((ch, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-muted/30 text-muted-foreground font-mono">
                              Ch. {ch}
                            </span>
                          ))}
                        </div>
                      )}
                      {loc.imageUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateImage.mutate({ locationId: loc.id });
                          }}
                          disabled={isGenerating}
                        >
                          {isGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ImageIcon className="w-3 h-3 mr-1" />}
                          Regenerate image
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
