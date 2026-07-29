import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, MapPin, Calendar, Minus, Plus, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/travel/flight-booking")({
  head: () => ({
    meta: [
      { title: "Book Flight Tickets Online — Kutchi Hub Travel" },
      { name: "description", content: "Book cheap domestic and international flight tickets online with instant confirmation, live inventory, and easy cancellation." },
      { property: "og:title", content: "Book Flight Tickets Online — Kutchi Hub Travel" },
      { property: "og:description", content: "Book cheap domestic and international flight tickets online with instant confirmation." },
    ],
  }),
  component: FlightBookingPage,
});

const TABS = [
  { label: "Flight", to: "/travel/flight-booking", active: true },
  { label: "Hotel", to: "/search", search: { category: "hotels" } },
  { label: "Bus", to: "/search", search: { category: "bus" } },
  { label: "Train", to: "/search", search: { category: "train" } },
  { label: "Car Rentals", to: "/search", search: { category: "car-rentals" } },
] as const;

const POPULAR_ROUTES = [
  "Mumbai to Bhuj", "Bhuj to Mumbai", "Ahmedabad to Bhuj", "Bhuj to Ahmedabad",
  "Mumbai to Ahmedabad", "Delhi to Mumbai", "Bangalore to Mumbai", "Mumbai to Kolkata",
  "Chennai to Mumbai", "Pune to Mumbai", "Delhi to Bangalore", "Hyderabad to Mumbai",
];

const AIRPORTS = [
  "Mumbai Airport", "Delhi Airport", "Bhuj Airport", "Ahmedabad Airport",
  "Bangalore Airport", "Chennai Airport", "Kolkata Airport", "Hyderabad Airport",
];

function Counter({ label, sub, value, onChange, min = 0 }: { label: string; sub: string; value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div>
      <p className="text-xs font-semibold text-white/90">{label}</p>
      <p className="text-[10px] text-white/60">{sub}</p>
      <div className="mt-2 flex h-10 items-center gap-2 rounded-md bg-white/10 px-2">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="grid h-7 w-7 place-items-center rounded bg-white/20 text-white hover:bg-white/30">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="flex-1 text-center text-sm font-bold text-white">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} className="grid h-7 w-7 place-items-center rounded bg-white/20 text-white hover:bg-white/30">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function FlightBookingPage() {
  const [tripType, setTripType] = useState<"oneway" | "return">("oneway");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [departure, setDeparture] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // No real booking backend — placeholder search behaviour.
    alert(`Searching flights from ${from || "?"} to ${to || "?"} on ${departure || "?"}`);
  };

  return (
    <div className="bg-muted/30">
      {/* Tabs */}
      <section className="bg-background border-b border-border">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-3 sm:gap-2">
          {TABS.map((t) => (
            <Link
              key={t.label}
              to={t.to}
              search={"search" in t ? t.search : undefined}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                "active" in t && t.active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-muted/70"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Hero + form */}
      <section className="relative">
        <div
          className="relative bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(15,23,42,0.55), rgba(15,23,42,0.7)), url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1600&q=80')",
          }}
        >
          <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
            <form
              onSubmit={handleSearch}
              className="rounded-2xl bg-slate-900/70 p-5 shadow-xl ring-1 ring-white/10 backdrop-blur sm:p-6"
            >
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <input type="radio" checked={tripType === "oneway"} onChange={() => setTripType("oneway")} className="accent-[#ff6a00]" />
                  One Way
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <input type="radio" checked={tripType === "return"} onChange={() => setTripType("return")} className="accent-[#ff6a00]" />
                  Return Journey
                </label>
                <span className="ml-auto text-xs text-white/70">* denotes mandatory fields</span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-semibold text-white/90">* Leaving From</Label>
                  <div className="mt-1 flex h-11 items-center rounded-md bg-white px-3">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      placeholder="Type Departure City"
                      className="h-10 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-white/90">* Going To</Label>
                  <div className="mt-1 flex h-11 items-center rounded-md bg-white px-3">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="Type Destination City"
                      className="h-10 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className={`mt-4 grid gap-4 ${tripType === "return" ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
                <div>
                  <Label className="text-xs font-semibold text-white/90">* Departure</Label>
                  <div className="mt-1 flex h-11 items-center rounded-md bg-white px-3">
                    <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={departure}
                      onChange={(e) => setDeparture(e.target.value)}
                      className="h-10 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                      required
                    />
                  </div>
                </div>
                {tripType === "return" && (
                  <div>
                    <Label className="text-xs font-semibold text-white/90">* Return</Label>
                    <div className="mt-1 flex h-11 items-center rounded-md bg-white px-3">
                      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="h-10 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <Counter label="* Adult 12+" sub="12 years & above" value={adults} onChange={setAdults} min={1} />
                <Counter label="Children 2-12" sub="2 to 12 years" value={children} onChange={setChildren} />
                <Counter label="Infants 0-2" sub="Under 2 years" value={infants} onChange={setInfants} />
              </div>

              <p className="mt-4 text-xs text-white/70">
                Disclaimer: Booking can be made for up to 9 travellers (Adults + Children).
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <Button type="submit" size="lg" className="rounded-md bg-[#ff6a00] px-8 text-white hover:bg-[#e65a00]">
                  SEARCH
                </Button>
                <div className="rounded-md bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-700">
                  Powered by Kutchi Hub Travel
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Info */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="flex items-center gap-2 text-lg font-extrabold text-foreground sm:text-xl">
          <Plane className="h-5 w-5 text-primary" /> Book Flight Tickets Online with Kutchi Hub
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The faster life moves, the faster we need to. Kutchi Hub brings you a quick and easy way to book flights online.
          Choose from an extensive range of airlines to find a flight that suits your preference and schedule. Compare fares,
          check live availability and confirm your booking in a few clicks.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Save on cheap domestic flight tickets to Mumbai, Delhi, Bangalore, Kolkata, Chennai, Ahmedabad and Bhuj with airlines
          like IndiGo, SpiceJet, Air India, Vistara and Akasa Air. We also offer connections to top international destinations.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                <Zap className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-foreground">Instant Flight Ticket Booking</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              We keep booking simple — real-time confirmation with tickets delivered to your inbox in seconds.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-foreground">100% Live Inventory</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Real-time prices and availability. One-click cancellation and dedicated call support whenever you need it.
            </p>
          </div>
        </div>
      </section>

      {/* Popular routes */}
      <section className="mx-auto max-w-7xl px-4 pb-8">
        <div className="rounded-2xl border border-border bg-background p-5">
          <h3 className="text-sm font-bold text-foreground">Popular Flight Routes</h3>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-primary">
            {POPULAR_ROUTES.map((r, i) => (
              <span key={r} className="hover:underline cursor-pointer">
                {r}{i < POPULAR_ROUTES.length - 1 ? " |" : ""}
              </span>
            ))}
          </div>
          <h3 className="mt-6 text-sm font-bold text-foreground">Popular Airports</h3>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-primary">
            {AIRPORTS.map((a, i) => (
              <span key={a} className="hover:underline cursor-pointer">
                {a}{i < AIRPORTS.length - 1 ? " |" : ""}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}