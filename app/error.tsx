"use client";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }){
  console.error("Global error:", error);
  return (
    <html>
      <body className="min-h-screen bg-zinc-50 text-zinc-900 p-6">
        <div className="max-w-xl mx-auto bg-white rounded-2xl p-6 shadow border border-zinc-200">
          <h2 className="text-lg font-semibold mb-2">Ups! Coś poszło nie tak.</h2>
          <p className="text-sm text-zinc-600 mb-2">Spróbuj odświeżyć stronę. Jeśli problem wraca, podeślij nam ten identyfikator:</p>
          <pre className="text-xs bg-zinc-100 rounded p-3 overflow-auto">{error?.digest ?? "(brak digesta)"}</pre>
          <div className="mt-4">
            <button onClick={()=> reset()} className="px-4 py-2 rounded-lg border">Odśwież</button>
          </div>
        </div>
      </body>
    </html>
  );
}
