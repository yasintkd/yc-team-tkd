/**
 * HTML → PDF export with consistent brand design
 * Uses jsPDF + html2canvas like existing exportGroupPdf.ts
 */

import { BRAND } from './brand'
import logoUrl from '../assets/logo-team-taekwondo.png'

export interface ReportPdfInput {
  title: string
  subtitle?: string
  columns: string[]
  rows: (string | number)[][]
  filename?: string
}

function escapeHtml(text: string | number): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeFilename(name: string) {
  return name
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'rapor'
}

function buildBodyHtml(data: ReportPdfInput) {
  const colTags = data.columns
    .map((c) => `<th>${escapeHtml(c)}</th>`)
    .join('')

  const rowTags = data.rows
    .map(
      (r) => `<tr>
        ${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}
      </tr>`,
    )
    .join('')

  return `
    <div class="header">
      <img src="${logoUrl}" alt="${escapeHtml(BRAND.name)}" class="logo" />
      <h1>${escapeHtml(data.title)}</h1>
      ${data.subtitle ? `<p class="subtitle">${escapeHtml(data.subtitle)}</p>` : ''}
    </div>
    <table>
      <thead><tr>${colTags}</tr></thead>
      <tbody>${rowTags}</tbody>
    </table>
    <p class="footer">Oluşturulma: ${escapeHtml(new Date().toLocaleString('tr-TR'))}</p>
  `
}

const pdfStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #ffffff;
    padding: 24px 28px;
    width: 680px;
  }
  .header { text-align: center; margin-bottom: 20px; }
  .logo { max-width: 180px; height: auto; display: block; margin: 0 auto; }
  h1 { margin-top: 12px; font-size: 18px; font-weight: 700; color: #2c2c34; }
  .subtitle { margin-top: 2px; font-size: 12px; color: #5a6b7d; }

  table { width: 100%; border-collapse: collapse; margin-top: 16px; border-radius: 8px; overflow: hidden; }
  thead { background: #b21f24; }
  th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #fff; }
  th:first-child { width: 32px; text-align: center; }

  tbody tr { background: #fff; border-bottom: 1px solid #eef6fc; }
  tbody tr:nth-child(even) { background: #f8fafd; }
  td { padding: 6px 12px; font-size: 12px; color: #2c2c34; }
  td:first-child { text-align: center; font-weight: 700; color: #b21f24; font-size: 11px; }

  .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #8a9db0; }
`

async function waitForImages(doc: Document) {
  const images = Array.from(doc.images)
  if (images.length === 0) return
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve()
          else { img.onload = () => resolve(); img.onerror = () => resolve() }
        }),
    ),
  )
}

export async function downloadReportPdf(data: ReportPdfInput) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:680px;height:8000px;border:0;visibility:hidden;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) { document.body.removeChild(iframe); throw new Error('PDF oluşturulamadı.') }

  doc.open()
  doc.write(`<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/><style>${pdfStyles}</style></head>
<body>${buildBodyHtml(data)}</body></html>`)
  doc.close()

  try {
    await waitForImages(doc)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const html2canvas = (await import('html2canvas')).default
    const { jsPDF } = await import('jspdf')

    const canvas = await html2canvas(doc.body, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      width: 680,
      windowWidth: 680,
    })

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const marginX = 10
    const marginT = 12
    const marginB = 16
    const printW = pageW - marginX * 2
    const printH = pageH - marginT - marginB
    const pxToMm = printW / canvas.width

    const totalMm = canvas.height * pxToMm

    if (totalMm <= printH) {
      // Tek sayfa
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', marginX, marginT, printW, totalMm)
    } else {
      // Çok sayfa — satır bazında kes
      const rowEls = Array.from(doc.querySelectorAll('tbody tr'))
      const rowTopsMm = rowEls.map((el) => (el as HTMLElement).getBoundingClientRect().top * 2 * pxToMm)
      const rowBotsMm = rowEls.map((el) => (el as HTMLElement).getBoundingClientRect().bottom * 2 * pxToMm)

      const breaks: number[] = []
      let pageEnd = printH
      for (let i = 0; i < rowBotsMm.length; i++) {
        if (rowBotsMm[i] > pageEnd) {
          breaks.push(rowTopsMm[i])
          pageEnd = rowTopsMm[i] + printH
        }
      }

      const cuts = [0, ...breaks, totalMm]
      for (let p = 0; p < cuts.length - 1; p++) {
        if (p > 0) pdf.addPage()
        const sliceTop = cuts[p]
        const sliceBot = cuts[p + 1]
        const sliceH = sliceBot - sliceTop

        const sc = document.createElement('canvas')
        sc.width = canvas.width
        sc.height = Math.ceil(sliceH / pxToMm)
        const ctx = sc.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, sc.width, sc.height)
        ctx.drawImage(canvas, 0, sliceTop / pxToMm, canvas.width, sc.height, 0, 0, sc.width, sc.height)

        pdf.addImage(sc.toDataURL('image/png'), 'PNG', marginX, marginT, printW, sliceH)
      }
    }

    pdf.save(`${data.filename ?? safeFilename(data.title)}.pdf`)
  } finally {
    document.body.removeChild(iframe)
  }
}
