// Sons synthétisés via Web Audio API — zéro fichier externe.
// Respecte l'autoplay policy : l'AudioContext est créé à la demande.

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch { return null }
}

function note(freq: number, startOffset: number, duration: number, gain: number, type: OscillatorType = 'sine') {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.connect(g)
  g.connect(c.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime + startOffset)
  g.gain.setValueAtTime(gain, c.currentTime + startOffset)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startOffset + duration)
  osc.start(c.currentTime + startOffset)
  osc.stop(c.currentTime + startOffset + duration)
}

/** Ding discret — badge normal. */
export function playDing() {
  note(880, 0, 0.06, 0.18)
  note(1320, 0.06, 0.5, 0.12)
}

/** Double ding — badge spécial / milestone majeur. */
export function playMajorDing() {
  note(660, 0, 0.25, 0.15)
  note(880, 0.1, 0.25, 0.15)
  note(1320, 0.22, 0.55, 0.20)
}

/** Ka-ching — bouton "Encaisser" offline gains. */
export function playCashRegister() {
  note(1047, 0,    0.15, 0.12, 'triangle')
  note(1319, 0.08, 0.15, 0.12, 'triangle')
  note(1568, 0.16, 0.25, 0.14, 'triangle')
  note(2093, 0.22, 0.40, 0.10, 'sine')
}

/** Fanfare courte — liberté financière / 1er investissement. */
export function playFanfare() {
  const melody = [523, 659, 784, 1047, 784, 1047, 1319]
  melody.forEach((f, i) => note(f, i * 0.09, 0.25, 0.12))
}

/** Pop — opportunité flash saisie. */
export function playPop() {
  note(440, 0, 0.05, 0.15, 'square')
  note(880, 0.05, 0.20, 0.10, 'sine')
}

/** Buzz négatif — avertissement. */
export function playBuzz() {
  note(220, 0, 0.08, 0.12, 'sawtooth')
  note(185, 0.08, 0.20, 0.08, 'sawtooth')
}

/** Surprise positive — rendement exceptionnel. */
export function playSurprise() {
  note(523, 0,    0.10, 0.10)
  note(784, 0.07, 0.10, 0.12)
  note(1047, 0.14, 0.30, 0.14)
}
