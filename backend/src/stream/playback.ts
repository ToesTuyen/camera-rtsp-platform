import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

export interface BrowserPlaybackState {
  status: 'ready' | 'processing' | 'error';
  playlist: string | null;
  error: string | null;
}

interface PlaybackJob extends BrowserPlaybackState {
  process?: ChildProcess;
}

/**
 * Chuyển recording HEVC đã có sang HLS H.264 khi người dùng mở Playback.
 * Bản gốc vẫn nằm nguyên ở /storage/rec; kết quả web-friendly nằm ở /playback.
 */
class BrowserPlaybackManager {
  private jobs = new Map<string, PlaybackJob>();

  prepare(cameraId: string, day: string): BrowserPlaybackState {
    const key = `${cameraId}/${day}`;
    const outputDir = path.join(config.storageRoot, 'playback', cameraId, day);
    const playlistFile = path.join(outputDir, 'index.m3u8');
    const playlistUrl = `/playback/${cameraId}/${day}/index.m3u8`;
    const sourceDir = path.join(config.storageRoot, 'rec', cameraId, day);
    if (!fs.existsSync(sourceDir)) {
      return { status: 'error', playlist: null, error: 'Không tìm thấy recording nguồn' };
    }
    const existing = this.jobs.get(key);
    if (existing?.status === 'processing') return this.publicState(existing);
    if (fs.existsSync(playlistFile)) {
      const state: PlaybackJob = { status: 'ready', playlist: playlistUrl, error: null };
      this.jobs.set(key, state);
      return this.publicState(state);
    }

    const segments = fs.readdirSync(sourceDir).filter((file) => file.endsWith('.ts')).sort();
    if (segments.length === 0) {
      return { status: 'error', playlist: null, error: 'Recording chưa có segment nào' };
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const concatFile = path.join(outputDir, '.concat.txt');
    fs.writeFileSync(concatFile, segments.map((file) => `file '${path.join(sourceDir, file).replace(/'/g, "'\\''")}'`).join('\n') + '\n');

    const job: PlaybackJob = { status: 'processing', playlist: null, error: null };
    this.jobs.set(key, job);
    const args = [
      '-hide_banner', '-loglevel', 'warning', '-y',
      '-fflags', '+genpts', '-f', 'concat', '-safe', '0', '-i', concatFile,
      '-map', '0:v:0', '-an',
      '-c:v', 'libx264', '-preset', config.browserPlaybackPreset,
      '-b:v', config.browserPlaybackBitrate, '-pix_fmt', 'yuv420p', '-g', '48',
      '-force_key_frames', `expr:gte(t,n_forced*${config.browserPlaybackSegmentSeconds})`,
      '-f', 'hls', '-hls_time', String(config.browserPlaybackSegmentSeconds),
      '-hls_list_size', '0', '-hls_flags', 'independent_segments',
      '-hls_segment_filename', path.join(outputDir, 'play_%06d.ts'), playlistFile,
    ];
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    job.process = proc;
    let lastError = '';
    proc.stderr?.on('data', (chunk: Buffer) => { lastError = chunk.toString().trim(); });
    proc.on('exit', (code) => {
      try { fs.unlinkSync(concatFile); } catch { /* ignore */ }
      job.process = undefined;
      if (code === 0 && fs.existsSync(playlistFile)) {
        job.status = 'ready';
        job.playlist = playlistUrl;
        job.error = null;
        console.log(`[playback] browser playlist ready for ${key}`);
      } else {
        job.status = 'error';
        job.playlist = null;
        job.error = lastError || `FFmpeg playback transcode thất bại (code ${code})`;
        console.error(`[playback] transcode failed for ${key}: ${job.error}`);
      }
    });
    return this.publicState(job);
  }

  private publicState(job: PlaybackJob): BrowserPlaybackState {
    return { status: job.status, playlist: job.playlist, error: job.error };
  }
}

export const browserPlaybackManager = new BrowserPlaybackManager();
