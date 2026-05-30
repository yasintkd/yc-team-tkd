import logoUrl from '../assets/logo-team-taekwondo.png'
import { BRAND } from './brand'

export type GroupPdfInput = {
  groupName: string
  groupNotes: string | null
  schedules: { dayLabel: string; timeRange: string }[]
  athletes: { firstName: string; lastName: string }[]
}

function safeFilename(name: string) {
  return name
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'grup'
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildBodyHtml(data: GroupPdfInput) {
  const scheduleRows =
    data.schedules.length === 0
      ? '<p class="muted">Program tanımlı değil.</p>'
      : `<ul class="list">
          ${data.schedules
            .map(
              (s) =>
                `<li><strong>${escapeHtml(s.dayLabel)}</strong> — ${escapeHtml(s.timeRange)}</li>`,
            )
            .join('')}
        </ul>`

  const athleteRows =
    data.athletes.length === 0
      ? '<p class="muted">Grupta kayıtlı sporcu yok.</p>'
      : `<ol class="list numbered">
          ${data.athletes
            .map(
              (a, i) =>
                `<li>${i + 1}. ${escapeHtml(a.firstName)} ${escapeHtml(a.lastName)}</li>`,
            )
            .join('')}
        </ol>`

  const notesBlock = data.groupNotes
    ? `<p class="notes">${escapeHtml(data.groupNotes)}</p>`
    : ''

  return `
    <div class="header">
      <img src="${logoUrl}" alt="${escapeHtml(BRAND.name)}" class="logo" />
      <p class="brand">${escapeHtml(BRAND.name)}</p>
    </div>
    <hr />
    <h1>${escapeHtml(data.groupName)}</h1>
    ${notesBlock}
    <h2>Antrenman programı</h2>
    ${scheduleRows}
    <h2>Sporcu listesi (${data.athletes.length})</h2>
    ${athleteRows}
    <p class="footer">Oluşturulma: ${escapeHtml(new Date().toLocaleString('tr-TR'))}</p>
  `
}

const iframeStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    background: #ffffff;
    padding: 28px 32px;
    width: 680px;
  }
  .header { text-align: center; margin-bottom: 20px; }
  .logo { max-width: 200px; height: auto; display: block; margin: 0 auto; }
  .brand { margin-top: 10px; font-size: 12px; color: #666666; }
  hr { border: none; border-top: 1px solid #cccccc; margin: 16px 0; }
  h1 { font-size: 20px; margin-bottom: 6px; font-weight: 700; }
  h2 { font-size: 14px; margin: 20px 0 8px; color: #333333; font-weight: 600; }
  .notes { margin-top: 8px; font-size: 13px; color: #444444; }
  .list { padding-left: 20px; font-size: 14px; line-height: 1.65; }
  .list.numbered { padding-left: 24px; line-height: 1.75; }
  .muted { font-size: 13px; color: #666666; }
  .footer { margin-top: 24px; font-size: 11px; color: #888888; }
`

function waitForImages(doc: Document) {
  const images = [...doc.images]
  if (images.length === 0) return Promise.resolve()
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve()
          else {
            img.onload = () => resolve()
            img.onerror = () => resolve()
          }
        }),
    ),
  )
}


export async function downloadGroupListPdf(data: GroupPdfInput) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:680px;height:4000px;border:0;visibility:hidden;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('PDF oluşturulamadı.')
  }

  doc.open()
  doc.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>${iframeStyles}</style>
</head>
<body>${buildBodyHtml(data)}</body>
</html>`)
  doc.close()

  try {
    await waitForImages(doc)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(doc.body, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      width: 680,
      windowWidth: 680,
    })

    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    const imgData = canvas.toDataURL('image/png')
    let heightLeft = imgHeight
    let position = 0

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    pdf.save(`${safeFilename(data.groupName)}-liste.pdf`)
  } finally {
    document.body.removeChild(iframe)
  }
}
