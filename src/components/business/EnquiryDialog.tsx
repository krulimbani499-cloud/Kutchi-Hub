import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { submitEnquiry } from "@/lib/leads.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { MessageSquare, CheckCircle2, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface Props {
  businessId: string;
  businessName: string;
  city?: string | null;
  defaultName?: string;
  defaultPhone?: string;
  defaultEmail?: string;
}

export function EnquiryDialog({ businessId, businessName, city, defaultName, defaultPhone, defaultEmail }: Props) {
  const submit = useServerFn(submitEnquiry);
  const { isAuthenticated, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(defaultName ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [service, setService] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submit({
        data: {
          businessId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          serviceNeeded: service.trim() || undefined,
          message: message.trim() || undefined,
          city: city ?? undefined,
        },
      });
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setService("");
        setMessage("");
      }, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send enquiry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 w-full bg-[#ff6a00] text-white hover:bg-[#e65a00]">
          <MessageSquare className="mr-2 h-4 w-4" />
          Send Enquiry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send enquiry to {businessName}</DialogTitle>
          <DialogDescription>
            The business will contact you on the phone number below.
          </DialogDescription>
        </DialogHeader>
        {!isLoading && !isAuthenticated ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <LogIn className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">Sign in to send an enquiry</p>
            <p className="text-sm text-muted-foreground">
              We ask you to sign in so businesses can trust incoming enquiries.
            </p>
            <Button asChild className="mt-2 bg-[#ff6a00] text-white hover:bg-[#e65a00]">
              <Link to="/auth">Sign in / Create account</Link>
            </Button>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="font-semibold text-foreground">Enquiry sent!</p>
            <p className="text-sm text-muted-foreground">The business will get in touch soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Your Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Rahul Sharma" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone Number *</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" maxLength={20} placeholder="+91 98xxxxxxxx" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email (optional)</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={255} placeholder="you@example.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Service Needed (optional)</label>
              <Input value={service} onChange={(e) => setService(e.target.value)} maxLength={120} placeholder="e.g. Wedding catering, AC repair..." />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Message (optional)</label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={3} placeholder="Tell them what you need..." />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={submitting || name.trim().length < 2 || phone.trim().length < 6} className="w-full bg-[#ff6a00] text-white hover:bg-[#e65a00]">
                {submitting ? "Sending..." : "Send Enquiry"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}