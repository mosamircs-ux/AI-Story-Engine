import { ReactNode } from "react";
import { Link, useRoute } from "wouter";
import { BookOpen, Users, Clock, MessageSquare, Home, MapPin, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
  novelId?: number;
}

export function Layout({ children, novelId }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex w-full bg-background relative isolate">
      <div className="noise-overlay" />
      
      {novelId && (
        <nav className="w-16 md:w-64 border-r border-border bg-card/50 backdrop-blur flex flex-col pt-8 pb-4 shrink-0 fixed h-[100dvh] left-0 top-0 z-40 transition-all duration-300">
          <div className="px-4 mb-8 hidden md:block">
            <h2 className="font-serif text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">Novel World</h2>
          </div>
          
          <div className="flex-1 flex flex-col gap-2 px-2 md:px-3">
            <NavItem href="/" icon={Home} label="Library" />
            <div className="h-px bg-border my-2 mx-2" />
            <NavItem href={`/novels/${novelId}`} icon={BookOpen} label="Dashboard" />
            <NavItem href={`/novels/${novelId}/characters`} icon={Users} label="Characters" />
            <NavItem href={`/novels/${novelId}/events`} icon={Clock} label="Story Events" />
            <NavItem href={`/novels/${novelId}/dialogue`} icon={MessageSquare} label="Dialogue" />
            <NavItem href={`/novels/${novelId}/locations`} icon={MapPin} label="Locations" />
            <NavItem href={`/novels/${novelId}/cinema`} icon={Clapperboard} label="Cinema" />
          </div>
        </nav>
      )}

      <main className={cn(
        "flex-1 relative z-10 transition-all duration-300 w-full",
        novelId ? "ml-16 md:ml-64" : ""
      )}>
        {children}
      </main>
    </div>
  );
}

function NavItem({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const [isActive] = useRoute(href === "/" ? "/" : `${href}(/.*)?`);
  
  return (
    <Link href={href} className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group",
      isActive 
        ? "bg-primary/10 text-primary" 
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )}>
      <Icon className={cn("w-5 h-5 shrink-0 transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-110")} />
      <span className="hidden md:block font-medium text-sm tracking-wide">{label}</span>
    </Link>
  );
}