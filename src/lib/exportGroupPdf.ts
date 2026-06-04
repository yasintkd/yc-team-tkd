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

  // list-style:none — numarayı biz veriyoruz, çift numara yok
  const athleteRows =
    data.athletes.length === 0
      ? '<p class="muted">Grupta kayıtlı sporcu yok.</p>'
      : `<ul class="athlete-list">
          ${data.athletes
            .map(
              (a, i) =>
                `<li><span class="num">${i + 1}.</span>${escapeHtml(a.firstName)} ${escapeHtml(a.lastName)}</li>`,
            )
            .join('')}
        </ul>`

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
    padding: 32px 36px 48px 36px;
    width: 680px;
  }
  .header { text-align: center; margin-bottom: 20px; }
  .logo { max-width: 200px; height: auto; display: block; margin: 0 auto; }
  .brand { margin-top: 10px; font-size: 12px; color: #666666; }
  hr { border: none; border-top: 1px solid #cccccc; margin: 16px 0; }
  h1 { font-size: 20px; margin-bottom: 6px; font-weight: 700; }
  h2 { font-size: 14px; margin: 20px 0 8px; color: #333333; font-weight: 600; }
  .notes { margin-top: 8px; font-size: 13px; color: #444444; }
  .list { list-style: disc; padding-left: 20px; font-size: 14px; line-height: 1.65; }

  /* Sporcu listesi */
  .athlete-list { list-style: none; padding-left: 0; font-size: 14px; }
  .athlete-list li {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 4px 0;
    border-bottom: 1px solid #f0f0f0;
    line-height: 1.6;
  }
  .athlete-list li:last-child { border-bottom: none; }
  .num { display: inline-block; min-width: 26px; font-size: 12px; color: #888888; flex-shrink: 0; }

  .muted { font-size: 13px; color: #666666; }
  .footer { margin-top: 32px; font-size: 11px; color: #888888; }
`

function waitForImages(doc: Document) {
  const images = [...doc.images]
  if (images.length === 0) return Promise.resolve()
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve()
          else { img.onload = () => resolve(); img.onerror = () => resolve() }
        }),
    ),
  )
}

export async function downloadGroupListPdf(data: GroupPdfInput) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:680px;height:8000px;border:0;visibility:hidden;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) { document.body.removeChild(iframe); throw new Error('PDF oluşturulamadı.') }

  doc.open()
  doc.write(`<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/><style>${iframeStyles}</style></head>
<body>${buildBodyHtml(data)}</body></html>`)
  doc.close()

  try {
    await waitForImages(doc)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const html2canvas = (await import('html2canvas')).default
    const { jsPDF }   = await import('jspdf')

    const canvas = await html2canvas(doc.body, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      width: 680,
      windowWidth: 680,
    })

    // ── PDF sayfa boyutu & kenar boşlukları ──────────────────────────────────
    const pdf     = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const pageW   = pdf.internal.pageSize.getWidth()   // 210 mm
    const pageH   = pdf.internal.pageSize.getHeight()  // 297 mm
    const marginX = 10  // sol-sağ (mm)
    const marginT = 12  // üst (mm)
    const marginB = 16  // alt (mm) — biraz daha geniş bırak
    const printW  = pageW - marginX * 2   // 190 mm
    const printH  = pageH - marginT - marginB  // 269 mm

    // canvas piksel → mm katsayısı (scale:2 dahil)
    const pxToMm = printW / canvas.width  // mm/px

    // ── Sporcu satırlarının kesme noktalarını bul ─────────────────────────────
    // iframe içindeki .athlete-list li elemanlarının getBoundingClientRect()
    // body'nin sol üst köşesine göre konumlarını verir (scale:1 px cinsinden)
    const athleteEls = Array.from(doc.querySelectorAll<HTMLElement>('.athlete-list li'))

    // Her li'nin üst kenarı — mm, scale:2 için ×2
    const rowTopsMm: number[] = athleteEls.map(
      (el) => el.getBoundingClientRect().top * 2 * pxToMm,
    )
    const rowBotsMm: number[] = athleteEls.map(
      (el) => el.getBoundingClientRect().bottom * 2 * pxToMm,
    )

    // Kesme noktaları: bir satır sayfaya sığmayacaksa o satırın üstünden kes
    const pageBreaksMm: number[] = []
    let pageEndMm = printH  // mevcut sayfanın içerik bitişi (mm)

    for (let i = 0; i < rowBotsMm.length; i++) {
      if (rowBotsMm[i] > pageEndMm) {
        // Bu satır sayfaya sığmıyor — satırın başından yeni sayfa aç
        const breakAt = rowTopsMm[i]
        pageBreaksMm.push(breakAt)
        pageEndMm = breakAt + printH  // bir sonraki sayfanın sonu
      }
    }

    // ── Canvas'ı satır hizalı dilimler halinde PDF'e yaz ─────────────────────
    const totalMm = canvas.height * pxToMm
    const cuts    = [0, ...pageBreaksMm, totalMm]  // başlangıç + kesme + son

    for (let p = 0; p < cuts.length - 1; p++) {
      if (p > 0) pdf.addPage()

      const sliceTopMm = cuts[p]
      const sliceBotMm = cuts[p + 1]
      const sliceHmm   = sliceBotMm - sliceTopMm

      // Piksel koordinatları
      const sliceTopPx = sliceTopMm / pxToMm
      const sliceHpx   = sliceHmm   / pxToMm

      // Dilim canvas — beyaz zemin üzerine kes
      const sc   = document.createElement('canvas')
      sc.width   = canvas.width
      sc.height  = Math.ceil(sliceHpx)
      const ctx  = sc.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, sc.width, sc.height)
      ctx.drawImage(
        canvas,
        0, sliceTopPx, canvas.width, sliceHpx,  // kaynak
        0, 0,          canvas.width, sliceHpx,  // hedef
      )

      pdf.addImage(sc.toDataURL('image/png'), 'PNG', marginX, marginT, printW, sliceHmm)
    }

    pdf.save(`${safeFilename(data.groupName)}-liste.pdf`)
  } finally {
    document.body.removeChild(iframe)
  }
}