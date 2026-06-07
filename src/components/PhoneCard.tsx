import { useState } from 'react'
import { MessageCircle, Phone, Copy, Check } from 'lucide-react'

interface PhoneCardProps {
  label: string
  contactName: string
  phone: string
  waMessage?: string
  showWelcome?: boolean
}

export default function PhoneCard({
  label,
  contactName,
  phone,
  waMessage = '',
  showWelcome = false,
}: PhoneCardProps) {
  const [copied, setCopied] = useState(false)

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  // Kişi kaydet: vCard indirme
  const saveContact = () => {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contactName}`,
      `N:${contactName};;;;`,
      `TEL;TYPE=CELL:${phone}`,
      'END:VCARD',
    ].join('\n')
    const blob = new Blob([vcard], { type: 'text/vcard' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${contactName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}.vcf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const cleanPhone = phone.replace(/\D/g, '')
  const intl = cleanPhone.startsWith('0') ? '90' + cleanPhone.slice(1) : cleanPhone
  const waUrl = waMessage
    ? `https://wa.me/${intl}?text=${encodeURIComponent(waMessage)}`
    : `https://wa.me/${intl}`

  return (
    <div className="rounded-xl border border-app-border bg-white px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{phone}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {/* Ara */}
        <a
          href={`tel:${phone.replace(/\s/g, '')}`}
          className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-app-bg-soft px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 transition"
        >
          <Phone className="h-3 w-3" />
          Ara
        </a>
        {/* Kopyala */}
        <button
          type="button"
          onClick={() => void copyPhone()}
          className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-app-bg-soft px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-app-bg-soft transition"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
        {/* Kişi kaydet */}
        <button
          type="button"
          onClick={saveContact}
          className="inline-flex items-center gap-1 rounded-lg border border-app-border bg-app-bg-soft px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 transition"
        >
          Rehbere Kaydet
        </button>
        {/* WhatsApp — normal mesaj */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 transition"
        >
          <MessageCircle className="h-3 w-3" />
          WhatsApp
        </a>
        {/* Karşılama mesajı — sadece veli kartında */}
        {showWelcome && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-100 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-200 transition"
          >
            <MessageCircle className="h-3 w-3" />
            Karşılama Mesajı Gönder
          </a>
        )}
      </div>
    </div>
  )
}
