#!/bin/bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
HOST_DIR="$ROOT_DIR/host"
HOST_SCRIPT="$HOST_DIR/bbot_host.py"
HOST_MANIFEST_TEMPLATE="$HOST_DIR/bbot_host.json"
HOST_MANIFEST_DIR="$HOME/.mozilla/native-messaging-hosts"
HOST_MANIFEST_TARGET="$HOST_MANIFEST_DIR/bbot_host.json"
PATH_EXPORT='export PATH="$HOME/.local/bin:$PATH"'

[ -f "$HOST_SCRIPT" ] || {
  echo "Missing native host script at $HOST_SCRIPT"
  exit 1
}

[ -f "$HOST_MANIFEST_TEMPLATE" ] || {
  echo "Missing native host manifest template at $HOST_MANIFEST_TEMPLATE"
  exit 1
}

[ -d "$HOST_MANIFEST_DIR" ] || mkdir -p "$HOST_MANIFEST_DIR" || {
  echo "Failed to create directory $HOST_MANIFEST_DIR"
  exit 1
}

python3 - "$HOST_MANIFEST_TEMPLATE" "$HOST_MANIFEST_TARGET" "$ROOT_DIR" <<'PY'
import pathlib
import sys

template_path = pathlib.Path(sys.argv[1])
target_path = pathlib.Path(sys.argv[2])
root_dir = sys.argv[3]

template = template_path.read_text(encoding="utf-8")
target_path.write_text(template.replace("USER", root_dir), encoding="utf-8")
PY

python3 - "$HOST_SCRIPT" <<'PY'
import pathlib
import sys

host_script = pathlib.Path(sys.argv[1])
host_script.write_text(
    host_script.read_text(encoding="utf-8").replace("\r\n", "\n"),
    encoding="utf-8",
    newline="\n",
)
PY

chmod +x "$HOST_SCRIPT" || {
  echo "Failed to make $HOST_SCRIPT executable"
  exit 1
}

for config_file in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
  [ -f "$config_file" ] || touch "$config_file"
  if ! grep -Fqx "$PATH_EXPORT" "$config_file"; then
    printf '%s\n' "$PATH_EXPORT" >> "$config_file"
  fi
done

export PATH="$HOME/.local/bin:$PATH"

if ! command -v pipx >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/pipx" ]; then
  echo "pipx not found, installing it for user without sudo..."
  python3 -m pip install --user pipx --break-system-packages || {
    echo "Failed to install pipx. Ensure python3-pip is installed and try again."
    exit 1
  }
fi

PIPX_BIN="$(command -v pipx || true)"
[ -n "$PIPX_BIN" ] || PIPX_BIN="$HOME/.local/bin/pipx"

if command -v bbot >/dev/null 2>&1 || [ -x "$HOME/.local/bin/bbot" ]; then
  if "$PIPX_BIN" upgrade bbot; then
    echo "BBOT updated."
  elif "$PIPX_BIN" install bbot; then
    echo "BBOT installed."
  else
    echo "Failed to install or update bbot with pipx"
    exit 1
  fi
else
  if "$PIPX_BIN" install bbot; then
    echo "BBOT installed."
  elif "$PIPX_BIN" upgrade bbot; then
    echo "BBOT updated."
  else
    echo "Failed to install or update bbot with pipx"
    exit 1
  fi
fi

echo "Native host registered from $ROOT_DIR"
echo "Deployment successful!"
