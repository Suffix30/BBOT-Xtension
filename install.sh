#!/bin/bash
set -euo pipefail

SOURCE_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
INSTALL_ROOT="${BBOT_XTENSION_HOME:-$HOME/.local/share/bbot-xtension}"
INSTALL_HOST_DIR="$INSTALL_ROOT/host"

mkdir -p "$INSTALL_HOST_DIR"

install -m 755 "$SOURCE_ROOT/deploy.sh" "$INSTALL_ROOT/deploy.sh"
install -m 755 "$SOURCE_ROOT/host/bbot_host.py" "$INSTALL_HOST_DIR/bbot_host.py"
install -m 644 "$SOURCE_ROOT/host/bbot_host.json" "$INSTALL_HOST_DIR/bbot_host.json"

echo "Installed BBOT Xtension runtime to $INSTALL_ROOT"
exec bash "$INSTALL_ROOT/deploy.sh"
