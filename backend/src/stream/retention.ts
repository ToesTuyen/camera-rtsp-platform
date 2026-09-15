import fs from 'fs';
import path from 'path';
import { config } from '../config';

/**
 * Xóa recording segment cũ hơn RECORD_RETENTION_HOURS.
 * Duyệt /storage/rec/<cameraId>/<day>/*.ts theo mtime.
 * Xóa thư mục ngày rỗng sau khi dọn.
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
  // chạy mỗi 30 phút
  return setInterval(run, 30 * 60 * 1000);
}

function cleanup(): void {
  const recRoot = path.join(config.storageRoot, 'rec');
  if (!fs.existsSync(recRoot)) return;

  const cutoff = Date.now() - config.recordRetentionHours * 3600 * 1000;
  let removed = 0;

  for (const cameraId of fs.readdirSync(recRoot)) {
    const camDir = path.join(recRoot, cameraId);
    if (!fs.statSync(camDir).isDirectory()) continue;

    for (const day of fs.readdirSync(camDir)) {
      const dayDir = path.join(camDir, day);
      if (!fs.statSync(dayDir).isDirectory()) continue;

      for (const file of fs.readdirSync(dayDir)) {
        if (!file.endsWith('.ts')) continue;
        const fp = path.join(dayDir, file);
        const st = fs.statSync(fp);
        if (st.mtimeMs < cutoff) {
          fs.unlinkSync(fp);
          removed++;
        }
      }

      // Nếu thư mục ngày không còn segment .ts nào -> xóa cả index.m3u8 + thư mục
      const remaining = fs
        .readdirSync(dayDir)
        .filter((f) => f.endsWith('.ts'));
      if (remaining.length === 0) {
        for (const f of fs.readdirSync(dayDir)) {
          fs.unlinkSync(path.join(dayDir, f));
        }
        fs.rmdirSync(dayDir);
      }
    }
  }

  if (removed > 0) {
    console.log(`[retention] removed ${removed} expired segment(s)`);
  }
}
