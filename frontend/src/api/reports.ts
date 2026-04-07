import client from './client'

export const reportApi = {
  getDailyReport: (date?: string) =>
    client.get('/stats/report/daily', { params: { date } }),
  getWeeklyTrend: () =>
    client.get('/stats/report/weekly'),
  getDeviceUptime: () =>
    client.get('/stats/report/devices'),
  getContentPerformance: () =>
    client.get('/stats/report/content'),
}
