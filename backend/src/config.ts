import dotenv from 'dotenv';
dotenv.config();

function num(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: num(process.env.PORT, 4000),

  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://camadmin:change_me_db_pass@localhost:5432/camera_platform',

  jwtSecret: process.env.JWT_SECRET ?? 'dev_insecure_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',

  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin',

  storageRoot: process.env.STORAGE_ROOT ?? '/storage',
  recordRetentionHours: num(process.env.RECORD_RETENTION_HOURS, 72),
  recordSegmentSeconds: num(process.env.RECORD_SEGMENT_SECONDS, 600),
  hlsSegmentSeconds: num(process.env.HLS_SEGMENT_SECONDS, 2),
  hlsListSize: num(process.env.HLS_LIST_SIZE, 6),
  recordTimezone: process.env.RECORD_TIMEZONE ?? 'Asia/Ho_Chi_Minh',

  // Transcode (dùng khi camera H.265 -> H.264 cho live để trình duyệt phát được)
  transcodePreset: process.env.TRANSCODE_PRESET ?? 'veryfast',
  transcodeBitrate: process.env.TRANSCODE_BITRATE ?? '2000k',
};

export type AppConfig = typeof config;
