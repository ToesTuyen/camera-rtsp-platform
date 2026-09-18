const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? '/api';

export interface Camera {
  id: number;
  name: string;
  rtsp_url: string;
  enabled: boolean;
  record: boolean;
  codec: 'auto' | 'h264' | 'h265';
  ai_enabled?: boolean;
  ai_rtsp_url?: string | null;
  ai_fps?: number;
  ai_confidence?: number;
  ai_labels?: string[];
  status: string;
  last_error?: string | null;
  updated_at?: string;
}

export interface DetectionEvent {
  id: number;
  camera_id: number;
  camera_name: string;
  detected_at: string;
  label: string;
  confidence: number;
  snapshot_url: string | null;
  metadata: { box?: number[]; ai_fps?: number };
}

export interface OnvifProfile {
  token: string;
  name: string;
  stream_uri: string;
  codec: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  bitrate: number | null;
}

export interface OnvifProbeResult {
  device: {
    manufacturer: string | null;
    model: string | null;
    firmware_version: string | null;
    serial_number: string | null;
  };
  profiles: OnvifProfile[];
  suggested_main_uri: string;
  suggested_sub_uri: string | null;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  async login(username: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return handle<{ token: string; user: any }>(res);
  },

  async listCameras() {
    const res = await fetch(`${API_BASE}/cameras`, { headers: authHeaders() });
    return handle<Camera[]>(res);
  },

  async getCamera(id: number) {
    const res = await fetch(`${API_BASE}/cameras/${id}`, { headers: authHeaders() });
    return handle<Camera>(res);
  },

  async createCamera(data: Partial<Camera>) {
    const res = await fetch(`${API_BASE}/cameras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handle<Camera>(res);
  },

  async updateCamera(id: number, data: Partial<Camera>) {
    const res = await fetch(`${API_BASE}/cameras/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handle<Camera>(res);
  },

  async probeOnvif(data: { url: string; username: string; password: string }) {
    const res = await fetch(`${API_BASE}/cameras/onvif/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handle<OnvifProbeResult>(res);
  },

  async deleteCamera(id: number) {
    const res = await fetch(`${API_BASE}/cameras/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handle<void>(res);
  },

  async recordingDays(cameraId: number) {
    const res = await fetch(`${API_BASE}/recordings/${cameraId}/days`, {
      headers: authHeaders(),
    });
    return handle<string[]>(res);
  },

  async recordingDay(cameraId: number, day: string) {
    const res = await fetch(`${API_BASE}/recordings/${cameraId}/${day}`, {
      headers: authHeaders(),
    });
    return handle<{ playlist: string | null; segments: any[] }>(res);
  },

  async listEvents(filters: { cameraId?: number; from?: string; to?: string; label?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const res = await fetch(`${API_BASE}/events?${query.toString()}`, { headers: authHeaders() });
    return handle<DetectionEvent[]>(res);
  },
};
