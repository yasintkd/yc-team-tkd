/**
 * Tescil fişi PDF oluşturucu.
 *
 * Kullanım:
 *   import { downloadTescilPdf } from './exportTescilPdf'
 *   await downloadTescilPdf({
 *     tc_no: '12345678901',
 *     first_name: 'Ali',
 *     last_name: 'Yılmaz',
 *     birth_date: '2010-05-15',
 *     mother_name: 'Ayşe',
 *     father_name: 'Mehmet',
 *   })
 *
 * Bağımlılıklar: jspdf (npm install jspdf)
 * Şablon: tescil_sablon.jpg (bu dosyayla aynı dizine koy)
 */

import { jsPDF } from 'jspdf'
import sablonUrl from './tescil_sablon.jpg'

export type TescilInput = {
  tc_no: string | null
  first_name: string
  last_name: string
  birth_date: string | null // 'YYYY-MM-DD'
  mother_name: string | null
  father_name: string | null
}

function s(v: string | null | undefined): string {
  return v?.trim() ?? ''
}

function fmtBirth(d: string | null | undefined): string {
  if (!d) return ''
  try {
    const [y, m, day] = d.slice(0, 10).split('-')
    return `${day}.${m}.${y}`
  } catch {
    return d ?? ''
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

export async function downloadTescilPdf(data: TescilInput): Promise<void> {
  const tc = s(data.tc_no)
  const ad = s(data.first_name)
  const soyad = s(data.last_name)
  const dogum = fmtBirth(data.birth_date)
  const ana = s(data.mother_name)
  const baba = s(data.father_name)
  const veli = [baba, soyad].filter(Boolean).join(' ')

  const templateImg = await loadImage(sablonUrl)

  const IMG_W = 1170
  const IMG_H = 827

  const canvas = document.createElement('canvas')
  canvas.width = IMG_W
  canvas.height = IMG_H
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(templateImg, 0, 0, IMG_W, IMG_H)

  const FONT_SIZE = 14
  ctx.font = `bold ${FONT_SIZE}px Arial, sans-serif`
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'top'

  // Sol blok — sporcu bilgileri
  const solFields: [string, number, number][] = [
    [tc, 263, 91],
    [ad, 288, 107],
    [soyad, 284, 124],
    [dogum, 269, 141],
    [ana, 284, 157],
    [baba, 262, 174],
  ]

  const veliField: [string, number, number] = [veli, 28, 263]

  // Sağ blok — sporcu kimlik bilgileri
  const sagFields: [string, number, number][] = [
    [tc, 792, 279],
    [ad, 792, 296],
    [soyad, 792, 313],
    [baba, 792, 329],
    [ana, 792, 346],
    [dogum, 792, 363],
  ]

  ;[...solFields, veliField, ...sagFields].forEach(([val, x, y]) => {
    if (val) ctx.fillText(val, x, y)
  })

  const imgData = canvas.toDataURL('image/jpeg', 0.92)

  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'landscape',
  })

  const pdfW = doc.internal.pageSize.getWidth()
  const pdfH = doc.internal.pageSize.getHeight()

  doc.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH)

  const fname =
    `${ad}_${soyad}_tescil.pdf`
      .replace(/\s+/g, '_')
      .replace(/[^\w.-]/g, '') || 'tescil.pdf'

  doc.save(fname)
}