import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { getStorageStatus } from '../stream/retention';
import { browserPlaybackManager } from '../stream/playback';

const router = Router();
router.use(requireAuth);

/** Thông tin filesystem của volume storage và chính sách auto-cleanup. */
router.get('/storage', (_req, res) => {
  try {
    res.json(getStorageStatus());
  } catch (err) {
    console.error('[recordings] cannot read storage status:', err);
    res.status(500).json({ error: 'Không đọc được dung lượng storage' });
  }
});

/**
 * Liệt kê các ngày có recording của 1 camera.
 * GET /api/recordings/:cameraId/days -> ["20260911", ...]
 */
router.get('/:cameraId/days', (req, res) => {
  if (!isCameraId(req.params.cameraId)) {
    res.status(400).json({ error: 'cameraId không hợp lệ' });
    return;
  }
  const camDir = path.join(config.storageRoot, 'rec', String(req.params.cameraId));
  if (!fs.existsSync(camDir)) {
    res.json([]);
    return;
  }
  const days = fs
    .readdirSync(camDir)
    .filter((d) => fs.statSync(path.join(camDir, d)).isDirectory())
    .sort()
    .reverse();
  res.json(days);
});

/** Chuẩn bị HLS H.264 cho recording HEVC để playback/seek được trong browser. */
router.post('/:cameraId/:day/browser-playback', (req, res) => {
  const { cameraId, day } = req.params;
  if (!isCameraId(cameraId) || !isDay(day)) {
    res.status(400).json({ error: 'Camera hoặc ngày không hợp lệ' });
    return;
  }
  const from = typeof req.body?.from === 'string' ? path.basename(req.body.from) : undefined;
  res.json(browserPlaybackManager.prepare(cameraId, day, from));
});

/**
 * Liệt kê segment của 1 ngày.
 * GET /api/recordings/:cameraId/:day -> danh sách file + playlist url
 */
router.get('/:cameraId/:day', (req, res) => {
  const { cameraId, day } = req.params;
  if (!isCameraId(cameraId) || !isDay(day)) {
    res.status(400).json({ error: 'Camera hoặc ngày không hợp lệ' });
    return;
  }
  const dayDir = path.join(config.storageRoot, 'rec', String(cameraId), String(day));
  if (!fs.existsSync(dayDir)) {
    res.json({ playlist: null, segments: [] });
    return;
  }
  const files = fs.readdirSync(dayDir);
  const durations = segmentDurations(dayDir);
  const segments = files
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((f) => {
      const st = fs.statSync(path.join(dayDir, f));
      return {
        file: f,
        url: `/rec/${cameraId}/${day}/${f}`,
        size: st.size,
        mtime: st.mtime,
        started_at: startedAtFromFilename(f),
        duration_s: durations.get(f) ?? config.recordSegmentSeconds,
      };
    });
  const hasPlaylist = files.includes('index.m3u8');
  res.json({
    playlist: hasPlaylist ? `/rec/${cameraId}/${day}/index.m3u8` : null,
    segments,
  });
});

/**
 * Trả playlist playback bắt đầu từ một segment đã chọn. Playlist kết thúc tại
 * segment mới nhất hiện có để user xem lại ổn định trong khi FFmpeg vẫn ghi.
 */
router.get('/:cameraId/:day/playlist', (req, res) => {
  const { cameraId, day } = req.params;
  if (!isCameraId(cameraId) || !isDay(day)) {
    res.status(400).json({ error: 'Camera hoặc ngày không hợp lệ' });
    return;
  }
  const dayDir = path.join(config.storageRoot, 'rec', cameraId, day);
  const from = typeof req.query.from === 'string' ? path.basename(req.query.from) : '';
  if (!fs.existsSync(dayDir)) {
    res.status(404).json({ error: 'Không có recording cho ngày đã chọn' });
    return;
  }
  const segments = fs.readdirSync(dayDir).filter((file) => file.endsWith('.ts')).sort();
  const durations = segmentDurations(dayDir);
  const startIndex = from ? segments.indexOf(from) : 0;
  if (from && startIndex < 0) {
    res.status(400).json({ error: 'Segment bắt đầu không hợp lệ' });
    return;
  }
  const selected = segments.slice(Math.max(0, startIndex));
  const targetDuration = selected.reduce(
    (max, file) => Math.max(max, durations.get(file) ?? config.recordSegmentSeconds),
    1
  );
  const playlist = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${Math.ceil(targetDuration)}`,
    ...selected.flatMap((file) => [
      `#EXTINF:${(durations.get(file) ?? config.recordSegmentSeconds).toFixed(3)},`,
      `/rec/${cameraId}/${day}/${encodeURIComponent(file)}`,
    ]),
    '#EXT-X-ENDLIST',
    '',
  ].join('\n');
  res.type('application/vnd.apple.mpegurl').send(playlist);
});

function isCameraId(value: string): boolean {
  return /^\d+$/.test(value);
}

function isDay(value: string): boolean {
  return /^\d{8}$/.test(value);
}

function startedAtFromFilename(file: string): string | null {
  const match = /^rec_(\d{8})_(\d{6})\.ts$/.exec(file);
  if (!match) return null;
  const [, day, time] = match;
  return `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`;
}

function segmentDurations(dayDir: string): Map<string, number> {
  const playlist = path.join(dayDir, 'index.m3u8');
  const durations = new Map<string, number>();
  if (!fs.existsSync(playlist)) return durations;
  let pendingDuration: number | null = null;
  for (const line of fs.readFileSync(playlist, 'utf8').split(/\r?\n/)) {
    const match = /^#EXTINF:([0-9.]+)/.exec(line);
    if (match) {
      pendingDuration = Number(match[1]);
      continue;
    }
    if (pendingDuration !== null && line && !line.startsWith('#')) {
      durations.set(path.basename(line), pendingDuration);
      pendingDuration = null;
    }
  }
  return durations;
}

export default router;
