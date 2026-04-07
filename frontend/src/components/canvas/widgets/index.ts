// V4 Phase 12b + Phase 16: Widget Registry
export { default as ClockWidget, clockWidgetDefaults } from './ClockWidget'
export { default as WeatherWidget, weatherWidgetDefaults } from './WeatherWidget'
export { default as RSSWidget, rssWidgetDefaults } from './RSSWidget'
export { default as QRCodeWidget, qrcodeWidgetDefaults } from './QRCodeWidget'
export { default as VideoWidget, videoWidgetDefaults } from './VideoWidget'
export { default as WebpageWidget, webpageWidgetDefaults } from './WebpageWidget'
export { default as SpreadsheetWidget, spreadsheetWidgetDefaults } from './SpreadsheetWidget'
export { default as ChartWidget, chartWidgetDefaults } from './ChartWidget'

export const widgetRegistry = {
  clock: { name: '디지털 시계', defaults: () => import('./ClockWidget').then(m => m.clockWidgetDefaults) },
  weather: { name: '날씨', defaults: () => import('./WeatherWidget').then(m => m.weatherWidgetDefaults) },
  rss: { name: 'RSS 뉴스', defaults: () => import('./RSSWidget').then(m => m.rssWidgetDefaults) },
  qrcode: { name: 'QR코드', defaults: () => import('./QRCodeWidget').then(m => m.qrcodeWidgetDefaults) },
  video: { name: '비디오', defaults: () => import('./VideoWidget').then(m => m.videoWidgetDefaults) },
  webpage: { name: '웹페이지', defaults: () => import('./WebpageWidget').then(m => m.webpageWidgetDefaults) },
  spreadsheet: { name: '스프레드시트', defaults: () => import('./SpreadsheetWidget').then(m => m.spreadsheetWidgetDefaults) },
  chart: { name: '차트', defaults: () => import('./ChartWidget').then(m => m.chartWidgetDefaults) },
}
