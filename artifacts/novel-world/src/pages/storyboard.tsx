import { useRef } from "react";
import { useParams } from "wouter";
import {
  useListEvents, getListEventsQueryKey,
  useListCharacters, getListCharactersQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Printer, LayoutGrid, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_COLORS: Record<string, string> = {
  violent: "#ef4444", shocking: "#f97316", tense: "#eab308",
  mysterious: "#a855f7", despairing: "#6366f1", sad: "#3b82f6",
  romantic: "#ec4899", hopeful: "#06b6d4", joyful: "#84cc16", peaceful: "#22c55e",
};
const TONE_EMOJI: Record<string, string> = {
  violent: "⚔️", shocking: "💥", tense: "⚡", mysterious: "🌑",
  despairing: "💔", sad: "🌧", romantic: "🌹", hopeful: "🌅",
  joyful: "✨", peaceful: "🕊",
};

export function Storyboard() {
  const params = useParams();
  const novelId = Number(params.novelId);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: events, isLoading } = useListEvents(novelId, {
    query: { enabled: !!novelId, queryKey: getListEventsQueryKey(novelId) },
  });
  const { data: characters } = useListCharacters(novelId, {
    query: { enabled: !!novelId, queryKey: getListCharactersQueryKey(novelId) },
  });

  const sorted = [...(events ?? [])].sort((a, b) => {
    if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
    return (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0);
  });

  const handlePrint = () => window.print();

  return (
    <Layout novelId={novelId}>
      {/* Print styles injected via style tag */}
      <style>{`
        @media print {
          /* Hide everything except storyboard */
          body > * { display: none !important; }
          #storyboard-print-root { display: block !important; }
          #storyboard-print-root * { display: revert; }

          .no-print { display: none !important; }
          .storyboard-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            padding: 16px;
          }
          .storyboard-panel {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #333 !important;
            background: #fff !important;
            color: #000 !important;
          }
          .storyboard-panel img {
            max-height: 160px;
            object-fit: cover;
          }
          .storyboard-panel-placeholder {
            height: 160px;
            border: 2px dashed #ccc;
            background: #f9f9f9;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            color: #999;
          }
          .tone-badge { font-size: 9px; }
          .panel-desc { font-size: 10px; color: #555; }
          .panel-visual { font-size: 9px; color: #777; font-style: italic; }
          h1, h2 { color: #000; }
        }
      `}</style>

      <div id="storyboard-print-root" className="max-w-6xl mx-auto px-6 py-10 md:py-16">
        {/* Header */}
        <header className="no-print border-b border-border pb-6 mb-10 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-serif text-glow mb-1 flex items-center gap-3">
              <LayoutGrid className="w-8 h-8 text-primary/60" />
              Storyboard
            </h1>
            <p className="text-muted-foreground font-light">
              {sorted.length} scenes — click Print to export as PDF
            </p>
          </div>
          <Button onClick={handlePrint} className="gap-2 shrink-0" disabled={isLoading || !sorted.length}>
            <Printer className="w-4 h-4" />
            Print / Export PDF
          </Button>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border/50 bg-card/30 animate-pulse h-64" />
            ))}
          </div>
        ) : !sorted.length ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl text-muted-foreground">
            <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-20" />
            No scenes found. Run analysis first.
          </div>
        ) : (
          <div ref={printRef} className="storyboard-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sorted.map((event, i) => {
              const toneColor = TONE_COLORS[event.emotionalTone ?? ""] ?? "#888";
              const toneEmoji = TONE_EMOJI[event.emotionalTone ?? ""] ?? "◆";

              const eventChars = (characters ?? []).filter(c =>
                (event.characters ?? []).some((n: string) => n.toLowerCase() === c.name.toLowerCase())
              );

              return (
                <div
                  key={event.id}
                  className={cn(
                    "storyboard-panel rounded-xl border border-border/60 bg-card/20 overflow-hidden flex flex-col",
                    "hover:border-primary/30 transition-all duration-300"
                  )}
                >
                  {/* Panel header */}
                  <div
                    className="px-3 py-2 flex items-center gap-2 border-b border-border/40"
                    style={{ borderLeftColor: toneColor, borderLeftWidth: 3 }}
                  >
                    <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums w-5 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/40">Ch.{event.chapterNumber}</span>
                    {event.emotionalTone && (
                      <span className="tone-badge ml-auto text-[9px] font-mono flex items-center gap-1 shrink-0"
                        style={{ color: toneColor }}>
                        {toneEmoji} {event.emotionalTone}
                      </span>
                    )}
                  </div>

                  {/* Image */}
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="w-full aspect-[16/9] object-cover"
                    />
                  ) : (
                    <div className="storyboard-panel-placeholder w-full aspect-[16/9] bg-muted/30 flex items-center justify-center border-b border-border/30">
                      <span className="text-muted-foreground/30 text-xs font-mono">No image</span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-3 flex flex-col gap-1.5 flex-1">
                    <h3 className="font-serif text-sm font-medium leading-snug text-foreground line-clamp-2">
                      {event.title}
                    </h3>

                    {event.description && (
                      <p className="panel-desc text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {event.visualDescription && (
                      <p className="panel-visual text-[9px] text-muted-foreground/60 italic leading-relaxed line-clamp-2 border-l border-border/40 pl-2">
                        {event.visualDescription}
                      </p>
                    )}

                    {/* Footer: location + character dots */}
                    <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-border/30">
                      {event.location && (
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground/50 font-mono truncate">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                      {eventChars.length > 0 && (
                        <div className="flex gap-0.5 ml-auto shrink-0">
                          {eventChars.slice(0, 4).map(c => (
                            <div
                              key={c.id}
                              title={c.name}
                              className="w-4 h-4 rounded-full border border-background overflow-hidden shrink-0"
                              style={{ borderColor: c.color ?? "#555" }}
                            >
                              {c.imageUrl ? (
                                <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                              ) : (
                                <div
                                  className="w-full h-full flex items-center justify-center text-[6px] font-bold"
                                  style={{ backgroundColor: `${c.color ?? "#555"}30`, color: c.color ?? "#999" }}
                                >
                                  {c.name.charAt(0)}
                                </div>
                              )}
                            </div>
                          ))}
                          {eventChars.length > 4 && (
                            <span className="text-[8px] text-muted-foreground/40 ml-0.5">+{eventChars.length - 4}</span>
                          )}
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
    </Layout>
  );
}
