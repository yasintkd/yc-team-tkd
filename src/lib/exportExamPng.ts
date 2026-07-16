import { BRAND } from './brand'
import logoUrl from '../assets/logo-team-taekwondo.png'
import { downloadPng } from './exportPng'

function escapeHtml(text: string | number) {
  return String(text).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"')
}

function safeFilename(name: string) {
  return name.trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').slice(0, 60) || 'rapor'
}

const pngStyles = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #e3f0fa; padding: 40px; width: 800px; }
.header { text-align: center; margin-bottom: 28px; }
.logo { max-width: 220px; height: auto; display: block; margin: 0 auto; }
h1 { margin-top: 16px; font-size: 22px; font-weight: 700; color: #2c2c34; }
.subtitle { margin-top: 4px; font-size: 13px; color: #5a6b7d; }
table { width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
thead { background: #b21f24; }
th { padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff; }
.num-th { width: 48px; text-align: center; }
.check-th { width: 60px; text-align: center; }
tbody tr { background: #ffffff; border-bottom: 1px solid #eef6fc; }
tbody tr:last-child { border-bottom: none; }
tbody tr:nth-child(even) { background: #f8fafd; }
td { padding: 10px 16px; font-size: 14px; color: #2c2c34; }
td.num { text-align: center; font-weight: 700; color: #b21f24; font-size: 13px; }
td.name { font-weight: 600; }
td.fee { font-size: 13px; }
td.check { text-align: center; }
.check-box { font-size: 18px; color: #5a6b7d; }
.footer { margin-top: 24px; text-align: center; font-size: 11px; color: #8a9db0; }
`

type Participant = { id: string; belt_before: string; target_belt: string; fee_paid: boolean; athletes: any }

export async function exportExamPng(
  participants: Participant[],
  title: string,
  examDate: string,
  type: 'attendance' | 'result',
) {
  const sorted = [...participants].sort((a, b) => {
    const aWhite = a.belt_before.toLowerCase().startsWith('beyaz')
    const bWhite = b.belt_before.toLowerCase().startsWith('beyaz')
    if (aWhite && !bWhite) return -1
    if (!aWhite && bWhite) return 1
    const nameA = athleteName(a)
    const nameB = athleteName(b)
    return nameA.localeCompare(nameB)
  })

  const isAttendance = type === 'attendance'

  const rows = sorted.map((p, i) => isAttendance
    ? `<tr><td class="num">${i + 1}</td><td class="name">${escapeHtml(athleteName(p))}</td><td class="belt">${escapeHtml(p.belt_before)}</td><td class="fee">${p.fee_paid ? 'Ödendi' : 'Ödemedi'}</td><td class="check"><span class="check-box">☐</span></td></tr>`
    : `<tr><td class="num">${i + 1}</td><td class="name">${escapeHtml(athleteName(p))}</td><td class="belt">${escapeHtml(p.target_belt)}</td></tr>`
  ).join('')

  const colTags = isAttendance
    ? '<th class="num-th">#</th><th class="name-th">Sporcu</th><th class="belt-th">Mevcut Kuşak</th><th class="fee-th">Ücret</th><th class="check-th">Katılım</th>'
    : '<th class="num-th">#</th><th class="name-th">Sporcu</th><th class="belt-th">Geçtiği Kuşak</th>'

  const subtitle = isAttendance
    ? `${new Date(examDate).toLocaleDateString('tr-TR')} · ${participants.length} Katılımcı`
    : `${new Date(examDate).toLocaleDateString('tr-TR')} · ${participants.length} Sporcu yükseldi`

  const body = `
    <div class="header">
      <img src="${logoUrl}" alt="${escapeHtml(BRAND.name)}" class="logo" />
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
    </div>
    <table><thead><tr>${colTags}</tr></thead><tbody>${rows}</tbody></table>
    <p class="footer">Oluşturulma: ${escapeHtml(new Date().toLocaleString('tr-TR'))}</p>
  `

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:10000px;border:0;visibility:hidden;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) { document.body.removeChild(iframe); throw new Error('Görsel oluşturulamadı.') }

  doc.open()
  doc.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><style>${pngStyles}</style></head><body>${body}</body></html>`)
  doc.close()

  try {
    const images = Array.from(doc.images)
    if (images.length > 0) {
      await Promise.all(images.map((img) => new Promise<void>((resolve) => {
        if (img.complete) resolve()
        else { img.onload = () => resolve(); img.onerror = () => resolve() }
      })))
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const html2canvas = (await import('html2canvas')).default
    iframe.style.width = '800px'
    iframe.style.height = `${doc.body.scrollHeight}px`

    const canvas = await html2canvas(doc.body, {
      backgroundColor: '#e3f0fa', scale: 2, useCORS: true, logging: false,
      width: 800, windowWidth: 800, height: doc.body.scrollHeight, windowHeight: doc.body.scrollHeight,
    })

    const suffix = isAttendance ? 'yoklama-listesi' : 'sonuc'
    await downloadPng(canvas, `${safeFilename(title)}-${suffix}.png`)
  } finally {
    document.body.removeChild(iframe)
  }
}

function athleteName(p: Participant) {
  const a = Array.isArray(p.athletes) ? p.athletes[0] : p.athletes
  return a ? `${a.first_name} ${a.last_name}` : p.id
}