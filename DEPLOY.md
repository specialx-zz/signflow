# VueSign 서버 배포 가이드

> 도커(Docker) 와 서버가 처음이신 분을 위한 단계별 설명입니다.

---

## 📋 준비물

| 항목 | 설명 |
|------|------|
| 리눅스 서버 | Ubuntu 20.04 / 22.04 권장 (AWS, 카페24, 가비아 VPS 등) |
| 도메인 | 예: `yourdomain.com` (가비아, 후이즈 등에서 구매) |
| DNS 설정 | `vuesign.yourdomain.com` → 서버 IP 연결 |
|          | `player.yourdomain.com` → 서버 IP 연결 |
| 서버 최소 사양 | RAM 2GB 이상, 디스크 20GB 이상 |

---

## 🗂 서버 폴더 구조

서버에 다음과 같이 파일을 배치합니다:

```
/home/ubuntu/deploy/               ← 배포 루트 폴더
├── docker-compose.yml             ← 이 프로젝트 파일
├── nginx/
│   ├── default.conf               ← 기존 Nginx 설정
│   └── vuesign.conf              ← VueSign Nginx 설정 (새로 추가)
├── vuesign/
│   ├── backend/                   ← Node.js 백엔드 소스 (Dockerfile 포함)
│   ├── frontend-dist/             ← 빌드된 관리자 앱 (dist 내용물)
│   ├── player-dist/               ← 빌드된 플레이어 앱 (dist 내용물)
│   ├── data/                      ← SQLite DB (자동 생성)
│   └── uploads/                   ← 업로드 파일 (자동 생성)
├── react-client/dist/             ← 기존 React 앱
├── certbot/                       ← SSL 인증서 (자동 생성)
└── mysql/                         ← MySQL 데이터 (자동 생성)
```

---

## 🔧 1단계 - 서버에 Docker 설치

서버에 SSH 접속 후 아래 명령어를 순서대로 실행하세요.

```bash
# 서버 패키지 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com | sh

# 현재 사용자를 docker 그룹에 추가 (sudo 없이 docker 사용 가능)
sudo usermod -aG docker $USER

# 로그아웃 후 다시 로그인 (그룹 적용)
exit
# SSH 재접속

# Docker 설치 확인
docker --version
docker compose version
```

---

## 🌐 2단계 - 도메인 DNS 설정

도메인 관리 페이지(가비아, 후이즈 등)에서 A레코드 추가:

| 레코드 타입 | 호스트 | 값 (서버 IP) |
|------------|--------|-------------|
| A | `vuesign` | `123.456.789.0` ← 내 서버 IP |
| A | `player` | `123.456.789.0` ← 내 서버 IP |

> ⏰ DNS 전파에 최대 24시간 걸릴 수 있습니다 (보통 10분~1시간)

---

## 📦 3단계 - 소스 코드 서버에 업로드

### 방법 A: Git 사용 (추천)
```bash
# 서버에서
cd /home/ubuntu
git clone https://github.com/yourname/vuesign.git deploy
cd deploy
```

### 방법 B: 직접 파일 복사 (FTP/SCP)
```bash
# 내 PC에서 (Windows PowerShell 또는 Git Bash)
scp -r D:/work/claude_project/magicinfo/* ubuntu@서버IP:/home/ubuntu/deploy/
```

---

## 🏗 4단계 - 프론트엔드 빌드 (내 PC에서)

서버에 올리기 전에 **내 PC에서** 빌드합니다.

```bash
# 관리자 앱 빌드
cd D:\work\claude_project\magicinfo\frontend
npm install
npm run build
# → frontend/dist/ 폴더 생성됨

# 플레이어 앱 빌드
cd D:\work\claude_project\magicinfo\player
npm install
npm run build
# → player/dist/ 폴더 생성됨
```

빌드된 파일을 서버로 업로드:
```bash
# 내 PC에서 (Git Bash)
# 관리자 앱
scp -r D:/work/claude_project/magicinfo/frontend/dist/* ubuntu@서버IP:/home/ubuntu/deploy/vuesign/frontend-dist/

# 플레이어 앱
scp -r D:/work/claude_project/magicinfo/player/dist/* ubuntu@서버IP:/home/ubuntu/deploy/vuesign/player-dist/
```

---

## ⚙️ 5단계 - 환경 설정 수정

서버에서 `docker-compose.yml` 을 열어 아래 항목을 수정합니다:

```bash
cd /home/ubuntu/deploy
nano docker-compose.yml
```

수정할 항목 (Ctrl+W 로 검색):

```yaml
# ⚠️ 반드시 변경할 항목들
JWT_SECRET: "change-this-secret-to-random-32chars!!"
# → 랜덤 문자열로 변경 (예: openssl rand -base64 32 명령으로 생성)

FRONTEND_URL: "https://vuesign.yourdomain.com"
# → 실제 도메인으로 변경
```

JWT_SECRET 랜덤값 생성:
```bash
openssl rand -base64 32
# 출력 예: K8mN3xP9qR2vY5wZ7aB4cD6eF1gH0iJ=
# 이 값을 JWT_SECRET 에 붙여넣기
```

Nginx 설정도 도메인 교체:
```bash
nano /home/ubuntu/deploy/nginx/vuesign.conf
# yourdomain.com 을 실제 도메인으로 모두 교체 (Ctrl+\  로 일괄 치환)
```

