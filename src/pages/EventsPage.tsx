import { useState } from 'react'
import BeltExams from './BeltExams'
import Competitions from './Competitions'
import Tabs from '../components/Tabs'

const TABS = [
  { key: 'sinav', label: 'Kuşak Sınavı' },
  { key: 'yarisma', label: 'Yarışmalar' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function EventsPage() {
  const [tab, setTab] = useState<TabKey>('sinav')

  return (
    <div className="space-y-4">
      <Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />
      {tab === 'sinav' ? <BeltExams /> : <Competitions />}
    </div>
  )
}
