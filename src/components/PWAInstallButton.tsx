import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWAInstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already running as installed PWA?
    if (typeof window !== "undefined") {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        // iOS Safari
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      if (standalone) setInstalled(true);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    // Fallback: iOS / unsupported browsers — show manual instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    alert(
      isIOS
        ? "To install: tap the Share button in Safari, then choose 'Add to Home Screen'."
        : "To install: open your browser menu and choose 'Install app' or 'Add to Home Screen'.",
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-[#ff6a00]/30 bg-gradient-to-r from-[#ff6a00] to-[#e65a00] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
      aria-label="Install Kutchi Hub app"
    >
      <Download className="h-4 w-4" />
      Install App
    </button>
  );
}