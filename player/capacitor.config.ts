import { CapacitorConfig } from '@capacitor/cli'

const isProd = process.env.NODE_ENV === 'production'

const config: CapacitorConfig = {
  appId: 'com.vuesign.player',
  appName: 'VueSign Player',
  webDir: 'dist',
  server: {
    // Android WebView의 오리진 스킴
    // https → origin: https://localhost (CORS에서 이 값을 허용해야 함)
    androidScheme: 'https',

    // 개발 시에만 라이브 리로드 서버 사용 (운영은 주석 처리)
    // url: 'http://192.168.1.100:5174',
    // cleartext: true,
  },
  android: {
    // 운영 환경에서는 false (API 서버도 HTTPS여야 함)
    // 개발 환경에서는 HTTP API 서버와 통신을 위해 true
    allowMixedContent: !isProd,
  },
  plugins: {
    Filesystem: {
      // 앱 내부 저장소만 사용
    },
  },
}

export default config
