import { useParams, Link } from "wouter";
import { useListCharacters, getListCharactersQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function CharacterGallery() {
  const params = useParams();
  const novelId = Number(params.novelId);

  const { data: characters, isLoading } = useListCharacters(novelId, {
    query: {
      enabled: !!novelId,
      queryKey: getListCharactersQueryKey(novelId)
    }
  });

  return (
    <Layout novelId={novelId}>
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        <header className="mb-12 border-b border-border pb-6 flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-serif text-glow mb-2">Dramatis Personae</h1>
            <p className="text-muted-foreground font-light">The cast of characters within the story.</p>
          </div>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="animate-pulse bg-muted/50 border border-border/50 rounded-xl h-80" />
            ))}
          </div>
        ) : !characters?.length ? (
          <div className="text-center py-20 text-muted-foreground">No characters found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {characters.map(char => (
              <Link key={char.id} href={`/novels/${novelId}/characters/${char.id}`}>
                <div 
                  className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/30 hover:border-primary/50 transition-all duration-500 cursor-pointer h-[400px] flex flex-col hover-elevate"
                  style={{ '--char-color': char.color || 'var(--primary)' } as React.CSSProperties}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background z-10 opacity-80" />
                  
                  {char.imageUrl ? (
                    <img 
                      src={char.imageUrl} 
                      alt={char.name} 
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 grayscale-[0.3] group-hover:grayscale-0" 
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                      <Users className="w-16 h-16 text-muted-foreground/20" />
                    </div>
                  )}

                  <div className="relative z-20 mt-auto p-6 flex flex-col h-full justify-end">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--char-color)' }} />
                      <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest bg-background/50 backdrop-blur">
                        {char.role}
                      </Badge>
                    </div>
                    
                    <h3 className="font-serif text-2xl font-medium text-foreground mb-2 group-hover:text-[var(--char-color)] transition-colors">
                      {char.name}
                    </h3>
                    
                    {char.personality && (
                      <p className="text-sm text-foreground/80 line-clamp-2 italic opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-4 group-hover:translate-y-0">
                        "{char.personality}"
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}