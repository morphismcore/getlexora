"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BlockType =
  | "section_header"
  | "numbered_paragraph"
  | "sub_paragraph"
  | "free_text"
  | "evidence_item"
  | "legal_reference";

interface Block {
  id: string;
  type: BlockType;
  content: string;
  children?: Block[];
}

interface HeaderFields {
  mahkeme: string;
  davaci: string;
  davaci_tc: string;
  davaci_adres: string;
  davaci_vekili: string;
  davali: string;
  davali_adres: string;
  konu: string;
}

interface DocumentState {
  docType: string;
  header: HeaderFields;
  blocks: Block[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOC_TYPES = [
  "Dava Dilekçesi",
  "İhtarname",
  "Sözleşme",
  "Cevap Dilekçesi",
] as const;

const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  section_header: "Bölüm Başlığı",
  numbered_paragraph: "Madde",
  sub_paragraph: "Alt Madde",
  free_text: "Serbest Metin",
  evidence_item: "Delil",
  legal_reference: "Kanun Referansı",
};

const SECTION_PRESETS = [
  "AÇIKLAMALAR",
  "HUKUKİ SEBEPLER",
  "DELİLLER",
  "SONUÇ VE TALEP",
];

// ---------------------------------------------------------------------------
// Template types & built-in templates (always available, merged with backend)
// ---------------------------------------------------------------------------

interface TemplateField {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface Template {
  id: string;
  name: string;
  category: string;
  fields: TemplateField[];
}

const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "builtin-ise-iade",
    name: "İşe İade Davası",
    category: "İş Hukuku",
    fields: [
      { id: "isci_adi", label: "İşçi Adı Soyadı", type: "text", required: true },
      { id: "isci_tc", label: "TC Kimlik No", type: "text", required: true },
      { id: "isveren", label: "İşveren Unvanı", type: "text", required: true },
      { id: "ise_baslama", label: "İşe Başlama Tarihi", type: "date", required: true },
      { id: "fesih_tarihi", label: "Fesih Tarihi", type: "date", required: true },
      { id: "fesih_sebebi", label: "Bildirilen Fesih Sebebi", type: "textarea", placeholder: "İşveren tarafından belirtilen fesih gerekçesi" },
      { id: "mahkeme", label: "Mahkeme", type: "text", placeholder: "Örn: İstanbul 3. İş Mahkemesi" },
    ],
  },
  {
    id: "builtin-kidem-tazminati",
    name: "Kıdem Tazminatı Talebi",
    category: "İş Hukuku",
    fields: [
      { id: "isci_adi", label: "İşçi Adı Soyadı", type: "text", required: true },
      { id: "isveren", label: "İşveren Unvanı", type: "text", required: true },
      { id: "calisma_suresi", label: "Çalışma Süresi (yıl)", type: "number", required: true },
      { id: "son_brut_ucret", label: "Son Brüt Ücret (TL)", type: "number", required: true },
      { id: "fesih_tarihi", label: "Fesih Tarihi", type: "date", required: true },
    ],
  },
  {
    id: "builtin-ihbarname",
    name: "Genel İhtarname",
    category: "Ticaret Hukuku",
    fields: [
      { id: "gonderen", label: "Gönderen (Ad Soyad / Unvan)", type: "text", required: true },
      { id: "muhatap", label: "Muhatap (Ad Soyad / Unvan)", type: "text", required: true },
      { id: "konu", label: "İhtar Konusu", type: "text", required: true },
      { id: "aciklama", label: "Açıklama", type: "textarea", required: true, placeholder: "İhtarnamenin detaylı açıklaması" },
      { id: "sure", label: "Verilen Süre (gün)", type: "number", placeholder: "Örn: 7" },
    ],
  },
  {
    id: "builtin-bosanma",
    name: "Anlaşmalı Boşanma Dilekçesi",
    category: "Aile Hukuku",
    fields: [
      { id: "davaci", label: "Davacı Eş", type: "text", required: true },
      { id: "davali", label: "Davalı Eş", type: "text", required: true },
      { id: "evlilik_tarihi", label: "Evlilik Tarihi", type: "date", required: true },
      { id: "cocuk_sayisi", label: "Müşterek Çocuk Sayısı", type: "number" },
      { id: "protokol_ozeti", label: "Anlaşma Protokolü Özeti", type: "textarea", placeholder: "Velayet, nafaka, mal paylaşımı gibi konulardaki anlaşma" },
      { id: "mahkeme", label: "Mahkeme", type: "text", placeholder: "Örn: İstanbul Aile Mahkemesi" },
    ],
  },
  {
    id: "builtin-nafaka",
    name: "Nafaka Talebi",
    category: "Aile Hukuku",
    fields: [
      { id: "davaci", label: "Davacı", type: "text", required: true },
      { id: "davali", label: "Davalı", type: "text", required: true },
      { id: "nafaka_turu", label: "Nafaka Türü", type: "select", options: ["Tedbir Nafakası", "Yoksulluk Nafakası", "İştirak Nafakası"], required: true },
      { id: "talep_miktari", label: "Talep Edilen Aylık Miktar (TL)", type: "number", required: true },
      { id: "gerekce", label: "Gerekçe", type: "textarea", required: true },
    ],
  },
  {
    id: "builtin-suc-duyurusu",
    name: "Suç Duyurusu",
    category: "Ceza Hukuku",
    fields: [
      { id: "sikayet_eden", label: "Şikayetçi / Müşteki", type: "text", required: true },
      { id: "suphe_li", label: "Şüpheli", type: "text", required: true },
      { id: "suc_tarihi", label: "Suç Tarihi", type: "date", required: true },
      { id: "suc_yeri", label: "Suç Yeri", type: "text" },
      { id: "olay_ozeti", label: "Olay Özeti", type: "textarea", required: true, placeholder: "Olayın ayrıntılı anlatımı" },
      { id: "suc_turu", label: "İsnat Edilen Suç", type: "text", placeholder: "Örn: Dolandırıcılık, Tehdit" },
    ],
  },
  {
    id: "builtin-idari-itiraz",
    name: "İdari İşlem İptali",
    category: "İdare Hukuku",
    fields: [
      { id: "davaci", label: "Davacı", type: "text", required: true },
      { id: "davali_idare", label: "Davalı İdare", type: "text", required: true },
      { id: "islem_tarihi", label: "İşlem Tarihi", type: "date", required: true },
      { id: "islem_konusu", label: "İptali İstenen İşlem", type: "textarea", required: true, placeholder: "İdari işlemin tanımı" },
      { id: "hukuka_aykirilik", label: "Hukuka Aykırılık Gerekçesi", type: "textarea", required: true },
    ],
  },
  {
    id: "builtin-icra-itiraz",
    name: "İcra Takibine İtiraz",
    category: "İcra-İflas",
    fields: [
      { id: "borclu", label: "Borçlu (İtiraz Eden)", type: "text", required: true },
      { id: "alacakli", label: "Alacaklı", type: "text", required: true },
      { id: "dosya_no", label: "İcra Dosya No", type: "text", required: true },
      { id: "itiraz_sebebi", label: "İtiraz Sebebi", type: "select", options: ["Borca İtiraz", "İmzaya İtiraz", "Zamanaşımı İtirazı", "Yetkiye İtiraz"], required: true },
      { id: "aciklama", label: "Açıklama", type: "textarea", required: true },
    ],
  },
  {
    id: "builtin-tuketici-sikayet",
    name: "Tüketici Şikayet Dilekçesi",
    category: "Tüketici Hukuku",
    fields: [
      { id: "tuketici", label: "Tüketici Adı Soyadı", type: "text", required: true },
      { id: "firma", label: "Şikayet Edilen Firma", type: "text", required: true },
      { id: "urun_hizmet", label: "Ürün / Hizmet", type: "text", required: true },
      { id: "satin_alma_tarihi", label: "Satın Alma Tarihi", type: "date" },
      { id: "sorun", label: "Sorun Açıklaması", type: "textarea", required: true, placeholder: "Yaşanan sorunun detaylı açıklaması" },
      { id: "talep", label: "Talep", type: "select", options: ["Ürün İadesi", "Ücretsiz Onarım", "Bedel İadesi", "Ürün Değişimi", "Tazminat"], required: true },
    ],
  },
  {
    id: "builtin-tahliye",
    name: "Tahliye Talepli Dava",
    category: "Gayrimenkul Hukuku",
    fields: [
      { id: "kiraya_veren", label: "Kiraya Veren", type: "text", required: true },
      { id: "kiraci", label: "Kiracı", type: "text", required: true },
      { id: "tasinmaz_adresi", label: "Taşınmaz Adresi", type: "textarea", required: true },
      { id: "kira_baslangic", label: "Kira Başlangıç Tarihi", type: "date" },
      { id: "tahliye_sebebi", label: "Tahliye Sebebi", type: "select", options: ["Kira Bedelinin Ödenmemesi", "Tahliye Taahhüdü", "İhtiyaç Sebebiyle", "Yeniden İnşa/İmar", "Süre Sonu"], required: true },
      { id: "aciklama", label: "Ek Açıklama", type: "textarea" },
    ],
  },

