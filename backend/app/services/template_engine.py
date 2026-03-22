"""
Dilekçe şablon motoru.
Yapılandırılmış form verisi → hukuki belge üretimi.
AI kullanmaz — pure template filling.
"""

from datetime import date

TEMPLATES = {
    "ise_iade_dava": {
        "name": "İşe İade Dava Dilekçesi",
        "category": "is_hukuku",
        "fields": [
            {"id": "mahkeme", "label": "Mahkeme", "type": "text", "placeholder": "İstanbul ( ). İş Mahkemesi", "required": True},
            {"id": "davaci_adi", "label": "Davacı Adı Soyadı", "type": "text", "required": True},
            {"id": "davaci_tc", "label": "Davacı TC Kimlik No", "type": "text", "required": False},
            {"id": "davaci_adres", "label": "Davacı Adresi", "type": "textarea", "required": True},
            {"id": "davaci_vekili", "label": "Davacı Vekili", "type": "text", "required": False},
            {"id": "davali_adi", "label": "Davalı (İşveren) Adı", "type": "text", "required": True},
            {"id": "davali_adres", "label": "Davalı Adresi", "type": "textarea", "required": True},
            {"id": "ise_giris_tarihi", "label": "İşe Giriş Tarihi", "type": "date", "required": True},
            {"id": "fesih_tarihi", "label": "Fesih Tarihi", "type": "date", "required": True},
            {"id": "fesih_sebebi", "label": "İşverenin Bildirdiği Fesih Sebebi", "type": "textarea", "required": True},
            {"id": "son_brut_ucret", "label": "Son Brüt Ücret (TL)", "type": "number", "required": True},
            {"id": "savunma_alinmis_mi", "label": "Fesih Öncesi Savunma Alındı mı?", "type": "select", "options": ["Hayır", "Evet"], "required": True},
            {"id": "arabuluculuk_tarihi", "label": "Arabuluculuk Son Tutanak Tarihi", "type": "date", "required": True},
            {"id": "ek_aciklama", "label": "Ek Açıklama / Özel Durumlar", "type": "textarea", "required": False},
        ],
        "template": """{mahkeme}'NE

DAVACI: {davaci_adi}
{davaci_tc_line}
Adres: {davaci_adres}
{davaci_vekili_line}

DAVALI: {davali_adi}
Adres: {davali_adres}

KONU: Feshin geçersizliğinin tespiti ile işe iade ve yasal sonuçlarına karar verilmesi talebidir.

AÇIKLAMALAR:

1. Müvekkilimiz, davalı işyerinde {ise_giris_tarihi} tarihinden itibaren çalışmaya başlamış olup, {fesih_tarihi} tarihinde iş akdi feshedilmiştir.

2. Son brüt ücreti {son_brut_ucret} TL olan müvekkilimizin iş sözleşmesi, işveren tarafından "{fesih_sebebi}" gerekçesiyle feshedilmiştir.

3. {savunma_paragrafi}

4. Zorunlu arabuluculuk sürecine başvurulmuş olup, {arabuluculuk_tarihi} tarihli son tutanakla anlaşma sağlanamamıştır. İşbu dava yasal süre içinde açılmaktadır.

5. 4857 sayılı İş Kanunu'nun 18. maddesi uyarınca, otuz veya daha fazla işçi çalıştıran işyerlerinde en az altı aylık kıdemi olan işçinin iş sözleşmesinin geçerli bir sebep olmaksızın feshedilemeyeceği düzenlenmiştir. Aynı Kanun'un 19. maddesi gereğince fesih bildiriminin yazılı olarak yapılması ve fesih sebebinin açık ve kesin bir şekilde belirtilmesi gerekmektedir.

{ek_aciklama_paragraf}

HUKUKİ SEBEPLER: 4857 s. İş Kanunu md. 18, 19, 20, 21; 7036 s. İş Mahkemeleri Kanunu md. 3; HMK ve ilgili mevzuat.

DELİLLER: SGK hizmet dökümü, iş sözleşmesi, fesih bildirimi, arabuluculuk son tutanağı, ücret bordroları, tanık beyanları ve her türlü yasal delil.

SONUÇ VE TALEP: Yukarıda arz edilen nedenlerle;
1. İş sözleşmesinin feshinin GEÇERSİZLİĞİNE ve müvekkilimizin İŞE İADESİNE,
2. İşe iade kararına rağmen işverence süresi içinde işe başlatılmaması halinde ödenmesi gereken tazminat miktarının belirlenmesine,
3. Kararın kesinleşmesine kadar çalıştırılmadığı süre için en çok 4 aya kadar doğmuş bulunan ücret ve diğer haklarının ödenmesine,
4. Yargılama giderleri ve vekalet ücretinin davalı tarafa yükletilmesine
karar verilmesini saygıyla arz ve talep ederiz.

Tarih: {bugun}

{davaci_imza}"""
    },

    "ihtarname": {
        "name": "İhtarname",
        "category": "genel",
        "fields": [
            {"id": "noter", "label": "Noter", "type": "text", "placeholder": "İstanbul ( ). Noterliği", "required": True},
            {"id": "ihtar_eden", "label": "İhtar Eden", "type": "text", "required": True},
            {"id": "ihtar_eden_adres", "label": "İhtar Eden Adresi", "type": "textarea", "required": True},
            {"id": "muhatap", "label": "Muhatap", "type": "text", "required": True},
            {"id": "muhatap_adres", "label": "Muhatap Adresi", "type": "textarea", "required": True},
            {"id": "konu", "label": "İhtarname Konusu", "type": "text", "required": True},
            {"id": "aciklama", "label": "Açıklama", "type": "textarea", "required": True},
            {"id": "talep", "label": "Talep", "type": "textarea", "required": True},
            {"id": "sure", "label": "Verilen Süre", "type": "text", "placeholder": "7 gün", "required": True},
        ],
        "template": """İHTARNAME

{noter} VASITASIYLA

İHTAR EDEN: {ihtar_eden}
Adres: {ihtar_eden_adres}

MUHATAP: {muhatap}
Adres: {muhatap_adres}

KONU: {konu}

AÇIKLAMALAR:

{aciklama}

İşbu ihtarname ile; {talep}

Aksi takdirde, {sure} içinde gereğinin yapılmaması halinde yasal yollara başvurulacağını, yargılama giderleri ve vekalet ücretinin tarafınıza yükletileceğini ihtaren bildiririz.

Saygılarımızla,

Tarih: {bugun}
{ihtar_eden}"""
    },

    "cevap_dilekce": {
        "name": "Cevap Dilekçesi",
        "category": "genel",
        "fields": [
            {"id": "mahkeme", "label": "Mahkeme", "type": "text", "required": True},
            {"id": "esas_no", "label": "Esas Numarası", "type": "text", "required": True},
            {"id": "davali_adi", "label": "Davalı (Cevap Veren)", "type": "text", "required": True},
            {"id": "davali_vekili", "label": "Davalı Vekili", "type": "text", "required": False},
            {"id": "davaci_adi", "label": "Davacı", "type": "text", "required": True},
            {"id": "cevaplar", "label": "Dava Dilekçesine Cevaplar", "type": "textarea", "required": True},
            {"id": "deliller", "label": "Deliller", "type": "textarea", "placeholder": "SGK kayıtları, tanık beyanları, belgeler...", "required": True},
            {"id": "sonuc_talep", "label": "Sonuç ve Talep", "type": "textarea", "required": True},
        ],
        "template": """{mahkeme}'NE

DOSYA NO: {esas_no}

DAVALI: {davali_adi}
{davali_vekili_line}

DAVACI: {davaci_adi}

KONU: Dava dilekçesine karşı cevaplarımızın sunulmasıdır.

CEVAPLAR:

{cevaplar}

DELİLLER: {deliller}

SONUÇ VE TALEP:
{sonuc_talep}

Saygılarımızla,

Tarih: {bugun}
{davali_adi}"""
    },

    "kidem_ihbar_dava": {
        "name": "Kıdem ve İhbar Tazminatı Dava Dilekçesi",
        "category": "is_hukuku",
        "fields": [
            {"id": "mahkeme", "label": "Mahkeme", "type": "text", "placeholder": "İstanbul ( ). İş Mahkemesi", "required": True},
            {"id": "davaci_adi", "label": "Davacı Adı Soyadı", "type": "text", "required": True},
            {"id": "davaci_tc", "label": "Davacı TC Kimlik No", "type": "text", "required": False},
            {"id": "davaci_adres", "label": "Davacı Adresi", "type": "textarea", "required": True},
            {"id": "davaci_vekili", "label": "Davacı Vekili", "type": "text", "required": False},
            {"id": "davali_adi", "label": "Davalı (İşveren) Adı", "type": "text", "required": True},
            {"id": "davali_adres", "label": "Davalı Adresi", "type": "textarea", "required": True},
            {"id": "ise_giris_tarihi", "label": "İşe Giriş Tarihi", "type": "date", "required": True},
            {"id": "fesih_tarihi", "label": "Fesih/Çıkış Tarihi", "type": "date", "required": True},
            {"id": "fesih_sekli", "label": "Fesih Şekli", "type": "select", "options": ["İşveren tarafından haksız fesih", "İşçi tarafından haklı nedenle fesih", "İşverenin bildirimsiz feshi"], "required": True},
            {"id": "son_brut_ucret", "label": "Son Brüt Ücret (TL)", "type": "number", "required": True},
            {"id": "kidem_talep", "label": "Kıdem Tazminatı Talep Ediliyor mu?", "type": "select", "options": ["Evet", "Hayır"], "required": True},
            {"id": "ihbar_talep", "label": "İhbar Tazminatı Talep Ediliyor mu?", "type": "select", "options": ["Evet", "Hayır"], "required": True},
            {"id": "diger_alacaklar", "label": "Diğer Alacak Kalemleri", "type": "textarea", "placeholder": "Fazla mesai, yıllık izin ücreti, AGİ vb.", "required": False},
            {"id": "arabuluculuk_tarihi", "label": "Arabuluculuk Son Tutanak Tarihi", "type": "date", "required": True},
            {"id": "ek_aciklama", "label": "Ek Açıklama", "type": "textarea", "required": False},
        ],
        "template": """{mahkeme}'NE

DAVACI: {davaci_adi}
{davaci_tc_line}
Adres: {davaci_adres}
{davaci_vekili_line}

DAVALI: {davali_adi}
Adres: {davali_adres}

KONU: Kıdem tazminatı, ihbar tazminatı ve işçilik alacaklarının tahsili talebidir.

AÇIKLAMALAR:

1. Müvekkilimiz, davalı işyerinde {ise_giris_tarihi} tarihinden {fesih_tarihi} tarihine kadar aralıksız çalışmıştır. Son brüt ücreti {son_brut_ucret} TL'dir.

2. İş sözleşmesi, {fesih_sekli} suretiyle sona ermiştir.

{kidem_paragrafi}

{ihbar_paragrafi}

{diger_alacaklar_paragrafi}

5. Zorunlu arabuluculuk sürecine başvurulmuş olup, {arabuluculuk_tarihi} tarihli son tutanakla anlaşma sağlanamamıştır.

{ek_aciklama_paragraf}

HUKUKİ SEBEPLER: 4857 s. İş Kanunu md. 17, 25, 32, 41, 46, 59; 1475 s. İş Kanunu md. 14; 7036 s. İş Mahkemeleri Kanunu md. 3; HMK ve ilgili mevzuat.

DELİLLER: SGK hizmet dökümü, iş sözleşmesi, ücret bordroları, banka hesap ekstresi, fesih bildirimi, arabuluculuk son tutanağı, tanık beyanları ve her türlü yasal delil.

SONUÇ VE TALEP: Yukarıda arz edilen nedenlerle;
{kidem_talep_sonuc}
{ihbar_talep_sonuc}
{diger_alacaklar_talep}
- Yargılama giderleri ve vekalet ücretinin davalı tarafa yükletilmesine
karar verilmesini saygıyla arz ve talep ederiz.

Tarih: {bugun}

{davaci_imza}"""
    },

    "arabuluculuk_basvuru": {
        "name": "Zorunlu Arabuluculuk Başvuru Dilekçesi",
        "category": "is_hukuku",
        "fields": [
            {"id": "adliye", "label": "Arabuluculuk Bürosu", "type": "text", "placeholder": "İstanbul Adliyesi Arabuluculuk Bürosu", "required": True},
            {"id": "basvuran_adi", "label": "Başvuran Adı Soyadı", "type": "text", "required": True},
            {"id": "basvuran_tc", "label": "Başvuran TC Kimlik No", "type": "text", "required": True},
            {"id": "basvuran_adres", "label": "Başvuran Adresi", "type": "textarea", "required": True},
            {"id": "basvuran_telefon", "label": "Başvuran Telefon", "type": "text", "required": True},
            {"id": "basvuran_vekili", "label": "Başvuran Vekili", "type": "text", "required": False},
            {"id": "karsi_taraf_adi", "label": "Karşı Taraf (İşveren) Adı", "type": "text", "required": True},
            {"id": "karsi_taraf_adres", "label": "Karşı Taraf Adresi", "type": "textarea", "required": True},
            {"id": "karsi_taraf_telefon", "label": "Karşı Taraf Telefon (Biliniyorsa)", "type": "text", "required": False},
            {"id": "uyusmazlik_turu", "label": "Uyuşmazlık Türü", "type": "select", "options": ["İşe iade", "Kıdem tazminatı", "İhbar tazminatı", "Fazla mesai ücreti", "Yıllık izin ücreti", "Ücret alacağı", "Diğer işçilik alacakları"], "required": True},
            {"id": "uyusmazlik_aciklama", "label": "Uyuşmazlığın Kısa Açıklaması", "type": "textarea", "required": True},
            {"id": "talep_tutari", "label": "Yaklaşık Talep Tutarı (TL)", "type": "number", "required": False},
        ],
        "template": """{adliye}'NA

ZORUNLU ARABULUCULUK BAŞVURU FORMU

BAŞVURAN:
Adı Soyadı: {basvuran_adi}
TC Kimlik No: {basvuran_tc}
Adres: {basvuran_adres}
Telefon: {basvuran_telefon}
{basvuran_vekili_line}

KARŞI TARAF:
Adı / Unvanı: {karsi_taraf_adi}
Adres: {karsi_taraf_adres}
{karsi_taraf_telefon_line}

UYUŞMAZLIĞIN TÜRÜ: {uyusmazlik_turu}

UYUŞMAZLIĞIN AÇIKLAMASI:

{uyusmazlik_aciklama}

{talep_tutari_line}

7036 sayılı İş Mahkemeleri Kanunu'nun 3. maddesi gereğince, iş mahkemelerinde dava açmadan önce arabulucuya başvurulması zorunlu olup, işbu başvuru yasal zorunluluk kapsamında yapılmaktadır.

Arabuluculuk görüşmelerinin başlatılmasını ve tarafların davet edilmesini saygıyla arz ve talep ederim.

Tarih: {bugun}

Başvuran: {basvuran_adi}"""
    },
}


