# VueSign Player

DID (Digital Information Display) web player for the VueSign system. Runs in a browser (Chrome kiosk mode) on display devices and connects to the VueSign management server.

## Development

### Prerequisites
- Node.js 18+
- VueSign backend running on port 3001

### Install & Run

```bash
cd player
npm install
npm run dev
```

Open: http://localhost:5174

### First-time Setup

On first launch, the Setup Screen appears:

1. Enter the **Server URL** (e.g., `http://192.168.1.100:3001`)
2. Enter a **Device Name** (e.g., `Lobby-Display-1`)
3. Click **연결 및 등록** — the player registers with the server and begins playback

Config is saved to `localStorage` and persists across reloads.

---

## URL Parameters (Auto-Config)

Skip the setup screen by passing parameters in the URL:

```
http://localhost:5174/?server=http://192.168.1.100:3001&name=Lobby-Display-1
```

| Parameter | Description |
|-----------|-------------|
| `server`  | VueSign backend URL |
| `name`    | Device display name |

If both are provided, the player auto-registers without showing the setup screen.

---

## Kiosk Mode (Chrome)

### Windows

```batch
"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk ^
  --noerrdialogs ^
  --disable-infobars ^
  --disable-session-crashed-bubble ^
  --no-first-run ^
  --start-fullscreen ^
  "http://localhost:5174/?server=http://192.168.1.100:3001&name=Lobby-Display-1"
```

### With auto-start on Windows boot

Create a shortcut in:
`C:\Users\<user>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\`

### Linux / Raspberry Pi

```bash
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  "http://localhost:5174/?server=http://192.168.1.100:3001&name=Lobby-Display-1"
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F1` | Toggle OSD (On-Screen Display info overlay) |
| `F11` | Toggle fullscreen |
| `Space` | Play / Pause |
| `Arrow Right` | Next playlist item |
| `Arrow Left` | Previous playlist item |
| `Arrow Up` | Volume +10% |
| `Arrow Down` | Volume -10% |
| `Ctrl +` | Brightness +10% |
| `Ctrl -` | Brightness -10% |
| `Ctrl+Shift+Esc` | Show setup reset dialog |
| Long press (2s) | Toggle OSD (touch screens) |

---

## Architecture

```
App.tsx
  ├── SetupScreen          First-time setup (server URL + device name)
  ├── ConnectingScreen     Animated connection indicator
  └── PlayerCore           Main player (after setup)
       ├── PlaylistPlayer  Cycles through playlist items with timers
       │    └── ContentRenderer  Renders IMAGE / VIDEO / HTML / URL / AUDIO
       ├── DefaultScreen   Clock + particles when no schedule is active
       ├── OSDOverlay       Info overlay (device name, schedule, clock, status)
       ├── OfflineNotice    Toast when server disconnects
       └── RemoteControlHandler  Keyboard + socket remote control
```

### Hooks

| Hook | Responsibility |
|------|----------------|
| `useSocket` | Socket.IO connection, event handling, status reporting |
| `useSchedule` | Checks active schedule every minute, loads playlist |
| `useOfflineCache` | Preloads content to IndexedDB for offline playback |

### Offline Behavior

1. Content is cached in IndexedDB (via `idb`) as Blobs on first load.
2. If the server disconnects, cached Blobs are served as `blob://` URLs.
3. The Service Worker (`public/sw.js`) caches static assets for full offline startup.
4. Socket.IO automatically reconnects every 10 seconds.

---

## Build for Production

```bash
npm run build
```

Output in `dist/`. Serve with any static file server or nginx.

```bash
# Quick preview
npm run preview   # http://localhost:4173
```

---

## Backend API Endpoints (Player-specific)

These endpoints require no authentication (called directly by the kiosk browser):

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/devices/register` | Register / update device |
| `GET`  | `/api/devices/:deviceId/schedules` | Get schedules for this device |
| `POST` | `/api/devices/:deviceId/status` | Report playback status |
| `POST` | `/api/devices/:deviceId/screenshot` | Upload screenshot |
| `GET`  | `/api/health` | Server health check |

## Socket.IO Events

### Player emits
| Event | Payload |
|-------|---------|
| `device:register` | `{ deviceId, deviceName, playerVersion }` |
| `device:status` | `{ deviceId, status: { isPlaying, volume, ... } }` |
| `device:screenshot` | `{ deviceId, data: ArrayBuffer }` |

### Player receives
| Event | Payload |
|-------|---------|
| `remote:command` | `{ command, value }` |
| `remote:screenshot` | _(no payload — triggers capture)_ |
| `schedule:update` | _(triggers schedule refresh)_ |
| `content:update` | _(triggers content reload)_ |
| `device:ping` | `{ timestamp }` |
