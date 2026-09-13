"""Mappls (MapMyIndia) Configuration & API Credentials."""

import os
from pathlib import Path

# Load from .env if present
ENV_FILE = Path(__file__).parent.parent / ".env"
if ENV_FILE.exists():
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    key, val = key.strip(), val.strip()
                    if key and val and key not in os.environ:
                        os.environ[key] = val
    except Exception:
        pass

# Default / Configured API Keys
DEFAULT_MAPPLS_API_KEY = "vfprupvufqvkbaarmpgonnlgzzgnnkzetirt"

MAPPLS_API_KEY = os.environ.get("MAPPLS_API_KEY", DEFAULT_MAPPLS_API_KEY)
MAPPLS_CLIENT_ID = os.environ.get("MAPPLS_CLIENT_ID", "")
MAPPLS_CLIENT_SECRET = os.environ.get("MAPPLS_CLIENT_SECRET", "")
