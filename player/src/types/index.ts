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

// ─── VueSign Phase W1: Canvas v2.0 데이터 모델 ─────────────────
// 프론트엔드(frontend/src/api/canvas.ts)와 동일한 스키마.
// 단일 페이지(flat elements), 배경이미지 + 실시간 데이터 위젯 중심.
export type WidgetKey =
  | 'weather.current'
  | 'weather.current.icon'
  | 'weather.current.temp'
  | 'weather.today.minmax'
  | 'weather.location'
  | 'weather.weekly'
  | 'air.pm.value'
  | 'air.pm.grade'
  | 'air.pm.card';

export interface WidgetConfig {
  locationId?: string;
  metric?: 'pm10' | 'pm25';
  days?: number;

  textColor?: string;
  accentColor?: string;
  fontSize?: number;
  fontFamily?: string;
  bgColor?: string;
  borderRadius?: number;

  showIcon?: boolean;
  showLocation?: boolean;
  showMinMax?: boolean;

  iconStyle?: 'filled' | 'outline';
  [key: string]: unknown;
}

export interface CanvasElement {
  id: string;
  type: 'text' | 'image' | 'widget' | string; // legacy('shape') 들어올 수 있음
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
  visible?: boolean;

  // text
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: string;
  lineHeight?: number;
  textShadow?: string;

  // image
  src?: string;
  fit?: 'contain' | 'cover' | 'fill' | string;

  // widget
  widget?: WidgetKey | string;
  config?: WidgetConfig | Record<string, unknown>;
}

export interface CanvasData {
  version: string; // '2.0' (v1 들어오면 normalize 필요)
  canvas: {
    width: number;
    height: number;
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundFit?: 'contain' | 'cover' | 'fill';
    // v1 호환
    background?: string;
    orientation?: string;
  };
  // v2.0
  elements?: CanvasElement[];
  // v1 호환 (레거시)
  pages?: Array<{
    id?: string;
    name?: string;
    duration?: number;
    transition?: string;
    elements?: CanvasElement[];
  }>;
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
