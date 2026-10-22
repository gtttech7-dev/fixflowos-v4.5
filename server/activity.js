/** Textos humanos para auditoria. Não confiar em descrições fornecidas pelo navegador. */
const verbs={create:'Cadastrou',update:'Atualizou',archive:'Arquivou',payment:'Registrou recebimento de',finalize:'Registrou',return:'Registrou devolução de',open:'Abriu',close:'Fechou',move:'Movimentou',cost:'Registrou custo em',sold:'Vendeu'};
const objects={customers:'cliente',devices:'aparelho de cliente',serviceOrders:'OS',products:'produto',sales:'venda',stockMovements:'estoque',storeDevices:'aparelho da loja',finance:'lançamento financeiro',cashSessions:'caixa',cashMovements:'caixa',users:'funcionário',suppliers:'fornecedor',serviceCatalog:'serviço',categories:'categoria',settings:'configurações',stores:'loja',plans:'plano',subscriptions:'assinatura',transactions:'cobrança',expenses:'despesa'};
export function describeEvent(type,resource,id,change={}) {
 const data=change.after||{},verb=type.split('.').at(-1);const noun=objects[resource]||resource;
 const identity=data.name||data.customerName||data.description||data.number||(resource==='serviceOrders'?`#${id.slice(0,8)}`:`#${id.slice(0,8)}`);
 if(type==='serviceOrders.update' && data.status)return `Alterou a OS ${identity} para “${data.status}”`;
 if(type==='stock.movement')return `Movimentou o estoque do produto ${identity}`;
 if(type==='serviceOrders.payment')return `Registrou recebimento de ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(data.amount)||0)} na OS ${identity} (${data.method||'forma não informada'}), recebido por ${data.receivedByName||'funcionário da loja'}`;
 if(type==='storeDevices.sold')return `Vendeu aparelho da loja ${identity}`;
 if(type==='sales.return')return `Registrou devolução da venda ${identity}`;
 if(type==='cash.open')return 'Abriu o caixa';
 if(type==='cash.close')return 'Fechou o caixa';
 if(type==='cash.move')return `Registrou movimentação de caixa`;
 return `${verbs[verb]||'Realizou alteração em'} ${noun} ${identity}`;
}
export const actionLabel=type=>({create:'Cadastro',update:'Alteração',archive:'Arquivo',payment:'Recebimento',finalize:'Venda',return:'Devolução',open:'Abertura',close:'Fechamento',move:'Movimentação',cost:'Custo',sold:'Venda'}[String(type||'').split('.').at(-1)]||'Movimentação');
