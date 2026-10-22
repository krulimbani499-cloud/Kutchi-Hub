import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, signOut } from "@/lib/auth";
import { deleteMyAccount, getAccountSummary } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Kutchi Hub" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: summary } = useQuery({ queryKey: ["account-summary"], queryFn: () => getAccountSummary(), enabled: open });

  const confirmDelete = async () => {
    if (typed !== "DELETE" || busy) return;
    setBusy(true);
    try {
      await deleteMyAccount({ data: { confirm: "DELETE" } });
      toast.success("Your account has been deleted.");
      setOpen(false);
      try {
        await signOut();
      } catch {
        /* the account is already gone; the local session is cleared on the next request */
      }
      await navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Settings</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{user?.email ?? "your account"}</span>.{" "}
        <Link to="/dashboard" className="text-primary hover:underline">Back to dashboard</Link>
      </p>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <TriangleAlert className="h-4 w-4" /> Delete my account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            This permanently deletes your Kutchi Hub account and your personal data: your profile, reviews, saved businesses,
            reward points and notifications. It cannot be undone.
          </p>
          <p>
            Business listings you own are <strong className="text-foreground">not deleted</strong>: they are archived (hidden from the
            website) and no longer linked to you.
          </p>
          <Button variant="destructive" onClick={() => { setTyped(""); setOpen(true); }}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete my account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-5 w-5" /> Delete your account?
            </DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {summary && summary.businessCount > 0 && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
                You own {summary.businessCount} business listing{summary.businessCount === 1 ? "" : "s"}. They will be archived (hidden
                from the website), not deleted.
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
              <Input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder="DELETE" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={typed !== "DELETE" || busy}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />} Delete my account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
