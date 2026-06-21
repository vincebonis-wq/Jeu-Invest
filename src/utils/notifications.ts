const LAST_SEEN_KEY = 'jeu-invest-last-seen'

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function sendNotification(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  new Notification(title, { body, icon: '/favicon.svg' })
}

export function scheduleOfflineReminder(): void {
  localStorage.setItem(LAST_SEEN_KEY, Date.now().toString())
}

export function checkOfflineReminder(): void {
  const last = parseInt(localStorage.getItem(LAST_SEEN_KEY) ?? '0')
  if (!last) return
  const hoursAway = (Date.now() - last) / 3_600_000
  if (hoursAway >= 8) {
    sendNotification(
      '💰 Patrimoine t\'attend !',
      `Absent depuis ${Math.round(hoursAway)}h — tes investissements ont travaillé pendant ce temps.`,
    )
  }
}
