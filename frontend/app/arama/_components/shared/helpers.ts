import React, { type ReactNode } from "react";

/**
 * Highlight matching query words in text.
 * Returns an array of ReactNodes with <mark> elements for matches.
 */
export function highlightText(text: string, queryStr: string): ReactNode[] {
  if (!queryStr.trim()) return [text];
  const words = queryStr
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return [text];
  const regex = new RegExp(`(${words.join("|")})`, "gi");
  const parts = text.split(regex);
  const testRegex = new RegExp(`^(?:${words.join("|")})$`, "i");
  return parts.map((part, i) =>
    testRegex.test(part)
      ? React.createElement(
          "mark",
          {
            key: i,
            className:
              "bg-[#6C6CFF]/15 text-[#A5A5FF] rounded-sm px-0.5 ring-1 ring-[#6C6CFF]/20",
          },
          part,
        )
      : part,
  );
}

/** Format a duration in milliseconds to a human-readable string. */
export function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** Format a date string to Turkish locale (e.g. "14 Mart 2024"). */
export function formatTurkishDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    let d: Date;
    if (dateStr.includes(".")) {
      const [day, month, year] = dateStr.split(".");
      d = new Date(Number(year), Number(month) - 1, Number(day));
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format legal text into structured paragraphs with section header detection.
 * Returns an array of ReactNodes.
 */
export function formatLegalText(
  text: string,
  searchQuery?: string,
): ReactNode[] {
  if (!text) return [];

  const paragraphs = text.split(/\n\n+/);

  return paragraphs
    .map((para, i) => {
      const trimmed = para.trim();
      if (!trimmed) return null;

      const content = searchQuery
        ? highlightText(trimmed, searchQuery)
        : trimmed;

      const isHeader =
        /^(DAVACI|DAVALI|HÜKÜM|KARAR|GEREKÇESİ|SONUÇ|İDDİA|SAVUNMA|DELİLLER|T\.C\.|TÜRK MİLLETİ ADINA)/i.test(
          trimmed,
        );

      if (isHeader) {
        return React.createElement(
          "div",
          { key: i, className: "mt-4 mb-2" },
          React.createElement(
            "p",
            { className: "text-[13px] font-semibold text-[#6C6CFF]" },
            content,
          ),
        );
      }

      return React.createElement(
        "p",
        {
          key: i,
          className:
            "text-[13px] text-[#ECECEE]/90 leading-relaxed mb-3 whitespace-pre-wrap break-words",
        },
        content,
      );
    })
    .filter(Boolean) as ReactNode[];
}

/** Extract the numeric daire value from a label like "3. Hukuk Dairesi". */
export function parseDaireValue(label: string): string | null {
  const m = label.match(/^(\d+)\./);
  return m ? m[1] : null;
}