  // =========================================================================
  // İŞ HUKUKU (ek şablonlar)
  // =========================================================================
  {
    id: "builtin-ihbar-tazminati",
    name: "İhbar Tazminatı Talebi",
    category: "İş Hukuku",
    fields: [
      { id: "isci_adi", label: "İşçi Adı Soyadı", type: "text", required: true },
      { id: "isveren", label: "İşveren Unvanı", type: "text", required: true },
      { id: "ise_baslama", label: "İşe Başlama Tarihi", type: "date", required: true },
      { id: "fesih_tarihi", label: "Fesih Tarihi", type: "date", required: true },
      { id: "son_brut_ucret", label: "Son Brüt Ücret (TL)", type: "number", required: true },
      { id: "fesih_sekli", label: "Fesih Şekli", type: "select", options: ["İşveren tarafından ihbarsız fesih", "Haklı sebep olmaksızın fesih"], required: true },
      { id: "mahkeme", label: "Mahkeme", type: "text", placeholder: "Örn: İstanbul 5. İş Mahkemesi" },
    ],
  },
  {
    id: "builtin-fazla-mesai",
    name: "Fazla Mesai Ücreti Alacağı",
    category: "İş Hukuku",
    fields: [
      { id: "isci_adi", label: "İşçi Adı Soyadı", type: "text", required: true },
      { id: "isveren", label: "İşveren Unvanı", type: "text", required: true },
      { id: "calisma_donem", label: "Fazla Mesai Yapılan Dönem", type: "text", required: true, placeholder: "Örn: 01.2023 - 12.2024" },
      { id: "haftalik_saat", label: "Haftalık Ortalama Çalışma Saati", type: "number", required: true, placeholder: "Örn: 55" },
      { id: "son_brut_ucret", label: "Son Brüt Ücret (TL)", type: "number", required: true },
      { id: "odenmis_mi", label: "Fazla Mesai Ücreti Ödenmiş mi?", type: "select", options: ["Hiç ödenmedi", "Kısmen ödendi", "Eksik ödendi"], required: true },
      { id: "mahkeme", label: "Mahkeme", type: "text", placeholder: "Örn: Ankara 2. İş Mahkemesi" },
    ],
  },
  {
    id: "builtin-yillik-izin",
    name: "Yıllık İzin Ücreti Alacağı",
    category: "İş Hukuku",
    fields: [
      { id: "isci_adi", label: "İşçi Adı Soyadı", type: "text", required: true },
      { id: "isveren", label: "İşveren Unvanı", type: "text", required: true },
      { id: "calisma_suresi", label: "Toplam Çalışma Süresi (yıl)", type: "number", required: true },
      { id: "kullanilmamis_izin", label: "Kullanılmamış İzin Günü", type: "number", required: true },
      { id: "son_brut_ucret", label: "Son Brüt Ücret (TL)", type: "number", required: true },
      { id: "fesih_tarihi", label: "İş Sözleşmesi Sona Erme Tarihi", type: "date", required: true },
    ],
  },
  {
    id: "builtin-mobbing",
    name: "Mobbing (Psikolojik Taciz) Davası",
    category: "İş Hukuku",
    fields: [
      { id: "isci_adi", label: "İşçi Adı Soyadı", type: "text", required: true },
      { id: "isveren", label: "İşveren Unvanı", type: "text", required: true },
      { id: "mobbing_uygulayan", label: "Mobbing Uygulayan Kişi/Pozisyon", type: "text", required: true },
      { id: "baslangic_tarihi", label: "Mobbing Başlangıç Tarihi (yaklaşık)", type: "date" },
      { id: "eylemler", label: "Mobbing Eylemleri", type: "textarea", required: true, placeholder: "Sistematik baskı, dışlama, aşağılama, iş vermeme vb. eylemleri detaylıca yazınız" },
      { id: "saglik_raporu", label: "Sağlık Raporu Var mı?", type: "select", options: ["Evet", "Hayır"] },
      { id: "talep", label: "Talep", type: "select", options: ["Maddi ve Manevi Tazminat", "İş Sözleşmesinin Haklı Feshi + Tazminat", "Sadece Manevi Tazminat"], required: true },
      { id: "mahkeme", label: "Mahkeme", type: "text", placeholder: "Örn: İstanbul 1. İş Mahkemesi" },
    ],
  },
  {
    id: "builtin-is-kazasi",
    name: "İş Kazası Tazminat Davası",
    category: "İş Hukuku",
    fields: [
      { id: "isci_adi", label: "İşçi / Hak Sahibi Adı Soyadı", type: "text", required: true },
      { id: "isveren", label: "İşveren Unvanı", type: "text", required: true },
      { id: "kaza_tarihi", label: "Kaza Tarihi", type: "date", required: true },
      { id: "kaza_yeri", label: "Kaza Yeri", type: "text", required: true },
      { id: "kaza_aciklama", label: "Kaza Açıklaması", type: "textarea", required: true, placeholder: "Kazanın oluş şekli ve koşulları" },
      { id: "yaralanma", label: "Yaralanma / Maluliyet Durumu", type: "textarea", required: true, placeholder: "Sağlık kurulu raporu, maluliyet oranı vb." },
      { id: "isg_onlem", label: "Alınmayan İSG Önlemleri", type: "textarea", placeholder: "İşverenin almadığı iş sağlığı ve güvenliği önlemleri" },
      { id: "talep_miktari", label: "Talep Edilen Tazminat (TL)", type: "number" },
      { id: "mahkeme", label: "Mahkeme", type: "text", placeholder: "Örn: Kocaeli 2. İş Mahkemesi" },
    ],
  },
  {
    id: "builtin-sendikal-tazminat",
    name: "Sendikal Tazminat Davası",
    category: "İş Hukuku",
    fields: [
      { id: "isci_adi", label: "İşçi Adı Soyadı", type: "text", required: true },
      { id: "isveren", label: "İşveren Unvanı", type: "text", required: true },
      { id: "sendika", label: "Üye Olunan Sendika", type: "text", required: true },
      { id: "uyelik_tarihi", label: "Sendika Üyelik Tarihi", type: "date", required: true },
      { id: "fesih_tarihi", label: "Fesih Tarihi", type: "date", required: true },
      { id: "fesih_nedeni", label: "İşverenin Bildirdiği Fesih Nedeni", type: "textarea" },
      { id: "sendikal_nedenler", label: "Sendikal Nedenle Fesih Kanıtları", type: "textarea", required: true, placeholder: "Sendika üyeliği sonrası yapılan ayrımcılık, baskı vb." },
      { id: "mahkeme", label: "Mahkeme", type: "text", placeholder: "Örn: İstanbul 7. İş Mahkemesi" },
    ],
  },

  // =========================================================================
  // CEZA HUKUKU (ek şablonlar)
  // =========================================================================
  {
    id: "builtin-sikayet-dilekcesi",
    name: "Şikayet Dilekçesi (Genel)",
    category: "Ceza Hukuku",
    fields: [
      { id: "sikayet_eden", label: "Şikayetçi Adı Soyadı", type: "text", required: true },
      { id: "sikayet_eden_tc", label: "TC Kimlik No", type: "text", required: true },
      { id: "sikayet_eden_adres", label: "Adres", type: "textarea", required: true },
      { id: "supheli", label: "Şüpheli (biliniyorsa)", type: "text", placeholder: "Bilinmiyorsa boş bırakınız" },
      { id: "olay_tarihi", label: "Olay Tarihi", type: "date", required: true },
      { id: "olay_yeri", label: "Olay Yeri", type: "text", required: true },
      { id: "olay_anlatimi", label: "Olayın Ayrıntılı Anlatımı", type: "textarea", required: true },
      { id: "deliller", label: "Deliller", type: "textarea", placeholder: "Tanık, kamera kaydı, belge vb." },
      { id: "cumhuriyet_bassavciligi", label: "Cumhuriyet Başsavcılığı", type: "text", placeholder: "Örn: İstanbul Anadolu Cumhuriyet Başsavcılığı" },
    ],
  },
  {
    id: "builtin-ceza-itiraz",
    name: "Ceza Kararına İtiraz",
    category: "Ceza Hukuku",
    fields: [
      { id: "itiraz_eden", label: "İtiraz Eden (Sanık/Müdafi)", type: "text", required: true },
      { id: "dosya_no", label: "Dosya No", type: "text", required: true },
      { id: "karar_mahkemesi", label: "Kararı Veren Mahkeme", type: "text", required: true },
      { id: "karar_tarihi", label: "Karar Tarihi", type: "date", required: true },
      { id: "karar_ozeti", label: "Karar Özeti", type: "textarea", required: true, placeholder: "Verilen ceza ve mahkumiyet kararının özeti" },
      { id: "itiraz_sebepleri", label: "İtiraz Sebepleri", type: "textarea", required: true, placeholder: "Usul ve esasa ilişkin itiraz gerekçeleri" },
      { id: "talep", label: "Talep", type: "select", options: ["Kararın kaldırılması", "Beraat", "Cezanın indirilmesi", "Yeniden yargılama"], required: true },
    ],
  },
  {
    id: "builtin-temyiz",
    name: "Temyiz Dilekçesi (Ceza)",
    category: "Ceza Hukuku",
    fields: [
      { id: "temyiz_eden", label: "Temyiz Eden", type: "text", required: true },
      { id: "dosya_no", label: "Dosya No", type: "text", required: true },
      { id: "mahkeme", label: "Kararı Veren Mahkeme", type: "text", required: true },
      { id: "karar_tarihi", label: "Karar Tarihi", type: "date", required: true },
      { id: "suc_turu", label: "Suç Türü", type: "text", required: true },
      { id: "verilen_ceza", label: "Verilen Ceza", type: "text", required: true },
      { id: "temyiz_sebepleri", label: "Temyiz Sebepleri", type: "textarea", required: true, placeholder: "CMK md. 288 ve devamı uyarınca temyiz nedenleri" },
      { id: "talep", label: "Talep", type: "select", options: ["Bozma", "Beraat", "Cezanın indirilmesi", "Düşme"], required: true },
    ],
  },
  {
    id: "builtin-beraat-talebi",
    name: "Beraat Talebi (Esas Hakkında Mütalaa)",
    category: "Ceza Hukuku",
    fields: [
      { id: "sanik", label: "Sanık Adı Soyadı", type: "text", required: true },
      { id: "dosya_no", label: "Dosya No", type: "text", required: true },
      { id: "mahkeme", label: "Mahkeme", type: "text", required: true },
      { id: "isnat_edilen_suc", label: "İsnat Edilen Suç", type: "text", required: true },
      { id: "beraat_gerekceleri", label: "Beraat Gerekçeleri", type: "textarea", required: true, placeholder: "Delil yetersizliği, suç unsurlarının oluşmadığı vb." },
      { id: "deliller", label: "Lehe Deliller", type: "textarea", placeholder: "Tanık, belge, bilirkişi raporu vb." },
    ],
  },
  {
    id: "builtin-tutukluluk-itiraz",
    name: "Tutukluluk Kararına İtiraz",
    category: "Ceza Hukuku",
    fields: [
      { id: "supheli_sanik", label: "Şüpheli/Sanık Adı Soyadı", type: "text", required: true },
      { id: "dosya_no", label: "Soruşturma/Dosya No", type: "text", required: true },
      { id: "tutuklama_tarihi", label: "Tutuklama Tarihi", type: "date", required: true },
      { id: "tutuklama_mahkemesi", label: "Tutuklama Kararını Veren Mahkeme", type: "text", required: true },
      { id: "itiraz_sebepleri", label: "İtiraz Sebepleri", type: "textarea", required: true, placeholder: "CMK md. 100 şartlarının bulunmadığı, adli kontrol yeterliliği vb." },
      { id: "talep", label: "Talep", type: "select", options: ["Tahliye", "Adli kontrol tedbirine çevrilmesi", "Ev hapsi"], required: true },
    ],
  },
  {
    id: "builtin-uzlasma",
    name: "Uzlaşma Talebi",
    category: "Ceza Hukuku",
    fields: [
      { id: "talepte_bulunan", label: "Talepte Bulunan", type: "text", required: true },
      { id: "karsi_taraf", label: "Karşı Taraf", type: "text", required: true },
      { id: "dosya_no", label: "Dosya No", type: "text", required: true },
      { id: "suc_turu", label: "Suç Türü", type: "text", required: true, placeholder: "Uzlaşmaya tabi suç türü" },
      { id: "uzlasma_teklifi", label: "Uzlaşma Teklifi", type: "textarea", required: true, placeholder: "Uzlaşma kapsamında önerilen edim (tazminat, özür vb.)" },
      { id: "cumhuriyet_bassavciligi", label: "Cumhuriyet Başsavcılığı", type: "text" },
    ],
  },

