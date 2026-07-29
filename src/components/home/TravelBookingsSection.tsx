import { Link } from "@tanstack/react-router";

type Item = {
  label: string;
  emoji: string;
  tag: string;
  to: string;
  search?: Record<string, string>;
};

const ITEMS: Item[] = [
  { label: "Flight", emoji: "✈️", tag: "", to: "/travel/flight-booking" },
  { label: "Bus", emoji: "🚌", tag: "Affordable Rides", to: "/search", search: { category: "bus" } },
  { label: "Train", emoji: "🚆", tag: "", to: "/search", search: { category: "train" } },
  { label: "Hotel", emoji: "🏨", tag: "Budget-friendly Stay", to: "/search", search: { category: "hotels" } },
  { label: "Car Rentals", emoji: "🚗", tag: "Drive Easy Anywhere", to: "/search", search: { category: "car-rentals" } },
];

export function TravelBookingsSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] md:items-center">
          <div>
            <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">Travel Bookings</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Instant ticket bookings for your best travel experience
            </p>
            <Link
              to="/search"
              search={{ category: "travel" }}
              className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
            >
              Explore More
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
            {ITEMS.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                search={item.search}
                className="group flex flex-col items-center text-center"
              >
                <div className="flex aspect-square w-full max-w-[92px] items-center justify-center rounded-2xl border border-border bg-background text-4xl shadow-sm transition-transform group-hover:-translate-y-0.5 sm:text-5xl">
                  <span aria-hidden>{item.emoji}</span>
                </div>
                <span className="mt-2 text-sm font-semibold text-foreground">{item.label}</span>
                {item.tag && (
                  <span className="mt-1 text-xs font-medium text-emerald-600">{item.tag}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}