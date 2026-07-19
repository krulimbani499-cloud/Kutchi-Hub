import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Chrome, Loader2, Apple, Gift } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { applyReferralCode } from "@/lib/referrals.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const emailSchema = z.string().email("Enter a valid email");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

function isRunningInsideMobileApp() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const capacitor = (window as any).Capacitor;
  const platform = capacitor?.getPlatform?.();
  const userAgent = navigator.userAgent.toLowerCase();

  return (
    capacitor?.isNativePlatform?.() === true ||
    (typeof platform === "string" && platform !== "web") ||
    userAgent.includes("capacitor") ||
    (userAgent.includes("android") && userAgent.includes("; wv"))
  );
}

export function AuthForms() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showSocialAuth, setShowSocialAuth] = useState(false);

  // Capture ?ref=CODE from URL and stash for post-signup redemption
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setReferral(ref.toUpperCase());
      setMode("signup");
      try {
        localStorage.setItem("kh:pending_referral", ref.toUpperCase());
      } catch {
        /* ignore */
      }
    } else {
      try {
        const stored = localStorage.getItem("kh:pending_referral");
        if (stored) setReferral(stored);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    setShowSocialAuth(!isRunningInsideMobileApp());
  }, []);

  const tryRedeemPending = async () => {
    if (!referral.trim()) return;
    try {
      await applyReferralCode({ data: { code: referral.trim() } });
      try {
        localStorage.removeItem("kh:pending_referral");
      } catch {
        /* ignore */
      }
    } catch {
      /* silent — user can still redeem from dashboard */
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage("Password reset link sent to your email.");
      } else if (mode === "signup") {
        emailSchema.parse(email);
        passwordSchema.parse(password);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (referral.trim()) {
          try {
            localStorage.setItem("kh:pending_referral", referral.trim().toUpperCase());
          } catch {
            /* ignore */
          }
        }
        setMessage("Check your email to confirm your account.");
      } else {
        emailSchema.parse(email);
        passwordSchema.parse(password);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await tryRedeemPending();
        await navigate({ to: "/" });
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setMessage(result.error.message);
    }
  };

  const handleApple = async () => {
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setMessage(result.error.message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Welcome to Kutchi Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to find and manage local businesses.</p>
      </div>

      {mode !== "reset" && showSocialAuth && (
        <>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={loading}
            >
              <Chrome className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleApple}
              disabled={loading}
            >
              <Apple className="mr-2 h-4 w-4" />
              Continue with Apple
            </Button>
          </div>
          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
        </TabsList>
        <TabsContent value="signin">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign in
            </Button>
            <p className="text-center text-sm">
              <button type="button" onClick={() => setMode("reset")} className="text-primary hover:underline">
                Forgot password?
              </button>
            </p>
          </form>
        </TabsContent>
        <TabsContent value="signup">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referral" className="flex items-center gap-1">
                <Gift className="h-3.5 w-3.5 text-[#ff6a00]" />
                Referral code <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="referral"
                value={referral}
                onChange={(e) => setReferral(e.target.value.toUpperCase())}
                placeholder="Get +50 bonus points"
                maxLength={12}
                className="font-mono uppercase tracking-widest"
              />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create account
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {mode === "reset" && (
        <form onSubmit={handleEmailAuth} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send reset link
          </Button>
          <p className="text-center text-sm">
            <button type="button" onClick={() => setMode("signin")} className="text-primary hover:underline">
              Back to sign in
            </button>
          </p>
        </form>
      )}

      {message && (
        <p className={`mt-4 text-center text-sm ${message.includes("sent") || message.includes("Check") ? "text-success" : "text-destructive"}`}>
          {message}
        </p>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        By signing in, you agree to our{" "}
        <Link to="/" className="text-primary hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link to="/" className="text-primary hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
