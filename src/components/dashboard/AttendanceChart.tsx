import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function AttendanceChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) return null
  return (
    <section className="glass-panel rounded-2xl p-4">
      <h2 className="mb-3 text-sm font-semibold">Son 30 Günlük Katılım</h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#b8d4e8" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#b8d4e8' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #b8d4e8', background: 'rgba(255,255,255,0.95)', fontSize: 12 }} formatter={(val) => [`${val} katılım`, 'Gelen']} labelFormatter={(lbl) => `Tarih: ${lbl}`} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {data.map((e) => (<Cell key={e.date} fill={e.count > 5 ? '#0097a7' : '#facc15'} />))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  )
}