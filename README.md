# FoxESS + RCE (Vercel-ready)

Nowoczesna aplikacja **Next.js 14** do liczenia zarobku z net-billingu:
- **FoxESS**: dzienny raport (`/op/v0/device/report/query`) + realtime (`/op/v0/device/real/query`).
- **PSE RCE**: ceny godzinowe, zagregowane do 24 godzin.

## Funkcje
- KPI: Dzisiejszy zarobek, Oddane (dzień), Śr. cena, Generacja (dzień), Moc teraz (W).
- Wykresy: PLN/h, kWh/h, Generacja (kWh/h), RCE (PLN/MWh).
- Zakresy: Dzisiaj, Wczoraj, Tydzień, Miesiąc, Rok + wybór daty.
- Tabela godzinowa (suma na dole).
- Negatywne RCE liczone jako 0 do przychodu (ale wyświetlane w tabeli).

## Start
```bash
npm i
cp .env.example .env   # uzupełnij FOXESS_API_KEY i FOXESS_INVERTER_SN
npm run dev
```

## Deploy na Vercel
1. Repo na GitHub.
2. Import do Vercel i ustaw zmienne środowiskowe z `.env` (bez TZ).
3. Deploy.

## Endpointy debug
- `/api/foxess/debug/day?date=YYYY-MM-DD`
- `/api/foxess/debug/realtime`
- `/api/rce/debug?date=YYYY-MM-DD`

## Licencja
MIT