---

## 🔑 6단계 - SSL 인증서 발급 (HTTPS)

```bash
cd /home/ubuntu/deploy

# 1. Nginx 만 먼저 HTTP로 시작 (인증서 발급 전)
docker compose up -d react-web

# 2. certbot 으로 SSL 인증서 발급 (도메인을 실제 도메인으로 변경)
docker run --rm \
  -v ./certbot/conf:/etc/letsencrypt \
  -v ./certbot/www:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  -d vuesign.yourdomain.com \
  -d player.yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --no-eff-email

# 성공 시 출력: "Successfully received certificate."
```

---

## 🚀 7단계 - 전체 서비스 시작

```bash
cd /home/ubuntu/deploy

# 모든 서비스 시작 (백그라운드 실행)
docker compose up -d

# 시작 로그 확인
docker compose logs -f vuesign-backend

# 전체 서비스 상태 확인
docker compose ps
```

정상 시 아래와 같이 표시됩니다:
```
NAME                STATUS
settle-db           running
react-web           running
vuesign-backend    running
api-partner-1       running
api-partner-2       running
```

---

## ✅ 8단계 - 접속 확인

| URL | 설명 |
|-----|------|
| `https://vuesign.yourdomain.com` | 관리자 로그인 페이지 |
| `https://player.yourdomain.com` | 플레이어 설정 화면 |

기본 계정:
- 이메일: `admin@vuesign.com`
- 비밀번호: `admin123`

> ⚠️ 첫 로그인 후 반드시 비밀번호를 변경하세요!

---

## 🖥 DID 장치에 플레이어 설치

각 디스플레이 PC/장치에서 Chrome을 키오스크 모드로 실행합니다.

### Windows PC (DID 장치)

바탕화면에 바로가기 파일 만들기:

```
대상: "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk "https://player.yourdomain.com?server=https://vuesign.yourdomain.com&name=1층로비" --noerrdialogs --disable-infobars --no-first-run
```

`name=1층로비` 부분을 각 디스플레이 이름으로 변경하면 됩니다.

### 라즈베리파이

```bash
# /home/pi/.config/autostart/player.desktop 파일 생성
chromium-browser --kiosk \
  "https://player.yourdomain.com?server=https://vuesign.yourdomain.com&name=디스플레이1" \
  --noerrdialogs --disable-infobars
```

---

## 🔄 업데이트 방법 (소스 변경 후 재배포)

```bash
# 1. 내 PC에서 빌드
cd D:\work\claude_project\magicinfo\frontend && npm run build
cd D:\work\claude_project\magicinfo\player && npm run build

# 2. 서버에 dist 파일 업로드
scp -r frontend/dist/* ubuntu@서버IP:/home/ubuntu/deploy/vuesign/frontend-dist/
scp -r player/dist/* ubuntu@서버IP:/home/ubuntu/deploy/vuesign/player-dist/

# 3. 백엔드가 변경됐다면
scp -r backend/* ubuntu@서버IP:/home/ubuntu/deploy/vuesign/backend/

# 서버에서 백엔드만 재시작
docker compose up -d --build vuesign-backend

# 4. Nginx 설정 변경됐다면
docker compose restart react-web
```

---

## 🛠 자주 쓰는 명령어

```bash
# 전체 로그 보기
docker compose logs -f

# 특정 서비스 로그
docker compose logs -f vuesign-backend

# 서비스 재시작
docker compose restart vuesign-backend

# 전체 중지
docker compose down

# 전체 시작
docker compose up -d

# VueSign 백엔드 컨테이너 내부 접속
docker exec -it vuesign-backend sh

# DB 파일 확인
ls -lh /home/ubuntu/deploy/vuesign/data/

# 업로드 파일 확인
ls -lh /home/ubuntu/deploy/vuesign/uploads/
```

---

## 🔒 SSL 인증서 자동 갱신 설정

Let's Encrypt 인증서는 90일마다 만료됩니다. 자동 갱신 설정:

```bash
# crontab 편집
crontab -e

# 아래 줄 추가 (매월 1일 새벽 3시 자동 갱신)
0 3 1 * * cd /home/ubuntu/deploy && docker run --rm \
  -v ./certbot/conf:/etc/letsencrypt \
  -v ./certbot/www:/var/www/certbot \
  certbot/certbot renew --quiet && \
  docker compose restart react-web
```

---

## ❓ 문제 해결

### 사이트가 안 열릴 때
```bash
# 방화벽 확인 (80, 443 포트 열려있어야 함)
sudo ufw status
sudo ufw allow 80
sudo ufw allow 443

# Nginx 설정 문법 오류 확인
docker exec react-web nginx -t

# Nginx 로그 확인
docker compose logs react-web
```

### 플레이어가 서버에 연결 안 될 때
- 플레이어 URL의 `server=` 값이 `https://vuesign.yourdomain.com` 인지 확인
- 브라우저 콘솔(F12)에서 에러 메시지 확인
- 서버에서 `docker compose ps` 로 vuesign-backend 가 running 인지 확인

### 업로드가 안 될 때
```bash
# 업로드 폴더 권한 확인
ls -la /home/ubuntu/deploy/vuesign/uploads/
# 없으면 생성
mkdir -p /home/ubuntu/deploy/vuesign/uploads
chmod 755 /home/ubuntu/deploy/vuesign/uploads
```
