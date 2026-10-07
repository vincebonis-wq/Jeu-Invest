import { useEffect } from 'react'
import { useRentier } from './store'
import { Tower } from './Tower'
import { Hud, Dock, BuildSheet, RoomPanel, QuestsSheet, StatsSheet, ResearchSheet, StaffSheet, Toasts, Flies, Coach, Intro, Welcome, Celebrate } from './UI'
import '../archipel/archipel.css'
import './rentier.css'

export function RentierApp() {
  const start = useRentier((s) => s.start)
  const sheet = useRentier((s) => s.sheet)
  const selected = useRentier((s) => s.selected)
  const introDone = useRentier((s) => s.game.introDone)
  useEffect(() => { start() }, [start])
  return (
    <div className="archipel fixed inset-0 overflow-hidden font-sans" style={{ background: '#0b1028' }}>
      <Tower />
      <Hud />
      {!selected && <Dock />}
      {selected && <RoomPanel />}
      <Coach />
      <Toasts />
      {sheet === 'build' && <BuildSheet />}
      {sheet === 'quests' && <QuestsSheet />}
      {sheet === 'stats' && <StatsSheet />}
      {sheet === 'research' && <ResearchSheet />}
      {sheet === 'staff' && <StaffSheet />}
      <Flies />
      <Welcome />
      <Celebrate />
      {!introDone && <Intro />}
    </div>
  )
}
