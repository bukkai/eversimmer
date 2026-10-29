#!/usr/bin/env bash
# Brings the Pi up to date with main. The new version is built in a release of its own, next to the
# one playing, and checked there (npm run check); only then does `current` point at it and the
# server restart. A version that fails is remembered and not tried again until main moves on.
# It runs as eversimmer, who owns everything it touches; the one thing it may do as root is restart
# the service (/etc/sudoers.d/eversimmer, see install.sh), so what main brings never runs as root.
# Run by eversimmer-update.timer; by hand: sudo systemctl start eversimmer-update
set -euo pipefail

ROOT=/opt/eversimmer
KEEP=2 # releases kept on the SD card: the one playing and the one before it
# a unit from before runs it as root: run install.sh again for the new one (see deploy/README.md)
[ "$(id -un)" = eversimmer ] || { echo "the update runs as eversimmer only; run install.sh again (deploy/README.md)" >&2; exit 1; }

git -C "$ROOT/repo" fetch --quiet origin main
new=$(git -C "$ROOT/repo" rev-parse origin/main)
playing=$(basename "$(readlink -f "$ROOT/current")")
[ "$new" = "$playing" ] && exit 0
[ "$new" = "$(cat "$ROOT/shared/failed" 2>/dev/null || true)" ] && exit 0

release="$ROOT/releases/$new"
echo "building $new"
rm -rf "$release"
mkdir -p "$release"
git -C "$ROOT/repo" archive "$new" | tar -x -C "$release"
# the source of exactly this version, which the server hands to anyone who asks (AGPL, see /source)
git -C "$ROOT/repo" archive --format=tar.gz --prefix=eversimmer/ "$new" > "$release/source.tar.gz"
echo "$new" > "$release/COMMIT"

# the dependencies' own install scripts stay off: nothing here needs them
if (cd "$release" && npm ci --no-audit --no-fund --ignore-scripts && npm run check && npm run build); then
  ln -sfn "$release" "$ROOT/current.new"
  mv -T "$ROOT/current.new" "$ROOT/current"
  sudo -n systemctl restart eversimmer
  echo "now playing $new"
  ls -1dt "$ROOT"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
else
  echo "$new" > "$ROOT/shared/failed"
  rm -rf "$release"
  echo "$new fails its checks; still playing $playing" >&2
  exit 1
fi
