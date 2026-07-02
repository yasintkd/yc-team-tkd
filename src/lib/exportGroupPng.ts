import { BRAND } from './brand'
import logoUrl from '../assets/logo-team-taekwondo.png'

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
.subtitle { margin-top: 4px; margin-bottom: 20px; font-size: 13px; color: #5a6b7d; }
table { width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
thead { background: #b21f24; }
th { padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff; }
.num-th { width: 48px; text-align: center; }
tbody tr { background: #ffffff; border-bottom: 1px solid #eef6fc; }
tbody tr:last-child { border-bottom: none; }
tbody tr:nth-child(even) { background: #f8fafd; }
td { padding: 10px 16px; font-size: 14px; color: #2c2c34; }
td.num { text-align: center; font-weight: 700; color: #b21f24; font-size: 13px; }
td.name { font-weight: 600; }
td.belt { font-size: 13px; }
td.age { font-size: 13px; color: #5a6b7d; }
.footer { margin-top: 24px; text-align: center; font-size: 11px; color: #8a9db0; }
.schedule-info { text-align: center; margin-bottom: 16px; font-size: 13px; color: #5a6b7d; }
.schedule-table { margin-bottom: 24px; }
.schedule-table table { width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.schedule-table thead { background: #b21f24; }
.schedule-table th { padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff; }
.schedule-table td { padding: 10px 16px; font-size: 13px; color: #2c2c34; }
.schedule-table tbody tr { background: #ffffff; border-bottom: 1px solid #eef6fc; }
.schedule-table tbody tr:last-child { border-bottom: none; }
.schedule-table tbody tr:nth-child(even) { background: #f8fafd; }
.two-col { display: flex; gap: 20px; }
.two-col .col { flex: 1; min-width: 0; }
.two-col .col table { margin-bottom: 0; }
`

type AthleteRow = { firstName: string; lastName: string; belt: string; birthYear: string | null; age: number | null }
type ScheduleInfo = { dayLabel: string; timeRange: string }

export async function exportGroupPng(params: {
  groupName: string
  groupNotes: string | null
  schedules: ScheduleInfo[]
  athletes: AthleteRow[]
}) {
  const { groupName, groupNotes, schedules, athletes } = params

  const subtitle = groupNotes || `${athletes.length} sporcu`

  const schedHtml = schedules.length > 0
    ? `<div class="schedule-table"><table><thead><tr><th>Gün</th><th>Saat</th></tr></thead><tbody>${schedules.map(s => `<tr><td><strong>${escapeHtml(s.dayLabel)}</strong></td><td>${escapeHtml(s.timeRange)}</td></tr>`).join('')}</tbody></table></div>`
    : ''

  function makeRows(list: AthleteRow[], startIndex: number) {
    return list.map((a, i) => {
      const ageStr = a.age != null ? `${a.birthYear} · ${a.age} yaş` : a.birthYear ?? ''
      return `<tr><td class="num">${startIndex + i + 1}</td><td class="name">${escapeHtml(a.firstName + ' ' + a.lastName)}</td><td class="belt">${escapeHtml(a.belt)}</td><td class="age">${escapeHtml(ageStr)}</td></tr>`
    }).join('')
  }

  const tableHeader = '<thead><tr><th class="num-th">#</th><th class="name-th">Sporcu</th><th class="belt-th">Kuşak</th><th class="age-th">Yaş</th></tr></thead>'

  let listHtml: string
  if (athletes.length > 10) {
    const half = Math.ceil(athletes.length / 2)
    const left = athletes.slice(0, half)
    const right = athletes.slice(half)
    listHtml = `<div class="two-col"><div class="col"><table>${tableHeader}<tbody>${makeRows(left, 0)}</tbody></table></div><div class="col"><table>${tableHeader}<tbody>${makeRows(right, half)}</tbody></table></div></div>`
  } else {
    listHtml = `<table>${tableHeader}<tbody>${makeRows(athletes, 0)}</tbody></table>`
  }

  const body = `
    <div class="header">
      <img src="${logoUrl}" alt="${escapeHtml(BRAND.name)}" class="logo" />
      <h1>${escapeHtml(groupName)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
      ${schedHtml}
    </div>
    ${listHtml}
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

    const link = document.createElement('a')
    link.download = `${safeFilename(groupName)}-grup-listesi.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } finally {
    document.body.removeChild(iframe)
  }
}