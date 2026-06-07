/**
 * exportTescilPdf.ts
 *
 * KURULUM:
 *  1. tescil_sablon.jpg dosyasını → src/assets/tescil_sablon.jpg  konumuna kopyalayın
 *  2. Bu dosyayı                  → src/lib/exportTescilPdf.ts    konumuna kopyalayın
 *
 * KULLANIM (Athletes.tsx):
 *   import { downloadTescilPdf } from '../lib/exportTescilPdf'
 *
 *   const downloadTescil = async (a: Athlete) => {
 *     try {
 *       await downloadTescilPdf({
 *         tc_no:       a.tc_no,
 *         first_name:  a.first_name,
 *         last_name:   a.last_name,
 *         birth_date:  a.birth_date,
 *         mother_name: a.mother_name,
 *         father_name: a.father_name,
 *       })
 *     } catch {
 *       setError('Tescil fişi oluşturulamadı.')
 *     }
 *   }
 *
 * Yöntem: Şablon görüntüsü arka plan olarak eklenir, üzerine jsPDF ile
 * sporcu bilgileri doğru koordinatlara yazılır. Sunucu gerekmez.
 */

import { jsPDF } from 'jspdf'
import sablonUrl from '../assets/tescil_sablon.jpg'

export type TescilInput = {
  tc_no:       string | null
  first_name:  string
  last_name:   string
  birth_date:  string | null   // 'YYYY-MM-DD'
  mother_name: string | null
  father_name: string | null
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

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

// ─── Görüntüyü yükle ─────────────────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src     = url
  })
}

// ─── Ana fonksiyon ───────────────────────────────────────────────────────────

export async function downloadTescilPdf(data: TescilInput): Promise<void> {
  // Girdi değerleri
  const tc    = s(data.tc_no)
  const ad    = s(data.first_name)
  const soyad = s(data.last_name)
  const dogum = fmtBirth(data.birth_date)
  const ana   = s(data.mother_name)
  const baba  = s(data.father_name)
  const veli  = [baba, soyad].filter(Boolean).join(' ')  // =D8&" "&D5

  // ── Şablonu Canvas'a çiz ────────────────────────────────────────────────────
  const templateImg = await loadImage(sablonUrl)

  const IMG_W = 1170   // şablonun piksel genişliği
  const IMG_H = 827    // şablonun piksel yüksekliği

  const canvas  = document.createElement('canvas')
  canvas.width  = IMG_W
  canvas.height = IMG_H
  const ctx = canvas.getContext('2d')!

  // Şablonu çiz
  ctx.drawImage(templateImg, 0, 0, IMG_W, IMG_H)

  // ── Font ayarları ───────────────────────────────────────────────────────────
  // Liberation Sans yerine sistem varsayılanı — her tarayıcıda Türkçe çalışır
  const FONT_SIZE = 14    // piksel
  ctx.font        = `bold ${FONT_SIZE}px Arial, sans-serif`
  ctx.fillStyle   = '#000000'
  ctx.textBaseline = 'top'

  // ── Koordinatlar ─────────────────────────────────────────────────────────────
  // Orijinal 1754×1241 PNG'den 1170×827'ye ölçeklenmiş koordinatlar.
  // Şablonun iki nokta (:) işaretinin hemen sağından başlar.
  //
  // Sol blok — sporcu bilgileri
  const solFields: [string, number, number][] = [
    [tc,    263, 91],    // T.C.Kimlik No
    [ad,    288, 107],   // Adı
    [soyad, 284, 124],   // Soyadı
    [dogum, 269, 141],   // Doğum Yeri-Tarihi
    [ana,   284, 157],   // Ana Adı
    [baba,  262, 174],   // Baba Adı
  ]

  // Sol blok — VELİ ADI/SOYADI
  const veliField: [string, number, number] = [veli, 28, 263]

  // Sağ blok — SPORCU KİMLİK BİLGİLERİ (iki noktanın sağı)
  const sagFields: [string, number, number][] = [
    [tc,    792, 279],   // TC
    [ad,    792, 296],   // Adı
    [soyad, 792, 313],   // Soyadı
    [baba,  792, 329],   // Babasının Adı
    [ana,   792, 346],   // Anasının Adı
    [dogum, 792, 363],   // DoğumYeri ve Yılı
  ]

  // ── Metinleri çiz ──────────────────────────────────────────────────────────
  ;[...solFields, veliField, ...sagFields].forEach(([val, x, y]) => {
    if (val) ctx.fillText(val, x, y)
  })

  // ── Canvas → JPEG dataURL ──────────────────────────────────────────────────
  const imgData = canvas.toDataURL('image/jpeg', 0.92)

  // ── jsPDF — A4 yatay ───────────────────────────────────────────────────────
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'landscape',
  })

  const pdfW = doc.internal.pageSize.getWidth()   // 297 mm
  const pdfH = doc.internal.pageSize.getHeight()  // 210 mm

  // Doldurulmuş görseli tam sayfaya yerleştir
  doc.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH)

  // ── İndir ──────────────────────────────────────────────────────────────────
  const fname = `${ad}_${soyad}_tescil.pdf`
    .replace(/\s+/g, '_')
    .replace(/[^\w.-]/g, '')
    || 'tescil.pdf'

  doc.save(fname)
}