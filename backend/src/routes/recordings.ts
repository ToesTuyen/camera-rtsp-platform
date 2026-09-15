import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

/**
 * Liệt kê các ngày có recording của 1 camera.
 * GET /api/recordings/:cameraId/days -> ["20260911", ...]
 */
router.get('/:cameraId/days', (req, res) => {
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

/**
 * Liệt kê segment của 1 ngày.
 * GET /api/recordings/:cameraId/:day -> danh sách file + playlist url
 */
router.get('/:cameraId/:day', (req, res) => {
  const { cameraId, day } = req.params;
  const dayDir = path.join(config.storageRoot, 'rec', String(cameraId), String(day));
  if (!fs.existsSync(dayDir)) {
    res.json({ playlist: null, segments: [] });
    return;
  }
  const files = fs.readdirSync(dayDir);
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
      };
    });
  const hasPlaylist = files.includes('index.m3u8');
  res.json({
    playlist: hasPlaylist ? `/rec/${cameraId}/${day}/index.m3u8` : null,
    segments,
  });
});

export default router;
