import { Cam } from 'onvif/promises';

export type OnvifProbeInput = {
  url: string;
  username: string;
  password: string;
};

export type OnvifProfile = {
  token: string;
  name: string;
  stream_uri: string;
  codec: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  bitrate: number | null;
};

export type OnvifProbeResult = {
  device: {
    manufacturer: string | null;
    model: string | null;
    firmware_version: string | null;
    serial_number: string | null;
  };
  profiles: OnvifProfile[];
  suggested_main_uri: string;
  suggested_sub_uri: string | null;
};

/**
 * Đọc thông tin Profile S/T từ ONVIF. Kết quả chỉ trả URI RTSP không chứa
 * username/password; web sẽ ghép credential người dùng vừa nhập vào URI đó.
 */
export async function probeOnvif(input: OnvifProbeInput): Promise<OnvifProbeResult> {
  const endpoint = parseOnvifUrl(input.url);
  const camera = new Cam({
    hostname: endpoint.hostname,
    port: endpoint.port,
    path: endpoint.path,
    useSecure: endpoint.useSecure,
    // Camera thường dùng chứng chỉ tự ký cho giao diện/ONVIF HTTPS.
    secureOpts: { rejectUnauthorized: false },
    username: input.username,
    password: input.password,
    timeout: 10_000,
    // Không tin XAddr có hostname nội bộ sai do camera trả về.
    preserveAddress: true,
  });

  await camera.connect();
  const information = await camera.getDeviceInformation().catch(() => ({}));
  const rawProfiles = await camera.getProfiles();
  const profiles: OnvifProfile[] = [];

  if (!Array.isArray(rawProfiles)) {
    throw new Error('Camera không trả về ONVIF media profile nào');
  }

  for (const [index, rawProfile] of rawProfiles.entries()) {
    const profile = asObject(rawProfile);
    const token = readString(asObject(profile.$), 'token') ?? readString(profile, 'token');
    if (!token) continue;

    try {
      const stream = await (camera as unknown as {
        getStreamUri(options: { protocol: string; profileToken: string }): Promise<{ uri?: string }>;
      }).getStreamUri({ protocol: 'RTSP', profileToken: token });
      const streamUri = readString(asObject(stream), 'uri');
      if (!streamUri || !streamUri.toLowerCase().startsWith('rtsp://')) continue;

      const encoder = asObject(profile.videoEncoderConfiguration);
      const resolution = asObject(encoder.resolution);
      profiles.push({
        token,
        name: readString(profile, 'name') ?? `Profile ${index + 1}`,
        stream_uri: streamUri,
        codec: readString(encoder, 'encoding')?.toLowerCase() ?? null,
        width: readNumber(resolution, 'width'),
        height: readNumber(resolution, 'height'),
        fps: readNumber(encoder, 'rateControl', 'frameRateLimit'),
        bitrate: readNumber(encoder, 'rateControl', 'bitrateLimit'),
      });
    } catch {
      // Một profile lỗi không được làm hỏng các profile còn lại.
    }
  }

  if (profiles.length === 0) {
    throw new Error('Không lấy được RTSP URI từ ONVIF profile nào');
  }

  const byResolution = [...profiles].sort((a, b) => resolutionScore(b) - resolutionScore(a));
  const suggestedMain = byResolution[0];
  const suggestedSub = byResolution.find((profile) => profile.token !== suggestedMain.token) ?? null;
  const device = asObject(information);

  return {
    device: {
      manufacturer: readString(device, 'manufacturer'),
      model: readString(device, 'model'),
      firmware_version: readString(device, 'firmwareVersion'),
      serial_number: readString(device, 'serialNumber'),
    },
    profiles: byResolution,
    suggested_main_uri: suggestedMain.stream_uri,
    suggested_sub_uri: suggestedSub?.stream_uri ?? null,
  };
}

export function validateOnvifInput(value: unknown): OnvifProbeInput | null {
  const body = asObject(value);
  const url = readString(body, 'url')?.trim();
  const username = readString(body, 'username')?.trim();
  const password = readString(body, 'password');
  if (!url || !username || password === null) return null;
  try {
    parseOnvifUrl(url);
  } catch {
    return null;
  }
  return { url, username, password };
}

export function safeOnvifError(error: unknown, password: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return (password ? message.split(password).join('<hidden>') : message).slice(0, 500);
}

function parseOnvifUrl(value: string): {
  hostname: string;
  port: number;
  path: string;
  useSecure: boolean;
} {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('invalid ONVIF URL');
  }
  const useSecure = url.protocol === 'https:';
  const port = Number(url.port || (useSecure ? '443' : '80'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid ONVIF port');
  return {
    hostname: url.hostname,
    port,
    path: `${url.pathname || '/onvif/device_service'}${url.search}`,
    useSecure,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readString(object: Record<string, unknown>, ...path: string[]): string | null {
  let value: unknown = object;
  for (const key of path) value = asObject(value)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(object: Record<string, unknown>, ...path: string[]): number | null {
  let value: unknown = object;
  for (const key of path) value = asObject(value)[key];
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function resolutionScore(profile: OnvifProfile): number {
  return (profile.width ?? 0) * (profile.height ?? 0);
}
