"""
Lexora E-posta Servisi — SMTP ile HTML e-posta gönderimi.
Şifre sıfırlama, süre hatırlatma vb. bildirimler için kullanılır.
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import structlog

from app.config import get_settings

logger = structlog.get_logger()


def _get_base_template(content: str, title: str = "Lexora") -> str:
    """Lexora branding'li HTML e-posta template'i."""
    return f"""<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#09090B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#6C6CFF,#A78BFA);line-height:48px;text-align:center;">
        <span style="color:white;font-size:22px;font-weight:bold;">L</span>
      </div>
      <h1 style="color:#ECECEE;font-size:20px;margin:12px 0 0;">{title}</h1>
    </div>
    <!-- Content -->
    <div style="background:#111113;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:32px;">
      {content}
    </div>
    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;">
      <p style="color:#5C5C5F;font-size:11px;margin:0;">
        Bu e-posta Lexora hukuk platformu tarafindan gonderilmistir.
      </p>
      <p style="color:#3A3A3F;font-size:10px;margin:8px 0 0;">
        &copy; 2026 Lexora. Tum haklari saklidir.
      </p>
    </div>
  </div>
</body>
</html>"""


def build_password_reset_email(reset_url: str, user_name: str) -> str:
    """Şifre sıfırlama e-posta HTML'i oluştur."""
    content = f"""
      <h2 style="color:#ECECEE;font-size:16px;margin:0 0 16px;">Sifre Sifirlama</h2>
      <p style="color:#8B8B8E;font-size:14px;line-height:1.6;margin:0 0 8px;">
        Merhaba <strong style="color:#ECECEE;">{user_name}</strong>,
      </p>
      <p style="color:#8B8B8E;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Hesabiniz icin sifre sifirlama talebi aldik. Asagidaki butona tiklayarak yeni sifrenizi belirleyebilirsiniz.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="{reset_url}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#6C6CFF,#7B7BFF);color:white;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;">
          Sifremi Sifirla
        </a>
      </div>
      <p style="color:#5C5C5F;font-size:12px;line-height:1.5;margin:16px 0 0;">
        Bu link 1 saat boyunca gecerlidir. Eger siz bu islemi talep etmediyseniz, bu e-postayi goz ardi edebilirsiniz.
      </p>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:20px 0;" />
      <p style="color:#3A3A3F;font-size:11px;margin:0;">
        Link calismazsa bu adresi tarayiciniza yapistirin:<br/>
        <span style="color:#5C5C5F;word-break:break-all;">{reset_url}</span>
      </p>
    """
    return _get_base_template(content, title="Lexora")


def build_deadline_reminder_email(
    user_name: str,
    deadlines: list[dict],
) -> str:
    """Süre hatırlatma e-posta HTML'i oluştur."""
    rows = ""
    for dl in deadlines:
        rows += f"""
        <tr>
          <td style="padding:8px 12px;color:#ECECEE;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04);">{dl['title']}</td>
          <td style="padding:8px 12px;color:#8B8B8E;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04);">{dl['case_title']}</td>
          <td style="padding:8px 12px;color:#E5484D;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.04);">{dl['deadline_date']}</td>
        </tr>"""

    content = f"""
      <h2 style="color:#ECECEE;font-size:16px;margin:0 0 16px;">Sure Hatirlatmasi</h2>
      <p style="color:#8B8B8E;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Merhaba <strong style="color:#ECECEE;">{user_name}</strong>,
        yaklasan sureleriniz bulunmaktadir:
      </p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
            <th style="text-align:left;padding:8px 12px;color:#5C5C5F;font-size:11px;font-weight:600;">SURE</th>
            <th style="text-align:left;padding:8px 12px;color:#5C5C5F;font-size:11px;font-weight:600;">DAVA</th>
            <th style="text-align:left;padding:8px 12px;color:#5C5C5F;font-size:11px;font-weight:600;">TARIH</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    """
    return _get_base_template(content, title="Lexora")


async def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """SMTP ile e-posta gönder. Başarılıysa True döner."""
    settings = get_settings()

    if not settings.smtp_user or not settings.smtp_password:
        logger.warning("email_skipped", reason="SMTP credentials not configured", to=to_email)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Lexora <{settings.smtp_from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from_email, to_email, msg.as_string())
        logger.info("email_sent", to=to_email, subject=subject)
        return True
    except Exception as e:
        logger.error("email_send_error", to=to_email, error=str(e))
        return False
