import { BRAND } from './brand'
import logoUrl from '../assets/logo-team-taekwondo.png'
import { downloadPng } from './exportPng'

export type CompPngInput = {
  competitionTitle: string
  competitionDate: string
  participants: {
    number: number
    name: string
    belt: string
    weight: string
  }[]
}

function safeFilename(name: string) {
  return name
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'yarisma'
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildBodyHtml(data: CompPngInput) {
  const rows = data.participants
    .map(
      (p) => `
        <tr>
          <td class="num">${p.number}</td>
          <td class="name">${escapeHtml(p.name)}</td>
          <td class="belt">${escapeHtml(p.belt)}</td>
          <td class="weight">${p.weight ? escapeHtml(p.weight) : '—'}</td>
        </tr>`,
    )
    .join('')

  return `
    <div class="header">
      <img src="${logoUrl}" alt="${escapeHtml(BRAND.name)}" class="logo" />
      <h1>${escapeHtml(data.competitionTitle)}</h1>
      <p class="subtitle">${escapeHtml(new Date(data.competitionDate).toLocaleDateString('tr-TR'))} · ${data.participants.length} Katılımcı</p>
    </div>
    <table>
      <thead>
        <tr>
          <th class="num-th">#</th>
          <th class="name-th">Sporcu</th>
          <th class="belt-th">Kuşak</th>
          <th class="weight-th">Kilo</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
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
  .num-th { width: 48px; text-align: center; }
  .name-th {}
  .belt-th { width: 200px; }
  .weight-th { width: 120px; }

  tbody tr {
    background: #ffffff;
    border-bottom: 1px solid #eef6fc;
    transition: background 0.1s;
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
  td.name { font-weight: 600; }
  td.belt {
    font-size: 13px;
    color: #5a6b7d;
  }
  td.weight { font-weight: 500; }

  .footer {
    margin-top: 24px;
    text-align: center;
    font-size: 11px;
    color: #8a9db0;
  }
`

function waitForImages(doc: Document) {
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

export async function downloadCompetitionPng(data: CompPngInput) {
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

    await downloadPng(canvas, `${safeFilename(data.competitionTitle)}-katilimcilar.png`)
  } finally {
    document.body.removeChild(iframe)
  }
}
