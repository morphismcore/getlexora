// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlockType =
  | "section_header"
  | "numbered_paragraph"
  | "sub_paragraph"
  | "free_text"
  | "evidence_item"
  | "legal_reference";

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  children?: Block[];
}

export interface HeaderFields {
  mahkeme: string;
  davaci: string;
  davaci_tc: string;
  davaci_adres: string;
  davaci_vekili: string;
  davali: string;
  davali_adres: string;
  konu: string;
}

export interface DocumentState {
  docType: string;
  header: HeaderFields;
  blocks: Block[];
}

export interface TemplateField {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface Template {
  id: string;
  name: string;
  category: string;
  fields: TemplateField[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DOC_TYPES = [
  "Dava Dilekçesi",
  "İhtarname",
  "Sözleşme",
  "Cevap Dilekçesi",
] as const;

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  section_header: "Bölüm Başlığı",
  numbered_paragraph: "Madde",
  sub_paragraph: "Alt Madde",
  free_text: "Serbest Metin",
  evidence_item: "Delil",
  legal_reference: "Kanun Referansı",
};

export const SECTION_PRESETS = [
  "AÇIKLAMALAR",
  "HUKUKİ SEBEPLER",
  "DELİLLER",
  "SONUÇ VE TALEP",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function uid(): string {
  return crypto.randomUUID();
}

export function subLabel(index: number): string {
  if (index < 26) return String.fromCharCode(97 + index);
  const first = String.fromCharCode(97 + Math.floor(index / 26) - 1);
  const second = String.fromCharCode(97 + (index % 26));
  return first + second;
}

export function emptyHeader(): HeaderFields {
  return {
    mahkeme: "",
    davaci: "",
    davaci_tc: "",
    davaci_adres: "",
    davaci_vekili: "",
    davali: "",
    davali_adres: "",
    konu: "",
  };
}

export function initialState(): DocumentState {
  return {
    docType: DOC_TYPES[0],
    header: emptyHeader(),
    blocks: [],
  };
}

export function sampleDocument(): DocumentState {
  return {
    docType: "Dava Dilekçesi",
    header: {
      mahkeme: "İstanbul 3. İş Mahkemesi",
      davaci: "Ahmet Yılmaz",
      davaci_tc: "12345678901",
      davaci_adres: "Kadıköy, İstanbul",
      davaci_vekili: "Av. Mehmet Demir",
      davali: "XYZ Teknoloji A.Ş.",
      davali_adres: "Şişli, İstanbul",
      konu: "Feshin geçersizliği ve işe iade talebi",
    },
    blocks: [
      { id: uid(), type: "section_header", content: "AÇIKLAMALAR" },
      {
        id: uid(),
        type: "numbered_paragraph",
        content:
          "Müvekkilimiz, davalı işyerinde 15.01.2020 tarihinden itibaren belirsiz süreli iş sözleşmesi kapsamında yazılım geliştirici olarak çalışmaktadır.",
        children: [],
      },
      {
        id: uid(),
        type: "numbered_paragraph",
        content:
          "İş sözleşmesi, davalı işveren tarafından 10.03.2024 tarihinde geçerli bir sebep gösterilmeksizin feshedilmiştir.",
        children: [
          {
            id: uid(),
            type: "sub_paragraph",
            content:
              "Fesih bildirimi yazılı olarak yapılmış ancak geçerli bir fesih sebebi belirtilmemiştir.",
          },
          {
            id: uid(),
            type: "sub_paragraph",
            content:
              "Müvekkilimizin savunması alınmamıştır.",
          },
        ],
      },
      {
        id: uid(),
        type: "numbered_paragraph",
        content:
          "Müvekkilimiz, davalı işyerinde 30 (otuz) dan fazla işçi çalışmakta olup, 6 aydan uzun süredir çalışmaktadır. Bu nedenle iş güvencesi kapsamındadır.",
        children: [],
      },
      { id: uid(), type: "section_header", content: "HUKUKİ SEBEPLER" },
      {
        id: uid(),
        type: "legal_reference",
        content:
          "4857 sayılı İş Kanunu md. 18, 19, 20, 21 — İş güvencesi hükümleri",
      },
      {
        id: uid(),
        type: "legal_reference",
        content:
          "4857 sayılı İş Kanunu md. 17 — Süreli fesih (ihbar tazminatı)",
      },
      {
        id: uid(),
        type: "free_text",
        content:
          "Yukarıda belirtilen kanun maddeleri uyarınca, feshin geçerli bir sebebe dayanmadığı açıktır.",
      },
      { id: uid(), type: "section_header", content: "DELİLLER" },
      { id: uid(), type: "evidence_item", content: "İş sözleşmesi sureti" },
      { id: uid(), type: "evidence_item", content: "Fesih bildirimi" },
      { id: uid(), type: "evidence_item", content: "Maaş bordroları" },
      {
        id: uid(),
        type: "evidence_item",
        content: "SGK hizmet dökümü",
      },
      { id: uid(), type: "evidence_item", content: "Tanık beyanları" },
      { id: uid(), type: "section_header", content: "SONUÇ VE TALEP" },
      {
        id: uid(),
        type: "free_text",
        content:
          "Yukarıda arz ve izah edilen nedenlerle; feshin geçersizliğine ve müvekkilimizin işe iadesine, boşta geçen süreye ilişkin en çok 4 aylık ücret ve diğer haklarının ödenmesine, işe başlatılmama halinde en az 4 en çok 8 aylık brüt ücreti tutarında tazminatın belirlenmesine ve yargılama giderleri ile vekalet ücretinin davalıya yükletilmesine karar verilmesini saygılarımızla arz ve talep ederiz.",
      },
    ],
  };
}
