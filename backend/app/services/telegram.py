"""
Telegram notification service for ingestion pipeline progress reports.
"""

import httpx
import structlog

from app.config import get_settings

logger = structlog.get_logger()


class TelegramService:
    """Send notifications to a Telegram chat via Bot API."""

    def __init__(self):
        settings = get_settings()
        self.token = settings.telegram_bot_token
        self.chat_id = settings.telegram_chat_id
        self.enabled = bool(self.token and self.chat_id)

    async def send_message(self, text: str) -> None:
        """POST a message to Telegram. Never raises — failures are logged and swallowed."""
        if not self.enabled:
            return
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"https://api.telegram.org/bot{self.token}/sendMessage",
                    json={
                        "chat_id": self.chat_id,
                        "text": text,
                        "parse_mode": "Markdown",
                    },
                )
                if resp.status_code != 200:
                    logger.warning(
                        "telegram_send_failed",
                        status=resp.status_code,
                        body=resp.text[:200],
                    )
        except Exception as e:
            logger.warning("telegram_send_error", error=str(e))

    async def send_ingestion_report(self, stats: dict) -> None:
        """Format and send an ingestion progress report."""
        if not self.enabled:
            return

        source = stats.get("source", "bilinmiyor")
        embedded = stats.get("embedded", 0)
        errors = stats.get("errors", 0)
        elapsed = stats.get("elapsed", "?")
        daire = stats.get("daire", "")
        page = stats.get("page", "")
        fetched = stats.get("fetched", 0)
        status = stats.get("status", "devam ediyor")

        lines = [
            f"\U0001f4ca *Lexora Ingestion Raporu*",
            f"\U0001f4e6 Kaynak: `{source}`",
            f"\U00002705 Embedded: *{embedded:,}*",
            f"\U0001f4e5 Fetched: *{fetched:,}*",
        ]

        if errors:
            lines.append(f"\U0000274c Hatalar: *{errors}*")

        if daire:
            lines.append(f"\U0001f3db Daire: `{daire}`")
        if page:
            lines.append(f"\U0001f4c4 Sayfa: `{page}`")

        lines.append(f"\U000023f1 Sure: {elapsed}")
        lines.append(f"\U0001f6a6 Durum: {status}")

        text = "\n".join(lines)
        await self.send_message(text)
