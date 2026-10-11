import sharp from 'sharp'
import { createHash } from 'node:crypto'
import {
  closeSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync,
  openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync,
  statSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// All paths are anchored to this script, never to the caller's working directory.
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
const source = join(root, 'assets/source/DroneVideo.mp4')
const publicDir = join(root, 'public')
const framesDir = join(publicDir, 'frames')
const mediaDir = join(publicDir, 'media')
const manifestPath = join(framesDir, 'manifest.json')
const posterPath = join(mediaDir, 'hero-poster.webp')
const generator = 'aether-estates/prepare-hero/v2'
const candidates = process.argv.includes('--candidates')
if (process.argv.slice(2).some(arg => arg !== '--candidates')) throw new Error('Supported option: --candidates')
const profiles = candidates
  ? [['desktop-a',120,960],['desktop-b',96,960],['desktop-c',72,960],['mobile-a',72,720],['mobile-b',60,720],['mobile-c',48,720]]
  : [['desktop',72,960],['mobile',60,720]]
const frameName = index => `frame_${String(index).padStart(4, '0')}.webp`
const quality = 64
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const mib = (bytes) => `${(bytes / 1024 ** 2).toFixed(2)} MiB`

function run(binary, args) {
  // No shell interpolation: filenames and filters are separate arguments.
  const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 64 * 1024 ** 2 })
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error(`${binary} is missing. On macOS, install FFmpeg with approval: brew install ffmpeg`)
    }
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${binary} failed (${result.status ?? result.signal}):\n${result.stderr?.trim() || 'No diagnostic output.'}`)
  }
  return result.stdout
}

function probe(args) {
  return JSON.parse(run('ffprobe', ['-v', 'error', ...args, '-of', 'json']))
}

function rational(value) {
  const [a, b = 1] = String(value ?? '').split(/[/:]/).map(Number)
  const result = a / b
  return Number.isFinite(result) && result > 0 ? result : null
}

function assertRegularFile(path) {
  const info = lstatSync(path)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Expected a regular, non-symlink file: ${path}`)
}

function ensureSafeDirectory(path) {
  // Check every segment we create or traverse under the canonical project root.
  if (path !== root && !path.startsWith(`${root}/`)) throw new Error(`Unsafe output path: ${path}`)
  if (path === root) return
  ensureSafeDirectory(dirname(path))
  if (!existsSync(path)) mkdirSync(path)
  const info = lstatSync(path)
  if (!info.isDirectory() || info.isSymbolicLink() || realpathSync(path) !== path) {
    throw new Error(`Refusing non-directory or symlink output: ${path}`)
  }
}

function assertOwnedDirectory(path) {
  if (!existsSync(path)) return
  ensureSafeDirectory(path)
  const manifest = join(path, 'manifest.json')
  assertRegularFile(manifest)
  const old = JSON.parse(readFileSync(manifest, 'utf8'))
  if (old.generatedBy !== generator || !Number.isSafeInteger(old.frameCount) || old.frameCount < 1) {
    throw new Error(`Refusing unowned output: ${path}`)
  }
  const names = new Set(['manifest.json', ...Array.from({length:old.frameCount}, (_,i)=>frameName(i+1))])
  for (const name of readdirSync(path)) {
    if (!names.has(name)) throw new Error(`Unexpected file in generated directory: ${name}`)
    assertRegularFile(join(path,name))
  }
}

function publishBatch(entries, staging) {
  const backups = [], installed = []
  try {
    for (const [index, [staged, destination]] of entries.entries()) {
      if (existsSync(destination)) {
        const backup = join(staging, `backup-${index}`)
        renameSync(destination, backup)
        backups.push([backup,destination])
      }
      renameSync(staged,destination)
      installed.push(destination)
    }
  } catch (error) {
    for (const path of installed.reverse()) rmSync(path,{recursive:true,force:true})
    for (const [backup,path] of backups.reverse()) renameSync(backup,path)
    throw error
  }
}

