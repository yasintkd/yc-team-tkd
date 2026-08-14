/**
 * WhatsApp karşılama mesajı linki oluşturur.
 *
 * Kullanım:
 *   import { getWaWelcomeUrl, openWaWelcome } from './welcomeMessage'
 *   // Link al:
 *   const url = getWaWelcomeUrl('Mehmet', 'Ali', '05551234567')
 *   // veya direkt aç:
 *   openWaWelcome('Mehmet', 'Ali', '05551234567')
 *
 * Bağımlılık: yok
 *
 * Not: Sporcu adı veli kartında kullanılır, veli adı görüntülenir.
 * Veli adı = parentDisplayName(...) ile oluşturulur (anne/baba adı + sporcu soyadı).
 */

const WELCOME_TEMPLATE = (
  veliAdi: string,
  sporcuAdi: string,
) => `👋 Merhaba ${veliAdi}, 

🏫 ${sporcuAdi}'nın Suluova Gençlik Merkezi Taekwondo kursuna kaydı başarıyla gerçekleşmiştir ✅

📢 Aşağıdaki link ile WhatsApp duyuru grubumuza katılmanız önem arz etmektedir:

🔗 https://chat.whatsapp.com/IAufuU9U79h6DM1skMeRAN?mode=gi_t

🤝 YC Team Taekwondo`

export function getWaWelcomeUrl(
  veliAdi: string,
  sporcuAdi: string,
  phone: string,
): string {
  const clean = phone.replace(/\D/g, '')
  const intl = clean.startsWith('0') ? '90' + clean.slice(1) : clean
  const msg = WELCOME_TEMPLATE(veliAdi, sporcuAdi)
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg).replace(/%0A/g, '%0D%0A')}`
}

export function openWaWelcome(
  veliAdi: string,
  sporcuAdi: string,
  phone: string,
): void {
  window.open(getWaWelcomeUrl(veliAdi, sporcuAdi, phone), '_blank')
}