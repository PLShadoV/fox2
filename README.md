# FoxESS + RCE (Vercel-ready)

Nowoczesna aplikacja **Next.js 14** do liczenia zarobku z net-billingu:
- **FoxESS Open API**: raport dzienny (`/op/v0/device/report/query`) dla `feedin` (kWh/h) + `generation`.
- **PSE RCE**: `/api/rce-pln` – pole **`rce_pln`** (PLN/MWh), **`udtczas`** (godzina), **`business_date`**.
- Przychód: `kWh * (RCE/1000)` → **PLN/h**.

## Szybki start
```bash
npm i
cp .env.example .env   # uzupełnij FOXESS_API_KEY i FOXESS_INVERTER_SN
npm run dev
```
Otwórz: http://localhost:3000

## Deploy na Vercel
1. Wypchnij repo na GitHub.
2. Importuj w Vercel i ustaw zmienne środowiskowe z `.env`.
3. Deploy.

## Uwagi
- Klucz FoxESS przechowuj po stronie serwera (route handlers). Nie udostępniaj na froncie.
- Strefa czasowa: `Europe/Warsaw`.
- Kod frontu jest minimalistyczny, ale nowocześnie stylowany (Tailwind + glass cards + gradient).

## Licencja
MIT
