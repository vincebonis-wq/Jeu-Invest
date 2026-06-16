// ============================================================================
// Formatage monétaire, pourcentages, dates.
// ============================================================================

const eurFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const eurFormatterCents = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formate en euros sans décimales : 12 500 € */
export function formatEuro(value: number): string {
  return eurFormatter.format(Math.round(value))
}

/** Formate en euros avec décimales (petits montants). */
export function formatEuroCents(value: number): string {
  return eurFormatterCents.format(value)
}

/** Format compact : 1,2 M€, 340 k€, 850 €. */
export function formatEuroCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')} M€`
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1).replace('.', ',')} k€`
  }
  return `${sign}${Math.round(abs)} €`
}

/** Pourcentage : 0.085 -> "+8,5 %" */
export function formatPercent(value: number, withSign = false): string {
  const pct = value * 100
  const sign = withSign && pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1).replace('.', ',')} %`
}

/** Signé avec euro : +1 200 € / -340 € */
export function formatEuroSigned(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatEuro(value)}`
}

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

const MONTHS_FR_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]

/** "13 juin 2026" */
export function formatGameDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** "juin 2026" */
export function formatMonthYear(iso: string): string {
  const d = new Date(iso)
  return `${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** "juin 26" pour axes de graphiques */
export function formatMonthShort(iso: string): string {
  const d = new Date(iso)
  return `${MONTHS_FR_SHORT[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Formate une durée en ms en texte humain : "3 j 4 h", "12 h 30 min", "45 min". */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0 min'
  const totalMinutes = Math.ceil(ms / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return hours > 0 ? `${days} j ${hours} h` : `${days} j`
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
  return `${minutes} min`
}
