import { Globe } from "lucide-react";
import { LANGUAGES, useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useLanguage();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 px-2 text-foreground"
          aria-label={t("nav.language")}
          title={t("nav.language")}
        >
          <Globe className="h-4 w-4" />
          <span className={compact ? "text-xs font-semibold" : "text-sm font-semibold"}>
            {compact ? current.short : current.label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[100] min-w-36 bg-popover">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onSelect={() => setLang(l.code)}
            className={l.code === lang ? "font-semibold text-[#ff6a00]" : ""}
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
