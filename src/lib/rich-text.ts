// Descriptions are stored exactly as the owner typed them (plain text with line breaks). This turns that text into blocks to
// show: paragraphs, bullet lists and numbered lists. Nothing here makes HTML: the blocks hold plain strings that the
// <RichText> component renders as text, so "<b>", "**x**" or "[x](y)" typed by an owner show up literally and do nothing.

export type RichBlock =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[]; start: number };

// "-", "*" and "–" start a bullet when the text follows, with or without a space ("- item", "-item"), or stand alone on the line
// (an empty bullet, skipped). Not bullets: "-5% off" (a digit follows), "--" / "---" and "**bold**" (another dash or star follows).
const SPACED_BULLET = /^[-*–](?![-*–\d])\s*(.*)$/;
// Symbol bullets: the space after them is optional ("✓Free parking" works too). An emoji variation selector is swallowed.
// Other emojis (📞 📸 ✅ ...) are NOT markers: a line that starts with one is an ordinary line and the emoji stays.
const SYMBOL_BULLET = /^[•●▪◦‣✓✔\u{1F449}]️?\s*(.*)$/u;
// "1." or "1)" followed by a space; "1.5 kg" and "2024. Founded" are not numbered items.
const NUMBERED = /^(\d{1,3})[.)]\s+(.*)$/;

type Marker = { kind: "ul"; text: string } | { kind: "ol"; text: string; n: number };

function marker(line: string): Marker | null {
  const t = line.trim();
  let m = SPACED_BULLET.exec(t);
  if (m) return { kind: "ul", text: (m[1] ?? "").trim() };
  m = SYMBOL_BULLET.exec(t);
  if (m) return { kind: "ul", text: m[1].trim() };
  m = NUMBERED.exec(t);
  if (m) return { kind: "ol", n: Number(m[1]), text: m[2].trim() };
  return null;
}

/**
 *  - a blank line starts a new paragraph;
 *  - a single line break stays a line break inside the paragraph;
 *  - consecutive bullet lines become one bulleted list, consecutive numbered lines one numbered list (marker removed);
 *  - bullet lines of the same kind separated only by blank lines are still ONE list (people leave gaps between items);
 *  - a plain line right after a list starts a new paragraph.
 */
export function parseRichText(input: string | null | undefined): RichBlock[] {
  const lines = (input ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: RichBlock[] = [];
  let last: RichBlock | null = null;
  let gap = false; // a blank line came after `last`

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      gap = true;
      continue;
    }
    const m = marker(line);
    if (m) {
      if (!m.text) continue; // a marker with nothing after it
      if (last && last.type === m.kind) {
        last.items.push(m.text);
      } else {
        last = m.kind === "ul" ? { type: "ul", items: [m.text] } : { type: "ol", items: [m.text], start: m.n };
        blocks.push(last);
      }
      gap = false;
      continue;
    }
    if (last && last.type === "p" && !gap) {
      last.lines.push(line);
    } else {
      last = { type: "p", lines: [line] };
      blocks.push(last);
    }
    gap = false;
  }
  return blocks;
}

/** One short line for cards and search results: markers removed, lines joined with " · ". */
export function plainPreview(input: string | null | undefined): string {
  return (input ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => {
      const t = l.trim();
      return t ? (marker(t)?.text ?? t) : "";
    })
    .filter(Boolean)
    .join(" · ");
}
