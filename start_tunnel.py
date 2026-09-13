"""CITYPULSE Public Domain Tunnel Manager.

Exposes the local CITYPULSE backend (localhost:8000) to a public HTTPS domain
using Cloudflare Tunnel. Works on any network without port forwarding or account setup.
"""

import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent
TOOLS_DIR = ROOT_DIR / "tools"
CF_EXE = TOOLS_DIR / "cloudflared.exe"


def ensure_cloudflared():
    """Download cloudflared binary if not present."""
    if CF_EXE.exists():
        return True
    TOOLS_DIR.mkdir(exist_ok=True)
    import urllib.request
    url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    print("Downloading Cloudflare tunnel client...")
    try:
        urllib.request.urlretrieve(url, CF_EXE)
        print("Download complete.")
        return True
    except Exception as e:
        print(f"Failed to download cloudflared: {e}")
        return False


def start_tunnel(port=8000):
    """Start Cloudflare tunnel and display public URL."""
    if not ensure_cloudflared():
        print("[Error] Could not initialize tunnel binary.")
        return

    print("==================================================")
    print("       CITYPULSE PUBLIC DOMAIN TUNNEL")
    print(f"       Forwarding -> http://127.0.0.1:{port}")
    print("==================================================")

    cmd = [str(CF_EXE), "tunnel", "--url", f"http://127.0.0.1:{port}"]
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    domain_found = False
    try:
        for line in process.stdout:
            print(line, end="", flush=True)
            if "trycloudflare.com" in line and not domain_found:
                domain_found = True
                for part in line.split():
                    if "trycloudflare.com" in part and part.startswith("https://"):
                        url = part.strip()
                        try:
                            with open(ROOT_DIR / "public_url.txt", "w", encoding="utf-8") as f:
                                f.write(url + "\n")
                        except Exception:
                            pass
                        print("\n" + "=" * 65, flush=True)
                        print(f"  LIVE PUBLIC HOST:  {url}", flush=True)
                        print(f"  ADMIN COMMAND:     {url}/admin", flush=True)
                        print(f"  CITIZEN PORTAL:    {url}/report", flush=True)
                        print(f"  API DOCS:          {url}/docs", flush=True)
                        print("=" * 65 + "\n", flush=True)

    except KeyboardInterrupt:
        print("\nStopping tunnel...")
        process.terminate()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    start_tunnel(port)