  // =========================================================================
  // TİCARET HUKUKU (ek şablonlar)
  // =========================================================================
  {
    id: "builtin-konkordato",
    name: "Konkordato Talebi",
    category: "Ticaret Hukuku",
    fields: [
      { id: "borclu", label: "Borçlu Şirket Unvanı", type: "text", required: true },
      { id: "borclu_adres", label: "Borçlu Adresi", type: "textarea", required: true },
      { id: "ticaret_sicil_no", label: "Ticaret Sicil No", type: "text", required: true },
      { id: "borc_miktari", label: "Toplam Borç Miktarı (TL)", type: "number", required: true },
      { id: "odeme_guclugu", label: "Ödeme Güçlüğünün Açıklaması", type: "textarea", required: true, placeholder: "Mali durumun kötüleşme nedenleri" },
      { id: "konkordato_projesi", label: "Konkordato Projesi Özeti", type: "textarea", required: true, placeholder: "Alacaklılara önerilen ödeme planı" },
      { id: "mahkeme", label: "Asliye Ticaret Mahkemesi", type: "text", required: true },
    ],
  },
  {
    id: "builtin-alacak-davasi",
    name: "Ticari Alacak Davası",
    category: "Ticaret Hukuku",
    fields: [
      { id: "davaci", label: "Davacı (Alacaklı) Unvanı", type: "text", required: true },
      { id: "davali", label: "Davalı (Borçlu) Unvanı", type: "text", required: true },
      { id: "alacak_miktari", label: "Alacak Miktarı (TL)", type: "number", required: true },
      { id: "alacak_kaynagi", label: "Alacağın Kaynağı", type: "select", options: ["Fatura", "Sözleşme", "Cari hesap", "Çek/Senet", "Haksız fiil"], required: true },
      { id: "vade_tarihi", label: "Vade/Muacceliyet Tarihi", type: "date", required: true },
      { id: "aciklama", label: "Açıklama", type: "textarea", required: true, placeholder: "Alacağın doğuş şekli ve ödenmeme süreci" },
      { id: "faiz_talebi", label: "Faiz Talebi", type: "select", options: ["Avans faizi", "Ticari temerrüt faizi", "Yasal faiz"], required: true },
      { id: "mahkeme", label: "Mahkeme", type: "text", placeholder: "Örn: İstanbul 3. Asliye Ticaret Mahkemesi" },
    ],
  },
  {
    id: "builtin-haksiz-rekabet",
    name: "Haksız Rekabet Davası",
    category: "Ticaret Hukuku",
    fields: [
      { id: "davaci", label: "Davacı", type: "text", required: true },
      { id: "davali", label: "Davalı", type: "text", required: true },
      { id: "rekabet_eylemi", label: "Haksız Rekabet Eylemi", type: "textarea", required: true, placeholder: "TTK md. 55 kapsamında haksız rekabet oluşturan eylemler" },
      { id: "zarar", label: "Uğranılan Zarar", type: "textarea", required: true },
      { id: "talep", label: "Talep", type: "select", options: ["Tespit + Men + Tazminat", "Tespit + Men", "Sadece Tazminat", "Eski hale iade"], required: true },
      { id: "mahkeme", label: "Mahkeme", type: "text", placeholder: "Örn: İstanbul Asliye Ticaret Mahkemesi" },
    ],
  },
  {
    id: "builtin-marka-ihlali",
    name: "Marka Hakkına Tecavüz Davası",
    category: "Ticaret Hukuku",
    fields: [
      { id: "davaci", label: "Marka Sahibi / Davacı", type: "text", required: true },
      { id: "davali", label: "İhlal Eden / Davalı", type: "text", required: true },
      { id: "marka_adi", label: "Marka Adı", type: "text", required: true },
      { id: "tescil_no", label: "Marka Tescil No", type: "text", required: true },
      { id: "ihlal_aciklama", label: "İhlal Açıklaması", type: "textarea", required: true, placeholder: "6769 sayılı SMK kapsamında tecavüz oluşturan eylemler" },
      { id: "talep", label: "Talep", type: "select", options: ["Tecavüzün tespiti + men + tazminat", "Tecavüzün tespiti + men", "Tazminat", "Ürünlere el konulması"], required: true },
      { id: "mahkeme", label: "Mahkeme", type: "text", placeholder: "Örn: İstanbul Fikri ve Sınai Haklar Mahkemesi" },
    ],
  },
  {
    id: "builtin-iflas-erteleme",
    name: "İflas Erteleme Talebi",
    category: "Ticaret Hukuku",
    fields: [
      { id: "sirket", label: "Şirket Unvanı", type: "text", required: true },
      { id: "ticaret_sicil", label: "Ticaret Sicil No", type: "text", required: true },
      { id: "borca_batiklik", label: "Borca Batıklık Durumu", type: "textarea", required: true, placeholder: "Aktif-pasif durumu, borca batıklık bilançosu" },
      { id: "iyilestirme_projesi", label: "İyileştirme Projesi Özeti", type: "textarea", required: true, placeholder: "Şirketin mali durumunu düzeltme planı" },
      { id: "erteleme_suresi", label: "Talep Edilen Erteleme Süresi", type: "select", options: ["1 yıl", "2 yıl", "3 yıl"], required: true },
      { id: "mahkeme", label: "Asliye Ticaret Mahkemesi", type: "text", required: true },
    ],
  },

  // =========================================================================
  // İDARE HUKUKU (ek şablonlar)
  // =========================================================================
  {
    id: "builtin-tam-yargi",
    name: "Tam Yargı Davası (İdari Tazminat)",
    category: "İdare Hukuku",
    fields: [
      { id: "davaci", label: "Davacı", type: "text", required: true },
      { id: "davali_idare", label: "Davalı İdare", type: "text", required: true },
      { id: "idari_eylem", label: "Zarara Neden Olan İdari Eylem/İşlem", type: "textarea", required: true },
      { id: "zarar_tarihi", label: "Zarar Tarihi", type: "date", required: true },
      { id: "maddi_zarar", label: "Maddi Zarar Miktarı (TL)", type: "number" },
      { id: "manevi_zarar", label: "Manevi Tazminat Talebi (TL)", type: "number" },
      { id: "zarar_aciklama", label: "Zarar Açıklaması", type: "textarea", required: true, placeholder: "İdarenin kusurlu eylemi ve nedensellik bağı" },
      { id: "mahkeme", label: "İdare Mahkemesi", type: "text", placeholder: "Örn: Ankara 4. İdare Mahkemesi" },
    ],
  },
  {
    id: "builtin-yurutmeyi-durdurma",
    name: "Yürütmeyi Durdurma Talebi",
    category: "İdare Hukuku",
    fields: [
      { id: "davaci", label: "Davacı", type: "text", required: true },
      { id: "davali_idare", label: "Davalı İdare", type: "text", required: true },
      { id: "islem", label: "İptali İstenen İdari İşlem", type: "textarea", required: true },
      { id: "islem_tarihi", label: "İşlem Tarihi", type: "date", required: true },
      { id: "teblig_tarihi", label: "Tebliğ Tarihi", type: "date", required: true },
      { id: "hukuka_aykirilik", label: "Açıkça Hukuka Aykırılık Gerekçesi", type: "textarea", required: true, placeholder: "İYUK md. 27 - hukuka açıkça aykırılık" },
      { id: "telafisi_guc_zarar", label: "Telafisi Güç veya İmkansız Zarar", type: "textarea", required: true, placeholder: "İşlemin uygulanması halinde doğacak telafisi güç zararlar" },
      { id: "mahkeme", label: "İdare Mahkemesi", type: "text" },
    ],
  },
  {
    id: "builtin-idari-basvuru",
    name: "İdari Başvuru Dilekçesi",
    category: "İdare Hukuku",
    fields: [
      { id: "basvuran", label: "Başvuran Adı Soyadı", type: "text", required: true },
      { id: "basvuran_tc", label: "TC Kimlik No", type: "text", required: true },
      { id: "basvurulan_idare", label: "Başvurulan İdare/Kurum", type: "text", required: true },
      { id: "basvuru_konusu", label: "Başvuru Konusu", type: "textarea", required: true, placeholder: "Talep edilen idari işlem veya düzeltme" },
      { id: "gerekce", label: "Gerekçe ve Yasal Dayanak", type: "textarea", required: true },
      { id: "ekler", label: "Ek Belgeler", type: "textarea", placeholder: "Başvuruya eklenen belgelerin listesi" },
    ],
  },
  {
    id: "builtin-bilgi-edinme",
    name: "Bilgi Edinme Başvurusu",
    category: "İdare Hukuku",
    fields: [
      { id: "basvuran", label: "Başvuran Adı Soyadı", type: "text", required: true },
      { id: "basvuran_tc", label: "TC Kimlik No", type: "text", required: true },
      { id: "basvuran_adres", label: "Adres", type: "textarea", required: true },
      { id: "basvurulan_kurum", label: "Başvurulan Kurum", type: "text", required: true },
      { id: "bilgi_konusu", label: "Talep Edilen Bilgi/Belge", type: "textarea", required: true, placeholder: "4982 sayılı Bilgi Edinme Hakkı Kanunu kapsamında talep edilen bilgi veya belge" },
      { id: "amac", label: "Bilgi Edinme Amacı", type: "textarea" },
    ],
  },

