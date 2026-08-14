# WhatsApp Karşılama Mesajı

## Ne işe yarar

Veli telefonuna WhatsApp linki açarak önceden hazırlanmış karşılama mesajı gönderir. Mesaj: kayıt onayı, duyuru grubu linki.

## Buton

Veli kartında "Karşılama Mesajı Gönder" butonu. Tıklandığında `openWaWelcome(veliAdi, sporcuAdi, telefon)` çağrılır, WhatsApp web/app açılır.

## Veli adı oluşturma

```ts
function parentDisplayName(a: {
  parent_type: string | null
  mother_name: string | null
  father_name: string | null
  last_name: string
}): string {
  if (a.parent_type === 'anne' && a.mother_name) return `${a.mother_name} ${a.last_name}`
  if (a.parent_type === 'baba' && a.father_name) return `${a.father_name} ${a.last_name}`
  if (a.mother_name) return `${a.mother_name} ${a.last_name}`
  if (a.father_name) return `${a.father_name} ${a.last_name}`
  return 'Veli'
}
```

## Bağımlılıklar

Yok. Saf DOM API.

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `welcomeMessage.ts` | İki export: `getWaWelcomeUrl`, `openWaWelcome` |

## Kullanım

```ts
import { openWaWelcome } from './welcomeMessage'

// Veli kartında butona tıklandığında:
const veliAdi = parentDisplayName(athlete) // "Ayşe Yılmaz"
openWaWelcome(veliAdi, athlete.first_name, veliPhone)
```

## Claude Code'a talimat

> `welcomeMessage.ts` dosyasını projene kopyala.
> Veli telefonu kartına bir buton koy, tıklanınca `openWaWelcome(veliAdi, sporcuAdi, veliPhone)` çağır.
> `veliAdi`'ni şöyle oluştur: anne/baba adı + sporcu soyadı.
> Mesaj içindeki grup linkini ve metni kendine göre düzenlemek istersen `WELCOME_TEMPLATE` sabitini değiştir.