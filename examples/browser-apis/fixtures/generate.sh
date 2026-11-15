#!/bin/sh
# Regenerate only these two checked-in, locally synthesized media fixtures.
# FFmpeg is optional: ordinary example builds use the existing assets.
set -eu
cd "$(dirname "$0")/.."
ffmpeg -y -hide_banner -loglevel error -f lavfi \
  -i "nullsrc=s=480x270:r=24,geq=r='80+65*sin(X/87+sin(Y/70+T)*2+T)':g='95+75*sin(Y/67+sin(X/90-T)*2+T+2)':b='125+90*sin((X+Y)/99+T+4)'" \
  -t 3 -c:v libvpx -b:v 180k -g 24 -an -f ivf fixtures/aurora.ivf
ffmpeg -y -hide_banner -loglevel error -i fixtures/aurora.ivf -c copy public/media/aurora.webm
