/**
 * Turkish legal citation parser.
 *
 * Detects common citation patterns in decision text:
 *   - Esas / Karar numbers  (2021/1234 E., E. 2021/1234, etc.)
 *   - Law references         (4857 sayılı Kanun, 6098 sayılı TBK, etc.)
 *   - Article references     (Madde 17, m. 17, md. 17, 17. madde, 17/1, 17 nci madde)
 *   - Court references       (Yargıtay 9. Hukuk Dairesi, Yargıtay HGK, Anayasa Mahkemesi, etc.)
 */

export interface Citation {
  type: "ictihat" | "mevzuat";
  text: string;
  start: number;
  end: number;
  // ictihat fields
  esas_no?: string;
  karar_no?: string;
  mahkeme?: string;
  // mevzuat fields
  kanun_no?: string;
  madde_no?: string;
}

// ────────────────────────────────────────────────────────────────
// Pattern definitions
// ────────────────────────────────────────────────────────────────

// Combined esas + karar on the same line: "2021/1234 E., 2022/5678 K."
const ESAS_KARAR_COMBINED =
  /(\d{4}\/\d{1,6})\s*E\.\s*,?\s*(\d{4}\/\d{1,6})\s*K\./g;

// Standalone esas: "2021/1234 E." or "E. 2021/1234"
const ESAS_ONLY_SUFFIX = /(\d{4}\/\d{1,6})\s*E\./g;
const ESAS_ONLY_PREFIX = /E\.\s*(\d{4}\/\d{1,6})/g;

// Standalone karar: "2022/5678 K." or "K. 2022/5678"
const KARAR_ONLY_SUFFIX = /(\d{4}\/\d{1,6})\s*K\./g;
const KARAR_ONLY_PREFIX = /K\.\s*(\d{4}\/\d{1,6})/g;

// Law references: "4857 sayılı Kanun", "6098 sayılı Türk Borçlar Kanunu", "4721 sayılı TMK"
const LAW_REF =
  /(\d{3,5})\s+sayılı\s+(?:[A-ZÇĞİÖŞÜa-zçğıöşü]+\s*){1,5}(?:Kanun[u']?|Kod[u']?|KHK|Yönetmeli[kğ]i?|Tüzü[kğ]ü?|TMK|TBK|TCK|CMK|HMK|İYUK|TTK|İİK|AATUHK)/g;

// Article references: "Madde 17", "m. 17", "md. 17", "17. madde", "17 nci madde", "17/1"
const ARTICLE_MADDE = /[Mm]adde\s+(\d{1,4}(?:\/\d{1,3})?)/g;
const ARTICLE_M_DOT = /[Mm](?:d)?\.\s*(\d{1,4}(?:\/\d{1,3})?)/g;
const ARTICLE_SUFFIX = /(\d{1,4})\.\s*[Mm]adde/g;
const ARTICLE_NCI = /(\d{1,4})\s+(?:[niuü]n?c[iıuü]|[iıuü]nc[iıuü])\s+[Mm]adde/g;

// Court references: "Yargıtay 9. Hukuk Dairesi", "Yargıtay HGK", "Anayasa Mahkemesi", "Danıştay"
const COURT_REF =
  /(?:Yargıtay\s+(?:(?:\d{1,2}\.\s*(?:Hukuk|Ceza)\s*Dairesi)|(?:İBGK|HGK|CGK|İBK)))|(?:Anayasa\s+Mahkemesi)|(?:Danıştay\s+\d{1,2}\.\s*Daire(?:si)?)/g;

// ────────────────────────────────────────────────────────────────
// Helper: run a regex and collect raw matches
// ────────────────────────────────────────────────────────────────

interface RawMatch {
  text: string;
  start: number;
  end: number;
  groups: string[]; // captured groups
}

