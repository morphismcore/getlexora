"""
Mahkeme istatistik motoru.
Qdrant'taki kararlara dayanarak mahkeme/daire bazlı istatistik üretir.
Ayrıca Bedesten API'den toplu veri çekerek analiz yapar.
"""

import asyncio
import re
from collections import Counter, defaultdict

import structlog

logger = structlog.get_logger()


class CourtStatisticsService:
    """Bedesten API verilerinden mahkeme/daire bazlı istatistik üretir."""

    def __init__(self, yargi, vector_store=None):
        self.yargi = yargi
        self.vector_store = vector_store

    async def _fetch_all_pages(
        self,
        keyword: str,
        item_type: str = "YARGITAYKARARI",
        max_pages: int = 10,
    ) -> list[dict]:
        """Bedesten API'den birden fazla sayfa çekerek tüm kararları toplar."""
        all_results: list[dict] = []

        # İlk sayfayı çek — toplam sonuç sayısını öğren
        try:
            first = await self.yargi.search_bedesten(
                keyword=keyword,
                item_type=item_type,
                page=1,
                page_size=10,
            )
        except Exception as e:
            logger.error("statistics_first_page_error", error=str(e), keyword=keyword)
            return []

        total = first.get("data", {}).get("total", 0)
        items = first.get("data", {}).get("emsalKararList", [])
        all_results.extend(items)

        if total <= 10:
            return all_results

        # Kalan sayfaları paralel çek
        total_pages = min((total + 9) // 10, max_pages)
        tasks = [
            self.yargi.search_bedesten(
                keyword=keyword,
                item_type=item_type,
                page=p,
                page_size=10,
            )
            for p in range(2, total_pages + 1)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception):
                logger.warning("statistics_page_error", error=str(r))
                continue
            page_items = r.get("data", {}).get("emsalKararList", [])
            all_results.extend(page_items)

        return all_results

    def _extract_year(self, item: dict) -> int | None:
        """Karardan yıl bilgisini çıkar."""
        # Önce esasNoYil dene
        esas_yil = item.get("esasNoYil")
        if esas_yil:
            try:
                return int(esas_yil)
            except (ValueError, TypeError):
                pass

        # kararTarihiStr'den çıkar (ör: "01.03.2024")
        tarih = item.get("kararTarihiStr", "")
        if tarih:
            match = re.search(r"(\d{4})", tarih)
            if match:
                return int(match.group(1))

        return None

    def _extract_chamber(self, item: dict) -> str:
        """Karardan daire/birim adını çıkar."""
        return item.get("birimAdi", "Bilinmeyen")

    async def get_court_stats(self, court_type: str, topic: str) -> dict:
        """
        Belirli bir mahkeme ve konu için istatistik üret.

        1. Bedesten API'de "{topic}" ara, 10 sayfa çek
        2. Her kararın daire bilgisini topla
        3. Daire bazlı karar sayısı dağılımı
        4. Yıl bazlı karar sayısı trendi
        5. En aktif daireler
        """
        from app.services.yargi import ITEM_TYPES

        item_type = ITEM_TYPES.get(court_type, "YARGITAYKARARI")
        items = await self._fetch_all_pages(keyword=topic, item_type=item_type, max_pages=10)

        if not items:
            return {
                "topic": topic,
                "court_type": court_type,
                "total_decisions": 0,
                "by_chamber": [],
                "by_year": [],
                "most_active_chamber": None,
                "note": "Bu konu için karar bulunamadı.",
            }

        # Daire bazlı sayım
        chamber_counter: Counter = Counter()
        year_counter: Counter = Counter()

        for item in items:
            chamber = self._extract_chamber(item)
            chamber_counter[chamber] += 1

            year = self._extract_year(item)
            if year:
                year_counter[year] += 1

        total = len(items)

        # Daire dağılımı
        by_chamber = [
            {
                "daire": daire,
                "count": count,
                "percentage": round(count / total * 100, 1),
            }
            for daire, count in chamber_counter.most_common()
        ]

        # Yıl bazlı trend (sıralı)
        by_year = [
            {"year": year, "count": count}
            for year, count in sorted(year_counter.items())
        ]

        most_active = chamber_counter.most_common(1)[0][0] if chamber_counter else None

        return {
            "topic": topic,
            "court_type": court_type,
            "total_decisions": total,
            "by_chamber": by_chamber,
            "by_year": by_year,
            "most_active_chamber": most_active,
            "note": "Bu istatistikler Bedesten API'deki kararlara dayanmaktadır.",
        }

    async def get_topic_comparison(self, topics: list[str], court_type: str = "yargitay") -> dict:
        """
        Birden fazla konuyu karşılaştır.
        Her konu için karar sayısı ve daire dağılımı.
        """
        tasks = [self.get_court_stats(court_type=court_type, topic=t) for t in topics]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        comparisons = []
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                logger.warning("topic_comparison_error", topic=topics[i], error=str(r))
                comparisons.append({
                    "topic": topics[i],
                    "total_decisions": 0,
                    "by_chamber": [],
                    "by_year": [],
                    "most_active_chamber": None,
                    "error": str(r),
                })
            else:
                comparisons.append(r)

        return {
            "topics": topics,
            "court_type": court_type,
            "comparisons": comparisons,
        }

    async def get_chamber_profile(self, daire: str, court_type: str = "yargitay") -> dict:
        """
        Belirli bir dairenin profili.
        En çok baktığı konular, yıllık karar sayısı trendi.

        Birkaç yaygın hukuk konusu üzerinden arama yaparak dairenin
        hangi konularda aktif olduğunu belirler.
        """
        from app.services.yargi import ITEM_TYPES

        item_type = ITEM_TYPES.get(court_type, "YARGITAYKARARI")

        # Yaygın hukuk konuları üzerinden arama yap
        common_topics = [
            "işe iade",
            "kıdem tazminatı",
            "ihbar tazminatı",
            "boşanma",
            "tapu iptal",
            "alacak",
            "itirazın iptali",
            "menfi tespit",
            "tazminat",
            "miras",
        ]

        topic_counts: dict[str, int] = {}
        year_counter: Counter = Counter()
        total_found = 0

        tasks = []
        for topic in common_topics:
            tasks.append(
                self.yargi.search_bedesten(
                    keyword=topic,
                    item_type=item_type,
                    birim_adi=daire,
                    page=1,
                    page_size=10,
                )
            )

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, r in enumerate(results):
            if isinstance(r, Exception):
                continue

            items = r.get("data", {}).get("emsalKararList", [])
            # Sadece bu daireye ait olanları say
            matching = [it for it in items if it.get("birimAdi", "") == daire]
            count = len(matching)

            if count > 0:
                topic_counts[common_topics[i]] = count
                total_found += count

                for item in matching:
                    year = self._extract_year(item)
                    if year:
                        year_counter[year] += 1

        # Konuları çoktan aza sırala
        top_topics = [
            {"topic": t, "count": c}
            for t, c in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)
        ]

        by_year = [
            {"year": year, "count": count}
            for year, count in sorted(year_counter.items())
        ]

        return {
            "daire": daire,
            "court_type": court_type,
            "total_sampled": total_found,
            "top_topics": top_topics,
            "by_year": by_year,
            "note": "Bu profil örneklem bazlı olup, yaygın hukuk konuları üzerinden oluşturulmuştur.",
        }
