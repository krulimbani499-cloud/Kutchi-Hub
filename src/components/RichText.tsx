import { Fragment } from "react";
import { parseRichText } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/**
 * Shows a description the way the owner typed it: paragraphs, line breaks, bullet lists and numbered lists
 * (see lib/rich-text.ts for the rules). Everything is rendered as React text nodes: there is no dangerouslySetInnerHTML and no
 * HTML or markdown interpretation, so nothing an owner types can inject markup. Long words and URLs wrap (no sideways scroll).
 * Colour and size come from `className` (e.g. "text-sm text-muted-foreground").
 */
export function RichText({ text, className }: { text: string | null | undefined; className?: string }) {
  const blocks = parseRichText(text);
  if (blocks.length === 0) return null;
  return (
    <div className={cn("min-w-0 max-w-full space-y-2 [overflow-wrap:anywhere]", className)} data-rich-text>
      {blocks.map((b, i) => {
        if (b.type === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-[#ff6a00]">
              {b.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={i} start={b.start} className="list-decimal space-y-1 pl-6 marker:font-medium marker:text-[#ff6a00]">
              {b.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i}>
            {b.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
