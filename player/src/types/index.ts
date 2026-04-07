export interface DeviceConfig {
  serverUrl: string;
  deviceName: string;
  deviceId: string;
  registeredAt: string;
}

export interface ContentItem {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'HTML' | 'URL' | 'AUDIO' | 'DOCUMENT' | 'CANVAS';
  fileUrl: string;
  duration: number; // seconds
  thumbnailUrl?: string;
  canvasData?: CanvasData;
}

// Canvas rendering types
export interface CanvasData {
  version: string;
  canvas: {
    width: number;
    height: number;
    orientation: string;
    background: string;
  };
  pages: CanvasPage[];
}

export interface CanvasPage {
  id: string;
  name: string;
  duration: number;
  transition: string;
  elements: CanvasElement[];
}

export interface CanvasElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  opacity: number;
  rotation: number;
  locked?: boolean;
  visible?: boolean;
  // Text
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: string;
  lineHeight?: number;
  // Shape
  shape?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  // Image
  src?: string;
  fit?: string;
  // Widget
  widget?: string;
  config?: Record<string, unknown>;
  // Animation
  animation?: {
    enter?: string;
    exit?: string;
    loop?: string;
    duration?: number;
    delay?: number;
    easing?: string;
  };
}

export interface PlaylistItem {
  id: string;
  content: ContentItem;
  duration: number;
  order: number;
  transition?: string; // 'none' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'zoom-in' | 'blur'
}

export interface Playlist {
  id: string;
  name: string;
  type: string;
  items: PlaylistItem[];
}

export interface ScheduleCondition {
  tagKey: string;
  tagValue: string;
  priority: number;
  playlist: Playlist | null;
}

export interface ScheduleEntry {
  id: string;
  playlist: Playlist | null;
  layout?: import('../components/ZoneLayoutPlayer').Layout | null;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  startDate: string; // YYYY-MM-DD
  endDate: string;
  repeat: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ...
  conditions?: ScheduleCondition[]; // V5.2: 조건부 재생
}

export interface ChannelData {
  id: string;
  name: string;
  items: PlaylistItem[];
}

export interface WallInfo {
  inWall: boolean;
  wallId?: string;
  wallName?: string;
  rows?: number;
  cols?: number;
  row?: number;
  col?: number;
  transform?: {
    css: string;
    transformOrigin: string;
  };
}

export interface EmergencyMessage {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'DANGER' | 'CUSTOM';
  bgColor: string;
  textColor: string;
  fontSize: number;
  displayMode: 'OVERLAY' | 'FULLSCREEN' | 'TICKER';
  priority: number;
  expiresAt?: string;
}

export interface DeviceStatus {
  isOnline: boolean;
  currentContent: string | null;
  currentPlaylist: string | null;
  currentSchedule: string | null;
  volume: number;
  brightness: number;
  isPlaying: boolean;
}

export interface ContentSyncStatus {
  isSyncing: boolean;
  downloaded: number;
  skipped: number;
  failed: number;
  total: number;
  version: number;
  lastSyncAt: string | null;
}

export type RemoteCommand =
  | 'PLAY'
  | 'PAUSE'
  | 'NEXT'
  | 'PREV'
  | 'VOLUME_UP'
  | 'VOLUME_DOWN'
  | 'VOLUME_SET'
  | 'BRIGHTNESS'
  | 'MUTE'
  | 'POWER_OFF'
  | 'POWER_ON'
  | 'POWER_TOGGLE'
  | 'REFRESH'
  | 'RESTART'
  | 'SCREENSHOT';

export interface RemoteCommandPayload {
  command: RemoteCommand;
  value?: number;
  deviceId?: string;
  params?: { value?: number; level?: number; [key: string]: unknown };
}
