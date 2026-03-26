"use client";

import React, { type ReactNode } from "react";
import { parseCitations, type Citation } from "../_lib/citation-parser";

// ────────────────────────────────────────────────────────────────
// Highlight helper (mirrors the one in page.tsx)
// ────────────────────────────────────────────────────────────────

function highlightText(text: string, queryStr: string): ReactNode[] {
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
    testRegex.test(part) ? (
      <mark
        key={i}
        className="bg-[#6C6CFF]/15 text-[#A5A5FF] rounded-sm px-0.5 ring-1 ring-[#6C6CFF]/20"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

// ────────────────────────────────────────────────────────────────
// CitationText component
// ────────────────────────────────────────────────────────────────

export interface CitationTextProps {
  text: string;
  searchQuery?: string;
  onCitationClick?: (citation: Citation) => void;
}

export default function CitationText({
  text,
  searchQuery,
  onCitationClick,
}: CitationTextProps) {
  const citations = parseCitations(text);

  // Build segments: plain text interspersed with citation spans
  const segments: ReactNode[] = [];
  let cursor = 0;

  for (let i = 0; i < citations.length; i++) {
    const c = citations[i];

    // Plain text before this citation
    if (c.start > cursor) {
      const plain = text.slice(cursor, c.start);
      segments.push(
        <React.Fragment key={`t-${cursor}`}>
          {searchQuery ? highlightText(plain, searchQuery) : plain}
        </React.Fragment>,
      );
    }

    // Citation span
    segments.push(
      <span
        key={`c-${c.start}`}
        role="button"
        tabIndex={0}
        className="text-[#6C6CFF] underline decoration-[#6C6CFF]/30 hover:decoration-[#6C6CFF] cursor-pointer transition-colors"
        onClick={() => onCitationClick?.(c)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCitationClick?.(c);
          }
        }}
        title={citationTooltip(c)}
      >
        {c.text}
      </span>,
    );

    cursor = c.end;
  }

  // Trailing plain text
  if (cursor < text.length) {
    const trailing = text.slice(cursor);
    segments.push(
      <React.Fragment key={`t-${cursor}`}>
        {searchQuery ? highlightText(trailing, searchQuery) : trailing}
      </React.Fragment>,
    );
  }

  return <>{segments}</>;
}

// ────────────────────────────────────────────────────────────────
// Tooltip builder
// ────────────────────────────────────────────────────────────────

function citationTooltip(c: Citation): string {
  const parts: string[] = [];
  if (c.mahkeme) parts.push(c.mahkeme);
  if (c.esas_no) parts.push(`Esas: ${c.esas_no}`);
  if (c.karar_no) parts.push(`Karar: ${c.karar_no}`);
  if (c.kanun_no) parts.push(`Kanun No: ${c.kanun_no}`);
  if (c.madde_no) parts.push(`Madde: ${c.madde_no}`);
  if (parts.length === 0) return c.text;
  return parts.join(" | ");
}

export { type Citation } from "../_lib/citation-parser";
