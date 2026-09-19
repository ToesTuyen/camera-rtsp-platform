import fs from 'fs';
import path from 'path';
import { config } from '../config';

export interface StorageStatus {
  label: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  used_percent: number;
  recording_bytes: number;
  recording_days: number;
  cleanup_threshold_percent: number;
  cleanup_target_percent: number;
}

interface RecordingDay {
  path: string;
  day: string;
  bytes: number;
  newestMtimeMs: number;
}

/**
 * Dọn recording theo hai chính sách an toàn:
 * - RECORD_RETENTION_HOURS > 0: xoá nguyên ngày recording đã quá hạn.
 * - Dung lượng filesystem chứa /storage >= ngưỡng: xoá nguyên ngày cũ nhất
 *   cho tới mức target. Không chạm live stream, snapshot AI, hay ngày đang ghi.
 */
export function startRetentionJob(): NodeJS.Timeout {
  const run = () => {
    try {
      cleanup();
    } catch (err) {
      console.error('[retention] error:', err);
    }
  };
  run();
  return setInterval(run, config.storageCleanupIntervalMinutes * 60 * 1000);
}

export function getStorageStatus(): StorageStatus {
  const stat = fs.statfsSync(config.storageRoot);
  const total = Number(stat.blocks) * Number(stat.bsize);
  const free = Number(stat.bavail) * Number(stat.bsize);
  const used = Math.max(0, total - free);
  const days = recordingDays();
  const recordingBytes = days.reduce((sum, day) => sum + day.bytes, 0);
  return {
    label: config.storageLabel,
    total_bytes: total,
    used_bytes: used,
    free_bytes: free,
    used_percent: total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0,
    recording_bytes: recordingBytes,
    recording_days: days.length,
    cleanup_threshold_percent: config.storageCleanupThresholdPercent,
    cleanup_target_percent: Math.min(config.storageCleanupTargetPercent, config.storageCleanupThresholdPercent),
  };
}

function cleanup(): void {
  const days = recordingDays();
  if (days.length === 0) return;

  const today = currentRecordDay();
  const cutoff = config.recordRetentionHours > 0
    ? Date.now() - config.recordRetentionHours * 3600 * 1000
    : null;
  let removed = 0;
  let removedBytes = 0;

  // Chỉ xoá ngày đã kết thúc: playlist không bị hỏng và không đụng segment FFmpeg đang ghi.
  for (const day of days) {
    if (cutoff === null || day.day >= today || day.newestMtimeMs >= cutoff) continue;
    removeDay(day, 'retention');
    removed++;
    removedBytes += day.bytes;
  }

  let status = getStorageStatus();
  if (status.used_percent >= config.storageCleanupThresholdPercent) {
    const targetPercent = Math.min(config.storageCleanupTargetPercent, config.storageCleanupThresholdPercent);
    const bytesToFree = Math.max(0, status.used_bytes - Math.floor(status.total_bytes * targetPercent / 100));
    let quotaFreed = 0;
    const candidates = recordingDays().filter((day) => day.day < today).sort((a, b) => a.day.localeCompare(b.day));

    console.warn(
      `[retention] storage is ${status.used_percent}% full (threshold ${config.storageCleanupThresholdPercent}%); freeing old recording days toward ${targetPercent}%`
    );
    for (const day of candidates) {
      if (quotaFreed >= bytesToFree) break;
      removeDay(day, 'storage quota');
      removed++;
      removedBytes += day.bytes;
      quotaFreed += day.bytes;
    }
    status = getStorageStatus();
    if (status.used_percent >= config.storageCleanupThresholdPercent) {
      console.warn(`[retention] storage is still ${status.used_percent}% full; no older completed recording day remains to remove`);
    }
  }

  if (removed > 0) {
    console.log(`[retention] removed ${removed} completed recording day(s), ${formatBytes(removedBytes)} freed`);
  }
}

function recordingDays(): RecordingDay[] {
  const recRoot = path.join(config.storageRoot, 'rec');
  if (!fs.existsSync(recRoot)) return [];
  const results: RecordingDay[] = [];

  for (const cameraId of fs.readdirSync(recRoot)) {
    const camDir = path.join(recRoot, cameraId);
    if (!fs.statSync(camDir).isDirectory()) continue;
    for (const day of fs.readdirSync(camDir)) {
      if (!/^\d{8}$/.test(day)) continue;
      const dayDir = path.join(camDir, day);
      if (!fs.statSync(dayDir).isDirectory()) continue;
      const files = fs.readdirSync(dayDir);
      let bytes = 0;
      let newestMtimeMs = 0;
      for (const file of files) {
        const filePath = path.join(dayDir, file);
        const st = fs.statSync(filePath);
        if (!st.isFile()) continue;
        bytes += st.size;
        newestMtimeMs = Math.max(newestMtimeMs, st.mtimeMs);
      }
      const browserPlaybackDir = path.join(config.storageRoot, 'playback', cameraId, day);
      if (fs.existsSync(browserPlaybackDir)) bytes += directoryBytes(browserPlaybackDir);
      const preparedPlaybackDir = path.join(config.storageRoot, 'playback', 'prepared', cameraId, day);
      if (fs.existsSync(preparedPlaybackDir)) bytes += directoryBytes(preparedPlaybackDir);
      results.push({ path: dayDir, day, bytes, newestMtimeMs });
    }
  }
  return results;
}

function removeDay(day: RecordingDay, reason: string): void {
  const cameraId = path.basename(path.dirname(day.path));
  fs.rmSync(day.path, { recursive: true, force: true });
  // Bản H.264 phục vụ browser playback là dẫn xuất của recording gốc, nên dọn
  // cùng ngày để quota thực sự được giải phóng và không để orphan files.
  fs.rmSync(path.join(config.storageRoot, 'playback', cameraId, day.day), { recursive: true, force: true });
  fs.rmSync(path.join(config.storageRoot, 'playback', 'prepared', cameraId, day.day), { recursive: true, force: true });
  console.log(`[retention] removed ${day.path} (${formatBytes(day.bytes)}, ${reason})`);
}

function directoryBytes(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    total += entry.isDirectory() ? directoryBytes(entryPath) : fs.statSync(entryPath).size;
  }
  return total;
}

function currentRecordDay(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.recordTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}${value('month')}${value('day')}`;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
