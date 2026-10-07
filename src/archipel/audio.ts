/**
 * Sons synthétisés (WebAudio) — aucun fichier, tout est généré.
 */

let ctx: AudioContext | null = null
let muted = false
let combo = 0
let lastCoin = 0

export function setMuted(m: boolean) { muted = m }

function ac() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  const a = ac(); if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, a.currentTime + start)
  g.gain.setValueAtTime(0, a.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur)
  o.connect(g).connect(a.destination)
  o.start(a.currentTime + start)
  o.stop(a.currentTime + start + dur + 0.02)
}

/** Pièces : la hauteur monte si l'on enchaîne les récoltes (combo). */
export function sfxCoin() {
  if (muted) return
  const now = performance.now()
  combo = now - lastCoin < 1400 ? Math.min(combo + 1, 10) : 0
  lastCoin = now
  const base = 880 * Math.pow(2, combo / 12)
  tone(base, 0, 0.12, 'sine', 0.18)
  tone(base * 1.5, 0.06, 0.18, 'sine', 0.14)
}

export function sfxTick() {
  if (muted) return
  tone(1600 + Math.random() * 400, 0, 0.04, 'triangle', 0.05)
}

export function sfxBuild() {
  if (muted) return
  tone(140, 0, 0.18, 'triangle', 0.3)
  tone(523, 0.08, 0.15, 'sine', 0.12)
  tone(659, 0.16, 0.15, 'sine', 0.12)
  tone(784, 0.24, 0.3, 'sine', 0.14)
}

export function sfxUpgrade() {
  if (muted) return
  ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.22, 'sine', 0.13))
}

export function sfxTap() {
  if (muted) return
  tone(660, 0, 0.05, 'sine', 0.06)
}

export function sfxError() {
  if (muted) return
  tone(180, 0, 0.12, 'square', 0.06)
  tone(140, 0.1, 0.16, 'square', 0.06)
}

export function sfxFanfare() {
  if (muted) return
  ;[523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.12))
}

export function haptic(ms = 10) {
  try { navigator.vibrate?.(ms) } catch { /* ignore */ }
}
