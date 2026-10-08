import { useEffect } from 'react'
import { useCorp } from './store'
import { Tower } from './Tower'
import { Hud, Dock, BuildSheet, RoomPanel, QuestsSheet, StatsSheet, ResearchSheet, StaffSheet, Toasts, Flies, Coach, Intro, Welcome, Celebrate, NewGameDialog } from './UI'
import '../archipel/archipel.css'
import '../rentier/rentier.css'
import './corp.css'

export function CorpApp() {
  const start = useCorp((s) => s.start)
  const sheet = useCorp((s) => s.sheet)
  const selected = useCorp((s) => s.selected)
  const introDone = useCorp((s) => s.game.introDone)
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
      <NewGameDialog />
      {!introDone && <Intro />}
    </div>
  )
}
