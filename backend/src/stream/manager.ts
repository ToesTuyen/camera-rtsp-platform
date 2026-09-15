import { pool } from '../db';
import { startFfmpeg, FfmpegHandle, CodecMode } from './ffmpeg';
import { config } from '../config';

export interface CameraRow {
  id: number;
  name: string;
  rtsp_url: string;
  enabled: boolean;
  record: boolean;
  codec: CodecMode;
  status: string;
}

interface Worker {
  handle?: FfmpegHandle; // undefined trong lúc đang probe/spawn
  restartTimer?: NodeJS.Timeout;
  stopping: boolean;
  backoffMs: number;
}

/**
 * Quản lý một FFmpeg process cho mỗi camera đang bật.
 * Tự động khởi động lại (backoff) khi process chết (mất kết nối RTSP).
 */
class StreamManager {
  private workers = new Map<number, Worker>();
  private recordDay = this.currentRecordDay();
  private recordDayTimer?: NodeJS.Timeout;

  async bootstrap(): Promise<void> {
    const { rows } = await pool.query<CameraRow>(
      'SELECT * FROM cameras WHERE enabled = true'
    );
    for (const cam of rows) {
      this.start(cam);
    }
    // FFmpeg ghi playlist theo ngày tại thời điểm nó khởi động. Khởi động lại nhẹ các
    // camera đang record khi qua ngày để không dồn segment mới vào thư mục ngày cũ.
    this.recordDayTimer = setInterval(() => this.rollRecordingDayIfNeeded(), 30_000);
    console.log(`[stream] bootstrapped ${rows.length} camera(s)`);
  }

  private currentRecordDay(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.recordTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return `${value('year')}${value('month')}${value('day')}`;
  }

  private rollRecordingDayIfNeeded(): void {
    const nextDay = this.currentRecordDay();
    if (nextDay === this.recordDay) return;
    this.recordDay = nextDay;
    void pool.query<CameraRow>('SELECT * FROM cameras WHERE enabled = true AND record = true')
      .then(({ rows }) => {
        console.log(`[stream] recording day changed to ${nextDay}; restarting ${rows.length} camera(s)`);
        rows.forEach((cam) => void this.restart(cam.id));
      })
      .catch((err) => console.error('[stream] failed to roll recording day:', err));
  }

  private async setStatus(id: number, status: string, error?: string | null) {
    await pool
      .query(
        'UPDATE cameras SET status = $1, last_error = $2, updated_at = now() WHERE id = $3',
        [status, error ?? null, id]
      )
      .catch(() => undefined);
  }

  start(cam: CameraRow): void {
    if (this.workers.has(cam.id)) return;
    this.spawn(cam, 1000);
  }

  private spawn(cam: CameraRow, backoffMs: number): void {
    void this.setStatus(cam.id, 'connecting');

    // Đăng ký worker placeholder ngay để stop() có thể hủy trong lúc probe
    const worker: Worker = { stopping: false, backoffMs };
    this.workers.set(cam.id, worker);

    startFfmpeg(
      cam.id,
      cam.rtsp_url,
      cam.record,
      cam.codec ?? 'auto',
      (line) => {
        // ffmpeg xuất thông tin frame => coi như online
        if (/frame=|Opening|Stream mapping/i.test(line)) {
          void this.setStatus(cam.id, 'online', null);
        }
        if (/error|failed|refused|timed out|Connection/i.test(line)) {
          console.warn(`[cam ${cam.id}] ${line}`);
        }
      },
      (code) => this.onExit(cam, code)
    )
      .then((handle) => {
        // Nếu đã bị stop trong lúc probe => kill ngay
        if (worker.stopping) {
          try {
            handle.proc.kill('SIGTERM');
          } catch {
            /* ignore */
          }
          return;
        }
        worker.handle = handle;
        console.log(
          `[cam ${cam.id}] started (live codec: ${handle.liveCodec}${
            handle.liveCodec === 'h265' ? ' -> transcode H.264' : ' copy'
          })`
        );
      })
      .catch((err) => {
        console.error(`[cam ${cam.id}] failed to start ffmpeg:`, err);
        this.onExit(cam, -1);
      });
  }

  private onExit(cam: CameraRow, code: number | null): void {
    const worker = this.workers.get(cam.id);
    if (!worker || worker.stopping) {
      this.workers.delete(cam.id);
      return;
    }
    const err = `ffmpeg exited (code ${code})`;
    void this.setStatus(cam.id, 'error', err);

    // exponential backoff tối đa 30s
    const nextBackoff = Math.min(worker.backoffMs * 2, 30000);
    console.warn(`[cam ${cam.id}] ${err}, restart in ${worker.backoffMs}ms`);
    worker.restartTimer = setTimeout(() => {
      this.workers.delete(cam.id);
      this.spawn(cam, nextBackoff);
    }, worker.backoffMs);
  }

  stop(id: number): void {
    const worker = this.workers.get(id);
    if (!worker) return;
    worker.stopping = true;
    if (worker.restartTimer) clearTimeout(worker.restartTimer);
    if (worker.handle) {
      try {
        worker.handle.proc.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
    this.workers.delete(id);
    void this.setStatus(id, 'stopped', null);
  }

  async restart(id: number): Promise<void> {
    this.stop(id);
    const { rows } = await pool.query<CameraRow>(
      'SELECT * FROM cameras WHERE id = $1',
      [id]
    );
    if (rows[0] && rows[0].enabled) {
      // đợi process cũ thoát hẳn
      setTimeout(() => this.start(rows[0]), 1500);
    }
  }

  stopAll(): void {
    if (this.recordDayTimer) clearInterval(this.recordDayTimer);
    for (const id of Array.from(this.workers.keys())) {
      this.stop(id);
    }
  }
}

export const streamManager = new StreamManager();
