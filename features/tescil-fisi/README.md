# Tescil Fişi PDF

## Ne işe yarar

Sporcu bilgilerini (TC, ad, soyad, doğum tarihi, anne/baba adı) alır, şablon JPG üzerine Canvas'la yazar, A4 yatay PDF olarak indirir.

## Kullanıcıya gösterilen buton

Sporcu detay sayfasında "Tescil Fişi İndir" butonu. Tıklandığında `downloadTescilPdf(input)` çağrılır.

## Bağımlılıklar

```
npm install jspdf
```

## Dosyalar

Alınması gereken 2 dosya:

| Dosya | Açıklama |
|---|---|
| `exportTescilPdf.ts` | Ana fonksiyon |
| `tescil_sablon.jpg` | Şablon görseli (1170×827 px) |

İkisini de aynı dizine koy.

## Supabase'den hangi alanlar

`athletes` tablosu:

| Sütun | `TescilInput` alanı |
|---|---|
| `tc_no` | `tc_no` |
| `first_name` | `first_name` |
| `last_name` | `last_name` |
| `birth_date` | `birth_date` (YYYY-MM-DD) |
| `mother_name` | `mother_name` |
| `father_name` | `father_name` |

## Kullanım

```ts
import { downloadTescilPdf } from './exportTescilPdf'

// Supabase'den çektikten sonra:
await downloadTescilPdf({
  tc_no: '12345678901',
  first_name: 'Ali',
  last_name: 'Yılmaz',
  birth_date: '2010-05-15',
  mother_name: 'Ayşe',
  father_name: 'Mehmet',
})
```

## Claude Code'a talimat

> Şu 2 dosyayı projene kopyala: `exportTescilPdf.ts` ve `tescil_sablon.jpg`.
> `npm install jspdf` yap.
> Sporcu detay sayfanda bir buton koy, tıklanınca Supabase'den sporcu bilgilerini alıp `downloadTescilPdf()` çağır.
>
> `.jpg` import'u için `src/vite-env.d.ts`'e (ya da `*.d.ts`) şunu ekle:
> ```ts
> declare module '*.jpg' { const src: string; export default src }
> ```
> (Vite kullanıyorsan zaten var; Next.js/React Native'de farklı yöntem gerekebilir.)