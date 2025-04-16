#!/bin/bash

[ -d "$HOME/.mozilla/native-messaging-hosts" ] || mkdir -p "$HOME/.mozilla/native-messaging-hosts" || {
  echo "Failed to create directory $HOME/.mozilla/native-messaging-hosts"
  exit 1
}

sed "s|\USER|$(pwd)|g" ./host/bbot_host.json > ./host/bbot_host_temp.json && \
mv ./host/bbot_host_temp.json ~/.mozilla/native-messaging-hosts/bbot_host.json || {
  echo "Failed to process or copy bbot_host.json"
  exit 1
}

chmod +x ./host/bbot_host.py || {
  echo "Failed to make bbot_host.py executable"
  exit 1
}

# Detect the user's shell
SHELL_TYPE=$(basename "$SHELL")
CONFIG_FILE=""
if [ "$SHELL_TYPE" = "bash" ]; then
  CONFIG_FILE="$HOME/.bashrc"
elif [ "$SHELL_TYPE" = "zsh" ]; then
  CONFIG_FILE="$HOME/.zshrc"
else
  echo "Unsupported shell: $SHELL_TYPE. Please manually add ~/.local/bin to your PATH."
  CONFIG_FILE="$HOME/.bashrc"
fi

# Check if ~/.local/bin is already in the PATH in the config file
if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' "$CONFIG_FILE"; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CONFIG_FILE"
  echo "Added ~/.local/bin to PATH in $CONFIG_FILE"
else
  echo "~/.local/bin is already in PATH in $CONFIG_FILE"
fi

# Source the config file to apply the change in the current session
source "$CONFIG_FILE" || {
  echo "Failed to source $CONFIG_FILE. You may need to restart your terminal."
}

if ! command -v pipx >/dev/null 2>&1; then
  echo "pipx not found, installing it for user without sudo..."
  python3 -m pip install --user pipx --break-system-packages || {
    echo "Failed to install pipx. Ensure python3-pip is installed and try again."
    exit 1
  }
fi

"$HOME/.local/bin/pipx" install bbot || {
  echo "Failed to install bbot with pipx"
  exit 1
}

echo "Deployment successful!"