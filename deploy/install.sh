#!/usr/bin/env bash
# First install of Eversimmer FM on a Raspberry Pi, or any Debian-like machine with systemd.
# Copy this file to the Pi and run it as root: sudo bash install.sh
# The first run makes a read-only deploy key and stops so you can add it on GitHub; run it again
# after that. Running it again later is harmless.
set -euo pipefail

REPO=git@github.com:stephanmullerNL/eversimmer.git
ROOT=/opt/eversimmer
HOME_DIR=/var/lib/eversimmer
as() { runuser -u eversimmer -- "$@"; }

[ "$(id -u)" = 0 ] || { echo "run this as root: sudo bash install.sh" >&2; exit 1; }
command -v git >/dev/null || { echo "install git first: sudo apt install git" >&2; exit 1; }
command -v node >/dev/null && node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' ||
  { echo "Node 22 or newer is needed (see deploy/README.md), found: $(node -v 2>/dev/null || echo none)" >&2; exit 1; }

id -u eversimmer &>/dev/null ||
  useradd --system --create-home --home-dir "$HOME_DIR" --shell /usr/sbin/nologin eversimmer

# a deploy key: read-only access to this one repository
key="$HOME_DIR/.ssh/id_ed25519"
if [ ! -f "$key" ]; then
  as mkdir -p -m 700 "$HOME_DIR/.ssh"
  as ssh-keygen -q -t ed25519 -N "" -C "eversimmer@$(hostname)" -f "$key"
  ssh-keyscan -t ed25519 github.com 2>/dev/null | as tee -a "$HOME_DIR/.ssh/known_hosts" >/dev/null
fi
if ! as git ls-remote "$REPO" &>/dev/null; then
  echo
  echo "Add this key on GitHub, under the repository's Settings > Deploy keys (read-only is enough):"
  echo
  cat "$key.pub"
  echo
  echo "Then run this script again."
  exit 1
fi

# eversimmer owns the releases and where `current` points; root only installs and restarts
mkdir -p "$ROOT/releases" "$ROOT/shared"
chown eversimmer: "$ROOT" "$ROOT/releases" "$ROOT/shared"
[ -e "$ROOT/shared/failed" ] && chown eversimmer: "$ROOT/shared/failed"
[ -d "$ROOT/repo/.git" ] || { mkdir -p "$ROOT/repo" && chown eversimmer: "$ROOT/repo" && as git clone --quiet "$REPO" "$ROOT/repo"; }
as git -C "$ROOT/repo" fetch --quiet origin main

if [ ! -f "$ROOT/shared/env" ]; then
  as git -C "$ROOT/repo" show origin/main:deploy/env.example > "$ROOT/shared/env"
  chown root:eversimmer "$ROOT/shared/env"
  chmod 640 "$ROOT/shared/env"
fi

for unit in eversimmer.service eversimmer-update.service eversimmer-update.timer; do
  as git -C "$ROOT/repo" show "origin/main:deploy/$unit" > "/etc/systemd/system/$unit"
done
systemctl daemon-reload
# the one thing the update may do as root
echo "eversimmer ALL=(root) NOPASSWD: $(command -v systemctl) restart eversimmer" > /etc/sudoers.d/eversimmer.new
chmod 440 /etc/sudoers.d/eversimmer.new
visudo -cqf /etc/sudoers.d/eversimmer.new
mv /etc/sudoers.d/eversimmer.new /etc/sudoers.d/eversimmer

# the first release, built and checked like every one after it
as git -C "$ROOT/repo" show origin/main:deploy/update.sh | as bash
systemctl enable --now eversimmer.service eversimmer-update.timer

echo
echo "The pot server is running on 127.0.0.1:8787. Put your Anthropic key in $ROOT/shared/env"
echo "and run: sudo systemctl restart eversimmer. For the tunnel, see deploy/README.md."
