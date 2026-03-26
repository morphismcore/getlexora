"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { EventType, DeadlineRule, DeadlineStats, RuleFormData } from "./types";
import { ALL_CATEGORIES, CATEGORY_COLORS, DEADLINE_TYPE_LABELS, DURATION_UNITS } from "./constants";
import { Skeleton, SkeletonCard, ConfirmDialog, SlideOver, EmptyState, FormField } from "./components";

// ── Edit Event Type Form ─────────────────────────────

function EditEventTypeForm({ eventType, onSave, onCancel }: { eventType: EventType; onSave: (et: EventType) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...eventType });
  return (
    <div className="space-y-5">
      <FormField label="Olay Turu Adi">
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
        />
      </FormField>
      <FormField label="Slug">
        <input
          type="text"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 font-mono"
        />
      </FormField>
      <FormField label="Kategori">
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
        >
          {ALL_CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#16161A]">{c}</option>)}
        </select>
      </FormField>
      <FormField label="Aciklama">
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 resize-none"
        />
      </FormField>
      <FormField label="Durum">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="accent-[#6C6CFF] w-4 h-4"
          />
          <span className="text-[13px] text-[#ECECEE]">Aktif</span>
        </label>
      </FormField>
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSave(form)}
          className="flex-1 py-3 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[13px] font-medium rounded-lg transition-colors"
        >
          Kaydet
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-[#8B8B8E] text-[13px] font-medium rounded-lg transition-colors"
        >
          Iptal
        </button>
      </div>
    </div>
  );
}

// ── Rule Form Fields ─────────────────────────────────

