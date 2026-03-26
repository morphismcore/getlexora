"use client";

import { type Template } from "./types";

// ---------------------------------------------------------------------------
// Category styling map
// ---------------------------------------------------------------------------

const CATS: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  "İş Hukuku": { color: "text-[#6C6CFF]", bg: "bg-[#6C6CFF]/[0.06]", border: "border-[#6C6CFF]/20", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  "Ceza Hukuku": { color: "text-[#E5484D]", bg: "bg-[#E5484D]/[0.06]", border: "border-[#E5484D]/20", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  "Ticaret Hukuku": { color: "text-[#A78BFA]", bg: "bg-[#A78BFA]/[0.06]", border: "border-[#A78BFA]/20", icon: "M3 3h18v18H3zM12 8v8m-4-4h8" },
  "İdare Hukuku": { color: "text-[#22D3EE]", bg: "bg-[#22D3EE]/[0.06]", border: "border-[#22D3EE]/20", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5" },
  "Aile Hukuku": { color: "text-[#F472B6]", bg: "bg-[#F472B6]/[0.06]", border: "border-[#F472B6]/20", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  "İcra-İflas": { color: "text-[#FFB224]", bg: "bg-[#FFB224]/[0.06]", border: "border-[#FFB224]/20", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  "Tüketici Hukuku": { color: "text-[#34D399]", bg: "bg-[#34D399]/[0.06]", border: "border-[#34D399]/20", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" },
  "Gayrimenkul Hukuku": { color: "text-[#FB923C]", bg: "bg-[#FB923C]/[0.06]", border: "border-[#FB923C]/20", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
};

// ---------------------------------------------------------------------------
// TemplateGallery — category cards + flat list of template buttons
// ---------------------------------------------------------------------------

export function TemplateGallery({
  templates,
  selectedTemplate,
  onSelectTemplate,
}: {
  templates: Template[];
  selectedTemplate: Template | null;
  onSelectTemplate: (tpl: Template) => void;
}) {
  const categories = Object.keys(CATS);
  const grouped: Record<string, Template[]> = {};
  for (const t of templates) {
    const cat = categories.find((c) => (t.category || "").includes(c)) || "Diğer";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  }
  for (const c of categories) {
    if (!grouped[c]) grouped[c] = [];
  }

  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C5C5F] mb-3">
        Şablon Galerisi
      </label>
      {/* Category cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {Object.entries(CATS).map(([cat, style]) => {
          const tpls = grouped[cat] || [];
          return (
            <div key={cat} className={`${style.bg} border ${style.border} rounded-xl p-3 cursor-pointer hover:scale-[1.02] transition-transform`}>
              <div className="flex items-center gap-2 mb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={style.color} strokeLinecap="round" strokeLinejoin="round">
                  <path d={style.icon} />
                </svg>
                <span className={`text-[12px] font-semibold ${style.color}`}>{cat}</span>
              </div>
              <p className="text-[10px] text-[#5C5C5F]">{tpls.length} şablon</p>
              {tpls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {tpls.slice(0, 3).map((tpl) => (
                    <button key={tpl.id} onClick={() => onSelectTemplate(tpl)}
                      className={`block w-full text-left text-[11px] px-2 py-1 rounded-md transition-colors ${
                        selectedTemplate?.id === tpl.id
                          ? `${style.bg} ${style.color} font-medium`
                          : "text-[#8B8B8E] hover:text-[#ECECEE] hover:bg-white/[0.03]"
                      }`}>
                      {tpl.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Flat template list */}
      <div className="flex flex-wrap gap-1.5">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => onSelectTemplate(tpl)}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all duration-150 ${
              selectedTemplate?.id === tpl.id
                ? "bg-[#6C6CFF]/20 border-[#6C6CFF]/50 text-[#6C6CFF]"
                : "bg-[#111113] border-white/[0.06] text-[#8B8B8E] hover:border-white/[0.12] hover:text-[#ECECEE]"
            }`}
          >
            {tpl.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemplateForm — form for filling template fields
// ---------------------------------------------------------------------------

export function TemplateForm({
  selectedTemplate,
  templateValues,
  onUpdateValue,
  onGenerate,
  onCancel,
  generating,
  inputCls,
}: {
  selectedTemplate: Template;
  templateValues: Record<string, string>;
  onUpdateValue: (fieldId: string, value: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  generating: boolean;
  inputCls: string;
}) {
  return (
    <div className="bg-[#111113] border border-[#6C6CFF]/30 rounded-xl p-4 space-y-3">
      <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[#6C6CFF] mb-1">
        {selectedTemplate.name} — Form
      </h2>
      {selectedTemplate.fields.map((field) => (
        <div key={field.id}>
          <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">
            {field.label} {field.required && <span className="text-[#E5484D]">*</span>}
          </label>
          {field.type === "select" ? (
            <select
              value={templateValues[field.id] || ""}
              onChange={(e) => onUpdateValue(field.id, e.target.value)}
              className={inputCls + " cursor-pointer"}
            >
              <option value="">Seçiniz...</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              value={templateValues[field.id] || ""}
              onChange={(e) => onUpdateValue(field.id, e.target.value)}
              placeholder={field.placeholder || ""}
              rows={3}
              className={inputCls + " resize-none"}
            />
          ) : (
            <input
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              value={templateValues[field.id] || ""}
              onChange={(e) => onUpdateValue(field.id, e.target.value)}
              placeholder={field.placeholder || ""}
              className={inputCls}
            />
          )}
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex-1 py-2 text-[12px] font-semibold text-white bg-[#6C6CFF] rounded-lg hover:bg-[#5B5BEE] disabled:opacity-50 transition-colors"
        >
          {generating ? "Oluşturuluyor..." : "Belge Oluştur"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-[12px] font-medium text-[#5C5C5F] bg-[#16161A] rounded-lg hover:text-[#ECECEE] transition-colors"
        >
          İptal
        </button>
      </div>
    </div>
  );
}
