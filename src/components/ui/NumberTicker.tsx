import { useEffect, useRef, useState } from 'react'
import { formatEuro } from '../../utils/formatting'
import { cn } from '../../utils/formatting'

interface NumberTickerProps {
  value: number
  className?: string
  format?: (n: number) => string
  duration?: number
  flash?: boolean
}

export function NumberTicker({
  value,
  className,
  format = formatEuro,
  duration = 600,
  flash = true,
}: NumberTickerProps) {
  const [display, setDisplay] = useState(value)
  const [flashClass, setFlashClass] = useState('')
  const fromRef = useRef(value)
  const prevValueRef = useRef(value)
  const startRef = useRef<number>(0)
  const rafRef = useRef<number>(0)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const prev = prevValueRef.current
    prevValueRef.current = value

    if (flash && Math.abs(value - prev) > 0.5) {
      if (flashTimer.current) clearTimeout(flashTimer.current)
      setFlashClass(value > prev ? 'animate-flash-up' : 'animate-flash-down')
      flashTimer.current = setTimeout(() => setFlashClass(''), 1100)
    }

    fromRef.current = display
    startRef.current = performance.now()
    const from = fromRef.current
    const to = value

    const animate = (now: number) => {
      const elapsed = now - startRef.current
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(to)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return <span className={cn(className, flashClass)}>{format(display)}</span>
}
