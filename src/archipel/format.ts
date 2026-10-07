export function fmtEur(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} €`
}

export function fmtShort(n: number) {
  const a = Math.abs(n)
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',')} M`
  if (a >= 1e4) return `${Math.round(n / 1e3)} k`
  if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace('.', ',')} k`
  return `${Math.round(n)}`
}

export function fmtPct(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits).replace('.', ',')} %`
}
