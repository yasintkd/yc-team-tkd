{\rtf1\ansi\ansicpg1254\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # \'d6zellik \uc0\u350 artnamesi: Canl\u305  Skor (Live Scoring) - yc-team-tkd (G\'fcncellenmi\u351  Final)\
\
## 1. Genel Bak\uc0\u305 \u351  ve Ama\'e7\
- **Mevcut Sistem:** Next.js (App Router) + Supabase + Vercel. Tek bir Dashboard ve alt sekmeler mevcut.\
- **Ama\'e7:** Dashboard'a **"Canl\uc0\u305  Skor"** ad\u305 nda yeni bir alt sekme eklenmesi.\
- **Temel \uc0\u304 \u351 lev:** Mevcut sporcu veritaban\u305 ndan se\'e7ilen iki sporcuyu e\u351 le\u351 tirip, Tekvando m\'fcsabaka kurallar\u305 na g\'f6re anl\u305 k puanlama yapmak.\
- **\'d6zel Ko\uc0\u351 ul:** Ma\'e7 verileri veritaban\u305 na **kaydedilmeyecek** (ge\'e7mi\u351  kayd\u305  istenmiyor). Sadece anl\u305 k oturum \'fczerinden \'e7al\u305 \u351 acak.\
\
## 2. Kullan\uc0\u305 c\u305  Rolleri ve Yetkilendirme (Hibrit Model)\
Mevcut sistemde tek rol var. Karma\uc0\u351 \u305 kl\u305 \u287 \u305  azaltmak i\'e7in \u351 u hibrit model \'f6nerilir:\
\
- **Admin (Mevcut Kullan\uc0\u305 c\u305 ):** T\'fcm yetkilere sahiptir. Sporcu se\'e7er, ma\'e7\u305  ba\u351 lat\u305 r/durdurur/s\u305 f\u305 rlar, puan girer, hakem karar\u305 n\u305  onaylar.\
- **Misafir (Scorekeeper):** \uc0\u350 ifre/giri\u351  gerektirmez. Sadece **ge\'e7erli bir Ma\'e7 ID'si (veya link)** ile oturuma kat\u305 l\u305 r. Sadece puan butonlar\u305 na t\u305 klayabilir ve gam-jeom ekleyebilir. Ma\'e7\u305  ba\u351 latma/durdurma, sporcu se\'e7me yetkisi yoktur.\
- *Not: Yetkilendirme kontrol\'fc frontend'de (localStorage/session) yap\uc0\u305 lacakt\u305 r.*\
\
## 3. Ger\'e7ek Zamanl\uc0\u305  Senkronizasyon (\'c7oklu Cihaz)\
- **Teknoloji:** Supabase Realtime (Broadcast) kullan\uc0\u305 lacak.\
- **Ak\uc0\u305 \u351 :** Admin ma\'e7\u305  ba\u351 latt\u305 \u287 \u305 nda rastgele bir `matchId` (UUID) olu\u351 turur ve bir Realtime Channel'a abone olur (`match:\{matchId\}`). Misafirler ayn\u305  URL parametresi (`?matchId=xxx`) ile ba\u287 lan\u305 r.\
- **Veri:** Puan, s\'fcre, raunt, gam-jeom ve **detayl\uc0\u305  vuru\u351  istatistikleri** t\'fcm cihazlara broadcast ile senkronize edilir.\
\
## 4. Sporcu E\uc0\u351 le\u351 tirme Aray\'fcz\'fc\
- **Veri Kayna\uc0\u287 \u305 :** Supabase `athletes` tablosu.\
- **Bile\uc0\u351 en:** "Sporcu 1 (Mavi)" ve "Sporcu 2 (K\u305 rm\u305 z\u305 )" i\'e7in ayr\u305  ayr\u305  **Searchable Select (Combobox)**. Yazmaya ba\u351 lad\u305 k\'e7a filtreleme yapar.\
\
## 5. M\'fcsabaka Kurallar\uc0\u305  ve Puan Sistemi\
\
### 5.1. Puan Butonlar\uc0\u305  (Her Sporcu i\'e7in ayr\u305  ayr\u305 )\
- **+1** (Yumruk / Punch) \
- **+2** (Yele\uc0\u287 e/G\'f6vdeye normal tekme / Body Kick) - *\u304 statistik: `straightBody`*\
- **+3** (Kafaya normal tekme / Head Kick) - *\uc0\u304 statistik: `straightHead`*\
- **+4** (Yele\uc0\u287 e/G\'f6vdeye d\'f6nerli tekme / Body Turning Kick) - *\u304 statistik: `turnBody`*\
- **+6** (Kafaya d\'f6nerli tekme / Head Turning Kick) - *\uc0\u304 statistik: `turnHead`*\
\
### 5.2. Gam-Jeom (Ceza) Y\'f6netimi\
- **Gam-Jeom Butonu:** Her sporcu i\'e7in ayr\uc0\u305  buton (Mavi Gam-Jeom / K\u305 rm\u305 z\u305  Gam-Jeom).\
- **Mekanik:** T\uc0\u305 kland\u305 \u287 \u305 nda, **ceza alan sporcuya de\u287 il, rakibine +1 puan eklenir**.\
- **Ceza Hakk\uc0\u305  (5 Hak):** Her sporcunun maksimum 5 gam-jeom ceza hakk\u305  vard\u305 r. 5. cezada o raunt otomatik kaybedilir.\
\
### 5.3. Raunt ve S\'fcre Y\'f6netimi\
- **Format:** En iyi 2 raunt (Best of 3). 2 raunt kazanan ma\'e7\uc0\u305  kazan\u305 r.\
- **S\'fcreler:** Raunt (Varsay\uc0\u305 lan 2 dk) ve Ara (Varsay\u305 lan 30 sn) ayarlanabilir olacak.\
\
### 5.4. \uc0\u55356 \u57286  Beraberlik (E\u351 itlik) Durumunda \'dcst\'fcnl\'fck Kriterleri (Tie-breaker)\
Ma\'e7\uc0\u305 n herhangi bir rauntunda veya ma\'e7 sonunda skor e\u351 itli\u287 i olu\u351 tu\u287 unda, kazanan\u305  belirlemek i\'e7in **s\u305 ras\u305 yla** a\u351 a\u287 \u305 daki kriterler uygulanacakt\u305 r. \
\
> *(Not: Bu kriterler, ma\'e7 boyunca tutulan istatistikler \'fczerinden otomatik olarak hesaplanacakt\uc0\u305 r.)*\
\
| S\uc0\u305 ra | Kriter | A\'e7\u305 klama | Kazanan |\
| :---: | :--- | :--- | :--- |\
| **1** | Kafaya D\'f6n\'fc\uc0\u351 l\'fc Teknik (+6) | En fazla kafaya d\'f6nerli vuru\u351  yapan sporcu. | Y\'fcksek olan |\
| **2** | G\'f6vdeye D\'f6n\'fc\uc0\u351 l\'fc Teknik (+4) | En fazla g\'f6vdeye d\'f6nerli vuru\u351  yapan sporcu. | Y\'fcksek olan |\
| **3** | Kafaya D\'fcz Teknik (+3) | En fazla kafaya d\'fcz vuru\uc0\u351  yapan sporcu. | Y\'fcksek olan |\
| **4** | G\'f6vdeye D\'fcz Teknik (+2) | En fazla g\'f6vdeye d\'fcz vuru\uc0\u351  yapan sporcu. | Y\'fcksek olan |\
| **5** | Gam-Jeom (Ceza) | En az ceza alan sporcu. | D\'fc\uc0\u351 \'fck olan |\
| **6** | Hakem Karar\uc0\u305  | Yukar\u305 daki 5 kriter de e\u351 it \'e7\u305 karsa, ekranda Admin'e "Mavi Kazand\u305 " veya "K\u305 rm\u305 z\u305  Kazand\u305 " se\'e7enekli bir popup a\'e7\u305 l\u305 r. Admin manuel se\'e7im yapar. | Manuel Se\'e7im |\
\
*\'d6rnek Algoritma (Ma\'e7 sonunda veya Raunt sonunda kontrol):*\
```javascript\
function getWinner(score1, score2, stats1, stats2) \{\
  if (score1 !== score2) return score1 > score2 ? 1 : 2;\
\
  // Kriter 1: Kafaya D\'f6n\'fc\uc0\u351 l\'fc (turnHead)\
  if (stats1.turnHead !== stats2.turnHead) return stats1.turnHead > stats2.turnHead ? 1 : 2;\
  // Kriter 2: G\'f6vdeye D\'f6n\'fc\uc0\u351 l\'fc (turnBody)\
  if (stats1.turnBody !== stats2.turnBody) return stats1.turnBody > stats2.turnBody ? 1 : 2;\
  // Kriter 3: Kafaya D\'fcz (straightHead)\
  if (stats1.straightHead !== stats2.straightHead) return stats1.straightHead > stats2.straightHead ? 1 : 2;\
  // Kriter 4: G\'f6vdeye D\'fcz (straightBody)\
  if (stats1.straightBody !== stats2.straightBody) return stats1.straightBody > stats2.straightBody ? 1 : 2;\
  // Kriter 5: Gam-jeom (d\'fc\uc0\u351 \'fck olan kazan\u305 r)\
  if (stats1.gamjeom !== stats2.gamjeom) return stats1.gamjeom < stats2.gamjeom ? 1 : 2;\
  \
  // Kriter 6: Hakem karar\uc0\u305 na d\'fc\u351 \
  return null; // null d\'f6nerse UI'da Hakem Popup'\uc0\u305  g\'f6ster.\
\}}