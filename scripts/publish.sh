#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ ! -f "$1" ]; then echo "Usage: publish.sh <html-file> [title]" >&2; exit 1; fi
if [ -z "${YEZHOU_API_TOKEN:-}" ]; then echo "Error: YEZHOU_API_TOKEN is not set. Create one at ${YEZHOU_BASE_URL:-https://yz.gbfeng.com}/agent" >&2; exit 1; fi

INPUT_FILE="$1"; TITLE="${2:-}"; BASE_URL="${YEZHOU_BASE_URL:-https://yz.gbfeng.com}"
PROJECT_DIR="$(cd "$(dirname "$INPUT_FILE")" && pwd)"; STATE_FILE="$PROJECT_DIR/.yezhou.json"

PAYLOAD_FILE="$(mktemp)"; trap 'rm -f "$PAYLOAD_FILE"' EXIT
SITE_ID="$(python3 - "$INPUT_FILE" "$TITLE" "$STATE_FILE" "$PAYLOAD_FILE" <<'PY'
import json, sys
from pathlib import Path
source, title, state, payload = sys.argv[1:]
html = Path(source).read_text(encoding="utf-8")
site_id = ""
if Path(state).exists():
    try: site_id = str(json.loads(Path(state).read_text(encoding="utf-8")).get("siteId", ""))
    except (OSError, ValueError): pass
Path(payload).write_text(json.dumps({"html": html, "title": title}, ensure_ascii=False), encoding="utf-8")
print(site_id)
PY
)"

if [ -n "$SITE_ID" ]; then ENDPOINT="$BASE_URL/api/agent/sites/$SITE_ID"; METHOD="PUT"; else ENDPOINT="$BASE_URL/api/agent/sites"; METHOD="POST"; fi
RESPONSE="$(curl --fail-with-body --silent --show-error -X "$METHOD" "$ENDPOINT" -H "Authorization: Bearer $YEZHOU_API_TOKEN" -H "Content-Type: application/json; charset=utf-8" --data-binary "@$PAYLOAD_FILE")"
python3 - "$RESPONSE" "$STATE_FILE" <<'PY'
import json, sys
from pathlib import Path
result = json.loads(sys.argv[1])
if not result.get("url") or not result.get("id"): raise SystemExit(result.get("error", "Publish failed"))
Path(sys.argv[2]).write_text(json.dumps({"siteId": result["id"], "url": result["url"]}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
print("Published:" if result.get("created") else "Updated:", result["url"])
PY
