import type { ReactNode } from 'react';

type IconName =
  | 'camera' | 'chevronDown' | 'clock' | 'folder' | 'grid' | 'layout'
  | 'monitor' | 'pause' | 'play' | 'rewind' | 'search' | 'settings'
  | 'skipBack' | 'skipForward' | 'user' | 'video' | 'zoomIn' | 'zoomOut';

export default function Icon({ name, size = 20, stroke = 1.8, className }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  const paths: Record<IconName, ReactNode> = {
    camera: <><path d="m2 7 3-2h7l2 2h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle cx="11.5" cy="13" r="3"/></>,
    chevronDown: <path d="m6 9 6 6 6-6"/>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>,
    folder: <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z"/>,
    grid: <><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><rect x="14" y="14" width="6.5" height="6.5" rx="1"/></>,
    layout: <><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M10 9.5V20"/></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    play: <path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>,
    rewind: <><path d="m11 6-6 6 6 6V6Zm8 0-6 6 6 6V6Z"/></>,
    search: <><circle cx="10.7" cy="10.7" r="6.2"/><path d="m15.5 15.5 4 4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.2 2.2-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55v.1h-3.12v-.1a1.7 1.7 0 0 0-1.03-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.2-2.2.06-.06A1.7 1.7 0 0 0 6.74 15a1.7 1.7 0 0 0-1.55-1.03h-.1v-3.12h.1a1.7 1.7 0 0 0 1.55-1.03 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.2-2.2.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.55v-.1h3.12v.1a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.2 2.2-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1.03h.1v3.12h-.1A1.7 1.7 0 0 0 19.4 15Z"/></>,
    skipBack: <><path d="M7 6v12M18 6l-8 6 8 6Z"/></>,
    skipForward: <><path d="M17 6v12M6 6l8 6-8 6Z"/></>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.8-3.3 3.2-5 7.5-5s6.7 1.7 7.5 5"/></>,
    video: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h8A2.5 2.5 0 0 1 16 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 16.5Z"/><path d="m16 10 4.2-2.2c.8-.4 1.8.1 1.8 1v6.4c0 .9-1 1.4-1.8 1L16 14"/></>,
    zoomIn: <><circle cx="10.5" cy="10.5" r="6"/><path d="M10.5 7.5v6m-3-3h6m2.2 4.2 4.3 4.3"/></>,
    zoomOut: <><circle cx="10.5" cy="10.5" r="6"/><path d="M7.5 10.5h6m2.2 4.2 4.3 4.3"/></>,
  };
  return <svg {...common} className={className}>{paths[name]}</svg>;
}