  // =========================================================================
  // AİLE HUKUKU (ek şablonlar)
  // =========================================================================
  {
    id: "builtin-cekismeli-bosanma",
    name: "Çekişmeli Boşanma Davası",
    category: "Aile Hukuku",
    fields: [
      { id: "davaci", label: "Davacı Eş", type: "text", required: true },
      { id: "davaci_tc", label: "Davacı TC Kimlik No", type: "text", required: true },
      { id: "davali", label: "Davalı Eş", type: "text", required: true },
      { id: "evlilik_tarihi", label: "Evlilik Tarihi", type: "date", required: true },
      { id: "cocuk_bilgileri", label: "Müşterek Çocuk Bilgileri", type: "textarea", placeholder: "İsim, doğum tarihi" },
      { id: "bosanma_sebebi", label: "Boşanma Sebebi", type: "select", options: ["Evlilik birliğinin temelinden sarsılması (TMK 166/1)", "Zina (TMK 161)", "Hayata kast, pek kötü muamele (TMK 162)", "Terk (TMK 164)", "Akıl hastalığı (TMK 165)", "Suç işleme ve haysiyetsiz hayat sürme (TMK 163)"], required: true },
      { id: "olaylar", label: "Olayların Anlatımı", type: "textarea", required: true, placeholder: "Boşanmaya neden olan olayların kronolojik anlatımı" },
      { id: "talepler", label: "Talepler", type: "textarea", required: true, placeholder: "Velayet, nafaka, tazminat, mal paylaşımı talepleri" },
      { id: "mahkeme", label: "Aile Mahkemesi", type: "text", placeholder: "Örn: İstanbul 5. Aile Mahkemesi" },
    ],
  },
  {
    id: "builtin-velayet",
    name: "Velayet Davası",
    category: "Aile Hukuku",
    fields: [
      { id: "davaci", label: "Davacı (Velayet Talep Eden)", type: "text", required: true },
      { id: "davali", label: "Davalı", type: "text", required: true },
      { id: "cocuk_adi", label: "Çocuğun Adı Soyadı", type: "text", required: true },
      { id: "cocuk_dogum", label: "Çocuğun Doğum Tarihi", type: "date", required: true },
      { id: "mevcut_velayet", label: "Mevcut Velayet Durumu", type: "text", required: true },
      { id: "velayet_degisiklik_sebebi", label: "Velayet Değişikliği Gerekçesi", type: "textarea", required: true, placeholder: "TMK md. 183, 348 - çocuğun üstün yararı kapsamında değişiklik gerekçesi" },
      { id: "mahkeme", label: "Aile Mahkemesi", type: "text" },
    ],
  },
  {
    id: "builtin-mal-paylasimi",
    name: "Mal Paylaşımı (Mal Rejimi Tasfiyesi) Davası",
    category: "Aile Hukuku",
    fields: [
      { id: "davaci", label: "Davacı", type: "text", required: true },
      { id: "davali", label: "Davalı", type: "text", required: true },
      { id: "evlilik_tarihi", label: "Evlilik Tarihi", type: "date", required: true },
      { id: "bosanma_tarihi", label: "Boşanma Karar Tarihi", type: "date", required: true },
      { id: "mal_rejimi", label: "Uygulanan Mal Rejimi", type: "select", options: ["Edinilmiş mallara katılma (yasal)", "Mal ayrılığı", "Paylaşmalı mal ayrılığı", "Mal ortaklığı"], required: true },
      { id: "mallar", label: "Tasfiyeye Konu Malvarlığı Değerleri", type: "textarea", required: true, placeholder: "Taşınmazlar, araçlar, banka hesapları, şirket hisseleri vb." },
      { id: "talep_miktari", label: "Katılma Alacağı Talebi (TL)", type: "number" },
      { id: "mahkeme", label: "Aile Mahkemesi", type: "text" },
    ],
  },
  {
    id: "builtin-koruma-karari",
    name: "Koruma Kararı Talebi (6284 Sayılı Kanun)",
    category: "Aile Hukuku",
    fields: [
      { id: "basvuran", label: "Başvuran Adı Soyadı", type: "text", required: true },
      { id: "basvuran_tc", label: "TC Kimlik No", type: "text", required: true },
      { id: "siddet_uygulayan", label: "Şiddet Uygulayan", type: "text", required: true },
      { id: "yakinlik", label: "Yakınlık Derecesi", type: "select", options: ["Eş", "Eski eş", "Birlikte yaşayan", "Aile üyesi", "Diğer"], required: true },
      { id: "siddet_turu", label: "Şiddet Türü", type: "select", options: ["Fiziksel şiddet", "Psikolojik şiddet", "Ekonomik şiddet", "Cinsel şiddet", "Birden fazla"], required: true },
      { id: "olaylar", label: "Olayların Anlatımı", type: "textarea", required: true },
      { id: "talep_edilen_tedbirler", label: "Talep Edilen Tedbirler", type: "textarea", required: true, placeholder: "Uzaklaştırma, iletişim yasağı, barınma yardımı vb." },
    ],
  },

  // =========================================================================
  // İCRA-İFLAS HUKUKU (ek şablonlar)
  // =========================================================================
  {
    id: "builtin-itirazin-iptali",
    name: "İtirazın İptali Davası",
    category: "İcra-İflas",
    fields: [
      { id: "davaci", label: "Davacı (Alacaklı)", type: "text", required: true },
      { id: "davali", label: "Davalı (Borçlu)", type: "text", required: true },
      { id: "icra_dosya_no", label: "İcra Dosya No", type: "text", required: true },
      { id: "alacak_miktari", label: "Takip Miktarı (TL)", type: "number", required: true },
      { id: "alacak_sebebi", label: "Alacağın Sebebi", type: "textarea", required: true },
      { id: "itiraz_tarihi", label: "Borçlunun İtiraz Tarihi", type: "date", required: true },
      { id: "icra_inkar_tazminati", label: "İcra İnkar Tazminatı Talebi", type: "select", options: ["Evet (%20'den aşağı olmamak üzere)", "Hayır"], required: true },
      { id: "mahkeme", label: "Mahkeme", type: "text", placeholder: "Örn: İstanbul 1. Asliye Hukuk Mahkemesi" },
    ],
  },
  {
    id: "builtin-itirazin-kaldirilmasi",
    name: "İtirazın Kaldırılması Talebi",
    category: "İcra-İflas",
    fields: [
      { id: "alacakli", label: "Alacaklı", type: "text", required: true },
      { id: "borclu", label: "Borçlu", type: "text", required: true },
      { id: "icra_dosya_no", label: "İcra Dosya No", type: "text", required: true },
      { id: "belge_turu", label: "Dayanak Belge", type: "select", options: ["İmza adi veya resmi senet", "Resmi dairelerin veya yetkili makamların belgeleri", "Kredi sözleşmesi", "Diğer İİK 68 belgesi"], required: true },
      { id: "alacak_miktari", label: "Alacak Miktarı (TL)", type: "number", required: true },
      { id: "aciklama", label: "Açıklama", type: "textarea", required: true },
      { id: "icra_mahkemesi", label: "İcra Hukuk Mahkemesi", type: "text", required: true },
    ],
  },
  {
    id: "builtin-menfi-tespit",
    name: "Menfi Tespit Davası",
    category: "İcra-İflas",
    fields: [
      { id: "davaci", label: "Davacı (Borçlu)", type: "text", required: true },
      { id: "davali", label: "Davalı (Alacaklı)", type: "text", required: true },
      { id: "icra_dosya_no", label: "İcra Dosya No", type: "text" },
      { id: "borc_miktari", label: "İddia Edilen Borç Miktarı (TL)", type: "number", required: true },
      { id: "borclu_olmama_sebebi", label: "Borçlu Olmama Sebebi", type: "textarea", required: true, placeholder: "Ödeme, zamanaşımı, sahtecilik, takas vb." },
      { id: "ihtiyati_tedbir", label: "İhtiyati Tedbir Talebi", type: "select", options: ["Evet (icranın durdurulması)", "Hayır"], required: true },
      { id: "mahkeme", label: "Mahkeme", type: "text" },
    ],
  },
  {
    id: "builtin-istirdat",
    name: "İstirdat Davası",
    category: "İcra-İflas",
    fields: [
      { id: "davaci", label: "Davacı (Ödeme Yapan)", type: "text", required: true },
      { id: "davali", label: "Davalı (Tahsil Eden)", type: "text", required: true },
      { id: "icra_dosya_no", label: "İcra Dosya No", type: "text", required: true },
      { id: "odenen_miktar", label: "Ödenen/Tahsil Edilen Miktar (TL)", type: "number", required: true },
      { id: "odeme_tarihi", label: "Ödeme Tarihi", type: "date", required: true },
      { id: "iade_sebebi", label: "İade Gerekçesi", type: "textarea", required: true, placeholder: "Borçlu olunmadığı halde ödeme yapıldığına dair gerekçe" },
      { id: "mahkeme", label: "Mahkeme", type: "text" },
    ],
  },
  {
    id: "builtin-haciz-istemi",
    name: "Haciz Talebi",
    category: "İcra-İflas",
    fields: [
      { id: "alacakli", label: "Alacaklı", type: "text", required: true },
      { id: "borclu", label: "Borçlu", type: "text", required: true },
      { id: "icra_dosya_no", label: "İcra Dosya No", type: "text", required: true },
      { id: "alacak_miktari", label: "Alacak Miktarı (TL)", type: "number", required: true },
      { id: "haciz_turu", label: "Haciz Türü", type: "select", options: ["Menkul haczi", "Gayrimenkul haczi", "Banka hesabı haczi", "Maaş haczi", "Araç haczi"], required: true },
      { id: "haciz_adresi", label: "Haciz Yapılacak Adres/Bilgi", type: "textarea", required: true },
      { id: "icra_dairesi", label: "İcra Dairesi", type: "text", required: true },
    ],
  },
  {
    id: "builtin-iflas-talebi",
    name: "İflas Davası",
    category: "İcra-İflas",
    fields: [
      { id: "davaci", label: "Davacı (Alacaklı)", type: "text", required: true },
      { id: "davali", label: "Davalı (Borçlu Tacir)", type: "text", required: true },
      { id: "alacak_miktari", label: "Alacak Miktarı (TL)", type: "number", required: true },
      { id: "iflas_sebebi", label: "İflas Sebebi", type: "select", options: ["Ödeme emrine itiraz edilmemesi (İİK 155)", "Alacağın icra takibinde tahsil edilememesi", "Borçlunun aciz hali"], required: true },
      { id: "icra_dosya_no", label: "İcra Dosya No (varsa)", type: "text" },
      { id: "aciklama", label: "Açıklama", type: "textarea", required: true },
      { id: "mahkeme", label: "Asliye Ticaret Mahkemesi", type: "text", required: true },
    ],
  },

