#!/bin/bash
# Render gate for the Intatto film (machine-wide render priority set by okx-claude, 25 Sep).
# Usage (from film/remotion): bash ../render-gate.sh npx remotion render <Comp> <out.mp4> --concurrency=2 [--scale=0.6667]
#  - ONE render at a time across the Intatto and Bellwether films, via the shared atomic mkdir lock
#    /tmp/bw-film-render.lock (protocol from bw-video: owner file inside, removed on release, trap on crash).
#  - Waits while live memory free (memory_pressure) is under 25%; swap alone never drains on macOS.
#  - From 18:40 UTC no new Intatto render starts: Bellwether's final render has the machine from 18:45 until
#    film/.bw-final-done exists (cg-film creates it when bw-video reports its final render is done).
# Until then, render 720p previews (--scale=0.6667).
HERE="$(cd "$(dirname "$0")" && pwd)"
LOCK=/tmp/bw-film-render.lock
swap_pct() { sysctl -n vm.swapusage | awk '{gsub("M","",$3); gsub("M","",$6); if ($3>0) printf "%d", $6*100/$3; else print 0}'; }
# macOS rarely shrinks swap once it's used, so gate on live memory pressure (free %), not swap alone.
free_pct() { memory_pressure 2>/dev/null | awk -F': ' '/free percentage/{gsub("%","",$2); print int($2)}'; }
bw_window() { local m=$((10#$(date -u +%H) * 60 + 10#$(date -u +%M))); { [ "$m" -ge $((18 * 60 + 40)) ] && [ ! -e "$HERE/.bw-final-done" ]; } || { [ "$m" -ge $((20 * 60 + 37)) ] && [ "$m" -lt $((20 * 60 + 55)) ] && [ ! -e "$HERE/.bw-v3-done" ]; }; }
release() { rm -f "$LOCK/owner" && rmdir "$LOCK" 2>/dev/null; }
while bw_window; do echo "render-gate: Bellwether's final render has the machine (18:40 UTC until its done ping); waiting"; sleep 30; done
# Wait for memory BEFORE taking the shared lock, so waiting never blocks Bellwether.
while :; do
  while [ "$(free_pct)" -lt 25 ]; do echo "render-gate: waiting (memory free $(free_pct)%, swap $(swap_pct)%)"; sleep 10; done
  if bw_window; then echo "render-gate: 18:40 UTC passed; Bellwether has the machine"; exit 75; fi
  mkdir "$LOCK" 2>/dev/null && break
  echo "render-gate: shared lock held by $(cat "$LOCK/owner" 2>/dev/null || echo unknown); waiting"; sleep 5
done
echo cg-film > "$LOCK/owner"
trap release EXIT INT TERM
echo "render-gate: go (memory free $(free_pct)%, swap $(swap_pct)%)"
nice -n 10 "$@"
