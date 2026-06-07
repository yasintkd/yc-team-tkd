import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Materials from './Materials'
import Reports from './Reports'
import Calendar from './Calendar'
import Tabs from '../components/Tabs'

const TABS = [
  { key: 'malzeme', label: 'Malzeme' },
  { key: 'raporlar', label: 'Raporlar' },
  { key: 'takvim', label: 'Takvim' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ToolsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as TabKey | null

  // URL'de tab varsa onu kullan, yoksa varsayılan 'malzeme'
  const tab = useMemo<TabKey>(() => {
    if (tabParam && TABS.some((t) => t.key === tabParam)) return tabParam
    return 'malzeme'
  }, [tabParam])

  const setTab = (k: TabKey) => {
    setSearchParams(k === 'malzeme' ? {} : { tab: k }, { replace: true })
  }

  return (
    <div className="space-y-4">
      <Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />
      {tab === 'malzeme' ? <Materials /> : tab === 'raporlar' ? <Reports /> : <Calendar />}
    </div>
  )
}