  // =========================================================================
  // TÜKETİCİ HUKUKU (ek şablonlar)
  // =========================================================================
  {
    id: "builtin-ayipli-mal",
    name: "Ayıplı Mal Davası",
    category: "Tüketici Hukuku",
    fields: [
      { id: "davaci", label: "Davacı (Tüketici)", type: "text", required: true },
      { id: "davali", label: "Davalı (Satıcı/Üretici)", type: "text", required: true },
      { id: "urun", label: "Ürün Adı ve Markası", type: "text", required: true },
      { id: "satin_alma_tarihi", label: "Satın Alma Tarihi", type: "date", required: true },
      { id: "fatura_bedeli", label: "Fatura Bedeli (TL)", type: "number", required: true },
      { id: "ayip_aciklama", label: "Ayıp Açıklaması", type: "textarea", required: true, placeholder: "6502 sayılı TKHK md. 8 - üründeki ayıbın detaylı açıklaması" },
      { id: "basvuru_yapildi_mi", label: "Satıcıya/Yetkili Servise Başvuruldu mu?", type: "select", options: ["Evet", "Hayır"], required: true },
      { id: "talep", label: "Talep (Seçimlik Hak)", type: "select", options: ["Ücretsiz onarım", "Ürün değişimi", "Bedel iadesi", "Bedelden indirim"], required: true },
      { id: "mahkeme", label: "Tüketici Mahkemesi", type: "text" },
    ],
  },
  {
    id: "builtin-cayma-hakki",
    name: "Cayma Hakkı Kullanımı",
    category: "Tüketici Hukuku",
    fields: [
      { id: "tuketici", label: "Tüketici Adı Soyadı", type: "text", required: true },
      { id: "tuketici_adres", label: "Adres", type: "textarea", required: true },
      { id: "satici", label: "Satıcı Firma", type: "text", required: true },
      { id: "siparis_tarihi", label: "Sipariş/Sözleşme Tarihi", type: "date", required: true },
      { id: "teslim_tarihi", label: "Teslim Tarihi", type: "date", required: true },
      { id: "urun_hizmet", label: "Ürün/Hizmet", type: "text", required: true },
      { id: "bedel", label: "Ödenen Bedel (TL)", type: "number", required: true },
      { id: "cayma_sebebi", label: "Cayma Sebebi (Opsiyonel)", type: "textarea", placeholder: "Mesafeli sözleşmelerde sebep göstermek zorunlu değildir" },
    ],
  },
  {
    id: "builtin-tuketici-hakem",
    name: "Tüketici Hakem Heyeti Başvurusu",
    category: "Tüketici Hukuku",
    fields: [
      { id: "basvuran", label: "Başvuran (Tüketici)", type: "text", required: true },
      { id: "basvuran_tc", label: "TC Kimlik No", type: "text", required: true },
      { id: "basvuran_adres", label: "Adres", type: "textarea", required: true },
      { id: "basvuran_tel", label: "Telefon", type: "text" },
      { id: "satici", label: "Şikayet Edilen Firma", type: "text", required: true },
      { id: "satici_adres", label: "Firma Adresi", type: "textarea" },
      { id: "urun_hizmet", label: "Ürün/Hizmet", type: "text", required: true },
      { id: "satin_alma_tarihi", label: "Satın Alma Tarihi", type: "date" },
      { id: "tutar", label: "İşlem Tutarı (TL)", type: "number", required: true },
      { id: "sikayet", label: "Şikayet Konusu", type: "textarea", required: true, placeholder: "Yaşanan sorunun detaylı anlatımı" },
      { id: "talep", label: "Talep", type: "textarea", required: true, placeholder: "Tüketici olarak talebiniz" },
    ],
  },

  // =========================================================================
  // KİRA HUKUKU (ek şablonlar)
  // =========================================================================
  {
    id: "builtin-kira-tespit",
    name: "Kira Tespit Davası",
    category: "Gayrimenkul Hukuku",
    fields: [
      { id: "davaci", label: "Davacı (Kiraya Veren)", type: "text", required: true },
      { id: "davali", label: "Davalı (Kiracı)", type: "text", required: true },
      { id: "tasinmaz_adresi", label: "Taşınmaz Adresi", type: "textarea", required: true },
      { id: "mevcut_kira", label: "Mevcut Aylık Kira (TL)", type: "number", required: true },
      { id: "talep_edilen_kira", label: "Talep Edilen Aylık Kira (TL)", type: "number", required: true },
      { id: "kira_baslangic", label: "Kira Başlangıç Tarihi", type: "date", required: true },
      { id: "emsal_kiralar", label: "Emsal Kira Bedelleri", type: "textarea", placeholder: "Çevredeki emsal taşınmazların kira bedelleri" },
      { id: "mahkeme", label: "Sulh Hukuk Mahkemesi", type: "text" },
    ],
  },
  {
    id: "builtin-kira-uyarlama",
    name: "Kira Uyarlama Davası",
    category: "Gayrimenkul Hukuku",
    fields: [
      { id: "davaci", label: "Davacı", type: "text", required: true },
      { id: "davali", label: "Davalı", type: "text", required: true },
      { id: "tasinmaz_adresi", label: "Taşınmaz Adresi", type: "textarea", required: true },
      { id: "mevcut_kira", label: "Mevcut Aylık Kira (TL)", type: "number", required: true },
      { id: "uyarlama_sebebi", label: "Uyarlama Sebebi", type: "select", options: ["Aşırı ifa güçlüğü (TBK md. 138)", "Ekonomik kriz / enflasyon", "Taşınmazın değer kaybı", "Diğer olağanüstü değişiklik"], required: true },
      { id: "aciklama", label: "Uyarlama Gerekçesi", type: "textarea", required: true, placeholder: "Sözleşmenin kurulduğu andaki koşulların öngörülemez biçimde değiştiği" },
      { id: "talep_edilen_kira", label: "Talep Edilen Yeni Kira (TL)", type: "number" },
      { id: "mahkeme", label: "Sulh Hukuk Mahkemesi", type: "text" },
    ],
  },
  {
    id: "builtin-depozito-iade",
    name: "Depozito İadesi Talebi",
    category: "Gayrimenkul Hukuku",
    fields: [
      { id: "kiraci", label: "Kiracı (Talep Eden)", type: "text", required: true },
      { id: "kiraya_veren", label: "Kiraya Veren", type: "text", required: true },
      { id: "tasinmaz_adresi", label: "Taşınmaz Adresi", type: "textarea", required: true },
      { id: "kira_baslangic", label: "Kira Başlangıç Tarihi", type: "date", required: true },
      { id: "tahliye_tarihi", label: "Tahliye Tarihi", type: "date", required: true },
      { id: "depozito_miktari", label: "Depozito Miktarı (TL)", type: "number", required: true },
      { id: "iade_yapildi_mi", label: "İade Yapıldı mı?", type: "select", options: ["Hiç iade yapılmadı", "Kısmen iade yapıldı", "Haksız kesinti yapıldı"], required: true },
      { id: "aciklama", label: "Ek Açıklama", type: "textarea" },
    ],
  },

