import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { downloadOrderPng } from '../lib/exportOrderPng'
import {
  Package, ClipboardList, BarChart3,
  Pencil, Trash2,
  CheckSquare, Square, Search,
  ShoppingCart,
  Download,
  AlertTriangle, Clock,
} from 'lucide-react'
import Tabs from '../components/Tabs'
import LoadingSkeleton from '../components/LoadingSkeleton'
import StatCard from '../components/StatCard'

// ─── Types ─────────────────────────────────────────────────────

type Product = {
  id: string; name: string; category: string | null
  price: number
  requires_boy: boolean; requires_kilo: boolean; requires_shoe_size: boolean; requires_gender: boolean
}

type Athlete = { id: string; first_name: string; last_name: string; belt: string; gender: string | null }

type AthleteOrder = {
  id: string; athlete_id: string
  total_amount: number
  payment_status: 'odendi' | 'kismi' | 'bekliyor'
  paid_amount: number | null; note: string | null
  is_ordered: boolean; is_delivered: boolean
  delivered_at: string | null
  created_at: string
  athletes: { first_name: string; last_name: string; gender: string | null } | null
  items: OrderItem[]
}

type OrderItem = {
  id: string; order_id: string; product_id: string
  boy_cm: number | null; kilo: number | null; shoe_size: number | null
  products: { name: string; price: number } | null
}

// ─── Helpers ───────────────────────────────────────────────────

function productName(p: { name: string; price: number } | null) {
  return p?.name ?? '—'
}

const TABS = [
  { key: 'products', label: 'Ürünler', icon: Package },
  { key: 'orders', label: 'Sipariş Ver', icon: ShoppingCart },
  { key: 'distribute', label: 'Dağıtım', icon: ClipboardList },
  { key: 'reports', label: 'Rapor', icon: BarChart3 },
] as const

type TabKey = (typeof TABS)[number]['key']

// ─── Main Component ────────────────────────────────────────────

export default function Materials() {
  const [tab, setTab] = useState<TabKey>('products')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [orders, setOrders] = useState<AthleteOrder[]>([])

  const flash = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(null), 3000) }

  const loadAll = async () => {
    setLoading(true); setError(null)
    try {
      // Teslim edilip 15dk geçen siparişleri otomatik temizle
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      await supabase.from('athlete_orders').delete().lte('delivered_at', cutoff)

      const [pRes, aRes, oRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('athletes').select('id, first_name, last_name, belt, gender').eq('is_active', true).order('last_name'),
        supabase.from('athlete_orders').select('*, athletes(first_name, last_name, gender), items:athlete_order_items(*, products(name, price))').order('created_at', { ascending: false }),
      ])
      if (pRes.error) throw pRes.error
      if (aRes.error) throw aRes.error
      if (oRes.error) throw oRes.error
      setProducts(pRes.data as Product[])
      setAthletes(aRes.data as Athlete[])
      setOrders(oRes.data as AthleteOrder[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi')
    }
    setLoading(false)
  }

  useEffect(() => { void loadAll() }, [])

  if (loading) return <LoadingSkeleton variant="card" count={3} />
  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">{message}</div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />

      {tab === 'products' && <ProductsTab products={products} onRefresh={() => void loadAll()} flash={flash} setError={setError} />}
      {tab === 'orders' && <OrdersTab products={products} athletes={athletes} onRefresh={() => void loadAll()} flash={flash} setError={setError} />}
      {tab === 'distribute' && <DistributeTab orders={orders} athletes={athletes} products={products} onRefresh={() => void loadAll()} flash={flash} setError={setError} />}
      {tab === 'reports' && <ReportsTab orders={orders} athletes={athletes} />}
    </div>
  )
}

// ÜRÜNLER

