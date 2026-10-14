#!/bin/bash
# Gabriel's voice memos -> edit-ready WAVs: mono, 80 Hz high-pass, head/tail silence trimmed (0.15 s / 0.25 s kept),
# two-pass loudnorm to -16 LUFS integrated, -1.5 dBTP, 48 kHz 24-bit. Originals in original/ are never modified.
set -euo pipefail
cd "$(dirname "$0")"
PRE="highpass=f=80,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.25,areverse"
for in in original/[0-9][0-9]-*.m4a; do
  n=$(basename "$in" .m4a)
  m=$(nice -n 10 ffmpeg -hide_banner -nostats -i "$in" -ac 1 -af "$PRE,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
  read -r MI MTP MLRA MTH OFF < <(echo "$m" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['input_i'],d['input_tp'],d['input_lra'],d['input_thresh'],d['target_offset'])")
  nice -n 10 ffmpeg -hide_banner -loglevel error -y -i "$in" -ac 1 \
    -af "$PRE,loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=$MI:measured_TP=$MTP:measured_LRA=$MLRA:measured_thresh=$MTH:offset=$OFF:linear=true,aresample=48000" \
    -c:a pcm_s24le "$n.wav"
  printf "%s.wav %.2f s\n" "$n" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$n.wav")"
done