function RuleFormFields({
  form,
  onChange,
  onSubmit,
  submitLabel,
}: {
  form: RuleFormData;
  onChange: (f: RuleFormData) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="space-y-5">
      <FormField label="Kural Adi">
        <input
          type="text"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="orn. Istinaf suresi"
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Sure Degeri">
          <input
            type="number"
            value={form.duration_value}
            onChange={(e) => onChange({ ...form, duration_value: parseInt(e.target.value) || 0 })}
            min={0}
            className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
          />
        </FormField>
        <FormField label="Sure Birimi">
          <select
            value={form.duration_unit}
            onChange={(e) => onChange({ ...form, duration_unit: e.target.value })}
            className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
          >
            {Object.entries(DURATION_UNITS).map(([k, v]) => <option key={k} value={k} className="bg-[#16161A]">{v}</option>)}
          </select>
        </FormField>
      </div>

      <FormField label="Sure Tipi">
        <select
          value={form.deadline_type}
          onChange={(e) => onChange({ ...form, deadline_type: e.target.value })}
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50"
        >
          {Object.entries(DEADLINE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-[#16161A]">{v.label}</option>)}
        </select>
      </FormField>

      <FormField label="Kanun Maddesi" hint="orn. HMK md. 345">
        <input
          type="text"
          value={form.law_reference}
          onChange={(e) => onChange({ ...form, law_reference: e.target.value })}
          placeholder="HMK md. 345"
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Adli Tatil Etkisi">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={form.affects_by_judicial_recess}
              onChange={(e) => onChange({ ...form, affects_by_judicial_recess: e.target.checked })}
              className="accent-[#6C6CFF] w-4 h-4"
            />
            <span className="text-[13px] text-[#ECECEE]">Evet</span>
          </label>
        </FormField>
        <FormField label="Resmi Tatil Etkisi">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={form.affects_by_holidays}
              onChange={(e) => onChange({ ...form, affects_by_holidays: e.target.checked })}
              className="accent-[#6C6CFF] w-4 h-4"
            />
            <span className="text-[13px] text-[#ECECEE]">Evet</span>
          </label>
        </FormField>
      </div>

      <FormField label="Aciklama">
        <textarea
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="Opsiyonel aciklama..."
          rows={3}
          className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 resize-none"
        />
      </FormField>

      <FormField label="Durum">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => onChange({ ...form, is_active: e.target.checked })}
            className="accent-[#6C6CFF] w-4 h-4"
          />
          <span className="text-[13px] text-[#ECECEE]">Aktif</span>
        </label>
      </FormField>

      <button
        onClick={onSubmit}
        disabled={!form.name}
        className="w-full py-3 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] text-white text-[13px] font-medium rounded-lg transition-colors"
      >
        {submitLabel}
      </button>
    </div>
  );
}

// ── Rule Card ────────────────────────────────────────

function RuleCard({
  rule,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  rule: DeadlineRule;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (r: DeadlineRule) => void;
  onDelete: () => void;
}) {
  const [editForm, setEditForm] = useState(rule);
  const dtLabel = DEADLINE_TYPE_LABELS[rule.deadline_type] || { label: rule.deadline_type, color: "#8B8B8E" };
  const unitLabel = DURATION_UNITS[rule.duration_unit] || rule.duration_unit;

  useEffect(() => { setEditForm(rule); }, [rule]);

  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-[#09090B] border border-[#6C6CFF]/20 rounded-lg p-4 space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Kural Adi">
            <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
          </FormField>
          <FormField label="Kanun Maddesi">
            <input type="text" value={editForm.law_reference} onChange={(e) => setEditForm({ ...editForm, law_reference: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Sure">
            <input type="number" value={editForm.duration_value} onChange={(e) => setEditForm({ ...editForm, duration_value: parseInt(e.target.value) || 0 })} min={0} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50" />
          </FormField>
          <FormField label="Birim">
            <select value={editForm.duration_unit} onChange={(e) => setEditForm({ ...editForm, duration_unit: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50">
              {Object.entries(DURATION_UNITS).map(([k, v]) => <option key={k} value={k} className="bg-[#16161A]">{v}</option>)}
            </select>
          </FormField>
          <FormField label="Sure Tipi">
            <select value={editForm.deadline_type} onChange={(e) => setEditForm({ ...editForm, deadline_type: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50">
              {Object.entries(DEADLINE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-[#16161A]">{v.label}</option>)}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={editForm.affects_by_judicial_recess} onChange={(e) => setEditForm({ ...editForm, affects_by_judicial_recess: e.target.checked })} className="accent-[#6C6CFF] w-3.5 h-3.5" />
            <span className="text-[12px] text-[#ECECEE]">Adli tatil etkisi</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={editForm.affects_by_holidays} onChange={(e) => setEditForm({ ...editForm, affects_by_holidays: e.target.checked })} className="accent-[#6C6CFF] w-3.5 h-3.5" />
            <span className="text-[12px] text-[#ECECEE]">Resmi tatil etkisi</span>
          </label>
        </div>
        <FormField label="Aciklama">
          <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50 resize-none" />
        </FormField>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancelEdit} className="px-3 py-1.5 text-[11px] font-medium text-[#8B8B8E] hover:text-[#ECECEE] bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors">Iptal</button>
          <button onClick={() => onSave(editForm)} className="px-3 py-1.5 text-[11px] font-medium text-white bg-[#6C6CFF] hover:bg-[#5B5BEE] rounded-lg transition-colors">Kaydet</button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-[#09090B] rounded-lg p-4 group hover:bg-[#0D0D10] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[13px] font-medium text-[#ECECEE]">{rule.name}</span>
            <span
              className="px-1.5 py-0.5 text-[10px] font-medium rounded"
              style={{ color: dtLabel.color, backgroundColor: `${dtLabel.color}15` }}
            >
              {dtLabel.label}
            </span>
            {!rule.is_active && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[#5C5C5F]/10 text-[#5C5C5F]">Pasif</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[#8B8B8E] flex-wrap">
            <span className="font-medium">
              {rule.duration_value} {unitLabel}
            </span>
            {rule.law_reference && (
              <>
                <span className="text-[#5C5C5F]">{"\u00b7"}</span>
                <span className="text-[#A78BFA]">{rule.law_reference}</span>
              </>
            )}
            <span className="text-[#5C5C5F]">{"\u00b7"}</span>
            <span className="flex items-center gap-1">
              Adli tatil: {rule.affects_by_judicial_recess ? <span className="text-[#3DD68C]">&#10003;</span> : <span className="text-[#E5484D]">&#10005;</span>}
            </span>
            <span className="flex items-center gap-1">
              Tatil: {rule.affects_by_holidays ? <span className="text-[#3DD68C]">&#10003;</span> : <span className="text-[#E5484D]">&#10005;</span>}
            </span>
          </div>
          {rule.description && (
            <p className="text-[11px] text-[#5C5C5F] mt-1.5">{rule.description}</p>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md hover:bg-white/[0.06] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors"
            aria-label="Duzenle"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-[#E5484D]/10 text-[#5C5C5F] hover:text-[#E5484D] transition-colors"
            aria-label="Sil"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main DeadlineRulesTab ────────────────────────────

export default function DeadlineRulesTab({
  token,
  apiUrl,
  headers,
  onToast,
}: {
  token: string | null;
  apiUrl: string;
  headers: Record<string, string>;
  onToast: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [deadlineStats, setDeadlineStats] = useState<DeadlineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tumu");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [editingRule, setEditingRule] = useState<string | null>(null);

  // Slide-over state
  const [showNewEventType, setShowNewEventType] = useState(false);
  const [showNewRule, setShowNewRule] = useState<string | null>(null);
  const [showEditEventType, setShowEditEventType] = useState<EventType | null>(null);

  // Confirm dialog
  const [confirmDelete, setConfirmDelete] = useState<{ type: "event" | "rule"; id: string; name: string } | null>(null);

  // New event type form
  const [newEventForm, setNewEventForm] = useState({ name: "", slug: "", category: "HMK", description: "" });

  // New/edit rule form
  const [ruleForm, setRuleForm] = useState<RuleFormData>({
    name: "",
    duration_value: 0,
    duration_unit: "gun",
    deadline_type: "usul_suresi",
    law_reference: "",
    affects_by_judicial_recess: true,
    affects_by_holidays: true,
    description: "",
    is_active: true,
  });

  const fetchEventTypes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [etRes, statsRes] = await Promise.allSettled([
        fetch(`${apiUrl}/api/v1/admin/event-types`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/v1/admin/deadline-rules/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (etRes.status === "fulfilled" && etRes.value.ok) {
        setEventTypes(await etRes.value.json());
      }
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        setDeadlineStats(await statsRes.value.json());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token, apiUrl]);

  useEffect(() => { fetchEventTypes(); }, [fetchEventTypes]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    eventTypes.forEach((et) => {
      counts[et.category] = (counts[et.category] || 0) + 1;
    });
    return counts;
  }, [eventTypes]);

  const filteredEventTypes = useMemo(() => {
    let filtered = eventTypes;
    if (selectedCategory !== "Tumu") {
      filtered = filtered.filter((et) => et.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((et) =>
        et.name.toLowerCase().includes(q) ||
        et.slug.toLowerCase().includes(q) ||
        et.rules.some((r) => r.name.toLowerCase().includes(q) || r.law_reference.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [eventTypes, selectedCategory, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // CRUD operations
  const createEventType = async () => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/event-types`, { method: "POST", headers, body: JSON.stringify(newEventForm) });
      if (r.ok) {
        onToast("Olay turu olusturuldu");
        setShowNewEventType(false);
        setNewEventForm({ name: "", slug: "", category: "HMK", description: "" });
        fetchEventTypes();
      } else {
        const err = await r.json().catch(() => ({}));
        onToast(err.detail || "Olusturma basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const updateEventType = async (et: EventType) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/event-types/${et.id}`, { method: "PUT", headers, body: JSON.stringify({ name: et.name, slug: et.slug, category: et.category, description: et.description, is_active: et.is_active }) });
      if (r.ok) { onToast("Olay turu guncellendi"); setShowEditEventType(null); fetchEventTypes(); }
      else { onToast("Guncelleme basarisiz", "error"); }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const deleteEventType = async (id: string) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/event-types/${id}`, { method: "DELETE", headers });
      if (r.ok) { onToast("Olay turu silindi"); fetchEventTypes(); }
      else { onToast("Silme basarisiz", "error"); }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const createRule = async (eventTypeId: string) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/deadline-rules`, { method: "POST", headers, body: JSON.stringify({ ...ruleForm, event_type_id: eventTypeId }) });
      if (r.ok) {
        onToast("Kural olusturuldu");
        setShowNewRule(null);
        setRuleForm({ name: "", duration_value: 0, duration_unit: "gun", deadline_type: "usul_suresi", law_reference: "", affects_by_judicial_recess: true, affects_by_holidays: true, description: "", is_active: true });
        fetchEventTypes();
      } else {
        const err = await r.json().catch(() => ({}));
        onToast(err.detail || "Olusturma basarisiz", "error");
      }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const updateRule = async (rule: DeadlineRule) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/deadline-rules/${rule.id}`, { method: "PUT", headers, body: JSON.stringify(rule) });
      if (r.ok) { onToast("Kural guncellendi"); setEditingRule(null); fetchEventTypes(); }
      else { onToast("Guncelleme basarisiz", "error"); }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const deleteRule = async (id: string) => {
    try {
      const r = await fetch(`${apiUrl}/api/v1/admin/deadline-rules/${id}`, { method: "DELETE", headers });
      if (r.ok) { onToast("Kural silindi"); fetchEventTypes(); }
      else { onToast("Silme basarisiz", "error"); }
    } catch { onToast("Baglanti hatasi", "error"); }
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "event") deleteEventType(confirmDelete.id);
    else deleteRule(confirmDelete.id);
    setConfirmDelete(null);
  };

  const totalRules = eventTypes.reduce((acc, et) => acc + et.rules.length, 0);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Olay Turu", value: deadlineStats?.event_type_count ?? eventTypes.length, color: "#6C6CFF" },
          { label: "Sure Kurali", value: deadlineStats?.rule_count ?? totalRules, color: "#3DD68C" },
          { label: "Kategori", value: deadlineStats?.category_count ?? Object.keys(categoryCounts).length, color: "#A78BFA" },
          { label: "Tatil Yili", value: deadlineStats?.holiday_years ?? 0, color: "#FFB224" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-[#111113] border border-white/[0.06] rounded-xl p-4">
            <p className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] text-[#5C5C5F] mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search + Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5C5F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Olay turu, kural veya kanun maddesi ara..."
            className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg pl-10 pr-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowNewEventType(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[12px] font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Yeni Olay Turu
        </button>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategory("Tumu")}
          className={`px-3 py-1.5 text-[12px] font-medium rounded-lg whitespace-nowrap transition-all ${selectedCategory === "Tumu" ? "bg-[#6C6CFF]/15 text-[#6C6CFF] ring-1 ring-[#6C6CFF]/30" : "bg-white/[0.04] text-[#5C5C5F] hover:text-[#8B8B8E] hover:bg-white/[0.06]"}`}
        >
          Tumu ({eventTypes.length})
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const count = categoryCounts[cat] || 0;
          const catColor = CATEGORY_COLORS[cat] || { color: "#8B8B8E", bg: "bg-[#8B8B8E]/10" };
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-lg whitespace-nowrap transition-all ${selectedCategory === cat ? "ring-1" : "bg-white/[0.04] hover:bg-white/[0.06]"}`}
              style={{
                color: selectedCategory === cat ? catColor.color : "#5C5C5F",
                backgroundColor: selectedCategory === cat ? `${catColor.color}15` : undefined,
                boxShadow: selectedCategory === cat ? `inset 0 0 0 1px ${catColor.color}40` : undefined,
              }}
            >
              {cat} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Event Types list */}
      {filteredEventTypes.length === 0 ? (
        <EmptyState
          icon="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          title={searchQuery ? "Sonuc bulunamadi" : "Henuz olay turu yok"}
          description={searchQuery ? "Farkli bir arama terimi deneyin." : "Ilk olay turunu olusturarak baslayin."}
          action={!searchQuery ? (
            <button onClick={() => setShowNewEventType(true)} className="px-4 py-2 bg-[#6C6CFF] hover:bg-[#5B5BEE] text-white text-[12px] font-medium rounded-lg transition-colors">
              + Yeni Olay Turu
            </button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filteredEventTypes.map((et) => {
            const isExpanded = expandedEvents.has(et.id);
            const catColor = CATEGORY_COLORS[et.category] || { color: "#8B8B8E", bg: "bg-[#8B8B8E]/10" };
            return (
              <motion.div key={et.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#111113] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.10] transition-colors">
                <button onClick={() => toggleExpand(et.id)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
                  <motion.svg animate={{ rotate: isExpanded ? 90 : 0 }} className="w-4 h-4 text-[#5C5C5F] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </motion.svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[14px] font-medium text-[#ECECEE] truncate">{et.name}</span>
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-md shrink-0" style={{ color: catColor.color, backgroundColor: `${catColor.color}15` }}>{et.category}</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-mono text-[#5C5C5F] bg-white/[0.04] rounded shrink-0">{et.rules.length}</span>
                    </div>
                    <span className="text-[11px] text-[#5C5C5F] font-mono">{et.slug}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${et.is_active ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#5C5C5F]/10 text-[#5C5C5F]"}`}>
                    {et.is_active ? "Aktif" : "Pasif"}
                  </span>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="px-5 pb-5 space-y-3 border-t border-white/[0.06] pt-4">
                        {et.description && <p className="text-[12px] text-[#8B8B8E] mb-3">{et.description}</p>}
                        {et.rules.length === 0 ? (
                          <div className="text-center py-6 bg-[#09090B] rounded-lg border border-dashed border-white/[0.06]">
                            <p className="text-[12px] text-[#5C5C5F]">Bu olay turune henuz kural eklenmemis.</p>
                          </div>
                        ) : (
                          et.rules.map((rule) => (
                            <RuleCard key={rule.id} rule={rule} isEditing={editingRule === rule.id} onEdit={() => setEditingRule(rule.id)} onCancelEdit={() => setEditingRule(null)} onSave={updateRule} onDelete={() => setConfirmDelete({ type: "rule", id: rule.id, name: rule.name })} />
                          ))
                        )}
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => { setShowNewRule(et.id); setRuleForm({ name: "", duration_value: 0, duration_unit: "gun", deadline_type: "usul_suresi", law_reference: "", affects_by_judicial_recess: true, affects_by_holidays: true, description: "", is_active: true }); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#6C6CFF] bg-[#6C6CFF]/10 hover:bg-[#6C6CFF]/20 rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Yeni Kural Ekle
                          </button>
                          <button onClick={() => setShowEditEventType(et)} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#8B8B8E] bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                            Olay Turunu Duzenle
                          </button>
                          <button onClick={() => setConfirmDelete({ type: "event", id: et.id, name: et.name })} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#E5484D] bg-[#E5484D]/10 hover:bg-[#E5484D]/20 rounded-lg transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            Sil
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Event Type Slide-over */}
      <SlideOver open={showNewEventType} onClose={() => setShowNewEventType(false)} title="Yeni Olay Turu">
        <div className="space-y-5">
          <FormField label="Olay Turu Adi">
            <input type="text" value={newEventForm.name} onChange={(e) => setNewEventForm({ ...newEventForm, name: e.target.value })} placeholder="orn. Hukuk Karari Tebligi" className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50" />
          </FormField>
          <FormField label="Slug (benzersiz tanimlayici)">
            <input type="text" value={newEventForm.slug} onChange={(e) => setNewEventForm({ ...newEventForm, slug: e.target.value })} placeholder="orn. hmk_karar_teblig" className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 font-mono" />
          </FormField>
          <FormField label="Kategori">
            <select value={newEventForm.category} onChange={(e) => setNewEventForm({ ...newEventForm, category: e.target.value })} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] focus:outline-none focus:border-[#6C6CFF]/50">
              {ALL_CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#16161A]">{c}</option>)}
            </select>
          </FormField>
          <FormField label="Aciklama">
            <textarea value={newEventForm.description} onChange={(e) => setNewEventForm({ ...newEventForm, description: e.target.value })} placeholder="Opsiyonel aciklama..." rows={3} className="w-full bg-[#1A1A1F] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#ECECEE] placeholder:text-[#5C5C5F] focus:outline-none focus:border-[#6C6CFF]/50 resize-none" />
          </FormField>
          <button onClick={createEventType} disabled={!newEventForm.name || !newEventForm.slug} className="w-full py-3 bg-[#6C6CFF] hover:bg-[#5B5BEE] disabled:bg-[#1A1A1F] disabled:text-[#5C5C5F] text-white text-[13px] font-medium rounded-lg transition-colors">
            Olay Turunu Olustur
          </button>
        </div>
      </SlideOver>

      {/* Edit Event Type Slide-over */}
      <SlideOver open={!!showEditEventType} onClose={() => setShowEditEventType(null)} title="Olay Turunu Duzenle">
        {showEditEventType && <EditEventTypeForm eventType={showEditEventType} onSave={updateEventType} onCancel={() => setShowEditEventType(null)} />}
      </SlideOver>

      {/* New Rule Slide-over */}
      <SlideOver open={!!showNewRule} onClose={() => setShowNewRule(null)} title="Yeni Sure Kurali">
        <RuleFormFields form={ruleForm} onChange={setRuleForm} onSubmit={() => showNewRule && createRule(showNewRule)} submitLabel="Kural Olustur" />
      </SlideOver>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === "event" ? "Olay Turunu Sil" : "Kurali Sil"}
        message={`"${confirmDelete?.name || ""}" silinecek. Bu islem geri alinamaz.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </motion.div>
  );
}