  // =========================================================================
  // DİĞER ÖZEL ALANLAR
  // =========================================================================
  {
    id: "builtin-tazminat-genel",
    name: "Maddi ve Manevi Tazminat Davası",
    category: "Borçlar Hukuku",
    fields: [
      { id: "davaci", label: "Davacı", type: "text", required: true },
      { id: "davali", label: "Davalı", type: "text", required: true },
      { id: "olay_tarihi", label: "Olay Tarihi", type: "date", required: true },
      { id: "olay_ozeti", label: "Olayın Özeti", type: "textarea", required: true, placeholder: "Haksız fiil veya sözleşmeye aykırılık" },
      { id: "maddi_zarar", label: "Maddi Tazminat Talebi (TL)", type: "number" },
      { id: "manevi_zarar", label: "Manevi Tazminat Talebi (TL)", type: "number" },
      { id: "zarar_detay", label: "Zarar Detayı", type: "textarea", required: true, placeholder: "Uğranılan zararın detaylı açıklaması ve belgeleri" },
      { id: "hukuki_dayanak", label: "Hukuki Dayanak", type: "select", options: ["Haksız fiil (TBK md. 49-76)", "Sözleşmeye aykırılık (TBK md. 112)", "Vekaletsiz iş görme", "Tehlike sorumluluğu"], required: true },
      { id: "mahkeme", label: "Mahkeme", type: "text" },
    ],
  },
  {
    id: "builtin-miras-tenkis",
    name: "Tenkis Davası (Miras)",
    category: "Miras Hukuku",
    fields: [
      { id: "davaci", label: "Davacı (Saklı Paylı Mirasçı)", type: "text", required: true },
      { id: "davali", label: "Davalı", type: "text", required: true },
      { id: "muris", label: "Muris (Ölen)", type: "text", required: true },
      { id: "olum_tarihi", label: "Ölüm Tarihi", type: "date", required: true },
      { id: "sakli_pay_orani", label: "Saklı Pay Oranı", type: "text", required: true, placeholder: "Örn: 1/4, 1/2" },
      { id: "tenkise_konu_islem", label: "Tenkise Konu Tasarruf", type: "textarea", required: true, placeholder: "Vasiyetname, bağışlama, ölünceye kadar bakma sözleşmesi vb." },
      { id: "mahkeme", label: "Asliye Hukuk Mahkemesi", type: "text" },
    ],
  },
  {
    id: "builtin-miras-paylasimi",
    name: "Miras Paylaşımı (Ortaklığın Giderilmesi)",
    category: "Miras Hukuku",
    fields: [
      { id: "davaci", label: "Davacı (Mirasçı)", type: "text", required: true },
      { id: "davalilar", label: "Davalılar (Diğer Mirasçılar)", type: "textarea", required: true },
      { id: "muris", label: "Muris (Ölen)", type: "text", required: true },
      { id: "olum_tarihi", label: "Ölüm Tarihi", type: "date", required: true },
      { id: "tereke", label: "Tereke Malvarlığı", type: "textarea", required: true, placeholder: "Taşınmazlar, araçlar, banka hesapları vb." },
      { id: "paylasim_talebi", label: "Paylaşım Talebi", type: "select", options: ["Aynen taksim", "Satış yoluyla taksim", "Karma"], required: true },
      { id: "mahkeme", label: "Sulh Hukuk Mahkemesi", type: "text" },
    ],
  },
  {
    id: "builtin-kamulaştırma-bedel",
    name: "Kamulaştırma Bedel Artırım Davası",
    category: "Gayrimenkul Hukuku",
    fields: [
      { id: "davaci", label: "Davacı (Taşınmaz Sahibi)", type: "text", required: true },
      { id: "davali_idare", label: "Davalı (Kamulaştıran İdare)", type: "text", required: true },
      { id: "tasinmaz", label: "Taşınmaz Bilgileri (Ada/Parsel)", type: "text", required: true },
      { id: "tasinmaz_adresi", label: "Taşınmaz Adresi", type: "textarea", required: true },
      { id: "takdir_edilen_bedel", label: "İdarece Takdir Edilen Bedel (TL)", type: "number", required: true },
      { id: "talep_edilen_bedel", label: "Talep Edilen Bedel (TL)", type: "number", required: true },
      { id: "bedel_farki_gerekce", label: "Bedel Farkı Gerekçesi", type: "textarea", required: true, placeholder: "Emsal satışlar, bilirkişi tespitleri, imar durumu vb." },
      { id: "mahkeme", label: "Asliye Hukuk Mahkemesi", type: "text" },
    ],
  },
  {
    id: "builtin-tapu-iptal-tescil",
    name: "Tapu İptali ve Tescil Davası",
    category: "Gayrimenkul Hukuku",
    fields: [
      { id: "davaci", label: "Davacı", type: "text", required: true },
      { id: "davali", label: "Davalı (Tapuda Kayıtlı Malik)", type: "text", required: true },
      { id: "tasinmaz", label: "Taşınmaz Bilgileri (Ada/Parsel/Pafta)", type: "text", required: true },
      { id: "tapu_iptal_sebebi", label: "Tapu İptal Sebebi", type: "select", options: ["Muris muvazaası", "Ehliyetsizlik", "Hukuki ehliyetsizlik", "Vekalet görevinin kötüye kullanılması", "Hata/Hile/İkrah", "Sahtecilik"], required: true },
      { id: "aciklama", label: "Dava Gerekçesi", type: "textarea", required: true },
      { id: "mahkeme", label: "Asliye Hukuk Mahkemesi", type: "text" },
    ],
  },
  {
    id: "builtin-istinaf",
    name: "İstinaf Başvuru Dilekçesi",
    category: "Usul Hukuku",
    fields: [
      { id: "istinaf_eden", label: "İstinaf Eden", type: "text", required: true },
      { id: "karsi_taraf", label: "Karşı Taraf", type: "text", required: true },
      { id: "ilk_derece_mahkemesi", label: "İlk Derece Mahkemesi", type: "text", required: true },
      { id: "dosya_no", label: "Dosya No", type: "text", required: true },
      { id: "karar_tarihi", label: "Karar Tarihi", type: "date", required: true },
      { id: "teblig_tarihi", label: "Tebliğ Tarihi", type: "date", required: true },
      { id: "karar_ozeti", label: "Kararın Özeti", type: "textarea", required: true },
      { id: "istinaf_sebepleri", label: "İstinaf Sebepleri", type: "textarea", required: true, placeholder: "HMK md. 353-355 kapsamında istinaf nedenleri" },
      { id: "talep", label: "Talep", type: "select", options: ["Kararın kaldırılması ve davanın kabulü", "Kararın kaldırılması ve yeniden yargılama", "Kararın düzeltilerek kaldırılması"], required: true },
      { id: "bam", label: "Bölge Adliye Mahkemesi", type: "text", placeholder: "Örn: İstanbul BAM 12. Hukuk Dairesi" },
    ],
  },
  {
    id: "builtin-ihtiyati-tedbir",
    name: "İhtiyati Tedbir Talebi",
    category: "Usul Hukuku",
    fields: [
      { id: "davaci", label: "Davacı / Talep Eden", type: "text", required: true },
      { id: "davali", label: "Davalı / Aleyhine İstenen", type: "text", required: true },
      { id: "dava_konusu", label: "Dava Konusu", type: "textarea", required: true },
      { id: "tedbir_konusu", label: "Tedbir Konusu", type: "textarea", required: true, placeholder: "HMK md. 389 - dava konusunun tehlikeye düşmesi veya hakkın elde edilmesinin zorlaşması" },
      { id: "tedbir_sebebi", label: "Tedbir Sebebi (Yakın Tehlike)", type: "textarea", required: true },
      { id: "talep_edilen_tedbir", label: "Talep Edilen Tedbir", type: "textarea", required: true, placeholder: "Satışın önlenmesi, üzerine şerh konulması vb." },
      { id: "mahkeme", label: "Mahkeme", type: "text" },
    ],
  },
  {
    id: "builtin-vergi-itiraz",
    name: "Vergi Cezasına İtiraz",
    category: "Vergi Hukuku",
    fields: [
      { id: "davaci", label: "Davacı (Mükellef)", type: "text", required: true },
      { id: "davaci_vkn", label: "Vergi Kimlik No", type: "text", required: true },
      { id: "davali", label: "Davalı (Vergi Dairesi)", type: "text", required: true },
      { id: "ihbarname_tarihi", label: "İhbarname Tarihi", type: "date", required: true },
      { id: "ihbarname_no", label: "İhbarname No", type: "text", required: true },
      { id: "vergi_turu", label: "Vergi Türü", type: "select", options: ["Gelir Vergisi", "Kurumlar Vergisi", "KDV", "ÖTV", "MTV", "Diğer"], required: true },
      { id: "tarhiyat_miktari", label: "Tarhiyat/Ceza Miktarı (TL)", type: "number", required: true },
      { id: "itiraz_sebepleri", label: "İtiraz Sebepleri", type: "textarea", required: true, placeholder: "VUK ve ilgili kanun maddeleri kapsamında itiraz gerekçeleri" },
      { id: "mahkeme", label: "Vergi Mahkemesi", type: "text" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return crypto.randomUUID();
}

function subLabel(index: number): string {
  if (index < 26) return String.fromCharCode(97 + index);
  // aa, ab, ac... for indices >= 26
  const first = String.fromCharCode(97 + Math.floor(index / 26) - 1);
  const second = String.fromCharCode(97 + (index % 26));
  return first + second;
}

function emptyHeader(): HeaderFields {
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

function initialState(): DocumentState {
  return {
    docType: DOC_TYPES[0],
    header: emptyHeader(),
    blocks: [],
  };
}

// ---------------------------------------------------------------------------
// Sample document loader
// ---------------------------------------------------------------------------

function sampleDocument(): DocumentState {
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

// ---------------------------------------------------------------------------
// Icons (inline SVG components)
// ---------------------------------------------------------------------------

function IconPlus({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14m-7-7h14" />
    </svg>
  );
}

function IconTrash({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
    </svg>
  );
}

function IconUp({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function IconDown({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconCopy({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function IconDownload({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3" />
    </svg>
  );
}

function IconDoc({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DilekcePage() {
  const [doc, setDoc] = useState<DocumentState>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lexora_dilekce_draft");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
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
        } catch {
          // QuotaExceededError — sessizce devam
        }
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
        // Merge: backend templates first, then built-ins not already present
        const backendIds = new Set(backend.map((t: Template) => t.id));
        const merged = [...backend, ...BUILTIN_TEMPLATES.filter((b) => !backendIds.has(b.id))];
        setTemplates(merged);
      })
      .catch(() => {});

    // Aramadan gelen citation varsa otomatik ekle
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
    setDoc((prev) => ({
      ...prev,
      header: { ...prev.header, [field]: value },
    }));
  }, []);

  const updateDocType = useCallback((value: string) => {
    setDoc((prev) => ({ ...prev, docType: value }));
  }, []);

  // --- Block CRUD ---
  const addBlock = useCallback((type: BlockType, presetContent?: string) => {
    const newBlock: Block = {
      id: uid(),
      type,
      content: presetContent ?? "",
      children: type === "numbered_paragraph" ? [] : undefined,
    };
    setDoc((prev) => ({ ...prev, blocks: [...prev.blocks, newBlock] }));
  }, []);

  const updateBlockContent = useCallback((blockId: string, content: string) => {
    setDoc((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) =>
        b.id === blockId ? { ...b, content } : b
      ),
    }));
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    setDoc((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== blockId),
    }));
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
      blocks: prev.blocks.map((b) =>
        b.id === parentId
          ? { ...b, children: [...(b.children ?? []), sub] }
          : b
      ),
    }));
  }, []);