function collectMatches(regex: RegExp, text: string): RawMatch[] {
  const results: RawMatch[] = [];
  const re = new RegExp(regex.source, regex.flags); // clone to reset lastIndex
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    results.push({
      text: m[0],
      start: m.index,
      end: m.index + m[0].length,
      groups: m.slice(1),
    });
  }
  return results;
}

// ────────────────────────────────────────────────────────────────
// Remove overlapping matches (keep longest / earliest)
// ────────────────────────────────────────────────────────────────

function dedup(citations: Citation[]): Citation[] {
  if (citations.length === 0) return [];

  // Sort by start, then by length descending (prefer longer match)
  citations.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const result: Citation[] = [citations[0]];
  for (let i = 1; i < citations.length; i++) {
    const prev = result[result.length - 1];
    const curr = citations[i];
    // skip if current is fully inside previous
    if (curr.start >= prev.start && curr.end <= prev.end) continue;
    // if overlap, keep the longer one
    if (curr.start < prev.end) {
      if (curr.end - curr.start > prev.end - prev.start) {
        result[result.length - 1] = curr;
      }
      continue;
    }
    result.push(curr);
  }
  return result;
}

// ────────────────────────────────────────────────────────────────
// Extract kanun_no from a law-reference match text
// ────────────────────────────────────────────────────────────────

function extractKanunNo(matchText: string): string | undefined {
  const m = matchText.match(/^(\d{3,5})\s+sayılı/);
  return m ? m[1] : undefined;
}

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

export function parseCitations(text: string): Citation[] {
  const citations: Citation[] = [];

  // 1. Combined esas + karar
  for (const m of collectMatches(ESAS_KARAR_COMBINED, text)) {
    citations.push({
      type: "ictihat",
      text: m.text,
      start: m.start,
      end: m.end,
      esas_no: m.groups[0],
      karar_no: m.groups[1],
    });
  }

  // 2. Standalone esas (suffix form)
  for (const m of collectMatches(ESAS_ONLY_SUFFIX, text)) {
    citations.push({
      type: "ictihat",
      text: m.text,
      start: m.start,
      end: m.end,
      esas_no: m.groups[0],
    });
  }

  // 3. Standalone esas (prefix form)
  for (const m of collectMatches(ESAS_ONLY_PREFIX, text)) {
    citations.push({
      type: "ictihat",
      text: m.text,
      start: m.start,
      end: m.end,
      esas_no: m.groups[0],
    });
  }

  // 4. Standalone karar (suffix)
  for (const m of collectMatches(KARAR_ONLY_SUFFIX, text)) {
    citations.push({
      type: "ictihat",
      text: m.text,
      start: m.start,
      end: m.end,
      karar_no: m.groups[0],
    });
  }

  // 5. Standalone karar (prefix)
  for (const m of collectMatches(KARAR_ONLY_PREFIX, text)) {
    citations.push({
      type: "ictihat",
      text: m.text,
      start: m.start,
      end: m.end,
      karar_no: m.groups[0],
    });
  }

  // 6. Court references
  for (const m of collectMatches(COURT_REF, text)) {
    citations.push({
      type: "ictihat",
      text: m.text,
      start: m.start,
      end: m.end,
      mahkeme: m.text,
    });
  }

  // 7. Law references
  for (const m of collectMatches(LAW_REF, text)) {
    citations.push({
      type: "mevzuat",
      text: m.text,
      start: m.start,
      end: m.end,
      kanun_no: extractKanunNo(m.text),
    });
  }

  // 8. Article references (multiple patterns)
  const articlePatterns = [ARTICLE_MADDE, ARTICLE_M_DOT, ARTICLE_SUFFIX, ARTICLE_NCI];
  for (const pat of articlePatterns) {
    for (const m of collectMatches(pat, text)) {
      citations.push({
        type: "mevzuat",
        text: m.text,
        start: m.start,
        end: m.end,
        madde_no: m.groups[0],
      });
    }
  }

  return dedup(citations);
}
