"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";

import {
  type BlockType,
  type Block,
  type HeaderFields,
  type DocumentState,
  type Template,
  DOC_TYPES,
  SECTION_PRESETS,
  uid,
  emptyHeader,
  initialState,
  sampleDocument,
  subLabel,
} from "./_components/types";
import { BUILTIN_TEMPLATES } from "./_components/templates-data";
import { IconDoc, IconCopy, IconDownload } from "./_components/icons";
import { BlockEditor, AddBlockBtn, Field } from "./_components/block-editor";
import { PreviewContent } from "./_components/preview-content";
import { TemplateGallery, TemplateForm } from "./_components/template-gallery";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DilekcePage() {
  const [doc, setDoc] = useState<DocumentState>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lexora_dilekce_draft");
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
    }
    return initialState();
  });
  const [mobileTab, setMobileTab] = useState<"editor" | "preview">("editor");
  const [copied, setCopied] = useState(false);
  const [templates, setTemplates] = useState<Template[]>(BUILTIN_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [templateMode, setTemplateMode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showNewDocConfirm, setShowNewDocConfirm] = useState(false);
  const [autoSaveFlash, setAutoSaveFlash] = useState(false);

  // --- Auto-save: debounced on change (1s) ---
  useEffect(() => {
    const timer = setTimeout(() => {
      if (doc.blocks.length > 0 || doc.header.mahkeme) {
        try {
          localStorage.setItem("lexora_dilekce_draft", JSON.stringify(doc));
          setLastSaved(new Date().toLocaleTimeString("tr-TR"));
        } catch { /* QuotaExceededError */ }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [doc]);

  // --- Auto-save: periodic interval (30s) with visual flash ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (doc.blocks.length > 0 || doc.header.mahkeme) {
        try {
          localStorage.setItem("lexora_dilekce_draft", JSON.stringify(doc));
          setLastSaved(new Date().toLocaleTimeString("tr-TR"));
          setAutoSaveFlash(true);
          setTimeout(() => setAutoSaveFlash(false), 2000);
        } catch { /* ignore */ }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [doc]);

  // --- Fetch templates on mount ---
  useEffect(() => {
    fetch(`${API_URL}/api/v1/templates`)
      .then((r) => r.json())
      .then((data) => {
        const backend = Array.isArray(data) ? data : [];
        const backendIds = new Set(backend.map((t: Template) => t.id));
        const merged = [...backend, ...BUILTIN_TEMPLATES.filter((b) => !backendIds.has(b.id))];
        setTemplates(merged);
      })
      .catch(() => {});

    if (typeof window !== "undefined") {
      const citation = localStorage.getItem("lexora_cite_to_dilekce");
      if (citation) {
        localStorage.removeItem("lexora_cite_to_dilekce");
        setDoc((prev) => ({
          ...prev,
          blocks: [
            ...prev.blocks,
            { id: uid(), type: "legal_reference" as BlockType, content: citation },
          ],
        }));
      }
    }
  }, []);

  // --- Header updates ---
  const updateHeader = useCallback((field: keyof HeaderFields, value: string) => {
    setDoc((prev) => ({ ...prev, header: { ...prev.header, [field]: value } }));
  }, []);

  const updateDocType = useCallback((value: string) => {
    setDoc((prev) => ({ ...prev, docType: value }));
  }, []);

  // --- Block CRUD ---
  const addBlock = useCallback((type: BlockType, presetContent?: string) => {
    const newBlock: Block = {
      id: uid(), type,
      content: presetContent ?? "",
      children: type === "numbered_paragraph" ? [] : undefined,
    };
    setDoc((prev) => ({ ...prev, blocks: [...prev.blocks, newBlock] }));
  }, []);

  const updateBlockContent = useCallback((blockId: string, content: string) => {
    setDoc((prev) => ({ ...prev, blocks: prev.blocks.map((b) => b.id === blockId ? { ...b, content } : b) }));
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    setDoc((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) }));
  }, []);

  const moveBlock = useCallback((blockId: string, direction: "up" | "down") => {
    setDoc((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === blockId);
      if (idx < 0) return prev;
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.blocks.length - 1) return prev;
      const next = [...prev.blocks];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return { ...prev, blocks: next };
    });
  }, []);

  // --- Sub-paragraph CRUD ---
  const addSubParagraph = useCallback((parentId: string) => {
    const sub: Block = { id: uid(), type: "sub_paragraph", content: "" };
    setDoc((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => b.id === parentId ? { ...b, children: [...(b.children ?? []), sub] } : b),
    }));
  }, []);

  const updateSubContent = useCallback((parentId: string, subId: string, content: string) => {
    setDoc((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) =>
        b.id === parentId
          ? { ...b, children: (b.children ?? []).map((c) => c.id === subId ? { ...c, content } : c) }
          : b
      ),
    }));
  }, []);

  const deleteSubParagraph = useCallback((parentId: string, subId: string) => {
    setDoc((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => b.id === parentId ? { ...b, children: (b.children ?? []).filter((c) => c.id !== subId) } : b),
    }));
  }, []);

  // --- Load sample ---
  const loadSample = useCallback(() => { setDoc(sampleDocument()); }, []);

  // --- New document ---
  const handleNewDocument = useCallback(() => {
    const hasContent = doc.blocks.length > 0 || doc.header.mahkeme || doc.header.davaci || doc.header.davali;
    if (hasContent) { setShowNewDocConfirm(true); }
    else { setDoc(initialState()); localStorage.removeItem("lexora_dilekce_draft"); }
  }, [doc]);

  const confirmNewDocument = useCallback(() => {
    setDoc(initialState());
    localStorage.removeItem("lexora_dilekce_draft");
    setShowNewDocConfirm(false);
  }, []);

  // --- Template selection ---
  const selectTemplate = useCallback((tpl: Template) => {
    setSelectedTemplate(tpl);
    setTemplateMode(true);
    const vals: Record<string, string> = {};
    tpl.fields.forEach((f) => (vals[f.id] = ""));
    setTemplateValues(vals);
  }, []);

  const updateTemplateValue = useCallback((fieldId: string, value: string) => {
    setTemplateValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  // --- Generate document from template ---
  const generateFromTemplate = useCallback(async () => {
    if (!selectedTemplate) return;
    setGenerating(true);
    try {
      const resp = await fetch(`${API_URL}/api/v1/templates/${selectedTemplate.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: templateValues }),
      });
      if (!resp.ok) throw new Error("Generation failed");
      const data = await resp.json();
      const text: string = data.document || "";

      const lines = text.split("\n");
      const blocks: Block[] = [];
      const newHeader = emptyHeader();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.match(/'N[EA]$/)) { newHeader.mahkeme = line.replace(/'N[EA]$/, "").trim(); continue; }
        if (line.startsWith("DAVACI:")) { newHeader.davaci = line.replace("DAVACI:", "").trim(); continue; }
        if (line.startsWith("DAVALI:")) { newHeader.davali = line.replace("DAVALI:", "").trim(); continue; }
        if (line.startsWith("Adres:") && !newHeader.davali) { newHeader.davaci_adres = line.replace("Adres:", "").trim(); continue; }
        if (line.startsWith("Adres:") && newHeader.davali) { newHeader.davali_adres = line.replace("Adres:", "").trim(); continue; }
        if (line.startsWith("TC Kimlik No:")) { newHeader.davaci_tc = line.replace("TC Kimlik No:", "").trim(); continue; }
        if (line.startsWith("Vekili:")) { newHeader.davaci_vekili = line.replace("Vekili:", "").trim(); continue; }
        if (line.startsWith("KONU:")) { newHeader.konu = line.replace("KONU:", "").trim(); continue; }
        if (line === line.toLocaleUpperCase("tr") && line.length < 60 && !line.match(/^\d/)) {
          blocks.push({ id: uid(), type: "section_header", content: line });
          continue;
        }
        if (line.match(/^\d+\.\s/)) {
          blocks.push({ id: uid(), type: "numbered_paragraph", content: line.replace(/^\d+\.\s/, ""), children: [] });
          continue;
        }
        if (line.startsWith("- ") || line.startsWith("\u2022 ")) {
          blocks.push({ id: uid(), type: "evidence_item", content: line.replace(/^[-\u2022]\s*/, "") });
          continue;
        }
        blocks.push({ id: uid(), type: "free_text", content: line });
      }

      setDoc({ docType: selectedTemplate.name, header: newHeader, blocks });
      setTemplateMode(false);
    } catch {
      alert("Belge oluşturulurken bir hata oluştu.");
    } finally {
      setGenerating(false);
    }
  }, [selectedTemplate, templateValues]);

  // --- Plain text generation ---
  const plainText = useMemo(() => {
    const h = doc.header;
    const lines: string[] = [];
    if (h.mahkeme) lines.push(`${h.mahkeme.toLocaleUpperCase("tr")}'NE`);
    lines.push("");
    if (h.davaci || h.davaci_tc || h.davaci_adres || h.davaci_vekili) {
      lines.push(`DAVACI      : ${h.davaci}`);
      if (h.davaci_tc) lines.push(`TC Kimlik No: ${h.davaci_tc}`);
      if (h.davaci_adres) lines.push(`Adres       : ${h.davaci_adres}`);
      if (h.davaci_vekili) lines.push(`Vekili      : ${h.davaci_vekili}`);
      lines.push("");
    }
    if (h.davali || h.davali_adres) {
      lines.push(`DAVALI      : ${h.davali}`);
      if (h.davali_adres) lines.push(`Adres       : ${h.davali_adres}`);
      lines.push("");
    }
    if (h.konu) { lines.push(`KONU        : ${h.konu}`); lines.push(""); }

    let numberedIdx = 0;
    for (const block of doc.blocks) {
      switch (block.type) {
        case "section_header":
          lines.push(""); lines.push(block.content.toLocaleUpperCase("tr")); lines.push(""); break;
        case "numbered_paragraph": {
          numberedIdx++;
          lines.push(`${numberedIdx}. ${block.content}`);
          if (block.children && block.children.length > 0) {
            block.children.forEach((sub, si) => { lines.push(`   ${subLabel(si)}) ${sub.content}`); });
          }
          lines.push(""); break;
        }
        case "free_text": lines.push(block.content); lines.push(""); break;
        case "evidence_item": lines.push(`  - ${block.content}`); break;
        case "legal_reference": lines.push(`  [Ref] ${block.content}`); break;
        default: lines.push(block.content); lines.push("");
      }
    }
    lines.push(""); lines.push("                                    Saygılarımla,");
    if (h.davaci_vekili) lines.push(`                                    ${h.davaci_vekili}`);
    return lines.join("\n");
  }, [doc]);

  // --- Export helpers ---
  const exportDocument = useCallback(async (format: "docx" | "pdf") => {
    setExporting(format);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("lexora_token") : null;
      const resp = await fetch(`${API_URL}/api/v1/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: plainText, title: doc.header.konu || "Dilekce" }),
      });
      if (!resp.ok) throw new Error(`${format.toUpperCase()} oluşturulamadı`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${doc.header.konu || "dilekce"}.${format}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { alert(`${format.toUpperCase()} dışa aktarma başarısız`); }
    finally { setExporting(null); }
  }, [doc, plainText]);

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(plainText); }
    catch { const ta = document.createElement("textarea"); ta.value = plainText; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [plainText]);

  const handleDownloadTxt = useCallback(() => {
    const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${doc.docType.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [plainText, doc.docType]);

  // --- Auto-numbering helper ---
  const numberedIndex = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const b of doc.blocks) {
      if (b.type === "numbered_paragraph") { idx++; map.set(b.id, idx); }
    }
    return map;
  }, [doc.blocks]);

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------

  const inputCls =
    "w-full bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors duration-150";

  // ---- Editor Panel ----
  const editorPanel = (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Template gallery */}
        {templates.length > 0 && (
          <TemplateGallery
            templates={templates}
            selectedTemplate={selectedTemplate}
            onSelectTemplate={selectTemplate}
          />
        )}

        {/* Template form */}
        {templateMode && selectedTemplate && (
          <TemplateForm
            selectedTemplate={selectedTemplate}
            templateValues={templateValues}
            onUpdateValue={updateTemplateValue}
            onGenerate={generateFromTemplate}
            onCancel={() => { setTemplateMode(false); setSelectedTemplate(null); }}
            generating={generating}
            inputCls={inputCls}
          />
        )}

        {/* Doc type selector */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C5C5F] mb-2">
            Belge Türü
          </label>
          <select value={doc.docType} onChange={(e) => updateDocType(e.target.value)} className={inputCls + " cursor-pointer"}>
            {DOC_TYPES.map((dt) => (<option key={dt} value={dt}>{dt}</option>))}
          </select>
        </div>

        {/* Header fields */}
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[#5C5C5F] mb-1">Başlık Bilgileri</h2>
          <Field label="Mahkeme" placeholder="İstanbul ( ). İş Mahkemesi" value={doc.header.mahkeme} onChange={(v) => updateHeader("mahkeme", v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Davacı" placeholder="Ad Soyad" value={doc.header.davaci} onChange={(v) => updateHeader("davaci", v)} />
            <Field label="TC Kimlik No" placeholder="12345678901" value={doc.header.davaci_tc} onChange={(v) => updateHeader("davaci_tc", v)} />
          </div>
          <Field label="Davacı Adresi" placeholder="Adres" value={doc.header.davaci_adres} onChange={(v) => updateHeader("davaci_adres", v)} />
          <Field label="Davacı Vekili" placeholder="Av. Ad Soyad" value={doc.header.davaci_vekili} onChange={(v) => updateHeader("davaci_vekili", v)} />
          <hr className="border-white/[0.04]" />
          <Field label="Davalı" placeholder="Şirket / Kişi adı" value={doc.header.davali} onChange={(v) => updateHeader("davali", v)} />
          <Field label="Davalı Adresi" placeholder="Adres" value={doc.header.davali_adres} onChange={(v) => updateHeader("davali_adres", v)} />
          <hr className="border-white/[0.04]" />
          <Field label="Konu" placeholder="Feshin geçersizliği ve işe iade talebi" value={doc.header.konu} onChange={(v) => updateHeader("konu", v)} />
        </div>

        {/* Blocks */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[#5C5C5F]">Belge İçeriği</h2>
            <button onClick={loadSample} className="text-[11px] font-medium text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors">Örnek Yükle</button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <AddBlockBtn label="Bölüm Başlığı" onClick={() => addBlock("section_header")} />
            <AddBlockBtn label="Madde" onClick={() => addBlock("numbered_paragraph")} />
            <AddBlockBtn label="Serbest Metin" onClick={() => addBlock("free_text")} />
            <AddBlockBtn label="Delil" onClick={() => addBlock("evidence_item")} />
            <AddBlockBtn label="Kanun Ref." onClick={() => addBlock("legal_reference")} />
          </div>

          {doc.blocks.length === 0 && (
            <div className="bg-[#111113] border border-dashed border-white/[0.08] rounded-xl p-4 text-center space-y-3">
              <p className="text-[12px] text-[#5C5C5F]">Hızlı başlangıç: Bölüm ekleyin</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {SECTION_PRESETS.map((s) => (
                  <button key={s} onClick={() => addBlock("section_header", s)}
                    className="px-2.5 py-1 text-[11px] font-medium bg-[#6C6CFF]/10 text-[#6C6CFF] rounded-md hover:bg-[#6C6CFF]/20 transition-colors">
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {doc.blocks.map((block) => (
              <BlockEditor key={block.id} block={block}
                numberedLabel={block.type === "numbered_paragraph" ? `${numberedIndex.get(block.id) ?? 0}.` : undefined}
                onUpdate={updateBlockContent} onDelete={deleteBlock}
                onMoveUp={() => moveBlock(block.id, "up")} onMoveDown={() => moveBlock(block.id, "down")}
                onAddSub={() => addSubParagraph(block.id)} onUpdateSub={updateSubContent} onDeleteSub={deleteSubParagraph} />
            ))}
          </div>

          {doc.blocks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              <AddBlockBtn label="Bölüm Başlığı" onClick={() => addBlock("section_header")} />
              <AddBlockBtn label="Madde" onClick={() => addBlock("numbered_paragraph")} />
              <AddBlockBtn label="Serbest Metin" onClick={() => addBlock("free_text")} />
              <AddBlockBtn label="Delil" onClick={() => addBlock("evidence_item")} />
              <AddBlockBtn label="Kanun Ref." onClick={() => addBlock("legal_reference")} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ---- Preview Panel ----
  const previewPanel = (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[#E0E0E0]/20 bg-[#F5F5F5]">
        <div className="flex items-center gap-2">
          <IconDoc className="w-4 h-4 text-[#666]" />
          <span className="text-[12px] font-semibold text-[#444] uppercase tracking-wider">Önizleme</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleCopy} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#555] bg-white border border-[#D0D0D0] rounded-md hover:bg-[#EEE] transition-colors">
            <IconCopy className="w-3.5 h-3.5" /> {copied ? "Kopyalandı" : "Kopyala"}
          </button>
          <button onClick={() => exportDocument("docx")} disabled={exporting === "docx"} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#555] bg-white border border-[#D0D0D0] rounded-md hover:bg-[#EEE] transition-colors disabled:opacity-50">
            <IconDownload className="w-3.5 h-3.5" /> {exporting === "docx" ? "..." : "DOCX İndir"}
          </button>
          <button onClick={() => exportDocument("pdf")} disabled={exporting === "pdf"} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#555] bg-white border border-[#D0D0D0] rounded-md hover:bg-[#EEE] transition-colors disabled:opacity-50">
            <IconDownload className="w-3.5 h-3.5" /> {exporting === "pdf" ? "..." : "PDF İndir"}
          </button>
          <button onClick={handleDownloadTxt} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#555] bg-white border border-[#D0D0D0] rounded-md hover:bg-[#EEE] transition-colors">
            <IconDownload className="w-3.5 h-3.5" /> TXT
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#E8E8E8]">
        <div className="max-w-[700px] mx-auto my-6 bg-[#FAFAFA] shadow-[0_1px_4px_rgba(0,0,0,0.08)] rounded-sm">
          <div className="px-12 py-10 text-[#111] text-[14px] leading-[1.8]" style={{ fontFamily: "var(--font-serif), 'Noto Serif', Georgia, serif" }}>
            <PreviewContent doc={doc} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 border-b border-white/[0.06] bg-[#09090B] px-4 md:px-5 pt-14 md:pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight text-[#ECECEE]">Dilekce Olusturucu</h1>
            <p className="text-[12px] text-[#5C5C5F] mt-0.5">
              Blok tabanlı hukuki belge düzenleyici
              {lastSaved && (
                <span className={`ml-2 text-[11px] transition-colors duration-500 ${autoSaveFlash ? "text-[#3DD68C]" : "text-[#3DD68C]/50"}`}>
                  {autoSaveFlash ? "\u2713 Otomatik kaydedildi" : `Son kayıt: ${lastSaved}`}
                </span>
              )}
            </p>
          </div>
          <button onClick={handleNewDocument} className="px-3 py-1.5 bg-[#6C6CFF] hover:bg-[#5B5BEE] rounded-lg text-[12px] font-medium text-white transition-colors">
            + Yeni Belge
          </button>
        </div>
        <div className="flex md:hidden mt-3 gap-1 bg-[#111113] rounded-lg p-0.5">
          <button onClick={() => setMobileTab("editor")} className={`flex-1 py-1.5 text-[12px] font-medium rounded-md transition-colors ${mobileTab === "editor" ? "bg-[#1E1E22] text-[#ECECEE]" : "text-[#5C5C5F]"}`}>
            Düzenleyici
          </button>
          <button onClick={() => setMobileTab("preview")} className={`flex-1 py-1.5 text-[12px] font-medium rounded-md transition-colors ${mobileTab === "preview" ? "bg-[#1E1E22] text-[#ECECEE]" : "text-[#5C5C5F]"}`}>
            Önizleme
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex min-h-0">
        <div className={`w-full md:w-1/2 md:border-r md:border-white/[0.06] bg-[#09090B] ${mobileTab !== "editor" ? "hidden md:block" : ""}`}>
          {editorPanel}
        </div>
        <div className={`w-full md:w-1/2 ${mobileTab !== "preview" ? "hidden md:block" : ""}`}>
          {previewPanel}
        </div>
      </div>

      {/* New document confirmation modal */}
      <AnimatePresence>
        {showNewDocConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowNewDocConfirm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111113] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-10 mx-auto rounded-xl bg-[#E5484D]/10 flex items-center justify-center">
                <IconDoc className="w-5 h-5 text-[#E5484D]" />
              </div>
              <div className="text-center">
                <h2 className="text-[15px] font-semibold text-[#ECECEE]">Yeni Belge</h2>
                <p className="text-[13px] text-[#5C5C5F] mt-2">Mevcut taslak silinecek. Emin misiniz?</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={confirmNewDocument} className="flex-1 py-2 bg-[#E5484D] hover:bg-[#D13438] rounded-lg text-[13px] font-medium text-white transition-colors">Taslağı Sil</button>
                <button onClick={() => setShowNewDocConfirm(false)} className="px-4 py-2 text-[13px] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors">İptal</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
