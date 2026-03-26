"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";

const BAROLAR = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara",
  "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman",
  "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa",
  "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne",
  "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun",
  "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir",
  "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri",
  "Kırıkkale", "Kırklareli", "Kırşehir", "Kilis", "Kocaeli", "Konya", "Kütahya",
  "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde",
  "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop",
  "Sivas", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van",
  "Yalova", "Yozgat", "Zonguldak",
].map((b) => `${b} Barosu`);

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/ı/g, "i").replace(/İ/g, "i")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ç/g, "c").replace(/Ç/g, "c")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g");
}

export function BaroDropdown({
  value,
  onChange,
  inputCls,
}: {
  value: string;
  onChange: (v: string) => void;
  inputCls: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return BAROLAR;
    const q = normalize(search.trim());
    return BAROLAR.filter((b) => normalize(b).includes(q));
  }, [search]);

  useEffect(() => {
    if (open) {
      searchInputRef.current?.focus();
      setSearch("");
      setActiveIdx(0);
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIdx]) {
      e.preventDefault();
      onChange(filtered[activeIdx]);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (open && listRef.current) {
      const activeEl = listRef.current.children[activeIdx] as HTMLElement;
      if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx, open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={inputCls + " cursor-pointer text-left flex items-center justify-between"}
      >
        <span className={value ? "text-[#ECECEE]" : "text-[#3A3A3F]"}>
          {value || "Baro Seçin (isteğe bağlı)"}
        </span>
        <div className="flex items-center gap-1.5">
          {value && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="text-[#5C5C5F] hover:text-[#E5484D] transition-colors p-0.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-[#5C5C5F]">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1.5 bg-[#16161A] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Search input */}
            <div className="p-2 border-b border-white/[0.06]">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5C5C5F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Baro ara..."
                  className="w-full bg-[#111113] border border-white/[0.06] rounded-lg pl-8 pr-3 py-2 text-[13px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/40 transition-all"
                />
              </div>
            </div>

            {/* List */}
            <div ref={listRef} className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-[12px] text-[#5C5C5F]">Sonuç bulunamadı</div>
              ) : (
                filtered.map((b, i) => (
                  <button
                    key={b}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(b);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full text-left px-3 py-2 text-[13px] flex items-center justify-between transition-colors ${
                      i === activeIdx ? "bg-[#6C6CFF]/[0.08] text-[#ECECEE]" : "text-[#8B8B8E] hover:bg-white/[0.03]"
                    } ${value === b ? "text-[#6C6CFF]" : ""}`}
                  >
                    {b}
                    {value === b && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6C6CFF" strokeWidth={2}>
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Count */}
            <div className="px-3 py-1.5 border-t border-white/[0.06] text-[10px] text-[#5C5C5F]">
              {filtered.length} baro
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
