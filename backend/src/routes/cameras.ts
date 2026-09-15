import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { streamManager, CameraRow } from '../stream/manager';

const router = Router();
router.use(requireAuth);

// Danh sách camera
router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, rtsp_url, enabled, record, codec, ai_enabled, ai_rtsp_url,
            ai_fps, ai_confidence, ai_labels, status, last_error, updated_at
     FROM cameras ORDER BY id`
  );
  res.json(rows);
});

// Chi tiết 1 camera
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM cameras WHERE id = $1', [
    req.params.id,
  ]);
  if (!rows[0]) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(rows[0]);
});

// Thêm camera
router.post('/', async (req, res) => {
  const {
    name,
    rtsp_url,
    enabled = true,
    record = true,
    codec = 'auto',
    ai_enabled = false,
    ai_rtsp_url = null,
    ai_fps = 2,
    ai_confidence = 0.5,
    ai_labels = ['person', 'car', 'motorcycle'],
  } = req.body ?? {};
  if (!name || !rtsp_url) {
    res.status(400).json({ error: 'name and rtsp_url required' });
    return;
  }
  if (!['auto', 'h264', 'h265'].includes(codec)) {
    res.status(400).json({ error: 'codec must be auto|h264|h265' });
    return;
  }
  if (!isAiSettingsValid(ai_fps, ai_confidence, ai_labels)) {
    res.status(400).json({ error: 'ai_fps must be 0.1..10, ai_confidence 0..1, ai_labels must be a string array' });
    return;
  }
  const { rows } = await pool.query<CameraRow>(
    `INSERT INTO cameras (
       name, rtsp_url, enabled, record, codec, ai_enabled, ai_rtsp_url, ai_fps, ai_confidence, ai_labels
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [name, rtsp_url, enabled, record, codec, ai_enabled, ai_rtsp_url || null, ai_fps, ai_confidence, ai_labels]
  );
  const cam = rows[0];
  if (cam.enabled) streamManager.start(cam);
  res.status(201).json(cam);
});

// Cập nhật camera
router.put('/:id', async (req, res) => {
  const { name, rtsp_url, enabled, record, codec, ai_enabled, ai_rtsp_url, ai_fps, ai_confidence, ai_labels } = req.body ?? {};
  if (codec !== undefined && !['auto', 'h264', 'h265'].includes(codec)) {
    res.status(400).json({ error: 'codec must be auto|h264|h265' });
    return;
  }
  if ((ai_fps !== undefined || ai_confidence !== undefined || ai_labels !== undefined) &&
    !isAiSettingsValid(ai_fps ?? 2, ai_confidence ?? 0.5, ai_labels ?? ['person', 'car', 'motorcycle'])) {
    res.status(400).json({ error: 'ai_fps must be 0.1..10, ai_confidence 0..1, ai_labels must be a string array' });
    return;
  }
  const { rows } = await pool.query<CameraRow>(
    `UPDATE cameras SET
       name = COALESCE($1, name),
       rtsp_url = COALESCE($2, rtsp_url),
       enabled = COALESCE($3, enabled),
       record = COALESCE($4, record),
       codec = COALESCE($5, codec),
       ai_enabled = COALESCE($6, ai_enabled),
       ai_rtsp_url = CASE WHEN $7::text = '' THEN NULL ELSE COALESCE($7, ai_rtsp_url) END,
       ai_fps = COALESCE($8, ai_fps),
       ai_confidence = COALESCE($9, ai_confidence),
       ai_labels = COALESCE($10, ai_labels),
       updated_at = now()
     WHERE id = $11 RETURNING *`,
    [
      name ?? null, rtsp_url ?? null, enabled ?? null, record ?? null, codec ?? null,
      ai_enabled ?? null, ai_rtsp_url ?? null, ai_fps ?? null, ai_confidence ?? null,
      ai_labels ?? null, req.params.id,
    ]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const cam = rows[0];
  // Áp dụng thay đổi lên worker
  if (cam.enabled) {
    await streamManager.restart(cam.id);
  } else {
    streamManager.stop(cam.id);
  }
  res.json(cam);
});

// Xóa camera
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  streamManager.stop(id);
  await pool.query('DELETE FROM cameras WHERE id = $1', [id]);
  res.status(204).end();
});

// Điều khiển start/stop thủ công
router.post('/:id/start', async (req, res) => {
  const { rows } = await pool.query<CameraRow>(
    'SELECT * FROM cameras WHERE id = $1',
    [req.params.id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  await pool.query('UPDATE cameras SET enabled = true WHERE id = $1', [rows[0].id]);
  streamManager.start({ ...rows[0], enabled: true });
  res.json({ ok: true });
});

router.post('/:id/stop', async (req, res) => {
  const id = Number(req.params.id);
  await pool.query('UPDATE cameras SET enabled = false WHERE id = $1', [id]);
  streamManager.stop(id);
  res.json({ ok: true });
});

export default router;

function isAiSettingsValid(fps: unknown, confidence: unknown, labels: unknown): boolean {
  return typeof fps === 'number' && Number.isFinite(fps) && fps >= 0.1 && fps <= 10 &&
    typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1 &&
    Array.isArray(labels) && labels.every((label) => typeof label === 'string' && label.trim().length > 0);
}
