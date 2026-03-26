"""
Ingestion yapılandırması — daire bazlı yıl aralığı ve öncelik ayarları.
Admin panelden değiştirilebilir, JSON dosyasında saklanır.
"""

import json
import os
import structlog

logger = structlog.get_logger()

CONFIG_FILE = "/app/data/ingestion_config.json"

DEFAULT_CONFIG = {
    "yargitay": {
        "enabled": True,
        "year_from": None,
        "year_to": None,
        "priority_daireler": [],
        "daire_config": {
            # Daire bazlı yıl aralığı: "9": {"year_from": 2015}
        },
    },
    "danistay": {
        "enabled": True,
        "year_from": None,
        "year_to": None,
        "priority_daireler": [],
        "daire_config": {},
    },
    "rekabet": {
        "enabled": False,
        "max_pages": 1100,
    },
    "kvkk": {
        "enabled": False,
        "max_decisions": 1000,
    },
    "aym": {
        "enabled": True,
        "pages": 10,
    },
    "aihm": {
        "enabled": True,
        "max_results": 500,
    },
}


def load_ingestion_config() -> dict:
    """Ingestion config dosyasını yükle. Yoksa default döndür."""
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE) as f:
                config = json.load(f)
                # Merge with defaults for missing keys
                merged = {**DEFAULT_CONFIG}
                for key in merged:
                    if key in config:
                        if isinstance(merged[key], dict) and isinstance(config[key], dict):
                            merged[key] = {**merged[key], **config[key]}
                        else:
                            merged[key] = config[key]
                return merged
    except Exception as e:
        logger.warning("ingestion_config_load_error", error=str(e))
    return DEFAULT_CONFIG.copy()


def save_ingestion_config(config: dict):
    """Ingestion config dosyasını kaydet."""
    try:
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        logger.info("ingestion_config_saved")
    except Exception as e:
        logger.error("ingestion_config_save_error", error=str(e))
        raise
