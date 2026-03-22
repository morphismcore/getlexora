"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface CommandItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandGroup {
  title: string;
  items: CommandItem[];
}

interface CommandPaletteProps {
  groups: CommandGroup[];
}

export default function CommandPalette({ groups }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Toggle with Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Filter items based on query
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      ),
    }))
    .filter((group) => group.items.length > 0);

  const allItems = filteredGroups.flatMap((g) => g.items);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      item.onSelect();
      setOpen(false);
    },
    []
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(allItems.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + allItems.length) % Math.max(allItems.length, 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (allItems[activeIndex]) {
          handleSelect(allItems[activeIndex]);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [allItems, activeIndex, handleSelect]
  );

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector("[data-active='true']");
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  let flatIndex = 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-[rgba(0,0,0,0.6)] backdrop-blur-[8px]"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Dialog */}
          <motion.div
            className="relative w-full max-w-[560px] mx-4 bg-elevated border border-border-default rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 h-12 border-b border-border-subtle">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-text-tertiary flex-shrink-0"
              >
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ara veya komut yaz..."
                className="flex-1 bg-transparent text-[14px] text-text-primary placeholder:text-text-tertiary outline-none"
              />
              <kbd className="text-[11px] text-text-tertiary bg-surface px-1.5 py-0.5 rounded border border-border-subtle font-medium">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
              {filteredGroups.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] text-text-tertiary">Sonuç bulunamadı</p>
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <div key={group.title}>
                    <div className="px-4 pt-2 pb-1">
                      <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
                        {group.title}
                      </span>
                    </div>
                    {group.items.map((item) => {
                      const currentIndex = flatIndex++;
                      const isActive = currentIndex === activeIndex;

                      return (
                        <button
                          key={item.id}
                          data-active={isActive}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setActiveIndex(currentIndex)}
                          className={`flex items-center gap-3 w-full px-4 h-9 text-left transition-colors ${
                            isActive
                              ? "bg-[rgba(255,255,255,0.06)] text-text-primary"
                              : "text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {item.icon && (
                            <span className="flex-shrink-0 text-text-tertiary">
                              {item.icon}
                            </span>
                          )}
                          <span className="flex-1 text-[13px] font-medium truncate">
                            {item.label}
                          </span>
                          {item.shortcut && (
                            <span className="text-[11px] text-text-tertiary flex-shrink-0">
                              {item.shortcut}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 h-9 border-t border-border-subtle">
              <span className="text-[11px] text-text-tertiary">
                <kbd className="font-medium">↑↓</kbd> gezin
              </span>
              <span className="text-[11px] text-text-tertiary">
                <kbd className="font-medium">↵</kbd> seç
              </span>
              <span className="text-[11px] text-text-tertiary">
                <kbd className="font-medium">esc</kbd> kapat
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
