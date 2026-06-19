import { useEffect, useState } from 'react'

// Confetti CSS-only — 30 particules animées, disparaît automatiquement.
const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#3b82f6', '#a855f7', '#f97316']
const COUNT = 36

interface Particle {
  id: number
  color: string
  left: string
  delay: string
  duration: string
  size: number
  shape: 'square' | 'circle'
}

function makeParticles(): Particle[] {
  return Array.from({ length: COUNT }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    left: `${(i / COUNT) * 100 + Math.random() * (100 / COUNT)}%`,
    delay: `${Math.random() * 0.5}s`,
    duration: `${0.9 + Math.random() * 0.8}s`,
    size: 6 + Math.floor(Math.random() * 7),
    shape: Math.random() > 0.5 ? 'square' : 'circle',
  }))
}

interface ConfettiProps {
  active: boolean
  duration?: number // ms avant disparition (défaut 2500)
}

export function Confetti({ active, duration = 2500 }: ConfettiProps) {
  const [particles] = useState<Particle[]>(makeParticles)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) { setVisible(false); return }
    setVisible(true)
    const t = setTimeout(() => setVisible(false), duration)
    return () => clearTimeout(t)
  }, [active, duration])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            animation: `confetti-fall ${p.duration} ${p.delay} ease-in forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
