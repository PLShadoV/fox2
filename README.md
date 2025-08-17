# FoxESS + RCE Dashboard (Next.js 14)

Aplikacja do hostowania na GitHub + Vercel. Łączy dane z **FoxESS Cloud** i **PSE RCE**:
- kafelki KPI (moc teraz, oddane kWh, dzienny zarobek),
- wykresy słupkowe (kWh i przychód),
- tabela godzinowa (kWh, cena, przychód) + suma,
- debug endpointy.

## Deploy (Vercel)
Ustaw w **Environment Variables** (Production):
- `FOXESS_API_KEY` – token FoxESS (MD5/Cloud)
- `FOXESS_INVERTER_SN` – numer seryjny falownika
- `FOXESS_API_LANG` – `pl` (opcjonalne)
- `PSE_RCE_BASE_URL` – `https://api.raporty.pse.pl/api` (opcjonalne)
- `NEXT_PUBLIC_APP_NAME` – nazwa appki (opcjonalne)
- `NEXT_PUBLIC_BASE_URL` – np. `https://twoja-domena.vercel.app` (zalecane)

## Endpoints
- `/api/foxess?date=YYYY-MM-DD` – zwraca 24 kWh eksportu i generacji (fallback na history/query + integracja *Power*)
- `/api/rce?date=YYYY-MM-DD` – 24 ceny RCE (PLN/MWh)
- `/api/foxess/debug/realtime` – bieżąca moc PV (W)
- `/api/foxess/debug/history2?date=YYYY-MM-DD` – wybrane serie (export/generation) i sumy

## UI
- Przyciski: Dzisiaj / Wczoraj / Ten tydzień / Ten miesiąc / Ten rok (na razie sterują datą; agregacje tyg/mies/rok do rozbudowy)
- Wybór daty (date picker).

## Styl
- TailwindCSS, nowoczesne karty i wykresy (Recharts).
