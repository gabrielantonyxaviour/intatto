#!/bin/bash
# 1080p finals, one beat at a time through the render gate -> film/out/final/beat-NN.mp4
cd "$(dirname "$0")/remotion" || exit 1
for n in ${@:-01 02 03 04 05 06 07 08 09 10 11}; do
  for try in 1 2 3; do
    bash ../render-gate.sh npx remotion render "Beat$n" "../out/final/beat-$n.mp4" --concurrency=2 --crf=16 && break
    echo "Beat$n attempt $try failed"
  done
  echo "DONE Beat$n $(date -u +%H:%M) $(ffprobe -v error -show_entries format=duration -of csv=p=0 ../out/final/beat-$n.mp4 2>/dev/null)"
done
