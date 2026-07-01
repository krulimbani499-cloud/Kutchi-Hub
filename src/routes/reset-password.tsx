import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — NearMe" },
      { name: "description", content: "Set a new password for your NearMe account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setType("recovery");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMessage("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password updated successfully. You can now sign in.");
    }
  };

  return (
    <div className="mx-auto mt-12 max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h1 className="mb-2 text-xl font-bold text-foreground">Reset Password</h1>
      {type !== "recovery" && (
        <p className="mb-4 text-sm text-muted-foreground">This link appears to be invalid. Please request a new password reset link.</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={loading || type !== "recovery"}>
          {loading ? "Updating..." : "Update password"}
        </Button>
      </form>
      {message && (
        <p className={`mt-4 text-center text-sm ${message.includes("success") ? "text-success" : "text-destructive"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
