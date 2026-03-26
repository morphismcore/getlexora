"use client";

import { useState, useCallback } from "react";
import { IconPlus, IconTrash, IconUp, IconDown } from "./icons";
import { type Block, type BlockType, BLOCK_TYPE_LABELS, subLabel } from "./types";

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

export function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[#5C5C5F] mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[15px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors duration-150"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddBlockBtn
// ---------------------------------------------------------------------------

export function AddBlockBtn({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-3 py-2 text-[13px] font-medium text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-lg hover:border-white/[0.12] hover:text-[#ECECEE] transition-all duration-150"
    >
      <IconPlus className="w-3 h-3" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// BlockEditor
// ---------------------------------------------------------------------------

export function BlockEditor({
  block,
  numberedLabel,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddSub,
  onUpdateSub,
  onDeleteSub,
}: {
  block: Block;
  numberedLabel?: string;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddSub: () => void;
  onUpdateSub: (parentId: string, subId: string, content: string) => void;
  onDeleteSub: (parentId: string, subId: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDeleteClick = useCallback(() => {
    if (block.content.length > 0) {
      setConfirmingDelete(true);
    } else {
      onDelete(block.id);
    }
  }, [block.content, block.id, onDelete]);

  const typeStyles: Record<BlockType, string> = {
    section_header: "border-l-[#6C6CFF]",
    numbered_paragraph: "border-l-emerald-500",
    sub_paragraph: "border-l-amber-500",
    free_text: "border-l-[#5C5C5F]",
    evidence_item: "border-l-orange-500",
    legal_reference: "border-l-purple-500",
  };

  const typeLabel =
    block.type === "numbered_paragraph" && numberedLabel
      ? `Madde ${numberedLabel}`
      : BLOCK_TYPE_LABELS[block.type];

  return (
    <div
      className={`bg-[#111113] border border-white/[0.06] border-l-2 ${typeStyles[block.type]} rounded-lg overflow-hidden`}
    >
      {/* Block header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02]">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[#5C5C5F]">
          {typeLabel}
        </span>
        <div className="flex items-center gap-0.5">
          {confirmingDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[#E5484D] font-medium">Silinsin mi?</span>
              <button
                onClick={() => { onDelete(block.id); setConfirmingDelete(false); }}
                className="px-1.5 py-0.5 rounded text-[12px] font-medium text-[#E5484D] bg-[#E5484D]/10 hover:bg-[#E5484D]/20 transition-colors"
              >
                Evet
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-1.5 py-0.5 rounded text-[12px] font-medium text-[#5C5C5F] hover:text-[#ECECEE] transition-colors"
              >
                Hayır
              </button>
            </div>
          ) : (
            <>
              <button onClick={onMoveUp} className="p-1 rounded text-[#5C5C5F] hover:text-[#ECECEE] hover:bg-white/[0.06] transition-colors" title="Yukarı taşı">
                <IconUp className="w-3.5 h-3.5" />
              </button>
              <button onClick={onMoveDown} className="p-1 rounded text-[#5C5C5F] hover:text-[#ECECEE] hover:bg-white/[0.06] transition-colors" title="Aşağı taşı">
                <IconDown className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleDeleteClick} className="p-1 rounded text-[#5C5C5F] hover:text-[#E5484D] hover:bg-[#E5484D]/10 transition-colors" title="Sil">
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Block content */}
      <div className="px-3 py-2">
        {block.type === "section_header" ? (
          <input
            type="text"
            value={block.content}
            onChange={(e) => onUpdate(block.id, e.target.value)}
            placeholder="Bölüm başlığı (ör. AÇIKLAMALAR)"
            className="w-full bg-transparent border-none text-[15px] font-bold text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none uppercase"
          />
        ) : (
          <textarea
            value={block.content}
            onChange={(e) => onUpdate(block.id, e.target.value)}
            placeholder={
              block.type === "evidence_item"
                ? "Delil açıklaması..."
                : block.type === "legal_reference"
                ? "4857 sayılı İK md. 18..."
                : "İçerik yazın..."
            }
            rows={block.content.length > 120 ? 4 : 2}
            className="w-full bg-transparent border-none text-[15px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none resize-none leading-relaxed"
          />
        )}
      </div>

      {/* Sub-paragraphs (only for numbered_paragraph) */}
      {block.type === "numbered_paragraph" && (
        <div className="px-3 pb-2 space-y-1.5">
          {(block.children ?? []).map((sub, si) => {
            const letter = subLabel(si);
            return (
              <div
                key={sub.id}
                className="flex items-start gap-2 pl-4 border-l border-amber-500/30 ml-1"
              >
                <span className="text-[14px] font-medium text-amber-500/70 mt-1.5 shrink-0">
                  {letter})
                </span>
                <textarea
                  value={sub.content}
                  onChange={(e) =>
                    onUpdateSub(block.id, sub.id, e.target.value)
                  }
                  placeholder="Alt madde içeriği..."
                  rows={1}
                  className="flex-1 bg-transparent border-none text-[14px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none resize-none leading-relaxed"
                />
                <button
                  onClick={() => onDeleteSub(block.id, sub.id)}
                  className="p-1 rounded text-[#5C5C5F] hover:text-[#E5484D] transition-colors shrink-0"
                >
                  <IconTrash className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <button
            onClick={onAddSub}
            className="ml-5 inline-flex items-center gap-1 text-[13px] text-[#5C5C5F] hover:text-amber-400 transition-colors"
          >
            <IconPlus className="w-3 h-3" />
            Alt Madde Ekle
          </button>
        </div>
      )}
    </div>
  );
}
