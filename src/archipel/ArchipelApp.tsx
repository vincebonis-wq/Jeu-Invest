import { useEffect } from 'react'
import { useArchipel } from './store'
import { Island } from './Island'
import { Hud, Dock, BuildSheet, BuildingPanel, QuestsSheet, StatsSheet, MarketSheet, Toasts, Flies, Coach, Intro, Welcome, Celebrate } from './UI'
import './archipel.css'

export function ArchipelApp() {
  const start = useArchipel((s) => s.start)
  const sheet = useArchipel((s) => s.sheet)
  const selected = useArchipel((s) => s.selected)
  const introDone = useArchipel((s) => s.game.introDone)
  useEffect(() => { start() }, [start])

  return (
    <div className="archipel fixed inset-0 overflow-hidden font-sans">
      <Island />
      <Hud />
      {!selected && <Dock />}
      {selected && <BuildingPanel />}
      <Coach />
      <Toasts />
      {sheet === 'build' && <BuildSheet />}
      {sheet === 'quests' && <QuestsSheet />}
      {sheet === 'stats' && <StatsSheet />}
      {sheet === 'market' && <MarketSheet />}
      <Flies />
      <Welcome />
      <Celebrate />
      {!introDone && <Intro />}
    </div>
  )
}
