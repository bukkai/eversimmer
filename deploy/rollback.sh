#!/usr/bin/env bash
# Goes back to the release before the one playing, and keeps the update from bringing the bad one
# back until main moves on. sudo /opt/eversimmer/current/deploy/rollback.sh
set -euo pipefail

ROOT=/opt/eversimmer
# the releases are eversimmer's, and stay so for the next update
as() { runuser -u eversimmer -- "$@"; }
playing=$(readlink -f "$ROOT/current")
previous=$(ls -1dt "$ROOT"/releases/*/ | sed 's:/$::' | grep -vx "$playing" | head -n 1 || true)
[ -n "$previous" ] || { echo "there is no earlier release to go back to" >&2; exit 1; }

basename "$playing" | as tee "$ROOT/shared/failed" >/dev/null
as ln -sfn "$previous" "$ROOT/current.new"
as mv -T "$ROOT/current.new" "$ROOT/current"
as touch "$previous" # the newest again, so cleaning up keeps it
systemctl restart eversimmer
echo "back to $(basename "$previous")"
