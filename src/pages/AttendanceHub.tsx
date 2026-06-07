import { useState } from 'react'
import Attendance from './Attendance'
import Groups from './Groups'
import Tabs from '../components/Tabs'

const TABS = [
  { key: 'yoklama', label: 'Yoklama' },
  { key: 'gruplar', label: 'Gruplar' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function AttendanceHub() {
  const [tab, setTab] = useState<TabKey>('yoklama')

  return (
    <div className="space-y-4">
      <Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />
      {tab === 'yoklama' ? <Attendance /> : <Groups />}
    </div>
  )
}
