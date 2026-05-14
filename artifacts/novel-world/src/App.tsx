import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HomePage } from "@/pages/home";
import { NovelDashboard } from "@/pages/novel-dashboard";
import { CharacterGallery } from "@/pages/character-gallery";
import { CharacterDetail } from "@/pages/character-detail";
import { EventsTimeline } from "@/pages/events-timeline";
import { DialoguePlayer } from "@/pages/dialogue-player";
import { LocationsGallery } from "@/pages/locations-gallery";
import { Cinema } from "@/pages/cinema";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/novels/:novelId" component={NovelDashboard} />
      <Route path="/novels/:novelId/characters" component={CharacterGallery} />
      <Route path="/novels/:novelId/characters/:characterId" component={CharacterDetail} />
      <Route path="/novels/:novelId/events" component={EventsTimeline} />
      <Route path="/novels/:novelId/dialogue" component={DialoguePlayer} />
      <Route path="/novels/:novelId/locations" component={LocationsGallery} />
      <Route path="/novels/:novelId/cinema" component={Cinema} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
