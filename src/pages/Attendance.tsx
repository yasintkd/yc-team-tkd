import { useState, useEffect } from 'react';
import type { FormEvent } from 'react'; // FormEvent'i bu şekilde ayırın
import { BELTS } from '../lib/belts';

const Athletes = () => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [parentFirstName, setParentFirstName] = useState('');
  const [parentLastName, setParentLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [belt, setBelt] = useState('');
  const [trainingGroupId, setTrainingGroupId] = useState('');
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    loadAthletes();
  }, []);

  const loadAthletes = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/grup');
      if (!response.ok) throw new Error('Gruplar yüklenirken bir hata oluştu');
      const data = await response.json();
      setGroups(data);
    } catch (error: any) {
      setError(error.message);
    }
    setSaving(false);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!canSubmit || saving) return;

    try {
      const response = await fetch('/api/sporcu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          birth_date: birthDate,
          phone: phone,
          belt: belt,
          group_id: trainingGroupId,
          parent_first_name: parentFirstName,
          parent_last_name: parentLastName,
        }),
      });

      if (!response.ok) {
        throw new Error('Sporcu eklenirken bir hata oluştu');
      }

      setParentFirstName('');
      setParentLastName('');
      setFirstName('');
      setLastName('');
      setBirthDate('');
      setPhone('');
      setBelt('');
      setTrainingGroupId('');

      await loadAthletes();
      setSaving(false);
    } catch (error: any) {
      setError(error.message);
      setSaving(false);
    }
  };

  const canSubmit = firstName && lastName && birthDate && phone && belt;

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">Yeni Sporcu Kaydı</h2>
        <p className="mt-1 text-xs text-brand-muted">
          YÇ Team Taekwondo salonuna yeni öğrenci ekleyin.
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="firstName">
              Adı
            </label>
            <input
              id="firstName"
              className="input-field"
              placeholder="Örn: Ali"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="lastName">
              Soyadı
            </label>
            <input
              id="lastName"
              className="input-field"
              placeholder="Örn: Yılmaz"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="birthDate">
              Doğum Tarihi
            </label>
            <input
              id="birthDate"
              type="date"
              className="input-field"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="phone">
              Telefon
            </label>
            <input
              id="phone"
              className="input-field"
              placeholder="Örn: 05xx xxx xx xx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="belt">
              Kuşak
            </label>
            <select
              id="belt"
              className="input-field"
              value={belt}
              onChange={(e) => setBelt(e.target.value)}
            >
              {BELTS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="group">
              Antrenman Grubu
            </label>
            <select
              id="group"
              className="input-field"
              value={trainingGroupId}
              onChange={(e) => setTrainingGroupId(e.target.value)}
            >
              <option value="">Grup seçilmedi</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="parentFirstName">
              Veli Adı
            </label>
            <input
              id="parentFirstName"
              className="input-field"
              placeholder="Örn: Ayşe"
              value={parentFirstName}
              onChange={(e) => setParentFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-slate-600" htmlFor="parentLastName">
              Veli Soyadı
            </label>
            <input
              id="parentLastName"
              className="input-field"
              placeholder="Örn: Yılmaz"
              value={parentLastName}
              onChange={(e) => setParentLastName(e.target.value)}
            />
          </div>

          <div className="flex sm:col-span-2 sm:justify-end">
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="btn-primary w-full sm:w-auto"
            >
              {saving ? 'Kaydediliyor...' : 'Sporcu Ekle'}
            </button>
          </div>
        </form>
      </section>

      {/* ... */}
    </div>
  );
};

export default Athletes;
