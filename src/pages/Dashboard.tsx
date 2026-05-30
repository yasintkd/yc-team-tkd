import { Users, CreditCard, CalendarClock } from 'lucide-react'
import StatCard from '../components/StatCard'

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <StatCard
          label="Aktif Sporcu"
          value="128"
          hint="Bu ay aktif antrenmanlara katılan toplam öğrenci"
          trendLabel="+6 yeni"
          trendPositive
          icon={Users}
        />
        <StatCard
          label="Aidat Performansı"
          value="%92"
          hint="Bu ay ödemesini tamamlayan sporcu oranı"
          trendLabel="+4% iyileşme"
          trendPositive
          icon={CreditCard}
        />
        <StatCard
          label="Yaklaşan Kuşak Sınavı"
          value="14 Haziran"
          hint="08:30 • Merkez Salon"
          trendLabel="21 gün kaldı"
          trendPositive
          icon={CalendarClock}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Aylık Aidat Durumu</h2>
            <span className="text-[11px] text-brand-muted">
              Örnek veri — API entegrasyonu eklenebilir
            </span>
          </div>
          <div className="mt-4 flex h-48 items-center justify-center rounded-xl border border-dashed border-app-border bg-app-bg-soft/80 text-xs text-brand-muted">
            Buraya aidat tahsilat grafiği eklenebilir
          </div>
        </div>

        <div className="glass-panel flex flex-col rounded-2xl p-4">
          <h2 className="text-sm font-semibold">Bugünün Programı</h2>
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            <li className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <span>Beyaz–Sarı Kuşak Grup</span>
              <span className="text-brand-muted">17:30 – 18:30</span>
            </li>
            <li className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <span>Yeşil–Mavi Kuşak Grup</span>
              <span className="text-brand-muted">18:30 – 19:30</span>
            </li>
            <li className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <span>Kırmızı–Siyah Kuşak Grup</span>
              <span className="text-brand-muted">19:30 – 20:30</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
