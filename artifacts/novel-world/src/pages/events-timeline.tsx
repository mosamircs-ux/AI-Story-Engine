import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import {
  useListEvents, getListEventsQueryKey,
  useListCharacters, getListCharactersQueryKey,
  useGenerateEventImage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, Image as ImageIcon, Loader2, MapPin, Clapperboard, GitBranch, Film } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tone system ──────────────────────────────────────────────────────────────

type Tone = "tense" | "joyful" | "sad" | "mysterious" | "romantic" | "violent" | "peaceful" | "shocking" | "hopeful" | "despairing";

const TONE_META: Record<string, { color: string; bg: string; border: string; intensity: number; emoji: string }> = {
  violent:    { color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   intensity: 10, emoji: "⚔️" },
  shocking:   { color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.3)",  intensity: 9,  emoji: "💥" },
  tense:      { color: "#eab308", bg: "rgba(234,179,8,0.08)",   border: "rgba(234,179,8,0.3)",   intensity: 8,  emoji: "⚡" },
  mysterious: { color: "#a855f7", bg: "rgba(168,85,247,0.08)",  border: "rgba(168,85,247,0.3)",  intensity: 7,  emoji: "🌑" },
  despairing: { color: "#6366f1", bg: "rgba(99,102,241,0.08)",  border: "rgba(99,102,241,0.3)",  intensity: 6,  emoji: "💔" },
  sad:        { color: "#3b82f6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.3)",  intensity: 5,  emoji: "🌧" },
  romantic:   { color: "#ec4899", bg: "rgba(236,72,153,0.08)",  border: "rgba(236,72,153,0.3)",  intensity: 4,  emoji: "🌹" },
  hopeful:    { color: "#06b6d4", bg: "rgba(6,182,212,0.08)",   border: "rgba(6,182,212,0.3)",   intensity: 3,  emoji: "🌅" },
  joyful:     { color: "#84cc16", bg: "rgba(132,204,22,0.08)",  border: "rgba(132,204,22,0.3)",  intensity: 2,  emoji: "✨" },
  peaceful:   { color: "#22c55e", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.3)",   intensity: 1,  emoji: "🕊" },
};

function getToneMeta(tone: string | null | undefined) {
  if (!tone) return null;
  return TONE_META[tone.toLowerCase()] ?? null;
}

// ─── Story Arc SVG ────────────────────────────────────────────────────────────

