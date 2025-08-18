'use client';
import React from 'react';

export type HourRow = { hour: number; kwh: number; price_pln_mwh: number; revenue_pln: number };

export default function HourlyTable({ rows, date, modeLabel }:{ rows: HourRow[]; date: string; modeLabel: string }){
  const totals = rows.reduce((acc, r)=>{
    acc.kwh += r.kwh;
    acc.revenue += r.revenue_pln;
    return acc;
  }, { kwh: 0, revenue: 0 });
  return (
    <div className="pv-panel">
      <h4>Tablica godzinowa — {date}</h4>
      <div style={{overflowX:'auto'}}>
        <table className="pv-table">
          <thead>
            <tr>
              <th style={{minWidth:80}}>Godzina</th>
              <th>Generacja (kWh)</th>
              <th>Cena ({modeLabel}) [PLN/MWh]</th>
              <th>Przychód (PLN)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.hour}>
                <td>{String(r.hour).padStart(2,'0')}:00</td>
                <td>{r.kwh.toFixed(2)}</td>
                <td>{r.price_pln_mwh.toFixed(2)}</td>
                <td>{r.revenue_pln.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Suma</td>
              <td>{totals.kwh.toFixed(2)}</td>
              <td></td>
              <td>{totals.revenue.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}