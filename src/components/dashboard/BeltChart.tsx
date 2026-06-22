import { Link, useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const BELT_COLORS: Record<string, string> = {
  'Beyaz': '#f1f5f9', 'Beyaz-Sarı': '#fde68a', 'Sarı': '#eab308',
  'Sarı-Yeşil': '#a3e635', 'Yeşil': '#22c55e', 'Yeşil-Mavi': '#2dd4bf',
  'Mavi': '#3b82f6', 'Mavi-Kırmızı': '#fb7185', 'Kırmızı': '#ef4444',
  'Kırmızı-Siyah': '#a855f7', 'Siyah': '#1e293b', '1. Dan': '#0f172a', '2. Dan': '#020617',
}

const COMPOUND_BELTS: Record<string, [string, string]> = {
  'Beyaz-Sarı': ['#f1f5f9', '#eab308'], 'Sarı-Yeşil': ['#eab308', '#22c55e'],
  'Yeşil-Mavi': ['#22c55e', '#3b82f6'], 'Mavi-Kırmızı': ['#3b82f6', '#ef4444'],
  'Kırmızı-Siyah': ['#ef4444', '#1e293b'],
}

function beltPatternId(belt: string) { return `pat-${belt.replace(/\s/g, '')}` }

function beltFill(belt: string) {
  return COMPOUND_BELTS[belt] ? `url(#${beltPatternId(belt)})` : (BELT_COLORS[belt] ?? '#94a3b8')
}

function getArcPath(cx: number, cy: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  const rad = (a: number) => (a * Math.PI) / 180
  const polar = (r: number, a: number) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))]
  const s = polar(outerRadius, startAngle); const e = polar(outerRadius, endAngle)
  const si = polar(innerRadius, endAngle); const ei = polar(innerRadius, startAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return [`M${s[0]},${s[1]}`, `A${outerRadius},${outerRadius},0,${large},1,${e[0]},${e[1]}`, `L${si[0]},${si[1]}`, `A${innerRadius},${innerRadius},0,${large},0,${ei[0]},${ei[1]}`, 'Z'].join(' ')
}

type BeltCount = { belt: string; count: number }

export default function BeltChart({ data }: { data: BeltCount[] }) {
  const navigate = useNavigate()
  if (data.length === 0) return null

  return (
    <div className="glass-panel rounded-2xl p-4">
      <h2 className="text-sm font-semibold">Kuşak Dağılımı</h2>
      {data.length === 0 ? (
        <p className="mt-3 text-xs text-brand-muted">Henüz sporcu kaydı yok.</p>
      ) : (
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <defs>
                {Object.entries(COMPOUND_BELTS).map(([belt, [c1, c2]]) => {
                  if (!data.some((b) => b.belt === belt)) return null
                  const id = beltPatternId(belt)
                  return (
                    <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                      <rect width="5" height="10" fill={c1} />
                      <rect x="5" width="5" height="10" fill={c2} />
                    </pattern>
                  )
                })}
              </defs>
              <Pie data={data} dataKey="count" nameKey="belt" cx="50%" cy="50%" innerRadius={58} outerRadius={92}
                paddingAngle={3} strokeWidth={2} stroke="#fff" isAnimationActive animationBegin={200}
                animationDuration={1200} animationEasing="ease-out"
                activeShape={(props: any) => {
                  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
                  return (
                    <g>
                      <defs>
                        <filter id={`glow-${props.belt?.replace(/\s/g, '') ?? 'belt'}`}>
                          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                      </defs>
                      <path d={getArcPath(cx, cy, innerRadius - 2, outerRadius + 4, startAngle, endAngle)} fill={fill} opacity={0.25} filter={`url(#glow-${props.belt?.replace(/\s/g, '') ?? 'belt'})`} />
                      <path d={getArcPath(cx, cy, innerRadius, outerRadius + 3, startAngle, endAngle)} fill={fill} opacity={0.9} stroke="#fff" strokeWidth={2} />
                    </g>
                  )
                }}
              >
                {data.map((e) => (<Cell key={e.belt} fill={beltFill(e.belt)} stroke="rgba(255,255,255,0.6)" strokeWidth={2} />))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.97)', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} formatter={(value, name) => [`${value} sporcu`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
            {data.map(({ belt, count }) => (
              <span key={belt} className="flex items-center gap-1.5 transition hover:scale-105 cursor-pointer hover:opacity-80" onClick={() => navigate(`/sporcular?belt=${encodeURIComponent(belt)}`)}>
                <span className="inline-block h-3 w-3 rounded-full ring-1 ring-black/5 transition-transform" style={{ background: COMPOUND_BELTS[belt] ? `linear-gradient(135deg, ${COMPOUND_BELTS[belt][0]} 50%, ${COMPOUND_BELTS[belt][1]} 50%)` : (BELT_COLORS[belt] ?? '#94a3b8') }} />
                {belt} <span className="font-semibold text-slate-800">{count}</span>
              </span>
            ))}
          </div>
          <Link to="/kusak-sinavi" className="mt-4 inline-block text-xs font-medium text-brand-red hover:underline">Kuşak sınavı listesi oluştur →</Link>
        </div>
      )}
    </div>
  )
}