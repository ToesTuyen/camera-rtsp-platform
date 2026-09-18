import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface Props {
  src: string; // .m3u8 url
  live?: boolean;
  controls?: boolean;
}

/** Player HLS dùng hls.js, fallback native HLS (Safari). */
export default function HlsPlayer({ src, live = false, controls = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({
        lowLatencyMode: live,
        liveSyncDurationCount: 3,
        enableWorker: true,
        xhrSetup(xhr) {
          const token = localStorage.getItem('token');
          if (token && src.startsWith('/api/')) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        },
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => undefined);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => undefined);
      });
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [src, live]);

  return (
    <video
      ref={videoRef}
      controls={controls}
      muted
      playsInline
      style={{ width: '100%', height: '100%', background: '#000', borderRadius: controls ? 8 : 0 }}
    />
  );
}
