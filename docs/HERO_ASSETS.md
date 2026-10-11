# Batch 2 — Hero asset verification

> Historical batch record. Current optimized profiles, loader limits, measurements, and verification supersede the asset/runtime numbers below: see [HERO_PERFORMANCE_OPTIMIZATION.md](HERO_PERFORMANCE_OPTIMIZATION.md).


## Source inspection

Inspected with FFmpeg/ffprobe 9.0.2 after the user approved Homebrew installation. Context7 was callable and supplied FFmpeg CLI documentation; no external video API or generation service was used. No Node dependencies were added.

| Property | Verified result |
| --- | --- |
| Source | `assets/source/DroneVideo.mp4` |
| Container duration | 10.026667 seconds |
| Video stream duration | 10.000000 seconds |
| Dimensions | 1280 × 720 |
| Aspect ratio | 16:9 by raster dimensions; source SAR/DAR tags absent |
| Codec / pixel format | H.264 / yuv420p |
| Frame rate | 24/1 nominal and average; decoded timestamp intervals confirm constant cadence |
| Estimated source frames | 240 |
| Counted decoded source frames | 240 |
| First / last source timestamps | 0 / 9.958333 seconds |
| File size | 10,630,443 bytes (10.14 MiB) |
| Audio | AAC, 48 kHz, stereo; audio duration 10.026667 seconds |
| Rotation | No rotation tag/display matrix present; no correction needed |
| Scan / color metadata | Progressive; smpte170m color space, iec61966-2-1 transfer |

No crop, trim, artificial grading, sharpening, scene generation, or watermark removal was applied. The audio's slightly longer duration explains the container/video difference. The extraction covers all 240 source frames at their native cadence. The source watermark remains visible.

Source SHA-256 before and after processing:

```text
279e8283475539b00d22fd6805f45f2b78be19aeb85e626e119b3d35555e9320
```

## Final assets

| Property | Result |
| --- | --- |
| Extracted files | 240, `frame_0001.jpg`–`frame_0240.jpg`, no gaps |
| Resolution / FPS | 1280 × 720 / 24 |
| Compression | JPEG, FFmpeg q:v 4, yuvj420p |
| Sequence size | 23,112,525 bytes (22.04 MiB) |
| Average JPEG | 96,302.19 bytes (94.05 KiB) |
| Poster | 179,555 bytes (175.35 KiB) |
| Manifest | 5,161 bytes |
| Total sequence + poster + manifest | 23,297,241 bytes (22.22 MiB) |

The q:v 4 sequence is about 16% smaller than the initial q:v 3 extraction (27,500,018 bytes). Opening, middle, and final comparisons retained architectural detail at the inspected resolution. This is a visual judgment, not a perceptual benchmark. The poster is an exact copy of the first extracted JPEG, avoiding a second lossy encoding.

## Verification performed

- Every JPEG decoded successfully using FFmpeg; ffprobe verified uniform dimensions and the decoded file count.
- Independently checked exact numbering, manifest count, first/last paths, sequence byte totals, and poster identity.
- Visually inspected final frames 0001 (full exterior), 0120 (entrance approach), and 0240 (interior living space). The architecture and source watermark are visible; no blank endpoint.
- Regenerated assets successfully; unrelated test files in both output directories survived and were removed after verification.
- Missing-tool and missing-source error paths returned useful failures. An isolated symlink-output test rejected the target and preserved unrelated external files.
- Source SHA-256 matched the initial baseline after both extraction runs.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Vite dev server started successfully. HTTP 200 and exact local-file bytes were verified for the manifest, first/last JPEGs, and poster; homepage returned HTTP 200.
- No browser interaction, Lighthouse, or scroll-animation test is claimed. This batch creates no runtime motion or image preloading.

## Handoff

Run `npm run prepare:hero` to regenerate. The output manifest owns the frame count; its URLs are compatible with Vite's public directory. A future deployment under a subpath should resolve them against the application's base URL. See `README.md` for rerun safeguards and replacement-source handling.

The full JPEG sequence is larger than the compressed source video. Batch 3 must implement viewport-aware loading and bounded caching rather than fetching/decoding the entire sequence at once. A mobile-resolution variant remains future work; this batch intentionally supplies the requested first implementation at native resolution.

Ready for Batch 3 asset integration, subject to user approval. The application remains the original placeholder. A properly licensed clean source may be required for production; existing exported frames and poster are not watermark-free.
