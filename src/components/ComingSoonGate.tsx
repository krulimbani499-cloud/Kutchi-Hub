import { useEffect, useState, type ReactNode } from "react";
import { useRouterState, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/kutchi-hub-logo.png";

// Routes that must remain accessible so admins can sign in.
const ALLOWED_PATHS = ["/auth", "/reset-password"];

export function ComingSoonGate({ children }: { children: ReactNode }) {
  // Coming Soon gate temporarily disabled — full site open to all users.
  return <>{children}</>;
}

function ComingSoonScreen({ loading }: { loading: boolean }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#fff7ef] via-background to-[#fff1e0] px-6 text-center">
      <img src={logo} alt="Kutchi Hub" className="mb-6 h-20 w-20 rounded-2xl shadow-lg" />
      <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
        Kutchi Hub
      </h1>
      <p className="mt-3 text-lg font-semibold text-[#ff6a00]">Coming Soon</p>
      <p className="mt-4 max-w-md text-sm text-muted-foreground sm:text-base">
        Kutch ka apna local business directory — restaurants, doctors, grocery,
        shops aur services. Hum jaldi hi launch ho rahe hain. Stay tuned!
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
        <span className="rounded-full border border-border bg-card/60 px-3 py-1">
          @kutchihub on Instagram
        </span>
        <span className="rounded-full border border-border bg-card/60 px-3 py-1">
          Launching soon
        </span>
      </div>
      {loading ? (
        <p className="mt-8 text-xs text-muted-foreground/70">Loading…</p>
      ) : (
        <Link
          to="/auth"
          className="mt-8 text-xs text-muted-foreground/70 underline underline-offset-4 hover:text-foreground"
        >
          Admin sign in
        </Link>
      )}
    </div>
  );
}