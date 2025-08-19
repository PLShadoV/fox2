# FoxESS × RCE — minimalist app

This bundle contains just the **UI**, the **RCEm table** and the **/api/range/compute** endpoint.

It **expects you already have** working endpoints:

- `/api/foxess/realtime` → `{ pvNowW: number }` (or compatible)
- `/api/foxess/day?date=YYYY-MM-DD` → payload with daily generation; the app auto-normalizes shapes.
- `/api/rce/day?date=YYYY-MM-DD` → hourly RCE prices; optional. If missing, the app will fall back to **RCEm** for revenue.

### What you get

- Glass-morphism tiles (Moc teraz, Wygenerowano, Przychód)
- Smooth area chart of **hourly generation** (not cumulative)
- Hourly table (generation, price, revenue)
- Range calculator that sums kWh and revenue for a date range (RCE or RCEm)
- Theme toggle (dark default, light optional)
- RCEm monthly prices baked in `/public/rcem.json`

### Rate limiting to FoxESS

The UI throttles realtime polling to **1 request / 60s** (client side). Your existing `/api/foxess/realtime` can add server-side caching if needed.

### Install

```
npm i
npm run dev
```

Adjust or keep your existing API endpoints; this UI will call them.
