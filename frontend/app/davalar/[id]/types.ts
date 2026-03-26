export interface CaseDetail {
  id: string;
  title: string;
  case_type: string;
  court: string | null;
  case_number: string | null;
  opponent: string | null;
  assigned_to: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeadlineCalcDetail {
  start_date: string;
  legal_duration: string;
  law_article: string;
  calculated_end: string;
  actual_end: string;
  extended_reason: string | null;
  skipped_days: { date: string; reason: string }[];
  remaining_calendar: number;
  remaining_business: number;
  law_text: string;
}

export interface Deadline {
  id: string;
  name: string;
  deadline_date: string;
  original_date?: string | null;
  urgency: "critical" | "warning" | "normal" | "expired";
  days_left: number;
  is_completed: boolean;
  law_reference: string;
  duration: string;
  note: string;
  override?: {
    original_date: string;
    reason: string;
    overridden_by: string;
    overridden_at: string;
  } | null;
  calc_detail?: DeadlineCalcDetail | null;
}

export interface CaseEvent {
  id: string;
  event_type: string;
  event_type_label: string;
  event_date: string;
  note: string | null;
  created_at: string;
  deadlines: Deadline[];
}

export interface EventTypeOption {
  value: string;
  label: string;
  description: string;
  is_frequent?: boolean;
}

export interface ApplicableDeadline {
  key: string;
  name: string;
  duration: string;
  law_reference: string;
}

export const CASE_TYPES: Record<string, string> = {
  is_hukuku: "Is Hukuku",
  ceza: "Ceza",
  ticaret: "Ticaret",
  idare: "Idare",
  aile: "Aile",
};

export const STATUS_COLORS: Record<string, string> = {
  aktif: "bg-[#3DD68C]/10 text-[#3DD68C]",
  beklemede: "bg-[#FFB224]/10 text-[#FFB224]",
  kapandi: "bg-[#5C5C5F]/10 text-[#5C5C5F]",
};

export const TABS = [
  { key: "ozet", label: "Ozet" },
  { key: "olaylar", label: "Olaylar & Sureler" },
  { key: "durusmalar", label: "Durusmalar" },
  { key: "belgeler", label: "Belgeler" },
  { key: "notlar", label: "Notlar" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export const EVENT_TYPE_OPTIONS: EventTypeOption[] = [
  { value: "karar_teblig", label: "Karar tebligi", description: "Hukuk mahkemesi kararinin teblig edilmesi", is_frequent: true },
  { value: "durusma", label: "Durusma", description: "Durusma yapilmasi", is_frequent: true },
  { value: "bilirkisi_raporu", label: "Bilirkisi raporu", description: "Bilirkisi raporunun teblig edilmesi", is_frequent: true },
  { value: "dava_acildi", label: "Dava acildi", description: "Dava dilekcessinin teblig edilmesi", is_frequent: true },
  { value: "ceza_karar_teblig", label: "Karar tebligi (Ceza)", description: "Ceza mahkemesi kararinin teblig edilmesi" },
  { value: "istinaf_teblig", label: "Istinaf suresi (BAM)", description: "Bolge Adliye Mahkemesine istinaf" },
  { value: "temyiz_teblig", label: "Temyiz suresi (Yargitay)", description: "Yargitaya temyiz basvurusu" },
  { value: "itiraz_teblig", label: "Itiraz suresi", description: "Karara itiraz" },
  { value: "karar_duzeltme", label: "Karar duzeltme", description: "Karar duzeltme basvurusu" },
  { value: "fesih_bildirimi", label: "Fesih bildirimi", description: "Is sozlesmesinin feshedilmesi" },
  { value: "icra_takibi", label: "Icra takibi (Odeme emri)", description: "Odeme emrinin borclura tebligi" },
  { value: "idari_islem", label: "Idari islem tebligi", description: "Idari islemin ilgilisine tebligi" },
];

export const MOCK_APPLICABLE_DEADLINES: Record<string, ApplicableDeadline[]> = {
  karar_teblig: [
    { key: "istinaf", name: "Istinaf basvurusu", duration: "14 gun", law_reference: "HMK md. 345" },
    { key: "temyiz", name: "Temyiz basvurusu", duration: "30 gun", law_reference: "HMK md. 361" },
    { key: "yargilanma_yenilenmesi", name: "Yargilamanin yenilenmesi", duration: "60 gun", law_reference: "HMK md. 375" },
  ],
  ceza_karar_teblig: [
    { key: "istinaf_ceza", name: "Istinaf basvurusu (Ceza)", duration: "7 gun", law_reference: "CMK md. 273" },
    { key: "temyiz_ceza", name: "Temyiz basvurusu (Ceza)", duration: "15 gun", law_reference: "CMK md. 291" },
  ],
  durusma: [
    { key: "beyanda_bulunma", name: "Beyanda bulunma", duration: "14 gun", law_reference: "HMK md. 147" },
  ],
  bilirkisi_raporu: [
    { key: "bilirkisi_itiraz", name: "Bilirkisi raporuna itiraz", duration: "14 gun", law_reference: "HMK md. 281" },
  ],
  dava_acildi: [
    { key: "cevap_dilekce", name: "Cevap dilekcesi", duration: "14 gun", law_reference: "HMK md. 127" },
  ],
  istinaf_teblig: [
    { key: "istinaf", name: "Istinaf basvurusu", duration: "14 gun", law_reference: "HMK md. 345" },
  ],
  temyiz_teblig: [
    { key: "temyiz", name: "Temyiz basvurusu", duration: "15 gun", law_reference: "HMK md. 361" },
  ],
  itiraz_teblig: [
    { key: "itiraz", name: "Itiraz", duration: "7 gun", law_reference: "HMK md. 341" },
  ],
  karar_duzeltme: [
    { key: "karar_duzeltme", name: "Karar duzeltme", duration: "15 gun", law_reference: "HMK md. 363" },
  ],
  fesih_bildirimi: [
    { key: "ise_iade", name: "Ise iade davasi", duration: "30 gun", law_reference: "Is K. md. 20" },
  ],
  icra_takibi: [
    { key: "itiraz_icra", name: "Odeme emrine itiraz", duration: "7 gun", law_reference: "IIK md. 62" },
  ],
  idari_islem: [
    { key: "iptal_davasi", name: "Iptal davasi", duration: "60 gun", law_reference: "IYUK md. 7" },
    { key: "tam_yargi", name: "Tam yargi davasi", duration: "60 gun", law_reference: "IYUK md. 13" },
  ],
};

export const OVERRIDE_REASONS = [
  "Hakim farkli sure verdi",
  "Ek sure verildi",
  "Tebligat tarihi duzeltmesi",
];
