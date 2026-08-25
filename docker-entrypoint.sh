#!/bin/sh
set -e
mkdir -p /app/data
# seed skills into persistent volume on first boot
if [ ! -f /app/skills/manifest.json ]; then
  cp -rn /app/skills-init/. /app/skills/ 2>/dev/null || true
fi
cd /app
exec node server.js
