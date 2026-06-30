import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BELTS } from '../lib/belts'
import { X } from 'lucide-react'

type TrainingGroup = { id: string; name: string }

type FormData = {
  first_name: string
  last_name: string
  birth_date: string
  phone: string
  belt: string
  gender: 'erkek' | 'kiz' | ''
  tc_no: string
  mother_name: string
  father_name: string
  parent_name: string
  parent_phone: string
  parent_type: 'anne' | 'baba' | ''
  training_group_id: string
}

const EMPTY_FORM: FormData = {
  first_name: '', last_name: '', birth_date: '', phone: '',
  belt: BELTS[0], gender: '', tc_no: '', mother_name: '', father_name: '',
  parent_name: '', parent_phone: '', parent_type: '', training_group_id: '',
}

function Field({ label, children, col2 = false }: { label: string; children: React.ReactNode; col2?: boolean }) {
  return (
    <div className={`space-y-1 text-xs min-w-0${col2 ? ' sm:col-span-2' : ''}`}>
      <label className="font-medium text-slate-500">{label}</label>
      {children}
    </div>
  )
}

type Props = {
  editingId: string | null
  onSaved: () => Promise<void>
  onClose: () => void
  groups: TrainingGroup[]
}

export default function AthleteFormModal({ editingId, onSaved, onClose, groups }: Props) {
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setField = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const canSubmit = form.first_name.trim().length > 0 && form.last_name.trim().length > 0
  const CURRENT_YEAR = new Date().getFullYear()

  const initForm = (data?: Partial<FormData>) => {
    setForm(data ? { ...EMPTY_FORM, ...data } : EMPTY_FORM)
    setError(null)
  }

  useEffect(() => {
    if (!editingId) { initForm(); return }
    supabase.from('athletes').select('*').eq('id', editingId).single().then(({ data, error: fetchErr }) => {
      if (fetchErr || !data) { setError('Sporcu bilgisi yüklenemedi.'); return }
      initForm({
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        birth_date: data.birth_date ?? '',
        phone: data.phone ?? '',
        belt: data.belt ?? BELTS[0],
        gender: data.gender ?? '',
        tc_no: data.tc_no ?? '',
        mother_name: data.mother_name ?? '',
        father_name: data.father_name ?? '',
        parent_name: data.parent_name ?? '',
        parent_phone: data.parent_phone ?? '',
        parent_type: data.parent_type ?? '',
        training_group_id: data.training_group_id ?? '',
      })
    })
  }, [editingId])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) return
    setSaving(true)
    setError(null)

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      birth_date: form.birth_date || null,
      phone: form.phone.trim() || null,
      belt: form.belt,
      gender: form.gender || null,
      tc_no: form.tc_no.trim() || null,
      mother_name: form.mother_name.trim() || null,
      father_name: form.father_name.trim() || null,
      parent_name: form.parent_name.trim() || null,
      parent_phone: form.parent_phone.trim() || null,
      parent_type: form.parent_type || null,
      training_group_id: form.training_group_id || null,
      branch: 'Taekwondo',
    }

    const { data: insertResult, error: dbErr } = editingId
      ? await supabase.from('athletes').update(payload).eq('id', editingId).select('id').maybeSingle()
      : await supabase.from('athletes').insert(payload).select('id').maybeSingle()

    if (dbErr) { setError(dbErr.message); setSaving(false); return }

    if (!editingId && insertResult?.id) {
      await supabase.from('athlete_licenses').insert({ athlete_id: insertResult.id, year: CURRENT_YEAR - 1 }).maybeSingle()
    }

    await onSaved()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-app-border/40 pb-3">
          <div>
            <h2 className="text-sm font-semibold">{editingId ? 'Sporcu Düzenle' : 'Yeni Sporcu Ekle'}</h2>
            <p className="mt-0.5 text-xs text-brand-muted">
              {editingId ? 'Mevcut sporcunun bilgilerini güncelleyin.' : 'Sisteme yeni bir sporcu ekleyin.'}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-app-border text-slate-500 hover:bg-app-bg-soft transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
        )}

        <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Adı *">
            <input className="input-field" placeholder="Ali" value={form.first_name} onChange={setField('first_name')} />
          </Field>
          <Field label="Soyadı *">
            <input className="input-field" placeholder="Yılmaz" value={form.last_name} onChange={setField('last_name')} />
          </Field>
          <Field label="Doğum Tarihi">
            <input type="date" className="input-field" value={form.birth_date} onChange={setField('birth_date')} />
          </Field>
          <Field label="Cinsiyet">
            <select className="input-field" value={form.gender} onChange={setField('gender')}>
              <option value="">Seçilmedi</option>
              <option value="erkek">Erkek</option>
              <option value="kiz">Kız</option>
            </select>
          </Field>
          <Field label="Telefon">
            <input className="input-field" placeholder="05xx xxx xx xx" value={form.phone} onChange={setField('phone')} />
          </Field>
          <Field label="Kuşak">
            <select className="input-field" value={form.belt} onChange={setField('belt')}>
              {BELTS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Antrenman Grubu" col2>
            <select className="input-field" value={form.training_group_id} onChange={setField('training_group_id')}>
              <option value="">Grup seçilmedi</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>

          <div className="col-span-1 sm:col-span-2 mt-1 border-t border-app-border/40 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Kimlik Bilgileri (Lisans / Tescil)</p>
          </div>
          <Field label="TC Kimlik No" col2>
            <input className="input-field" placeholder="12345678901" maxLength={11} value={form.tc_no} onChange={setField('tc_no')} />
          </Field>
          <Field label="Anne Adı">
            <input className="input-field" placeholder="Fatma" value={form.mother_name} onChange={setField('mother_name')} />
          </Field>
          <Field label="Baba Adı Soyadı">
            <input className="input-field" placeholder="Ahmet Arif" value={form.father_name} onChange={setField('father_name')} />
          </Field>

          <div className="col-span-1 sm:col-span-2 mt-1 border-t border-app-border/40 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Veli İrtibat</p>
          </div>
          <Field label="Veli Telefonu" col2>
            <input className="input-field" placeholder="05xx xxx xx xx" value={form.parent_phone} onChange={setField('parent_phone')} />
          </Field>
          <div className="col-span-1 sm:col-span-2 flex gap-4 text-xs">
            {(['anne', 'baba'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="parent_type" value={t}
                  checked={form.parent_type === t}
                  onChange={() => setForm((p) => ({ ...p, parent_type: t }))}
                  className="accent-brand-cyan" />
                {t === 'anne' ? 'Anne' : 'Baba'}
              </label>
            ))}
          </div>

          <div className="col-span-1 sm:col-span-2 pt-4 flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-app-border bg-white py-2.5 text-sm font-semibold text-slate-600 hover:bg-app-bg-soft transition active:scale-[0.98]">
              Vazgeç
            </button>
            <button type="submit" disabled={!canSubmit || saving} className="btn-primary flex-1">
              {saving ? 'Kaydediliyor...' : editingId ? 'Değişiklikleri Kaydet' : 'Sporcu Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}