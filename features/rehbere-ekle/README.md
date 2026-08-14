# Rehbere Ekle (vCard)

## Ne işe yarar

Sporcu/veli bilgilerini `.vcf` dosyası olarak indirir, telefon rehberine kaydeder. İndirilen dosyaya tıklayınca rehbere eklenir.

## Buton

Kişi kartında "Rehbere Kaydet" butonu. Tıklandığında `saveContact('Ad Soyad TTA', '05551234567')` çağrılır.

## Etiket

Arkadaşının programında kişi adının sonuna **TTA** etiketi gelir (bizde `SLV` idi).
Örnek: `Ali Yılmaz TTA`

## Bağımlılıklar

Yok. Saf DOM API.

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `saveContact.ts` | Tek fonksiyon (1 KB) |

## Kullanım

```ts
import { saveContact } from './saveContact'

// Sporcu için:
saveContact(`${athlete.first_name} ${athlete.last_name} TTA`, athlete.phone)

// Veli için:
saveContact(`Veli Adı Soyadı (${athlete.first_name}) TTA`, veliPhone)
```

## Claude Code'a talimat

> `saveContact.ts` dosyasını projene kopyala.
> Kişi kartında bir buton koy: `saveContact('Ad Soyad TTA', telefon)` çağır.
> Ad soyad sonuna `TTA` eklemeyi unutma.