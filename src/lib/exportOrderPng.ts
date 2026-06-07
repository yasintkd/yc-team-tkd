import { BRAND } from './brand'
import logoUrl from '../assets/logo-team-taekwondo.png'

export type OrderPngItem = {
  productName: string
  /** Formatted size info like "130cm" or "-" */
  sizeInfo: string
  quantity: number
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildBodyHtml(items: OrderPngItem[], orderCount: number) {
  const rows = items
    .map(
      (p, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="name">${escapeHtml(p.productName)}</td>
          <td class="size">${escapeHtml(p.sizeInfo)}</td>
          <td class="qty">${p.quantity}</td>
        </tr>`,
    )
    .join('')

  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
  const totalTypes = items.length

  return `
    <div class="header">
      <img src="${logoUrl}" alt="${escapeHtml(BRAND.name)}" class="logo" />
      <h1>Sipariş Listesi</h1>
      <p class="subtitle">${orderCount} sipariş · ${totalTypes} kalem · Toplam ${totalQty} adet</p>
    </div>
    <table>
      <thead>
        <tr>
          <th class="num-th">#</th>
          <th class="name-th">Ürün</th>
          <th class="size-th">Beden / Ölçü</th>
          <th class="qty-th">Adet</th>
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
  .size-th { }
  .qty-th { width: 80px; text-align: center; }

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
  td.size { font-size: 13px; color: #5a6b7d; }
  td.qty {
    text-align: center;
    font-weight: 700;
    font-size: 16px;
    color: #2c2c34;
  }

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

export async function downloadOrderPng(items: OrderPngItem[], orderCount: number) {
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
<body>${buildBodyHtml(items, orderCount)}</body></html>`,
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

    const link = document.createElement('a')
    link.download = `siparis-listesi.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } finally {
    document.body.removeChild(iframe)
  }
}
