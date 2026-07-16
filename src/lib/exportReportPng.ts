/**
 * HTML → PNG export with consistent brand design
 * Matches existing Competition/Order export format.
 *
 * Usage:
 *   await exportReportPng({
 *     title: 'Sporcu Listesi',
 *     subtitle: '45 aktif sporcu',
 *     columns: ['#', 'Ad Soyad', 'Kuşak'],
 *     rows: [['1', 'Ali Yılmaz', 'Sarı'], ...],
 *   })
 */

import { BRAND } from './brand'
import logoUrl from '../assets/logo-team-taekwondo.png'
import { downloadPng } from './exportPng'

export interface ReportPngInput {
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

function buildBodyHtml(data: ReportPngInput) {
  const colTags = data.columns
    .map((c, i) => `<th class="col-${i}">${escapeHtml(c)}</th>`)
    .join('')

  const rowTags = data.rows
    .map(
      (r) => `<tr>
        ${r
          .map(
            (c, ci) =>
              `<td class="${ci === 0 ? 'num' : 'col-' + ci}">${escapeHtml(c)}</td>`,
          )
          .join('')}
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
      <thead>
        <tr>${colTags}</tr>
      </thead>
      <tbody>
        ${rowTags}
      </tbody>
    </table>
    <p class="footer">Oluşturulma: ${escapeHtml(new Date().toLocaleString('tr-TR'))}</p>
  `
}

const pngStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #e3f0fa;
    padding: 40px;
    width: 800px;
  }
  .header { text-align: center; margin-bottom: 28px; }
  .logo { max-width: 220px; height: auto; display: block; margin: 0 auto; }
  h1 {
    margin-top: 16px;
    font-size: 22px;
    font-weight: 700;
    color: #2c2c34;
  }
  .subtitle {
    margin-top: 4px;
    font-size: 13px;
    color: #5a6b7d;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }
  thead {
    background: #b21f24;
  }
  th {
    padding: 12px 16px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #ffffff;
  }
  th.col-0 { width: 48px; text-align: center; }

  tbody tr {
    background: #ffffff;
    border-bottom: 1px solid #eef6fc;
  }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:nth-child(even) { background: #f8fafd; }
  td {
    padding: 10px 16px;
    font-size: 14px;
    color: #2c2c34;
  }
  td.num {
    text-align: center;
    font-weight: 700;
    color: #b21f24;
    font-size: 13px;
  }

  .footer {
    margin-top: 24px;
    text-align: center;
    font-size: 11px;
    color: #8a9db0;
  }
`

async function waitForImages(doc: Document) {
  const images = Array.from(doc.images)
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

export async function downloadReportPng(data: ReportPngInput) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:800px;height:10000px;border:0;visibility:hidden;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Görsel oluşturulamadı.')
  }

  doc.open()
  doc.write(
    `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/><style>${pngStyles}</style></head>
<body>${buildBodyHtml(data)}</body></html>`,
  )
  doc.close()

  try {
    await waitForImages(doc)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const html2canvas = (await import('html2canvas')).default

    iframe.style.width = '800px'
    iframe.style.height = `${doc.body.scrollHeight}px`

    const canvas = await html2canvas(doc.body, {
      backgroundColor: '#e3f0fa',
      scale: 2,
      useCORS: true,
      logging: false,
      width: 800,
      windowWidth: 800,
      height: doc.body.scrollHeight,
      windowHeight: doc.body.scrollHeight,
    })

    await downloadPng(canvas, `${data.filename ?? safeFilename(data.title)}.png`)
  } finally {
    document.body.removeChild(iframe)
  }
}