function ProductsTab({
  products, onRefresh, flash, setError,
}: {
  products: Product[]; onRefresh: () => void
  flash: (m: string) => void; setError: (e: string | null) => void
}) {
  const [editing, setEditing] = useState<Product | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [rBoy, setRBoy] = useState(false)
  const [rKilo, setRKilo] = useState(false)
  const [rShoe, setRShoe] = useState(false)
  const [rGender, setRGender] = useState(false)

  const reset = () => { setEditing(null); setName(''); setPrice(''); setRBoy(false); setRKilo(false); setRShoe(false); setRGender(false) }

  const startEdit = (p: Product) => {
    setEditing(p); setName(p.name); setPrice(String(p.price))
    setRBoy(p.requires_boy); setRKilo(p.requires_kilo); setRShoe(p.requires_shoe_size); setRGender(p.requires_gender)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !price) return
    const payload = {
      name: name.trim(), price: parseFloat(price),
      requires_boy: rBoy, requires_kilo: rKilo, requires_shoe_size: rShoe, requires_gender: rGender,
    }
    if (editing) {
      const { error: err } = await supabase.from('products').update(payload).eq('id', editing.id)
      if (err) { setError(err.message); return }
      flash('Ürün güncellendi.')
    } else {
      const { error: err } = await supabase.from('products').insert(payload)
      if (err) { setError(err.message); return }
      flash('Ürün eklendi.')
    }
    reset(); onRefresh()
  }

  const remove = async (id: string) => {
    if (!window.confirm('Bu ürünü silmek istediğinize emin misiniz?')) return
    const { error: err } = await supabase.from('products').delete().eq('id', id)
    if (err) { setError(err.message); return }
    flash('Ürün silindi.'); onRefresh()
  }

  return (
    <section className="glass-panel rounded-2xl p-4">
      <h2 className="text-sm font-semibold">{editing ? 'Ürünü Düzenle' : 'Yeni Ürün'}</h2>
      <form className="mt-3 space-y-3" onSubmit={submit}>
        <div className="flex flex-wrap gap-2">
          <input className="input-field min-w-[200px] flex-1 text-xs" placeholder="Ürün adı" value={name} onChange={e => setName(e.target.value)} autoFocus={!!editing} />
          <input type="number" min="0" step="0.01" className="input-field w-[120px] text-xs" placeholder="Fiyat (₺)" value={price} onChange={e => setPrice(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={rBoy} onChange={e => setRBoy(e.target.checked)} /> Boy (cm)
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={rKilo} onChange={e => setRKilo(e.target.checked)} /> Kilo (kg)
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={rShoe} onChange={e => setRShoe(e.target.checked)} /> Ayakkabı No
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={rGender} onChange={e => setRGender(e.target.checked)} /> Cinsiyet
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={!name.trim() || !price} className="btn-primary text-xs">{editing ? 'Güncelle' : 'Ekle'}</button>
          {editing && <button type="button" onClick={reset} className="rounded-lg border border-app-border bg-white px-3 py-2 text-xs text-slate-600 hover:bg-app-bg-soft">İptal</button>}
        </div>
      </form>

      <div className="mt-4 space-y-1">
        {products.length === 0 && <p className="text-xs text-brand-muted">Henüz ürün yok.</p>}
        {products.map(p => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border border-app-border bg-white px-3 py-2">
            <div>
              <p className="text-sm font-medium text-slate-800">{p.name}</p>
              <p className="text-[11px] text-brand-muted">
                {p.price} ₺
                {[p.requires_boy && 'boy', p.requires_kilo && 'kilo', p.requires_shoe_size && 'ayakkabı', p.requires_gender && 'cinsiyet'].filter(Boolean).length > 0 &&
                  ` • ${[p.requires_boy && 'boy', p.requires_kilo && 'kilo', p.requires_shoe_size && 'ayakkabı', p.requires_gender && 'cinsiyet'].filter(Boolean).join(', ')}`
                }
              </p>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => startEdit(p)} className="rounded-lg border border-app-border bg-white p-1.5 text-slate-500 hover:bg-app-bg-soft"><Pencil className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => void remove(p.id)} className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// SİPARİŞ VER

function OrdersTab({
  products, athletes, onRefresh, flash, setError,
}: {
  products: Product[]; athletes: Athlete[]
  onRefresh: () => void; flash: (m: string) => void; setError: (e: string | null) => void
}) {
  const [athleteId, setAthleteId] = useState('')
  const [athleteSearch, setAthleteSearch] = useState('')
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [paymentStatus, setPaymentStatus] = useState<'odendi' | 'kismi' | 'bekliyor'>('odendi')
  const [paidAmount, setPaidAmount] = useState('')
  const [note, setNote] = useState('')
  const [boyCm, setBoyCm] = useState('')
  const [kilo, setKilo] = useState('')
  const [shoeSize, setShoeSize] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedAthlete = athletes.find(a => a.id === athleteId)

  const filteredAthletes = useMemo(() => {
    const q = athleteSearch.toLowerCase()
    return athletes.filter(a => `${a.first_name} ${a.last_name}`.toLowerCase().includes(q))
  }, [athletes, athleteSearch])

  // Union of required measurements from selected products
  const needs = useMemo(() => {
    let boy = false, kg = false, shoe = false, gender = false
    for (const pid of selectedProductIds) {
      const p = products.find(x => x.id === pid)
      if (!p) continue
      if (p.requires_boy) boy = true
      if (p.requires_kilo) kg = true
      if (p.requires_shoe_size) shoe = true
      if (p.requires_gender) gender = true
    }
    return { boy, kg, shoe, gender }
  }, [selectedProductIds, products])

  // Cart total
  const cartTotal = useMemo(() => {
    let total = 0
    for (const pid of selectedProductIds) {
      const p = products.find(x => x.id === pid)
      if (p) total += p.price
    }
    return total
  }, [selectedProductIds, products])

  const toggleProduct = (pid: string) => {
    setSelectedProductIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    )
  }

  const canSubmit = athleteId && selectedProductIds.length > 0

  const resetForm = () => {
    setAthleteId(''); setAthleteSearch(''); setSelectedProductIds([])
    setPaymentStatus('odendi'); setPaidAmount(''); setNote('')
    setBoyCm(''); setKilo(''); setShoeSize('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true); setError(null)

    // Create order
    const { data: order, error: oErr } = await supabase.from('athlete_orders').insert({
      athlete_id: athleteId,
      total_amount: cartTotal,
      payment_status: paymentStatus,
      paid_amount: paymentStatus === 'odendi' ? cartTotal : (paidAmount ? parseFloat(paidAmount) : null),
      note: note.trim() || null,
    }).select('id').single()

    if (oErr) { setError(oErr.message); setSaving(false); return }

    // Insert order items (shared measurements for all)
    const items = selectedProductIds.map(pid => ({
      order_id: order!.id,
      product_id: pid,
      boy_cm: needs.boy && boyCm ? parseFloat(boyCm) : null,
      kilo: needs.kg && kilo ? parseFloat(kilo) : null,
      shoe_size: needs.shoe && shoeSize ? parseFloat(shoeSize) : null,
    }))

    const { error: iErr } = await supabase.from('athlete_order_items').insert(items)
    if (iErr) { setError(iErr.message); setSaving(false); return }

    flash(`Sipariş kaydedildi. Toplam: ${cartTotal} ₺`)
    resetForm(); setSaving(false); onRefresh()
  }

  return (
    <section className="glass-panel rounded-2xl p-4">
      <h2 className="text-sm font-semibold">Sporcu Siparişi</h2>

      <form className="mt-3 space-y-3" onSubmit={submit}>
        {/* Sporcu seç */}
        <div className="flex items-center gap-2 rounded-lg border border-app-border bg-white px-3 focus-within:border-brand-cyan focus-within:ring-2 focus-within:ring-brand-cyan/25">
          <Search className="h-3.5 w-3.5 shrink-0 text-brand-muted" />
          <input className="w-full bg-transparent py-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400" placeholder="Sporcu ara..." value={athleteSearch} onChange={e => setAthleteSearch(e.target.value)} />
        </div>
        <div className="relative">
          <select className="input-field w-full appearance-none text-sm pr-8" value={athleteId} onChange={e => setAthleteId(e.target.value)} required>
            <option value="">Sporcu seç</option>
            {filteredAthletes.map(a => (
              <option key={a.id} value={a.id}>{a.first_name} {a.last_name} — {a.belt}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        {/* Ürünler - yatay kaydırmalı kartlar */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-slate-600">Ürün Seç</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {products.map(p => {
              const selected = selectedProductIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProduct(p.id)}
                  className={`relative flex shrink-0 flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-3 text-xs font-medium transition-all ${
                    selected
                      ? 'border-brand-cyan bg-brand-cyan/5 text-brand-cyan shadow-sm'
                      : 'border-app-border bg-white text-slate-600 hover:border-slate-300 hover:bg-app-bg-soft/50'
                  }`}
                >
                  {selected && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-cyan text-[10px] text-white shadow-sm">
                      ✓
                    </span>
                  )}
                  <span className="whitespace-nowrap">{p.name}</span>
                  <span className="text-[11px] opacity-70">{p.price}₺</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Ölçüler - seçilen ürünlerin ihtiyacına göre */}
        {selectedProductIds.length > 0 && (needs.boy || needs.kg || needs.shoe || needs.gender) && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-slate-600">Sporcu Ölçüleri</p>
            <div className="flex flex-wrap gap-2">
              {needs.boy && (
                <input className="input-field w-[120px] text-xs" type="number" step="0.1" placeholder="Boy (cm)" value={boyCm} onChange={e => setBoyCm(e.target.value)} />
              )}
              {needs.kg && (
                <input className="input-field w-[120px] text-xs" type="number" step="0.1" placeholder="Kilo (kg)" value={kilo} onChange={e => setKilo(e.target.value)} />
              )}
              {needs.shoe && (
                <input className="input-field w-[120px] text-xs" type="number" step="0.5" placeholder="Ayakkabı no" value={shoeSize} onChange={e => setShoeSize(e.target.value)} />
              )}
              {needs.gender && selectedAthlete && (
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm ring-1 ring-app-border">
                  Cinsiyet: {selectedAthlete.gender === 'erkek' ? 'Erkek' : selectedAthlete.gender === 'kiz' ? 'Kız' : '—'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Toplam */}
        <div className="rounded-xl bg-brand-cyan/5 border border-brand-cyan/20 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">Sepet Toplamı</span>
            <span className="text-lg font-bold text-slate-900">{cartTotal} ₺</span>
          </div>
        </div>

        {/* Ödeme */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-slate-600">Ödeme</p>
          <div className="flex flex-wrap gap-2">
            {(['odendi', 'kismi', 'bekliyor'] as const).map(s => (
              <button key={s} type="button" onClick={() => setPaymentStatus(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  paymentStatus === s
                    ? s === 'odendi' ? 'bg-emerald-100 text-emerald-800'
                      : s === 'kismi' ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-700'
                    : 'border border-app-border bg-white text-slate-500 hover:bg-app-bg-soft'
                }`}
              >
                {s === 'odendi' ? 'Ödendi' : s === 'kismi' ? 'Kısmi Ödeme' : 'Bekliyor'}
              </button>
            ))}
          </div>
          {paymentStatus === 'kismi' && (
            <div className="flex flex-wrap gap-2">
              <input type="number" min="0" step="0.01" className="input-field w-[140px] text-xs" placeholder="Alınan miktar (₺)" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
              <input className="input-field min-w-[200px] flex-1 text-xs" placeholder="Not (örn: 500 ödendi, 500 borç)" value={note} onChange={e => setNote(e.target.value)} />
            </div>
          )}
          {paymentStatus === 'bekliyor' && (
            <input className="input-field w-full text-xs" placeholder="Not" value={note} onChange={e => setNote(e.target.value)} />
          )}
        </div>

        <button type="submit" disabled={saving || !canSubmit} className="btn-primary text-xs">
          {saving ? 'Kaydediliyor...' : 'Siparişi Kaydet'}
        </button>
      </form>
    </section>
  )
}

// DAĞITIM

function DistributeTab({
  products, orders, athletes, onRefresh, flash, setError,
}: {
  products: Product[]; orders: AthleteOrder[]; athletes: Athlete[]
  onRefresh: () => void; flash: (m: string) => void; setError: (e: string | null) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPaid, setEditPaid] = useState('')
  const [editStatus, setEditStatus] = useState<'odendi' | 'kismi' | 'bekliyor'>('odendi')
  const [editNote, setEditNote] = useState('')
  const [editSelectedProductIds, setEditSelectedProductIds] = useState<string[]>([])
  const [editBoyCm, setEditBoyCm] = useState('')
  const [editKilo, setEditKilo] = useState('')
  const [editShoeSize, setEditShoeSize] = useState('')
  const [saving, setSaving] = useState(false)
  const [exportingPng, setExportingPng] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const startEdit = (o: AthleteOrder) => {
    setEditingId(o.id)
    setEditPaid(o.paid_amount?.toString() ?? '')
    setEditStatus(o.payment_status)
    setEditNote(o.note ?? '')

    // Ürün seçimlerini ve ölçüleri yükle
    const productIds = o.items?.map(item => item.product_id) ?? []
    setEditSelectedProductIds(productIds)

    // İlk item'dan ölçüleri al (tüm itemlar aynı ölçüleri paylaşır)
    const firstItem = o.items?.[0]
    setEditBoyCm(firstItem?.boy_cm?.toString() ?? '')
    setEditKilo(firstItem?.kilo?.toString() ?? '')
    setEditShoeSize(firstItem?.shoe_size?.toString() ?? '')
  }

  // Seçilen ürünlere göre hangi ölçülerin gerekli olduğunu hesapla
  const editNeeds = useMemo(() => {
    let boy = false, kg = false, shoe = false
    for (const pid of editSelectedProductIds) {
      const p = products.find(x => x.id === pid)
      if (!p) continue
      if (p.requires_boy) boy = true
      if (p.requires_kilo) kg = true
      if (p.requires_shoe_size) shoe = true
    }
    return { boy, kg, shoe }
  }, [editSelectedProductIds, products])

  const editToggleProduct = (pid: string) => {
    setEditSelectedProductIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    )
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true); setError(null)

    // Yeni toplam tutarı hesapla
    let newTotal = 0
    for (const pid of editSelectedProductIds) {
      const p = products.find(x => x.id === pid)
      if (p) newTotal += p.price
    }

    // Sipariş master kaydını güncelle
    const { error: oErr } = await supabase.from('athlete_orders').update({
      total_amount: newTotal,
      payment_status: editStatus,
      paid_amount: editStatus === 'odendi' ? newTotal : (editPaid ? parseFloat(editPaid) : 0),
      note: editNote.trim() || null,
    }).eq('id', editingId)
    if (oErr) { setError(oErr.message); setSaving(false); return }

    // Eski item'ları sil
    const { error: dErr } = await supabase.from('athlete_order_items').delete().eq('order_id', editingId)
    if (dErr) { setError(dErr.message); setSaving(false); return }

    // Yeni item'ları ekle
    const items = editSelectedProductIds.map(pid => ({
      order_id: editingId,
      product_id: pid,
      boy_cm: editNeeds.boy && editBoyCm ? parseFloat(editBoyCm) : null,
      kilo: editNeeds.kg && editKilo ? parseFloat(editKilo) : null,
      shoe_size: editNeeds.shoe && editShoeSize ? parseFloat(editShoeSize) : null,
    }))
    const { error: iErr } = await supabase.from('athlete_order_items').insert(items)
    if (iErr) { setError(iErr.message); setSaving(false); return }

    flash('Sipariş güncellendi')
    setEditingId(null); setSaving(false); onRefresh()
  }

  const toggleOrdered = async (orderId: string, current: boolean) => {
    const { error: err } = await supabase.from('athlete_orders').update({ is_ordered: !current }).eq('id', orderId)
    if (err) { setError(err.message); return }
    onRefresh()
  }

  const toggleDelivered = async (orderId: string, current: boolean) => {
    const updates: Record<string, unknown> = { is_delivered: !current }
    if (!current) updates.delivered_at = new Date().toISOString()
    else updates.delivered_at = null
    const { error: err } = await supabase.from('athlete_orders').update(updates).eq('id', orderId)
    if (err) { setError(err.message); return }
    onRefresh()
  }

  const deleteOrder = async (orderId: string) => {
    setError(null)
    const { error: err } = await supabase.from('athlete_orders').delete().eq('id', orderId)
    if (err) { setError(err.message); return }
    flash('Sipariş silindi.')
    onRefresh()
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)))
    }
  }

  const exportNotOrderedPng = async () => {
    setExportingPng(true)
    setError(null)
    try {
      // Seçili siparişler varsa seçilenlerden sadece sipariş verilmemiş olanları al
      // Seçili yoksa tüm sipariş verilmemiş olanları al
      const targetOrders = selectedIds.size > 0
        ? orders.filter(o => selectedIds.has(o.id) && !o.is_ordered)
        : orders.filter(o => !o.is_ordered)

      if (targetOrders.length === 0) {
        setError('Dışa aktarılacak sipariş bulunamadı.')
        setExportingPng(false)
        return
      }

      // Her sipariş için sporcu bilgisine erişim için lookup
      const orderAthleteMap = new Map(targetOrders.map(o => [o.id, o.athletes]))
      // Her ürün için cinsiyet gerekip gerekmediği
      const productGenderReq = new Map(products.map(p => [p.id, p.requires_gender]))

      // Grupla: ürün adı + beden bilgisi + cinsiyet → adet
      const grouped = new Map<string, { productName: string; sizeInfo: string; quantity: number; genderInfo?: string }>()

      const allItems = targetOrders.flatMap((o) => o.items ?? [])

      for (const item of allItems) {
        const pn = productName(item.products)
        const parts: string[] = []
        if (item.boy_cm) parts.push(`${item.boy_cm}cm`)
        if (item.kilo) parts.push(`${item.kilo}kg`)
        if (item.shoe_size) parts.push(`Ayakkabı ${item.shoe_size}`)
        const sizeInfo = parts.length > 0 ? parts.join(' / ') : '-'

        // Cinsiyet bilgisi
        const reqGender = productGenderReq.get(item.product_id) ?? false
        let genderInfo: string | undefined
        if (reqGender) {
          const orderAthletes = orderAthleteMap.get(item.order_id)
          const gender = orderAthletes?.gender
          genderInfo = gender === 'erkek' ? 'Erkek' : gender === 'kiz' ? 'Kız' : '—'
        }

        const key = `${pn}||${sizeInfo}||${genderInfo ?? ''}`
        const existing = grouped.get(key)
        if (existing) {
          existing.quantity++
        } else {
          grouped.set(key, { productName: pn, sizeInfo, quantity: 1, genderInfo })
        }
      }

      await downloadOrderPng(
        [...grouped.values()].sort((a, b) => a.productName.localeCompare(b.productName)),
        targetOrders.length,
      )

      // Seçimleri temizle
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Görsel oluşturulamadı.')
    } finally {
      setExportingPng(false)
    }
  }

  // ─── Rapor metrikleri ────────────────────────────────────────
  const stats = useMemo(() => {
    const total = orders.length
    const ordered = orders.filter(o => o.is_ordered).length
    const delivered = orders.filter(o => o.is_delivered).length
    const notOrdered = orders.filter(o => !o.is_ordered).length

    // Eksik ölçü: ürünün requires_boy/kilo/shoe_size ihtiyacı varsa
    // ama ilgili item alanı null ise o sipariş "eksik" sayılır
    const missingData = orders.filter(o =>
      (o.items ?? []).some(item => {
        const product = products.find(p => p.id === item.product_id)
        if (!product) return false
        if (product.requires_boy && !item.boy_cm) return true
        if (product.requires_kilo && !item.kilo) return true
        if (product.requires_shoe_size && !item.shoe_size) return true
        return false
      }),
    ).length

    return { total, ordered, delivered, notOrdered, missingData }
  }, [orders, products])

  const payments: Record<string, { label: string; cls: string }> = {
    odendi: { label: 'Ödendi', cls: 'bg-emerald-100 text-emerald-800' },
    kismi: { label: 'Kısmi', cls: 'bg-amber-100 text-amber-800' },
    bekliyor: { label: 'Bekliyor', cls: 'bg-slate-100 text-slate-600' },
  }

  return (
    <section className="glass-panel rounded-2xl p-4">
      {/* Sayısal rapor */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Toplam Sipariş" value={String(stats.total)} icon={ClipboardList} />
        <StatCard label="Sipariş Verildi" value={String(stats.ordered)} icon={Package} />
        <StatCard label="Teslim Edildi" value={String(stats.delivered)} icon={CheckSquare} />
        <StatCard label="Bekleyen" value={String(stats.notOrdered)} icon={Clock} />
        <StatCard label="Eksik Veri" value={String(stats.missingData)} icon={AlertTriangle}
          hint={stats.missingData > 0 ? 'Boy, kilo veya ayakkabı no girilmemiş' : undefined} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Sipariş Listesi</h2>
          {orders.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{orders.length} sipariş</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {orders.length > 0 && (
            <>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="rounded-lg border border-app-border bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-app-bg-soft transition"
              >
                {selectedIds.size === orders.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
              </button>
              <button
                type="button"
                disabled={exportingPng}
                onClick={() => void exportNotOrderedPng()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-app-bg-soft disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" />
                {exportingPng ? 'Hazırlanıyor...' : `PNG İndir${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
              </button>
            </>
          )}
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="mt-3 text-xs text-brand-muted">Henüz sipariş yok.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {orders.map(o => {
            const editing = editingId === o.id
            const athlete = athletes.find(a => a.id === o.athlete_id)
            const checked = selectedIds.has(o.id)
            return (
              <div key={o.id} className="rounded-xl border border-app-border bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleSelect(o.id)}
                    className={`mt-0.5 shrink-0 transition ${checked ? 'text-brand-cyan' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{athlete ? `${athlete.first_name} ${athlete.last_name}` : '—'}</p>
                    <p className="text-[11px] text-brand-muted">
                      {new Date(o.created_at).toLocaleDateString('tr-TR')}
                      {' · '}<span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${payments[o.payment_status]?.cls ?? ''}`}>{payments[o.payment_status]?.label ?? o.payment_status}</span>
                      {' · '}{o.total_amount} ₺
                      {o.paid_amount != null && o.paid_amount < o.total_amount ? ` (${o.paid_amount}₺ alındı)` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => startEdit(o)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-app-bg-soft hover:text-brand-cyan transition"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {o.is_delivered && (
                      <button type="button" onClick={() => { if (confirm('Sipariş silinecek. Emin misiniz?')) void deleteOrder(o.id) }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Ürün listesi */}
                {o.items && o.items.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {o.items.map(item => {
                      const pn = productName(item.products)
                      const details = [item.boy_cm && `${item.boy_cm}cm`, item.kilo && `${item.kilo}kg`, item.shoe_size && `ayakkabı ${item.shoe_size}`].filter(Boolean).join(', ')
                      return (
                        <span key={item.id} className="rounded-full bg-app-bg-soft px-2 py-0.5 text-[11px] text-slate-600">
                          {pn}{details ? ` (${details})` : ''}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Not */}
                {!editing && o.note && <p className="mt-1 text-[11px] text-brand-muted">📝 {o.note}</p>}

                {/* Sipariş verildi / Teslim edildi tikleri */}
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <button type="button" onClick={() => void toggleOrdered(o.id, o.is_ordered)}
                      className={`${o.is_ordered ? 'text-brand-cyan' : 'text-slate-400'}`}
                    >
                      {o.is_ordered ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                    <span className={o.is_ordered ? 'text-slate-700 font-medium' : 'text-slate-500'}>Sipariş Verildi</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <button type="button" onClick={() => void toggleDelivered(o.id, o.is_delivered)}
                      className={`${o.is_delivered ? 'text-brand-cyan' : 'text-slate-400'}`}
                    >
                      {o.is_delivered ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                    <span className={o.is_delivered ? 'text-slate-700 font-medium' : 'text-slate-500'}>Teslim Edildi</span>
                  </label>
                </div>

                {/* Inline düzenleme */}
                {editing && (
                  <div className="mt-3 border-t border-app-border pt-3 space-y-3" onClick={e => e.stopPropagation()}>
                    {/* Ürün seçimi */}
                    <div>
                      <p className="text-[11px] font-medium text-slate-600 mb-2">Ürünler</p>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                        {products.map(p => {
                          const sel = editSelectedProductIds.includes(p.id)
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => editToggleProduct(p.id)}
                              className={`relative flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 px-3 py-2 text-xs font-medium transition-all ${
                                sel
                                  ? 'border-brand-cyan bg-brand-cyan/5 text-brand-cyan shadow-sm'
                                  : 'border-app-border bg-white text-slate-600 hover:border-slate-300 hover:bg-app-bg-soft/50'
                              }`}
                            >
                              {sel && (
                                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-cyan text-[10px] text-white shadow-sm">✓</span>
                              )}
                              <span className="whitespace-nowrap">{p.name}</span>
                              <span className="text-[10px] opacity-70">{p.price}₺</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Ölçüler */}
                    {(editNeeds.boy || editNeeds.kg || editNeeds.shoe) && (
                      <div>
                        <p className="text-[11px] font-medium text-slate-600 mb-1">Ölçüler</p>
                        <div className="flex flex-wrap gap-2">
                          {editNeeds.boy && (
                            <input type="number" step="0.1" className="input-field w-[120px] text-xs"
                              placeholder="Boy (cm)" value={editBoyCm} onChange={e => setEditBoyCm(e.target.value)} />
                          )}
                          {editNeeds.kg && (
                            <input type="number" step="0.1" className="input-field w-[120px] text-xs"
                              placeholder="Kilo (kg)" value={editKilo} onChange={e => setEditKilo(e.target.value)} />
                          )}
                          {editNeeds.shoe && (
                            <input type="number" step="0.5" className="input-field w-[120px] text-xs"
                              placeholder="Ayakkabı no" value={editShoeSize} onChange={e => setEditShoeSize(e.target.value)} />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ödeme */}
                    <div>
                      <p className="text-[11px] font-medium text-slate-600 mb-1">Ödeme</p>
                      <div className="flex flex-wrap gap-2">
                        {(['odendi', 'kismi', 'bekliyor'] as const).map(s => (
                          <button key={s} type="button" onClick={() => setEditStatus(s)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                              editStatus === s
                                ? s === 'odendi' ? 'bg-emerald-100 text-emerald-800'
                                  : s === 'kismi' ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-200 text-slate-700'
                                : 'border border-app-border bg-white text-slate-500 hover:bg-app-bg-soft'
                            }`}
                          >
                            {s === 'odendi' ? 'Ödendi' : s === 'kismi' ? 'Kısmi' : 'Bekliyor'}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <input type="number" min="0" step="0.01" className="input-field w-[140px] text-xs"
                          placeholder="Alınan miktar (₺)" value={editPaid} onChange={e => setEditPaid(e.target.value)} />
                        <input className="input-field min-w-[200px] flex-1 text-xs"
                          placeholder="Not" value={editNote} onChange={e => setEditNote(e.target.value)} />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={saveEdit} disabled={saving}
                        className="btn-primary text-xs">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
                      <button type="button" onClick={() => setEditingId(null)}
                        className="rounded-lg border border-app-border px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-app-bg-soft transition">İptal</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// RAPOR

function ReportsTab({
  orders, athletes,
}: {
  orders: AthleteOrder[]; athletes: Athlete[]
}) {
  // Borçlu sporcular
  const debtors = useMemo(() =>
    orders.filter(o => o.payment_status === 'kismi' || o.payment_status === 'bekliyor'),
    [orders],
  )

  // Bekleyen sipariş (sipariş verilmedi)
  const notOrdered = useMemo(() =>
    orders.filter(o => !o.is_ordered),
    [orders],
  )

  // Teslim edilmeyenler
  const notDelivered = useMemo(() =>
    orders.filter(o => o.is_ordered && !o.is_delivered),
    [orders],
  )

  return (
    <div className="space-y-4">
      {/* Borçlu sporcular */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Borç Durumu</h2>
        {debtors.length === 0 ? (
          <p className="mt-3 text-xs text-emerald-700">✅ Borçlu sporcu yok.</p>
        ) : (
          <div className="mt-3 space-y-1">
            {debtors.map(o => {
              const a = athletes.find(x => x.id === o.athlete_id)
              const debt = o.total_amount - (o.paid_amount ?? 0)
              return (
                <div key={o.id} className="rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-800">{a ? `${a.first_name} ${a.last_name}` : '—'}</p>
                  <p className="text-[11px] text-slate-600">
                    {o.total_amount}₺ · {o.paid_amount ? `${o.paid_amount}₺ ödendi, ` : ''}
                    <span className="font-semibold text-rose-700">{debt.toFixed(2)}₺ borç</span>
                  </p>
                  {o.note && <p className="text-[11px] text-brand-muted">📝 {o.note}</p>}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Sipariş verilmeyenler */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Sipariş Verilmeyenler</h2>
        {notOrdered.length === 0 ? (
          <p className="mt-3 text-xs text-emerald-700">✅ Tüm siparişler verilmiş.</p>
        ) : (
          <div className="mt-3 space-y-1">
            {notOrdered.map(o => {
              const a = athletes.find(x => x.id === o.athlete_id)
              return (
                <div key={o.id} className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-800">{a ? `${a.first_name} ${a.last_name}` : '—'}</p>
                  <p className="text-[11px] text-brand-muted">{o.total_amount}₺ · {new Date(o.created_at).toLocaleDateString('tr-TR')}</p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Teslim edilmeyenler */}
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Teslim Edilmeyenler</h2>
        {notDelivered.length === 0 ? (
          <p className="mt-3 text-xs text-emerald-700">✅ Tüm siparişler teslim edilmiş.</p>
        ) : (
          <div className="mt-3 space-y-1">
            {notDelivered.map(o => {
              const a = athletes.find(x => x.id === o.athlete_id)
              return (
                <div key={o.id} className="rounded-xl border border-sky-200 bg-sky-50/50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-800">{a ? `${a.first_name} ${a.last_name}` : '—'}</p>
                  <p className="text-[11px] text-brand-muted">{o.total_amount}₺ · {new Date(o.created_at).toLocaleDateString('tr-TR')}</p>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
