import { useEffect, useRef, useState } from 'react'
import { formatEuro } from '../../utils/formatting'

interface NumberTickerProps {
  value: number
  className?: string
  format?: (n: number) => string
  duration?: number
}

/**
 * Compteur animé : interpole en douceur vers la nouvelle valeur.
 * Idéal pour le patrimoine qui monte en temps réel.
 */
export function NumberTicker({
  value,
  className,
  format = formatEuro,
  duration = 600,
}: NumberTickerProps) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const startRef = useRef<number>(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    fromRef.current = display
    startRef.current = performance.now()
    const from = fromRef.current
    const to = value

    const animate = (now: number) => {
      const elapsed = now - startRef.current
      const t = Math.min(1, elapsed / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (to - from) * eased
      setDisplay(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(to)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return <span className={className}>{format(display)}</span>
}
