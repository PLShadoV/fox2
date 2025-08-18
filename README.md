# Patch: szybki kalkulator + motywy (dark default)

**Co w paczce**
- `app/api/range/compute/route.ts` – kompletny endpoint liczący sumy GENERATION i przychodu (RCE / RCEm) z timeoutami i walidacją dat.
- `components/ThemeToggle.tsx` – działający przełącznik jasny/ciemny (domyślnie ciemny).
- `app/globals.css` – zmienne i klasy (`.pv-card`, `.pv-chip`, `.pv-table`) z poprawionym kontrastem.

## Instalacja
1. Skopiuj katalogi z paczki do swojego projektu, zachowując strukturę:
   - `app/api/range/compute/route.ts`
   - `components/ThemeToggle.tsx`
   - `app/globals.css` (jeśli masz własny, dodaj **blok :root** i **klasy .pv-*** na koniec swojego pliku)
2. Użyj `ThemeToggle` w nagłówku (musi być **client component**):
   ```tsx
   import ThemeToggle from "@/components/ThemeToggle";

   export default function HeaderBar(){
     return (
       <div className="flex gap-3 items-center">
         <a className="pv-chip" href="https://www.foxesscloud.com" target="_blank">FoxESS</a>
         <a className="pv-chip" href="https://raporty.pse.pl/report/rce-pln" target="_blank">RCE (PSE)</a>
         <ThemeToggle />
       </div>
     );
   }
   ```
3. W kalkulatorze wysyłaj zapytanie tak (obsługuje `YYYY-MM-DD` oraz `DD.MM.YYYY`):
   ```ts
   const from = new Date(fromDate).toISOString().slice(0,10);
   const to   = new Date(toDate).toISOString().slice(0,10);
   const url  = `/api/range/compute?from=${from}&to=${to}&mode=${mode}`; // mode: rce | rcem
   const res  = await fetch(url).then(r=>r.json());
   ```

## Notatki
- Endpoint ogranicza zakres do ~92 dni, żeby nie blokować serwera. Podnieś wartość w `MAX_DAYS`, jeśli koniecznie trzeba.
- RCEm: najpierw próbuje `/api/rcem?month=YYYY-MM` (jeśli masz), w przeciwnym razie bierze średnią z godzinowych RCE.
- Ujemne ceny w RCE są widoczne w tabeli, ale **nie są liczone** do przychodu (zgodnie z prośbą).
- Motyw **domyślnie ciemny** – zapisywany w `localStorage("pv-theme")`.