let staging
let lock
const lockPath = join(root, '.prepare-hero.lock')
try {
  if (!existsSync(source)) throw new Error(`Source video not found: ${source}`)
  assertRegularFile(source)
  const sourceHash = hash(source)
  const ffmpegVersion = run('ffmpeg', ['-version']).split('\n')[0]
  const ffprobeVersion = run('ffprobe', ['-version']).split('\n')[0]
  try {
    lock = openSync(lockPath, 'wx')
    writeFileSync(lock, `${process.pid}\n`)
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error('Another preparation may be running (.prepare-hero.lock exists). Only remove a stale lock after checking its PID.')
    }
    throw error
  }

  const metadata = probe(['-count_frames', '-show_streams', '-show_format', source])
  const video = metadata.streams.find((stream) => stream.codec_type === 'video' && !stream.disposition?.attached_pic)
  if (!video) throw new Error('No usable video stream found.')
  const sourceFps = rational(video.avg_frame_rate) ?? rational(video.r_frame_rate)
  if (!sourceFps) throw new Error('Unable to determine a positive source frame rate.')
  const durationSeconds = Number(video.duration ?? metadata.format.duration)
  if (!(durationSeconds > 0)) throw new Error('Unable to determine a positive video duration.')
  const transfer = video.color_transfer
  if (transfer === 'smpte2084' || transfer === 'arib-std-b67') {
    throw new Error('HDR source detected. Supply an approved SDR export to avoid unapproved color transformations.')
  }
  const timing = probe([
    '-select_streams', String(video.index), '-show_frames',
    '-show_entries', 'frame=best_effort_timestamp_time', source,
  ]).frames.map((frame) => Number(frame.best_effort_timestamp_time))
  if (!timing.length || timing.some((time) => !Number.isFinite(time))) {
    throw new Error('Source frame timestamps could not be verified.')
  }
  const deltas = timing.slice(1).map((time, i) => time - timing[i])
  if (deltas.some((delta) => delta <= 0)) throw new Error('Non-increasing source timestamps require manual review.')
  const variableFrameRate = deltas.some((delta) => Math.abs(delta - 1 / sourceFps) > 0.001)
  const rotation = Number(video.side_data_list?.find((item) => item.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0)
  const sourceInfo = {
    path: 'assets/source/DroneVideo.mp4', sha256: sourceHash,
    fileSizeBytes: statSync(source).size,
    containerDurationSeconds: Number(metadata.format.duration), videoDurationSeconds: durationSeconds,
    width: video.width, height: video.height,
    displayAspectRatio: video.display_aspect_ratio ?? null,
    sampleAspectRatio: video.sample_aspect_ratio ?? null,
    codec: video.codec_name, pixelFormat: video.pix_fmt,
    nominalFrameRate: video.r_frame_rate, averageFrameRate: video.avg_frame_rate,
    actualAverageFps: sourceFps, variableFrameRate,
    estimatedFrameCount: Math.round(durationSeconds * sourceFps),
    decodedFrameCount: Number(video.nb_read_frames),
    firstTimestampSeconds: timing[0], lastTimestampSeconds: timing.at(-1),
    audioPresent: metadata.streams.some((stream) => stream.codec_type === 'audio'),
    audioStreams: metadata.streams.filter((stream) => stream.codec_type === 'audio').map((stream) => ({
      codec: stream.codec_name, sampleRate: stream.sample_rate, channels: stream.channels,
    })),
    rotationDegrees: rotation, fieldOrder: video.field_order ?? null,
    colorSpace: video.color_space ?? null, colorTransfer: transfer ?? null,
    tags: video.tags ?? {}, sideData: video.side_data_list ?? [],
  }
  console.log('Verified source metadata:\n' + JSON.stringify(sourceInfo, null, 2))

  ensureSafeDirectory(framesDir)
  ensureSafeDirectory(mediaDir)
  // Keep the current poster and legacy sequence until runtime verification permits retirement.
  // Refuse overwriting an unrelated root manifest or poster.
  const previousRootHash = existsSync(manifestPath) ? (assertRegularFile(manifestPath), hash(manifestPath)) : null
  const previousPosterHash = existsSync(posterPath) ? (assertRegularFile(posterPath), hash(posterPath)) : null
  if (existsSync(manifestPath)) {
    assertRegularFile(manifestPath)
    const previous = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const owner = previous.generatedBy
    if (![generator, 'aether-estates/prepare-hero/v1'].includes(owner)) throw new Error('Unowned root manifest')
  } else if (existsSync(posterPath)) throw new Error('Poster has no owned manifest')
  if (existsSync(posterPath)) assertRegularFile(posterPath)
  if (rotation !== 0 || (video.sample_aspect_ratio && !['1:1','N/A'].includes(video.sample_aspect_ratio))) {
    throw new Error('Replacement source rotation/pixel aspect needs explicit review before extraction.')
  }
  const destinationRoot = candidates ? join(root,'artifacts/hero-optimization/candidates') : join(framesDir,'v2')
  ensureSafeDirectory(destinationRoot)
  for (const [id] of profiles) assertOwnedDirectory(join(destinationRoot,id))
  staging = mkdtempSync(join(root, '.hero-preparation-'))
  const raw = join(staging, 'source')
  mkdirSync(raw)
  run('ffmpeg', ['-hide_banner','-loglevel','error','-nostdin','-n','-i',source,
    '-map',`0:${video.index}`,'-an','-sn','-dn','-fps_mode','passthrough',join(raw,'%04d.png')])
  if (readdirSync(raw).length !== timing.length) throw new Error('Decoded source count mismatch')
  const prepared = []
  for (const [id, count, maxWidth] of profiles) {
    if (count > timing.length) throw new Error('Profile would duplicate source frames')
    const directory = join(staging,id)
    mkdirSync(directory)
    // Nearest source timestamp to evenly spaced points, explicitly including both endpoints.
    const indices = Array.from({length:count}, (_,i) => {
      const target = timing[0] + i * (timing.at(-1)-timing[0])/(count-1)
      return timing.reduce((best,time,index) => Math.abs(time-target)<Math.abs(timing[best]-target) ? index : best, 0)
    })
    if (new Set(indices).size !== count || indices[0] !== 0 || indices.at(-1) !== timing.length-1) throw new Error('Invalid sampling')
    let sequenceBytes = 0
    const sequenceHash = createHash('sha256').update(sourceHash).update(String(count))
    let width, height
    for (const [index, sourceIndex] of indices.entries()) {
      const output = join(directory,frameName(index+1))
      await sharp(join(raw,`${String(sourceIndex+1).padStart(4,'0')}.png`))
        .resize({width:maxWidth,withoutEnlargement:true}).webp({quality,effort:5}).toFile(output)
      const decoded = await sharp(output).raw().toBuffer({resolveWithObject:true})
      width ??= decoded.info.width
      height ??= decoded.info.height
      if (decoded.info.width !== width || decoded.info.height !== height || width > maxWidth ||
          Math.abs(width/height-video.width/video.height) > .005) throw new Error('Output dimensions/aspect mismatch')
      sequenceBytes += statSync(output).size
      sequenceHash.update(readFileSync(output))
    }
    const prefix = `/frames/v2/${id}`
    const manifest = {
      generatedBy:generator, profile:id,
      assetVersion:sequenceHash.digest('hex').slice(0,16), frameCount:count, fps:count/durationSeconds,
      durationSeconds,width,height,filenamePattern:`${prefix}/frame_%04d.webp`,
      firstFrame:`${prefix}/${frameName(1)}`,lastFrame:`${prefix}/${frameName(count)}`,
      posterUrl:'/media/hero-poster.webp',startNumber:1,sequenceBytes,
      averageFrameBytes:sequenceBytes/count,sourceFrameIndices:indices,
      frameTimesSeconds:indices.map(i=>timing[i]-timing[0]),
      timingNote:'Nearest source frames to uniform samples spanning first through final source timestamp; fps is coverage density, not playback speed.',
      source:sourceInfo,processing:{webpQuality:quality,effort:5,sharpVersion:sharp.versions.sharp,ffmpegVersion,ffprobeVersion},
    }
    writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
    assertOwnedDirectory(join(destinationRoot,id))
    prepared.push({id,directory,manifest})
    console.log(`${id}: ${count} WebP ${width}×${height}, ${sequenceBytes} bytes (${mib(sequenceBytes)})`)
  }
  if (hash(source) !== sourceHash) throw new Error('Source changed; refusing publication')
  const entries = prepared.map(({id,directory})=>[directory,join(destinationRoot,id)])
  if (!candidates) {
    // The independent poster is byte-identical to the verified desktop opening frame.
    const stagedPoster=join(staging,'hero-poster.webp')
    copyFileSync(join(prepared[0].directory,frameName(1)),stagedPoster)
    entries.push([stagedPoster,posterPath])
    // Root manifest is a backwards-compatible desktop manifest, not another frame copy.
    const stagedRootManifest=join(staging,'manifest.json')
    writeFileSync(stagedRootManifest,JSON.stringify(prepared[0].manifest,null,2)+'\n')
    entries.push([stagedRootManifest,manifestPath])
  }
  ensureSafeDirectory(destinationRoot)
  for (const {id} of prepared) assertOwnedDirectory(join(destinationRoot,id))
  if (!candidates) {
    for (const [path, previous] of [[manifestPath,previousRootHash],[posterPath,previousPosterHash]]) {
      const current = existsSync(path) ? (assertRegularFile(path),hash(path)) : null
      if (current !== previous) throw new Error('Public metadata/poster changed during preparation; refusing publication')
    }
  }
  publishBatch(entries,staging)
  console.log('Verified all output decodes, dimensions, counts, endpoints and unchanged source SHA-256. Watermark unaltered.')

} catch (error) {
  console.error(`Hero preparation failed: ${error.message}`)
  process.exitCode = 1
} finally {
  if (staging) rmSync(staging, { recursive: true, force: true })
  if (lock !== undefined) {
    closeSync(lock)
    unlinkSync(lockPath)
  }
}
