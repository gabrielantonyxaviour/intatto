#!/bin/bash
# Quick preview cut: the 11 rendered beat clips back to back, each with Gabriel's VO for that beat laid at its start.
# Each beat clip is exactly VO + 0.1 s (beat 11: + 2 s), so each wav is padded to its clip. No render, just ffmpeg.
# Usage: bash film/assemble-preview.sh [polished|edit]   -> film/out/intatto-preview-<source>.mp4
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${1:-polished}"
CLIPS="${CLIPS:-$HERE/storyboard/presentation/clips}"; TAG="${TAG:-preview}"
VO="$HERE/vo/gabriel/$SRC"
OUT="$HERE/out"; TMP="$OUT/.$TAG-$SRC"
SLUGS=(hook why intatto live friday saturday weekend risk model okx-ai close)
mkdir -p "$TMP"; : > "$TMP/list.txt"
for i in $(seq 1 11); do
  n=$(printf %02d "$i"); clip="$CLIPS/beat-$n.mp4"; wav="$VO/$n-${SLUGS[$((i-1))]}.wav"
  [ -f "$clip" ] || { echo "missing $clip" >&2; exit 1; }
  [ -f "$wav" ] || { echo "missing $wav" >&2; exit 1; }
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$clip")
  ffmpeg -v error -y -i "$clip" -i "$wav" -filter_complex "[1:a]aresample=48000,apad,atrim=0:$d[a]" \
    -map 0:v -map "[a]" -c:v libx264 -crf 16 -preset medium -r 30 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -ac 2 \
    -t "$d" "$TMP/$n.mp4"
  echo "file '$TMP/$n.mp4'" >> "$TMP/list.txt"
done
ffmpeg -v error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy -movflags +faststart "$OUT/intatto-$TAG-$SRC.mp4"
echo "$OUT/intatto-$TAG-$SRC.mp4 $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/intatto-$TAG-$SRC.mp4")s"