class TemplateEngine:
    """
    Dilekçe şablon motoru.
    Form verilerini alır, şablona yerleştirir, belge üretir.
    """

    @staticmethod
    def list_templates() -> list[dict]:
        """Tüm şablonları listeler (template metni hariç)."""
        result = []
        for tid, tpl in TEMPLATES.items():
            result.append({
                "id": tid,
                "name": tpl["name"],
                "category": tpl["category"],
                "fields": tpl["fields"],
            })
        return result

    @staticmethod
    def get_template(template_id: str) -> dict | None:
        """Tek bir şablonu döndürür (fields dahil, template metni hariç)."""
        tpl = TEMPLATES.get(template_id)
        if not tpl:
            return None
        return {
            "id": template_id,
            "name": tpl["name"],
            "category": tpl["category"],
            "fields": tpl["fields"],
        }

    @staticmethod
    def generate(template_id: str, values: dict[str, str]) -> str:
        """
        Şablonu doldurarak belge üretir.
        Conditional paragrafları handle eder.
        """
        tpl = TEMPLATES.get(template_id)
        if not tpl:
            raise ValueError(f"Şablon bulunamadı: {template_id}")

        # Bugünün tarihi
        bugun = date.today().strftime("%d.%m.%Y")

        # Build context from values
        ctx = {**values, "bugun": bugun}

        # -- Conditional lines / paragraphs --

        # davaci_tc_line
        tc = values.get("davaci_tc", "").strip()
        ctx["davaci_tc_line"] = f"TC Kimlik No: {tc}" if tc else ""

        # davaci_vekili_line
        vekil = values.get("davaci_vekili", "").strip()
        ctx["davaci_vekili_line"] = f"Vekili: {vekil}" if vekil else ""

        # davali_vekili_line
        dvekil = values.get("davali_vekili", "").strip()
        ctx["davali_vekili_line"] = f"Vekili: {dvekil}" if dvekil else ""

        # basvuran_vekili_line
        bvekil = values.get("basvuran_vekili", "").strip()
        ctx["basvuran_vekili_line"] = f"Vekili: {bvekil}" if bvekil else ""

        # karsi_taraf_telefon_line
        ktel = values.get("karsi_taraf_telefon", "").strip()
        ctx["karsi_taraf_telefon_line"] = f"Telefon: {ktel}" if ktel else ""

        # talep_tutari_line
        ttutari = values.get("talep_tutari", "").strip()
        ctx["talep_tutari_line"] = f"YAKLAŞIK TALEP TUTARI: {ttutari} TL" if ttutari else ""

        # savunma_paragrafi (ise_iade_dava)
        savunma = values.get("savunma_alinmis_mi", "Hayır")
        if savunma == "Hayır":
            ctx["savunma_paragrafi"] = (
                "4857 sayılı İş Kanunu'nun 19. maddesi gereğince, işveren fesihten önce "
                "işçinin savunmasını almak zorundadır. Ancak müvekkilimizin savunması "
                "alınmadan iş akdi feshedilmiştir. Bu durum tek başına feshin "
                "geçersizliğini gerektirmektedir."
            )
        else:
            ctx["savunma_paragrafi"] = (
                "Her ne kadar fesih öncesinde savunma alınmış ise de, fesih sebebi "
                "geçerli ve yeterli bir neden teşkil etmemektedir. İşverenin ileri "
                "sürdüğü gerekçe, feshin son çare olması ilkesiyle bağdaşmamaktadır."
            )

        # ek_aciklama_paragraf
        ek = values.get("ek_aciklama", "").strip()
        ctx["ek_aciklama_paragraf"] = f"6. {ek}" if ek else ""

        # davaci_imza
        davaci_adi = values.get("davaci_adi", "").strip()
        davaci_vekili = values.get("davaci_vekili", "").strip()
        if davaci_vekili:
            ctx["davaci_imza"] = f"Davacı Vekili\n{davaci_vekili}"
        elif davaci_adi:
            ctx["davaci_imza"] = f"Davacı\n{davaci_adi}"
        else:
            ctx["davaci_imza"] = ""

        # -- kidem_ihbar_dava conditionals --
        kidem = values.get("kidem_talep", "Evet")
        ihbar = values.get("ihbar_talep", "Evet")

        if kidem == "Evet":
            ctx["kidem_paragrafi"] = (
                "3. Müvekkilimiz, 1475 sayılı İş Kanunu'nun 14. maddesi kapsamında "
                "kıdem tazminatına hak kazanmış olup, davalı işveren tarafından "
                "kıdem tazminatı ödenmemiştir."
            )
            ctx["kidem_talep_sonuc"] = (
                "- Kıdem tazminatının fesih tarihinden itibaren işleyecek "
                "en yüksek banka mevduat faizi ile birlikte davalıdan tahsiline,"
            )
        else:
            ctx["kidem_paragrafi"] = ""
            ctx["kidem_talep_sonuc"] = ""

        if ihbar == "Evet":
            ctx["ihbar_paragrafi"] = (
                "4. İş sözleşmesi bildirim sürelerine uyulmaksızın feshedilmiş olup, "
                "4857 sayılı İş Kanunu'nun 17. maddesi gereğince ihbar tazminatına "
                "hak kazanılmıştır."
            )
            ctx["ihbar_talep_sonuc"] = (
                "- İhbar tazminatının fesih tarihinden itibaren işleyecek "
                "yasal faizi ile birlikte davalıdan tahsiline,"
            )
        else:
            ctx["ihbar_paragrafi"] = ""
            ctx["ihbar_talep_sonuc"] = ""

        diger = values.get("diger_alacaklar", "").strip()
        if diger:
            ctx["diger_alacaklar_paragrafi"] = (
                f"Ayrıca müvekkilimizin şu alacak kalemleri de ödenmemiştir: {diger}"
            )
            ctx["diger_alacaklar_talep"] = (
                "- Fazla mesai, yıllık izin ücreti ve diğer işçilik alacaklarının "
                "yasal faizleriyle birlikte davalıdan tahsiline,"
            )
        else:
            ctx["diger_alacaklar_paragrafi"] = ""
            ctx["diger_alacaklar_talep"] = ""

        # Fill template
        template_text = tpl["template"]

        # Replace all placeholders
        for key, val in ctx.items():
            placeholder = "{" + key + "}"
            template_text = template_text.replace(placeholder, str(val))

        # Clean up empty lines left by conditional sections
        lines = template_text.split("\n")
        cleaned = []
        prev_empty = False
        for line in lines:
            is_empty = line.strip() == ""
            if is_empty and prev_empty:
                continue
            cleaned.append(line)
            prev_empty = is_empty

        return "\n".join(cleaned).strip()
