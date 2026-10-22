import React from 'react';
import {brl} from '../lib/helpers';
export default function FinanceChart({rows=[]}){
 const max=Math.max(1,...rows.flatMap(r=>[r.received,r.spent,r.pending].map(Number)));
 return <div><div className="cash-chart" role="img" aria-label="Gráfico com recebimentos, despesas e valores a receber em seis meses">{rows.map(r=><div key={r.month} className="cash-chart-group"><div className="cash-chart-bars">{[['received','bar-in'],['spent','bar-out'],['pending','bar-pending']].map(([key,cls])=><div key={key} title={`${r.month} · ${key}: ${brl(r[key])}`} className={`cash-chart-bar ${cls}`} style={{height:`${Math.max(2,Number(r[key]||0)/max*100)}%`}}/>)}</div><span className="cash-chart-label">{r.month.slice(5)}/{r.month.slice(2,4)}</span></div>)}</div><div className="cash-chart-legend"><span><b className="bar-in"/>Recebido</span><span><b className="bar-out"/>Despesas</span><span><b className="bar-pending"/>A receber</span></div></div>;
}
