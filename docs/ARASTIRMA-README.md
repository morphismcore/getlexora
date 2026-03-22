# LEXORA — AI-Powered Legal Assistant for Turkish Lawyers
## Tam Ürün Araştırma Dokümanı

---

### Temel İlke
> Bu sistem bir avukatın işini destekler, yapmaz. Her çıktıda avukat son kararı verir; sistem araştırma + taslak + analiz üretir.

---

## Doküman İndeksi

| # | Dosya | İçerik | Sayfa |
|---|-------|--------|-------|
| 1 | [BOLUM-01-AJAN-MIMARISI.md](./BOLUM-01-AJAN-MIMARISI.md) | 19 ajan tanımı, orkestrasyon akışı, shared state, event bus | Ajan envanteri |
| 2 | [BOLUM-02-HUKUK-ALANI-OZELLESME.md](./BOLUM-02-HUKUK-ALANI-OZELLESME.md) | Ceza, Ticaret, İş hukuku ajan akışları | Alan bazlı akışlar |
| 3 | [BOLUM-03-HALUSINASYON-SIFIRLANMASI.md](./BOLUM-03-HALUSINASYON-SIFIRLANMASI.md) | Citation verification, grounding, confidence scoring, audit trail | Anti-hallüsinasyon |
| 4 | [BOLUM-04-GUNLUK-IS-AKISI.md](./BOLUM-04-GUNLUK-IS-AKISI.md) | Sabah rutini → Dava açma → Araştırma → Dilekçe → Duruşma hazırlığı → Müvekkil raporu | UX akışları |
| 5 | [BOLUM-05-UYAP-ENTEGRASYONU.md](./BOLUM-05-UYAP-ENTEGRASYONU.md) | UYAP erişim yolları, browser extension, UDF formatı, hukuki risk, yol haritası | UYAP stratejisi |
| 6 | [BOLUM-06-DIFFERENTIATOR.md](./BOLUM-06-DIFFERENTIATOR.md) | Hakim profili, karşı vekil analizi, outcome tahmini, strateji simülatörü, içtihat watchdog | Rekabet avantajı |
| 7 | [BOLUM-07-TEKNIK-STACK.md](./BOLUM-07-TEKNIK-STACK.md) | LLM, LangGraph, Qdrant, bge-m3, chunking, streaming, multi-tenancy, auth | Altyapı kararları |
| 8 | [BOLUM-08-SATIS-STRATEJISI.md](./BOLUM-08-SATIS-STRATEJISI.md) | Avukat psikolojisi, demo, baro kanalı, fiyatlandırma, onboarding, churn | Go-to-market |
| 9 | [BOLUM-09-ROADMAP.md](./BOLUM-09-ROADMAP.md) | Hafta 1-4 POC → Ay 12 Scale, ekip büyümesi, başarı metrikleri | Ürün yol haritası |
| 10 | [BOLUM-10-RISK-ANALIZI.md](./BOLUM-10-RISK-ANALIZI.md) | 5 ölümcül risk, erken uyarı, kurtarma planları | Risk yönetimi |

---

## Hızlı Özet

- **19 ajan** — Araştırma (5), Yazım (2), Strateji (3), Doğrulama (3), Belge Analiz (3), Operasyonel (2), Hafıza (1)
- **Teknik stack** — Claude API + LangGraph + Qdrant + bge-m3 + FastAPI + Next.js
- **Fiyatlandırma** — ₺999/ay (Başlangıç), ₺2,499/ay (Profesyonel), ₺1,999/avukat/ay (Büro)
- **Hedef** — Ay 12: 500+ avukat, MRR ₺500K+, ARR ₺6M+
- **Veri kaynakları** — yargi-mcp, mevzuat-mcp, DergiPark, Resmi Gazete, HUDOC
- **Anti-hallüsinasyon** — 5 katmanlı doğrulama, <%1 hallüsinasyon hedefi

---

*Bu doküman Mart 2026'da hazırlanmıştır. Pazar koşulları ve teknoloji hızla değişmektedir.*
