#!/bin/sh
# One command: מי שילם? (Isometric People Scene, 1080x1920, 30 fps). Needs the Lemo-Opuscar library (LIB) and ffmpeg 7 on PATH.
set -e
LIB=/root/lemo-opuscar
P=$(cd "$(dirname "$0")" && pwd)
cd "$LIB"
node core/render/events.mjs "$P" --size 1080x1920
.venv/bin/python "$P/audio.py" "$P"
node core/render/video.mjs "$P" --fps 30 --workers 4 --size 1080x1920 --out "$P/out/video.mp4"
sh core/render/mux.sh "$P/out/video.mp4" "$P/mix.wav" "$P/bit-mystery.mp4" 30 0
node core/render/readcheck.mjs "$P" --size 1080x1920 > "$P/out/readcheck.txt"
