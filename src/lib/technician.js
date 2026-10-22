/** Histórico efetivo de conclusão: não inventar data para OS antigas. */
export const completedStatuses = new Set(['Pronto para retirada','Entregue']);
export function completionDate(order, events=[]) {
  if (order.completedAt) return order.completedAt;
  if(!completedStatuses.has(order.status)) return null;
  const change = events.filter(ev => ev.resource==='serviceOrders' && ev.resourceId===order.id && completedStatuses.has(ev.changes?.status?.after) && !completedStatuses.has(ev.changes?.status?.before)).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')))[0];
  return change?.createdAt||null;
}
export const inLastDays = (date,days,now=Date.now()) => Boolean(date && Date.parse(date)>=now-days*86400000 && Date.parse(date)<=now);
