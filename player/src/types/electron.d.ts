/**
 * Type declarations for the Electron preload API.
 * Available at window.electronAPI when running inside Electron.
 */

interface ElectronCacheDownloadResult {
  success: boolean;
  path?: string;
  cached?: boolean;
  size?: number;
  error?: string;
}

interface ElectronDownloadProgressEvent {
  contentId: string;
  received: number;
  total: number;
  percent: number;
}

interface ElectronCacheAPI {
  /** 진행률 이벤트 포함 다운로드 (재생 직전용) */
  downloadWithProgress(url: string, contentId: string, filename: string): Promise<ElectronCacheDownloadResult>;
  /** 진행률 이벤트 구독, unsubscribe 함수 반환 */
  onDownloadProgress(callback: (data: ElectronDownloadProgressEvent) => void): () => void;
  /** 백그라운드 다운로드 (진행률 없음) */
  download(url: string, contentId: string, filename: string): Promise<ElectronCacheDownloadResult>;
  getPath(contentId: string, filename: string): Promise<string | null>;
  exists(contentId: string, filename: string): Promise<boolean>;
  stats(): Promise<{ totalSize: number; fileCount: number; cacheDir: string }>;
  clear(): Promise<{ success: boolean; error?: string }>;
  remove(contentId: string): Promise<{ success: boolean; error?: string }>;
}

interface ElectronConfigAPI {
  get(): Promise<any>;
  set(config: any): Promise<{ success: boolean; error?: string }>;
}

interface ElectronSystemAPI {
  info(): Promise<{
    platform: string;
    arch: string;
    version: string;
    electronVersion: string;
    isKiosk: boolean;
    isDev: boolean;
    cacheDir: string;
    userData: string;
  }>;
  restart(): void;
  exitKiosk(): void;
  enterKiosk(): void;
  autostart: {
    get(): Promise<boolean>;
    set(enabled: boolean): Promise<boolean>;
  };
}

interface ElectronUpdaterAPI {
  onAvailable(callback: (info: { version: string }) => void): void;
  onProgress(callback: (progress: { percent: number }) => void): void;
  onDownloaded(callback: (info: { version: string }) => void): void;
}

interface ElectronAPI {
  isElectron: true;
  platform: string;
  cache: ElectronCacheAPI;
  config: ElectronConfigAPI;
  system: ElectronSystemAPI;
  updater: ElectronUpdaterAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
