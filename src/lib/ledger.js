/** Métricas financeiras determinísticas: OS criada gera valor previsto, nunca receita efetiva. */
export const cents = value => Math.round((Number(value) || 0) * 100);
export const cashValue = centsValue => Math.round(centsValue)/100;
export function orderBalance(order) {
  const paid = (Array.isArray(order.payments) ? order.payments : []).reduce((sum, p) => sum + Math.max(0,cents(p.amount)), 0);
  const total = Math.max(0,cents(order.total));
  return { total:cashValue(total), paid:cashValue(paid), outstanding:order.status === 'Cancelado' ? 0 : cashValue(Math.max(0,total - paid)) };
}
export const inRange = (value, filter = 'month', start = '', end = '', now = new Date()) => {
  if (!value || Number.isNaN(Date.parse(value))) return false;
  const time = Date.parse(value);
  if (filter === 'all') return true;
  if (filter === 'custom') return (!start || time >= Date.parse(start)) && (!end || time <= Date.parse(end+'T23:59:59.999'));
  if (filter === '7') return time >= now.getTime() - 7 * 86400000 && time <= now.getTime();
  if (filter === 'year') return new Date(time).getFullYear() === now.getFullYear();
  const d = new Date(time);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};
export function orderReceivables(orders, filter='all', start='', end='', now=new Date()) {
  return orders.filter(o=>o.status !== 'Cancelado' && inRange(o.createdAt,filter,start,end,now)).map(o=>({...o,...orderBalance(o)})).filter(o=>o.outstanding>0);
}
export function storeLedger(finance,orders,{filter='month',start='',end='',now=new Date()}={}) {
 const selectedPayments = finance.filter(x=>x.status==='Pago' && inRange(x.paidAt||x.createdAt,filter,start,end,now));
 const received = selectedPayments.filter(x=>x.type==='receita').reduce((v,x)=>v+cents(x.amount),0);
 const expenses = selectedPayments.filter(x=>x.type==='despesa').reduce((v,x)=>v+cents(x.amount),0);
 const manualPending=finance.filter(x=>x.type==='receita' && !['Pago','Cancelado','Troca'].includes(x.status) && !x.sourceId && inRange(x.dueDate||x.createdAt,filter,start,end,now));
 const pendingOrders=orderReceivables(orders,filter,start,end,now);
 const outstanding=cashValue(manualPending.reduce((v,x)=>v+cents(x.amount),0)+pendingOrders.reduce((v,x)=>v+cents(x.outstanding),0));
 return {received:cashValue(received),expenses:cashValue(expenses),result:cashValue(received-expenses),outstanding, pendingOrders,manualPending};
}