function StoryArc({ events, onClickEvent }: { events: any[]; onClickEvent: (id: number) => void }) {
  const W = 800;
  const H = 120;
  const PAD = 24;

  if (events.length < 2) return null;

  const points = events.map((e, i) => {
    const meta = getToneMeta(e.emotionalTone);
    const intensity = meta?.intensity ?? 5;
    const x = PAD + (i / (events.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((intensity - 1) / 9) * (H - PAD * 2);
    return { x, y, event: e, color: meta?.color ?? "var(--primary)" };
  });

  // Build smooth SVG path
  const d = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, "");

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/50 bg-card/20 px-2 py-2">
      <p className="absolute top-3 left-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/40">Story Arc</p>
      <p className="absolute bottom-3 left-4 text-[8px] font-mono text-muted-foreground/30">calm</p>
      <p className="absolute top-3 right-4 text-[8px] font-mono text-muted-foreground/30 rotate-0">intense</p>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={PAD}
            y1={H - PAD - t * (H - PAD * 2)}
            x2={W - PAD}
            y2={H - PAD - t * (H - PAD * 2)}
            stroke="rgba(255,255,255,0.04)"
            strokeDasharray="4 4"
          />
        ))}

        {/* Gradient fill under curve */}
        <defs>
          <linearGradient id="arc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${d} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`}
          fill="url(#arc-fill)"
        />

        {/* Curve */}
        <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeOpacity="0.5" />

        {/* Chapter dividers */}
        {(() => {
          const seenChapters = new Set<number>();
          return points.map((p) => {
            if (seenChapters.has(p.event.chapterNumber)) return null;
            seenChapters.add(p.event.chapterNumber);
            return (
              <line
                key={p.event.chapterNumber}
                x1={p.x}
                y1={PAD}
                x2={p.x}
                y2={H - PAD}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="2 4"
              />
            );
          });
        })()}

        {/* Event dots */}
        {points.map((p, i) => (
          <g key={i} className="cursor-pointer" onClick={() => onClickEvent(p.event.id)}>
            <circle cx={p.x} cy={p.y} r={10} fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r={p.event.imageUrl ? 5 : 3.5}
              fill={p.color}
              opacity={0.9}
            />
            {p.event.imageUrl && (
              <circle cx={p.x} cy={p.y} r={7} fill="none" stroke={p.color} strokeWidth="1" opacity="0.5" />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  index,
  isHighlighted,
  cardRef,
  onGenerateImage,
  isGenerating,
  characters,
}: {
  event: any;
  index: number;
  isHighlighted: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  onGenerateImage: () => void;
  isGenerating: boolean;
  characters: any[];
}) {
  const meta = getToneMeta(event.emotionalTone);
  const isLeft = index % 2 === 0;

  const eventChars = characters.filter((c) =>
    (event.characters ?? []).some((n: string) => n.toLowerCase() === c.name.toLowerCase()),
  );

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative flex gap-6 md:gap-10 items-start transition-all duration-700",
        isLeft ? "flex-row" : "flex-row-reverse",
        "scroll-mt-24",
      )}
      id={`event-${event.id}`}
    >
      {/* Timeline node */}
      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center z-10 hidden md:flex">
        <div
          className="w-4 h-4 rounded-full border-2 border-background shadow-lg transition-transform duration-300"
          style={{
            backgroundColor: meta?.color ?? "hsl(var(--primary))",
            boxShadow: isHighlighted ? `0 0 16px ${meta?.color ?? "hsl(var(--primary))"}80` : undefined,
            transform: isHighlighted ? "scale(1.5)" : "scale(1)",
          }}
        />
        <span className="text-[10px] font-mono text-muted-foreground/50 mt-1 whitespace-nowrap">
          Ch. {event.chapterNumber}
        </span>
      </div>

      {/* Spacer on alternating side */}
      <div className="flex-1 hidden md:block" />

      {/* Card */}
      <div
        className={cn(
          "flex-1 group rounded-xl border overflow-hidden transition-all duration-500",
          isHighlighted
            ? "border-primary/50 shadow-xl"
            : "border-border/50 hover:border-primary/20",
        )}
        style={
          isHighlighted && meta
            ? { borderColor: meta.border, boxShadow: `0 8px 32px ${meta.color}20` }
            : {}
        }
      >
        {/* Image / header */}
        {event.imageUrl ? (
          <div className="relative aspect-[16/7] bg-muted overflow-hidden">
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover grayscale-[0.1] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              {meta && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest mb-2 opacity-80">
                  <span>{meta.emoji}</span>
                  <span style={{ color: meta.color }}>{event.emotionalTone}</span>
                </span>
              )}
              <h3 className="text-xl md:text-2xl font-serif text-foreground text-glow leading-tight">
                {event.title}
              </h3>
            </div>
            {/* Regenerate button on hover */}
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background/40 backdrop-blur text-xs"
              onClick={onGenerateImage}
              disabled={isGenerating}
            >
              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
            </Button>
          </div>
        ) : (
          <div
            className="p-5 border-b border-border/50 flex justify-between items-start gap-4"
            style={meta ? { backgroundColor: meta.bg } : {}}
          >
            <div>
              {meta && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest mb-1.5 opacity-70">
                  <span>{meta.emoji}</span>
                  <span style={{ color: meta.color }}>{event.emotionalTone}</span>
                </span>
              )}
              <h3 className="text-xl font-serif text-foreground">{event.title}</h3>
            </div>
            <Button
              onClick={onGenerateImage}
              disabled={isGenerating}
              variant="outline"
              size="sm"
              className="shrink-0 border-border/50 text-muted-foreground hover:text-foreground"
            >
              {isGenerating ? (
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              ) : (
                <ImageIcon className="w-3 h-3 mr-1.5" />
              )}
              Generate Scene
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="p-5 md:p-6 space-y-4" style={meta ? { backgroundColor: `${meta.bg}` } : {}}>
          <p className="text-muted-foreground leading-relaxed">{event.description}</p>

          {event.visualDescription && (
            <p
              className="text-xs text-muted-foreground/60 italic border-l-2 pl-3 leading-relaxed"
              style={{ borderColor: meta?.color ?? "hsl(var(--primary))" }}
            >
              {event.visualDescription}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/30">
            {event.location && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-background/40 px-2.5 py-1 rounded-md border border-border/40">
                <MapPin className="w-3 h-3" style={{ color: meta?.color ?? undefined }} />
                {event.location}
              </div>
            )}

            {/* Character avatars */}
            {eventChars.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                {eventChars.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    title={c.name}
                    className="w-6 h-6 rounded-full border-2 border-background overflow-hidden shrink-0"
                    style={{ borderColor: c.color ?? "#666" }}
                  >
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-[8px] font-bold"
                        style={{ backgroundColor: `${c.color ?? "#666"}30`, color: c.color ?? "#999" }}
                      >
                        {c.name.charAt(0)}
                      </div>
                    )}
                  </div>
                ))}
                {eventChars.length > 5 && (
                  <span className="text-[10px] font-mono text-muted-foreground/50">+{eventChars.length - 5}</span>
                )}
              </div>
            )}

            {/* Fallback character badges if no matched chars */}
            {eventChars.length === 0 && event.characters && event.characters.length > 0 && (
              <div className="flex flex-wrap gap-1 ml-auto">
                {event.characters.slice(0, 4).map((char: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-mono px-2 py-0.5 bg-muted/40">
                    {char}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Coming Soon card ─────────────────────────────────────────────────────────

function ComingSoonCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex-1 rounded-xl border border-dashed border-border/40 bg-card/10 p-6 md:p-8 flex flex-col gap-3 group hover:border-primary/20 transition-all duration-300">
      <div className="w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
        <Icon className="w-5 h-5 text-primary/40 group-hover:text-primary/60 transition-colors" />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-serif text-foreground/70 text-lg">{title}</h3>
          <span className="text-[10px] font-mono uppercase tracking-widest text-primary/40 border border-primary/20 px-1.5 py-0.5 rounded-full">Soon</span>
        </div>
        <p className="text-sm text-muted-foreground/60 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const ALL_TONES = Object.keys(TONE_META);

export function EventsTimeline() {
  const params = useParams();
  const novelId = Number(params.novelId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [toneFilter, setToneFilter] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const { data: events, isLoading } = useListEvents(novelId, {
    query: { enabled: !!novelId, queryKey: getListEventsQueryKey(novelId) },
  });

  const { data: characters } = useListCharacters(novelId, {
    query: { enabled: !!novelId, queryKey: getListCharactersQueryKey(novelId) },
  });

  const generateImage = useGenerateEventImage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(novelId) });
        toast({ title: "Scene image generated" });
      },
      onError: () => {
        toast({ title: "Generation failed", variant: "destructive" });
      },
    },
  });

  // Sort events globally by chapter + sequenceOrder
  const sorted = [...(events ?? [])].sort((a, b) => {
    if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
    return (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0);
  });

  // Active tones for filter tabs
  const activeTones = [...new Set(sorted.map((e) => e.emotionalTone).filter(Boolean))] as string[];

  const filtered = toneFilter ? sorted.filter((e) => e.emotionalTone === toneFilter) : sorted;

  const handleArcClick = (id: number) => {
    setHighlightedId(id);
    const el = cardRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlightedId(null), 3000);
  };

  return (
    <Layout novelId={novelId}>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-16 space-y-12">

        {/* Header */}
        <header className="border-b border-border pb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-serif text-glow mb-1">Story Timeline</h1>
            <p className="text-muted-foreground font-light">
              {sorted.length} events across the narrative arc
            </p>
          </div>
          <Link href={`/novels/${novelId}/cinema`}>
            <Button variant="outline" size="sm" className="gap-2 shrink-0">
              <Clapperboard className="w-4 h-4" />
              Open Cinema
            </Button>
          </Link>
        </header>

        {isLoading ? (
          <div className="space-y-8">
            <div className="h-32 bg-card/40 rounded-xl border border-border/50 animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-card/30 rounded-xl border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : !sorted.length ? (
          <div className="text-center py-24 border border-dashed border-border rounded-xl">
            <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-muted-foreground">No events found. Run analysis to extract story events.</p>
          </div>
        ) : (
          <>
            {/* Story Arc visualization */}
            <StoryArc events={sorted} onClickEvent={handleArcClick} />

            {/* Tone filter tabs */}
            {activeTones.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setToneFilter(null)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-mono transition-all duration-200",
                    !toneFilter
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground border border-border/40 hover:border-border hover:text-foreground",
                  )}
                >
                  All ({sorted.length})
                </button>
                {activeTones.map((tone) => {
                  const meta = getToneMeta(tone);
                  const count = sorted.filter((e) => e.emotionalTone === tone).length;
                  return (
                    <button
                      key={tone}
                      onClick={() => setToneFilter(toneFilter === tone ? null : tone)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-mono transition-all duration-200 flex items-center gap-1.5 border",
                        toneFilter === tone ? "opacity-100" : "opacity-60 hover:opacity-90",
                      )}
                      style={
                        toneFilter === tone && meta
                          ? { backgroundColor: meta.bg, borderColor: meta.border, color: meta.color }
                          : { borderColor: meta?.border ?? "var(--border)", color: meta?.color ?? "var(--muted-foreground)" }
                      }
                    >
                      <span>{meta?.emoji}</span>
                      <span className="capitalize">{tone}</span>
                      <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Timeline */}
            <div className="relative space-y-10 md:space-y-16">
              {/* Center line on desktop */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent hidden md:block" />

              {filtered.map((event, i) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={i}
                  isHighlighted={highlightedId === event.id}
                  cardRef={(el) => { cardRefs.current[event.id] = el; }}
                  onGenerateImage={() => generateImage.mutate({ eventId: event.id })}
                  isGenerating={generateImage.isPending && generateImage.variables?.eventId === event.id}
                  characters={characters ?? []}
                />
              ))}
            </div>

            {/* Coming Soon section */}
            <div className="pt-12 border-t border-border/40">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/40 mb-6 text-center">
                Coming Next
              </p>
              <div className="flex flex-col md:flex-row gap-4">
                <ComingSoonCard
                  icon={GitBranch}
                  title="Interactive Story"
                  desc="Navigate the story as a player — make choices at key decision points and explore alternate paths through the narrative."
                />
                <ComingSoonCard
                  icon={Film}
                  title="Movie Generator"
                  desc="Assemble the cinematic scenes, dialogue audio, and scene images into a full movie sequence you can export and share."
                />
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
