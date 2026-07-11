import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listPublicEvents } from "@/lib/events.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, ExternalLink, Phone } from "lucide-react";
import { BASE_URL } from "@/lib/seo";

const eventsQueryOptions = queryOptions({
  queryKey: ["public-events"],
  queryFn: () => listPublicEvents(),
});

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events in Kutch — Kutchi Hub" },
      { name: "description", content: "Upcoming events, fairs, festivals and gatherings across Kutch. Find dates, venues and details on Kutchi Hub." },
      { property: "og:title", content: "Events in Kutch — Kutchi Hub" },
      { property: "og:description", content: "Upcoming events, fairs, festivals and gatherings across Kutch." },
      { property: "og:url", content: `${BASE_URL}/events` },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/events` }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(eventsQueryOptions),
  component: EventsPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <p className="text-sm text-destructive">Failed to load events: {error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">Not found</div>,
});

function EventsPage() {
  const { data: events } = useSuspenseQuery(eventsQueryOptions);
  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.start_at) >= now);
  const past = events.filter((e) => new Date(e.start_at) < now);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-foreground">Events in Kutch</h1>
        <p className="mt-2 text-muted-foreground">Discover upcoming fairs, festivals and gatherings near you.</p>
      </div>

      {upcoming.length === 0 && past.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No events yet. Check back soon!</CardContent></Card>
      )}

      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-bold text-foreground">Upcoming</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold text-muted-foreground">Past events</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((e) => <EventCard key={e.id} event={e} past />)}
          </div>
        </section>
      )}
    </div>
  );
}

function EventCard({ event, past }: { event: any; past?: boolean }) {
  const start = new Date(event.start_at);
  const dateLabel = start.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const timeLabel = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <Card className={`overflow-hidden transition-all hover:shadow-md ${past ? "opacity-70" : ""}`}>
      {event.image_url && (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img src={event.image_url} alt={event.title} loading="lazy" className="size-full object-cover" />
        </div>
      )}
      <CardContent className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {event.category && <Badge variant="secondary">{event.category}</Badge>}
          {event.city && <Badge variant="outline">{event.city}</Badge>}
        </div>
        <h3 className="text-lg font-bold text-foreground">{event.title}</h3>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{dateLabel} · {timeLabel}</span>
        </div>
        {event.location && (
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
        )}
        {event.description && (
          <p className="mt-3 line-clamp-3 text-sm text-foreground">{event.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {event.contact && (
            <a href={`tel:${event.contact}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Phone className="h-3.5 w-3.5" /> {event.contact}
            </a>
          )}
          {event.link_url && (
            <a href={event.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> More info
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}