  const updateSubContent = useCallback(
    (parentId: string, subId: string, content: string) => {
      setDoc((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) =>
          b.id === parentId
            ? {
                ...b,
                children: (b.children ?? []).map((c) =>
                  c.id === subId ? { ...c, content } : c
                ),
              }
            : b
        ),
      }));
    },
    []
  );

  const deleteSubParagraph = useCallback((parentId: string, subId: string) => {
    setDoc((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) =>
        b.id === parentId
          ? { ...b, children: (b.children ?? []).filter((c) => c.id !== subId) }
          : b
      ),
    }));
  }, []);

  // --- Load sample ---
  const loadSample = useCallback(() => {
    setDoc(sampleDocument());
  }, []);

  // --- New document (clear all) ---
  const handleNewDocument = useCallback(() => {
    const hasContent = doc.blocks.length > 0 || doc.header.mahkeme || doc.header.davaci || doc.header.davali;
    if (hasContent) {
      setShowNewDocConfirm(true);
    } else {
      setDoc(initialState());
      localStorage.removeItem("lexora_dilekce_draft");
    }
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

      // Parse generated text into blocks
      const lines = text.split("\n");
      const blocks: Block[] = [];
      const newHeader = emptyHeader();
      let numberedCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Detect mahkeme header (ends with 'NE or 'NA)
        if (line.match(/'N[EA]$/)) {
          newHeader.mahkeme = line.replace(/'N[EA]$/, "").trim();
          continue;
        }
        // Detect DAVACI/DAVALI lines
        if (line.startsWith("DAVACI:")) { newHeader.davaci = line.replace("DAVACI:", "").trim(); continue; }
        if (line.startsWith("DAVALI:")) { newHeader.davali = line.replace("DAVALI:", "").trim(); continue; }
        if (line.startsWith("Adres:") && !newHeader.davali) { newHeader.davaci_adres = line.replace("Adres:", "").trim(); continue; }
        if (line.startsWith("Adres:") && newHeader.davali) { newHeader.davali_adres = line.replace("Adres:", "").trim(); continue; }
        if (line.startsWith("TC Kimlik No:")) { newHeader.davaci_tc = line.replace("TC Kimlik No:", "").trim(); continue; }
        if (line.startsWith("Vekili:")) { newHeader.davaci_vekili = line.replace("Vekili:", "").trim(); continue; }
        if (line.startsWith("KONU:")) { newHeader.konu = line.replace("KONU:", "").trim(); continue; }

        // Detect section headers (all uppercase, short)
        if (line === line.toLocaleUpperCase("tr") && line.length < 60 && !line.match(/^\d/)) {
          blocks.push({ id: uid(), type: "section_header", content: line });
          numberedCount = 0;
          continue;
        }
        // Detect numbered paragraphs
        if (line.match(/^\d+\.\s/)) {
          numberedCount++;
          blocks.push({ id: uid(), type: "numbered_paragraph", content: line.replace(/^\d+\.\s/, ""), children: [] });
          continue;
        }
        // Detect evidence items (bullet points)
        if (line.startsWith("- ") || line.startsWith("• ")) {
          blocks.push({ id: uid(), type: "evidence_item", content: line.replace(/^[-•]\s*/, "") });
          continue;
        }
        // Everything else is free text
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

    // Header
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

    if (h.konu) {
      lines.push(`KONU        : ${h.konu}`);
      lines.push("");
    }

    // Blocks
    let numberedIdx = 0;
    for (const block of doc.blocks) {
      switch (block.type) {
        case "section_header":
          lines.push("");
          lines.push(block.content.toLocaleUpperCase("tr"));
          lines.push("");
          break;

        case "numbered_paragraph": {
          numberedIdx++;
          lines.push(`${numberedIdx}. ${block.content}`);
          if (block.children && block.children.length > 0) {
            block.children.forEach((sub, si) => {
              const letter = subLabel(si);
              lines.push(`   ${letter}) ${sub.content}`);
            });
          }
          lines.push("");
          break;
        }

        case "free_text":
          lines.push(block.content);
          lines.push("");
          break;

        case "evidence_item":
          lines.push(`  - ${block.content}`);
          break;

        case "legal_reference":
          lines.push(`  [Ref] ${block.content}`);
          break;

        default:
          lines.push(block.content);
          lines.push("");
      }
    }

    // Signature area
    lines.push("");
    lines.push("                                    Saygılarımla,");
    if (h.davaci_vekili) {
      lines.push(`                                    ${h.davaci_vekili}`);
    }

    return lines.join("\n");
  }, [doc]);

  // --- Export DOCX ---
  const handleExportDocx = useCallback(async () => {
    setExporting("docx");
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("lexora_token") : null;
      const resp = await fetch(`${API_URL}/api/v1/export/docx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: plainText, title: doc.header.konu || "Dilekce" }),
      });
      if (!resp.ok) throw new Error("DOCX oluşturulamadı");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.header.konu || "dilekce"}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("DOCX dışa aktarma başarısız");
    } finally {
      setExporting(null);
    }
  }, [doc, plainText]);

  // --- Export PDF ---
  const handleExportPdf = useCallback(async () => {
    setExporting("pdf");
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("lexora_token") : null;
      const resp = await fetch(`${API_URL}/api/v1/export/pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: plainText, title: doc.header.konu || "Dilekce" }),
      });
      if (!resp.ok) throw new Error("PDF oluşturulamadı");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.header.konu || "dilekce"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF dışa aktarma başarısız");
    } finally {
      setExporting(null);
    }
  }, [doc, plainText]);

  // --- Copy ---
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(plainText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = plainText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [plainText]);

  // --- Download TXT ---
  const handleDownloadTxt = useCallback(() => {
    const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.docType.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [plainText, doc.docType]);

  // --- Auto-numbering helper ---
  const numberedIndex = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const b of doc.blocks) {
      if (b.type === "numbered_paragraph") {
        idx++;
        map.set(b.id, idx);
      }
    }
    return map;
  }, [doc.blocks]);

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------

  const inputCls =
    "w-full bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors duration-150";

  const btnSmall =
    "p-1.5 rounded-md text-[#5C5C5F] hover:text-[#ECECEE] hover:bg-white/[0.06] transition-all duration-150";

  // ---- Editor Panel ----
  const editorPanel = (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Template gallery */}
        {templates.length > 0 && (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C5C5F] mb-3">
              Şablon Galerisi
            </label>
            {/* Category cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              {(() => {
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
                const categories = Object.keys(CATS);
                const grouped: Record<string, Template[]> = {};
                for (const t of templates) {
                  const cat = categories.find((c) => (t.category || "").includes(c)) || "Diğer";
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(t);
                }
                // Also show categories with 0 templates
                for (const c of categories) {
                  if (!grouped[c]) grouped[c] = [];
                }

                return Object.entries(CATS).map(([cat, style]) => {
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
                            <button key={tpl.id} onClick={() => selectTemplate(tpl)}
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
                });
              })()}
            </div>
            {/* Flat template list */}
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => selectTemplate(tpl)}
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
        )}

        {/* Template form */}
        {templateMode && selectedTemplate && (
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
                    onChange={(e) => updateTemplateValue(field.id, e.target.value)}
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
                    onChange={(e) => updateTemplateValue(field.id, e.target.value)}
                    placeholder={field.placeholder || ""}
                    rows={3}
                    className={inputCls + " resize-none"}
                  />
                ) : (
                  <input
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    value={templateValues[field.id] || ""}
                    onChange={(e) => updateTemplateValue(field.id, e.target.value)}
                    placeholder={field.placeholder || ""}
                    className={inputCls}
                  />
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button
                onClick={generateFromTemplate}
                disabled={generating}
                className="flex-1 py-2 text-[12px] font-semibold text-white bg-[#6C6CFF] rounded-lg hover:bg-[#5B5BEE] disabled:opacity-50 transition-colors"
              >
                {generating ? "Oluşturuluyor..." : "Belge Oluştur"}
              </button>
              <button
                onClick={() => { setTemplateMode(false); setSelectedTemplate(null); }}
                className="px-4 py-2 text-[12px] font-medium text-[#5C5C5F] bg-[#16161A] rounded-lg hover:text-[#ECECEE] transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {/* Doc type selector */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#5C5C5F] mb-2">
            Belge Türü
          </label>
          <select
            value={doc.docType}
            onChange={(e) => updateDocType(e.target.value)}
            className={inputCls + " cursor-pointer"}
          >
            {DOC_TYPES.map((dt) => (
              <option key={dt} value={dt}>
                {dt}
              </option>
            ))}
          </select>
        </div>

        {/* Header fields */}
        <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[#5C5C5F] mb-1">
            Başlık Bilgileri
          </h2>

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
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[#5C5C5F]">
              Belge İçeriği
            </h2>
            <button
              onClick={loadSample}
              className="text-[11px] font-medium text-[#6C6CFF] hover:text-[#8B8BFF] transition-colors"
            >
              Örnek Yükle
            </button>
          </div>

          {/* Add block buttons */}
          <div className="flex flex-wrap gap-1.5">
            <AddBlockBtn label="Bölüm Başlığı" onClick={() => addBlock("section_header")} />
            <AddBlockBtn label="Madde" onClick={() => addBlock("numbered_paragraph")} />
            <AddBlockBtn label="Serbest Metin" onClick={() => addBlock("free_text")} />
            <AddBlockBtn label="Delil" onClick={() => addBlock("evidence_item")} />
            <AddBlockBtn label="Kanun Ref." onClick={() => addBlock("legal_reference")} />
          </div>

          {/* Section presets */}
          {doc.blocks.length === 0 && (
            <div className="bg-[#111113] border border-dashed border-white/[0.08] rounded-xl p-4 text-center space-y-3">
              <p className="text-[12px] text-[#5C5C5F]">
                Hızlı başlangıç: Bölüm ekleyin
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {SECTION_PRESETS.map((s) => (
                  <button
                    key={s}
                    onClick={() => addBlock("section_header", s)}
                    className="px-2.5 py-1 text-[11px] font-medium bg-[#6C6CFF]/10 text-[#6C6CFF] rounded-md hover:bg-[#6C6CFF]/20 transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Block list */}
          <div className="space-y-2">
            {doc.blocks.map((block) => (
              <BlockEditor
                key={block.id}
                block={block}
                numberedLabel={
                  block.type === "numbered_paragraph"
                    ? `${numberedIndex.get(block.id) ?? 0}.`
                    : undefined
                }
                onUpdate={updateBlockContent}
                onDelete={deleteBlock}
                onMoveUp={() => moveBlock(block.id, "up")}
                onMoveDown={() => moveBlock(block.id, "down")}
                onAddSub={() => addSubParagraph(block.id)}
                onUpdateSub={updateSubContent}
                onDeleteSub={deleteSubParagraph}
              />
            ))}
          </div>

          {/* Bottom add buttons (repeat for convenience) */}
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
      {/* Preview toolbar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[#E0E0E0]/20 bg-[#F5F5F5]">
        <div className="flex items-center gap-2">
          <IconDoc className="w-4 h-4 text-[#666]" />
          <span className="text-[12px] font-semibold text-[#444] uppercase tracking-wider">
            Önizleme
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#555] bg-white border border-[#D0D0D0] rounded-md hover:bg-[#EEE] transition-colors"
          >
            <IconCopy className="w-3.5 h-3.5" />
            {copied ? "Kopyalandı" : "Kopyala"}
          </button>
          <button
            onClick={handleExportDocx}
            disabled={exporting === "docx"}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#555] bg-white border border-[#D0D0D0] rounded-md hover:bg-[#EEE] transition-colors disabled:opacity-50"
          >
            <IconDownload className="w-3.5 h-3.5" />
            {exporting === "docx" ? "..." : "DOCX İndir"}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting === "pdf"}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#555] bg-white border border-[#D0D0D0] rounded-md hover:bg-[#EEE] transition-colors disabled:opacity-50"
          >
            <IconDownload className="w-3.5 h-3.5" />
            {exporting === "pdf" ? "..." : "PDF İndir"}
          </button>
          <button
            onClick={handleDownloadTxt}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#555] bg-white border border-[#D0D0D0] rounded-md hover:bg-[#EEE] transition-colors"
          >
            <IconDownload className="w-3.5 h-3.5" />
            TXT
          </button>
        </div>
      </div>

      {/* Preview document */}
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
            <h1 className="text-[20px] font-bold tracking-tight text-[#ECECEE]">
              Dilekce Olusturucu
            </h1>
            <p className="text-[12px] text-[#5C5C5F] mt-0.5">
              Blok tabanlı hukuki belge düzenleyici
              {lastSaved && (
                <span className={`ml-2 text-[11px] transition-colors duration-500 ${autoSaveFlash ? "text-[#3DD68C]" : "text-[#3DD68C]/50"}`}>
                  {autoSaveFlash ? "✓ Otomatik kaydedildi" : `Son kayıt: ${lastSaved}`}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleNewDocument}
            className="px-3 py-1.5 bg-[#6C6CFF] hover:bg-[#5B5BEE] rounded-lg text-[12px] font-medium text-white transition-colors"
          >
            + Yeni Belge
          </button>
        </div>

        {/* Mobile tabs */}
        <div className="flex md:hidden mt-3 gap-1 bg-[#111113] rounded-lg p-0.5">
          <button
            onClick={() => setMobileTab("editor")}
            className={`flex-1 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
              mobileTab === "editor"
                ? "bg-[#1E1E22] text-[#ECECEE]"
                : "text-[#5C5C5F]"
            }`}
          >
            Düzenleyici
          </button>
          <button
            onClick={() => setMobileTab("preview")}
            className={`flex-1 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
              mobileTab === "preview"
                ? "bg-[#1E1E22] text-[#ECECEE]"
                : "text-[#5C5C5F]"
            }`}
          >
            Önizleme
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex min-h-0">
        {/* Editor - left */}
        <div
          className={`w-full md:w-1/2 md:border-r md:border-white/[0.06] bg-[#09090B] ${
            mobileTab !== "editor" ? "hidden md:block" : ""
          }`}
        >
          {editorPanel}
        </div>

        {/* Preview - right */}
        <div
          className={`w-full md:w-1/2 ${
            mobileTab !== "preview" ? "hidden md:block" : ""
          }`}
        >
          {previewPanel}
        </div>
      </div>

      {/* New document confirmation modal */}
      <AnimatePresence>
        {showNewDocConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowNewDocConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111113] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-[#E5484D]/10 flex items-center justify-center">
                <IconDoc className="w-5 h-5 text-[#E5484D]" />
              </div>
              <div className="text-center">
                <h2 className="text-[15px] font-semibold text-[#ECECEE]">Yeni Belge</h2>
                <p className="text-[13px] text-[#5C5C5F] mt-2">Mevcut taslak silinecek. Emin misiniz?</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={confirmNewDocument}
                  className="flex-1 py-2 bg-[#E5484D] hover:bg-[#D13438] rounded-lg text-[13px] font-medium text-white transition-colors"
                >
                  Taslağı Sil
                </button>
                <button
                  onClick={() => setShowNewDocConfirm(false)}
                  className="px-4 py-2 text-[13px] text-[#5C5C5F] hover:text-[#ECECEE] transition-colors"
                >
                  İptal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Field({
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
      <label className="block text-[11px] font-medium text-[#5C5C5F] mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#16161A] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[13px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none focus:border-[#6C6CFF]/50 transition-colors duration-150"
      />
    </div>
  );
}

function AddBlockBtn({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#8B8B8E] bg-[#111113] border border-white/[0.06] rounded-lg hover:border-white/[0.12] hover:text-[#ECECEE] transition-all duration-150"
    >
      <IconPlus className="w-3 h-3" />
      {label}
    </button>
  );
}

function BlockEditor({
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
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5C5C5F]">
          {typeLabel}
        </span>
        <div className="flex items-center gap-0.5">
          {confirmingDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#E5484D] font-medium">Silinsin mi?</span>
              <button
                onClick={() => { onDelete(block.id); setConfirmingDelete(false); }}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[#E5484D] bg-[#E5484D]/10 hover:bg-[#E5484D]/20 transition-colors"
              >
                Evet
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[#5C5C5F] hover:text-[#ECECEE] transition-colors"
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
            className="w-full bg-transparent border-none text-[13px] font-bold text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none uppercase"
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
            className="w-full bg-transparent border-none text-[13px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none resize-none leading-relaxed"
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
                <span className="text-[12px] font-medium text-amber-500/70 mt-1.5 shrink-0">
                  {letter})
                </span>
                <textarea
                  value={sub.content}
                  onChange={(e) =>
                    onUpdateSub(block.id, sub.id, e.target.value)
                  }
                  placeholder="Alt madde içeriği..."
                  rows={1}
                  className="flex-1 bg-transparent border-none text-[12px] text-[#ECECEE] placeholder:text-[#3A3A3F] focus:outline-none resize-none leading-relaxed"
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
            className="ml-5 inline-flex items-center gap-1 text-[11px] text-[#5C5C5F] hover:text-amber-400 transition-colors"
          >
            <IconPlus className="w-3 h-3" />
            Alt Madde Ekle
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview Content (rendered as formatted legal document)
// ---------------------------------------------------------------------------

function PreviewContent({ doc }: { doc: DocumentState }) {
  const h = doc.header;
  const hasHeader = h.mahkeme || h.davaci || h.davali || h.konu;

  let numberedIdx = 0;

  return (
    <div className="space-y-0">
      {/* Court header */}
      {h.mahkeme && (
        <div className="text-center mb-8">
          <p className="font-bold text-[16px] uppercase tracking-wide">
            {h.mahkeme.toLocaleUpperCase("tr")}&apos;NE
          </p>
        </div>
      )}

      {/* Parties */}
      {hasHeader && (
        <div className="mb-6 space-y-1 text-[13px]">
          {(h.davaci || h.davaci_tc || h.davaci_adres || h.davaci_vekili) && (
            <div className="space-y-0.5">
              <div className="flex">
                <span className="w-28 font-bold shrink-0">DAVACI</span>
                <span>: {h.davaci}</span>
              </div>
              {h.davaci_tc && (
                <div className="flex">
                  <span className="w-28 shrink-0 text-[#555]">TC Kimlik No</span>
                  <span>: {h.davaci_tc}</span>
                </div>
              )}
              {h.davaci_adres && (
                <div className="flex">
                  <span className="w-28 shrink-0 text-[#555]">Adres</span>
                  <span>: {h.davaci_adres}</span>
                </div>
              )}
              {h.davaci_vekili && (
                <div className="flex">
                  <span className="w-28 shrink-0 text-[#555]">Vekili</span>
                  <span>: {h.davaci_vekili}</span>
                </div>
              )}
            </div>
          )}

          {(h.davali || h.davali_adres) && (
            <div className="space-y-0.5 mt-3">
              <div className="flex">
                <span className="w-28 font-bold shrink-0">DAVALI</span>
                <span>: {h.davali}</span>
              </div>
              {h.davali_adres && (
                <div className="flex">
                  <span className="w-28 shrink-0 text-[#555]">Adres</span>
                  <span>: {h.davali_adres}</span>
                </div>
              )}
            </div>
          )}

          {h.konu && (
            <div className="flex mt-3">
              <span className="w-28 font-bold shrink-0">KONU</span>
              <span>: {h.konu}</span>
            </div>
          )}
        </div>
      )}

      {hasHeader && <hr className="border-[#CCC] my-6" />}

      {/* Blocks */}
      {doc.blocks.map((block) => {
        switch (block.type) {
          case "section_header":
            return (
              <div key={block.id} className="mt-6 mb-3">
                <h3 className="font-bold text-[15px] uppercase tracking-wide border-b border-[#CCC] pb-1">
                  {block.content || "(Bölüm başlığı)"}
                </h3>
              </div>
            );

          case "numbered_paragraph": {
            numberedIdx++;
            return (
              <div key={block.id} className="mb-3">
                <p className="text-justify">
                  <span className="font-bold mr-1">{numberedIdx}.</span>
                  {block.content || "(...)"}
                </p>
                {block.children && block.children.length > 0 && (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {block.children.map((sub, si) => {
                      const letter = subLabel(si);
                      return (
                        <p key={sub.id} className="text-justify">
                          <span className="font-medium mr-1">
                            {letter})
                          </span>
                          {sub.content || "(...)"}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          case "free_text":
            return (
              <p key={block.id} className="mb-3 text-justify">
                {block.content || "(...)"}
              </p>
            );

          case "evidence_item":
            return (
              <div key={block.id} className="flex gap-2 mb-1 ml-4">
                <span className="text-[#555]">&ndash;</span>
                <span>{block.content || "(Delil)"}</span>
              </div>
            );

          case "legal_reference":
            return (
              <div
                key={block.id}
                className="mb-2 ml-4 pl-3 border-l-2 border-purple-400/40 italic text-[13px] text-[#444] font-mono"
              >
                {block.content || "(Kanun referansı)"}
              </div>
            );

          default:
            return (
              <p key={block.id} className="mb-2">
                {block.content}
              </p>
            );
        }
      })}

      {/* Signature area */}
      {hasHeader && (
        <div className="mt-12 text-right">
          <p className="italic">Saygılarımla,</p>
          {h.davaci_vekili && (
            <p className="font-bold mt-1">{h.davaci_vekili}</p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!hasHeader && doc.blocks.length === 0 && (
        <div className="text-center py-16 text-[#999] text-[13px]">
          <p>Sol panelden belgenizi oluşturmaya başlayın.</p>
          <p className="mt-1 text-[12px]">
            Başlık bilgilerini doldurun ve bloklar ekleyin.
          </p>
        </div>
      )}
    </div>
  );
}
