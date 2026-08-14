# Zoom Engelle (Çift Tıklama / Yakınlaştırma)

## Ne işe yarar

Mobilde çift tıklama, pinch zoom, iOS Safari gesture zoom'u ve masaüstünde Ctrl/Cmd + scroll/tuş zoom'unu engeller. Input focus'unda sayfanın yakınlaşmasını `font-size: 16px` ile engeller.

## Kullanım

```ts
import { preventZoom } from './preventZoom'

// Uygulama başlangıcında bir kere çağır:
preventZoom()

// user-select da engellensin istersen:
preventZoom({ disableUserSelect: true })
```

## Bağımlılıklar

Yok. Saf DOM API.

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `preventZoom.ts` | Tek export: `preventZoom()` |

## Ayrıca CSS'te olmalı

```css
html { touch-action: manipulation; }
input, textarea, select { font-size: 16px !important; }
```

## Neleri engeller

| Sorun | Yöntem |
|---|---|
| Çift tıklama zoom | `touchend` zaman farkı > 300ms |
| İki parmak pinch zoom | `touchstart`/`touchmove`'da > 1 touch |
| iOS Safari gesture | `gesturestart`/`change`/`end` prevent |
| Ctrl/Cmd +/- tuş | `keydown`'da engelle |
| Ctrl + scroll | `wheel`'da engelle |
| Input focus zoom (iOS) | CSS `font-size: 16px` |

## Claude Code'a talimat

> `preventZoom.ts` dosyasını projene kopyala.
> `main.tsx`'te (veya en üst component'te) `preventZoom()` çağır.
> CSS'ine `html { touch-action: manipulation; }` ve `input, textarea, select { font-size: 16px !important; }` ekle.