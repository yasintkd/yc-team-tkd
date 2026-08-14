/**
 * vCard (.vcf) indirerek kişiyi rehbere kaydeder.
 *
 * Kullanım:
 *   import { saveContact } from './saveContact'
 *   saveContact('Ali Yılmaz TTA', '05551234567')
 *
 * Bağımlılık: yok (saf DOM API)
 */

export function saveContact(displayName: string, phone: string): void {
  const clean = phone.replace(/\D/g, '')
  const intl = clean.startsWith('0') ? '90' + clean.slice(1) : clean

  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${displayName}`,
    `N:;${displayName};;;`,
    `TEL;TYPE=CELL:+${intl}`,
    'END:VCARD',
  ].join('\n')

  const blob = new Blob([vcard], { type: 'text/vcard' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${displayName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}.vcf`
  a.click()
  URL.revokeObjectURL(url)
}