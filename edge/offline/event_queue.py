import json
from pathlib import Path


QUEUE_FILE = Path(__file__).parent / "pending_events.json"


def load_events():
    if not QUEUE_FILE.exists():
        return []
    try:
        with QUEUE_FILE.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (json.JSONDecodeError, OSError):
        return []


def save_events(events):
    with QUEUE_FILE.open("w", encoding="utf-8") as file:
        json.dump(events, file, indent=2)


def add_event(event):
    events = load_events()
    events.append(event)
    save_events(events)


def clear_events():
    save_events([])
