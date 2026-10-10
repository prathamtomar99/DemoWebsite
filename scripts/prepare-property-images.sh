#!/bin/sh
set -eu
# Download sized WebP derivatives from the verified Unsplash image CDN.
# No runtime hotlinks; source URLs and licence notes are in docs/IMAGE_SOURCES.md.
for pair in 'woodland photo-1781269986378-a2f366df4d0f' 'horizon photo-1613977257365-aaae5a9817ff' 'courtyard photo-1777914467886-663ef9f4025e'; do
  set -- $pair
  for width in 480 800 1200; do
    curl -fsSL "https://images.unsplash.com/$2?w=$width&q=82&fm=webp" -o "public/images/$1-$width.webp"
  done
done
