# FixFlowOS V3.1 — Correções e homologação pendente (17/10/2026)

## Alterações implementadas nesta versão

1. **OS e a receber:** o saldo previsto é calculado a partir de `total - sum(payments)` de cada OS ativa já criada, mesmo que ainda esteja aguardando avaliação. O valor deve ter sido informado na OS; uma OS com total vazio tem saldo zero até o orçamento/total ser preenchido. Pagamentos efetivamente registrados permanecem em `finance` como receitas pagas. OS canceladas sem pagamentos deixam de integrar o saldo. Ao alterar uma OS, o cálculo é refeito, sem duplicar lançamentos financeiros. Por padrão, o cartão **Total a receber** considera todas as OS do histórico carregado, sem depender do filtro dos recebimentos do mês.
2. **Permissão de recebimento:** `orders.payment` agora autoriza ADMIN, GERENTE, VENDEDOR e VENDEDOR_TECNICO. TECNICO é bloqueado pelo backend. Para evitar falsificar quem recebeu, os dois cargos administrativos podem declarar um outro funcionário ativo e autorizado como recebedor. A operação continua auditada com o usuário que realmente executou o registro. Os outros cargos podem registrar **somente pagamentos recebidos por sua própria conta**.
3. **Caixa e vendas:** área única `/caixa` inclui PDV, venda avulsa sem item de estoque, venda de serviços, venda de aparelho próprio, devolução integral, extrato de movimentações, abertura e fechamento (apenas ADMIN/GERENTE). `/vendas` redireciona para `/caixa`. Venda avulsa não altera estoque físico. Transações PIX/cartão não aumentam **saldo físico em dinheiro** da sessão; são registradas no extrato. Venda de aparelho próprio marca-o vendido e registra preço real. Caixa aberto continua tendo movimentos; se estiver fechado, os registros de recebimentos/vendas são salvos sem vínculo a uma sessão.
4. **Privacidade e permissões:** dados de fornecedores apenas para o ADMIN, inclusive API, campos de produtos e eventos; estoque não fornece saldo exato ao Técnico, Vendedor ou Vendedor Técnico, apenas `Esgotado`, `Última unidade` e `Disponível`; custos de venda e serviço ocultos a não gestores. O Técnico não pode alterar valores financeiros da OS nem registrar recebimentos, mas pode continuar editando os dados técnicos. Consulta do caixa disponível a todos, com saldos restritos e operações conforme papel.
5. **Autoria e histórico:** novos eventos usam nomes dos funcionários, textos descritivos, status/valores quando pertinentes e ID da conta de quem executou a ação. O extrato do caixa distingue `Registrado por` e `Recebido por`, e consulta nomes existentes dos funcionários para exibir operações antigas quando possível. Os registros antigos que não guardam descrições detalhadas podem permanecer menos completos.
6. **Relatórios técnicos:** `completedAt` passa a registrar a primeira transição para OS pronta/entregue; `assignedAt` registra nova atribuição. Para OS antigas sem `completedAt`, o relatório usa a data real de um evento de alteração de status, se estiver acessível; caso contrário, informa que não é possível determinar o período com segurança.
7. **Rentabilidade avulsa:** se uma venda incluir item avulso sem custo cadastrado, lucro/custo ficam sem estimativa para aquela venda, evitando tratar custo desconhecido como zero e inventar margem. Serviços e produtos cadastrados mantêm o cálculo de custo quando disponível.
8. **Firebase público:** `.env.example` está preenchido com as configurações **públicas** do projeto `fixflowos-v3`. Não contém chave de serviço privada nem outras credenciais secretas.

## Limites e pendências: não usar como produto comercial homologado

- NÃO foi executado build de produção (`npm run build` não passa neste ambiente porque não foi possível instalar o Vite pelo npm). A verificação estática de sintaxe não substitui o build.
- NÃO foram executados testes reais em Firebase, Storage, Vercel, emuladores ou com usuários reais. O comportamento descrito acima está implementado no código, mas exige integração e homologação.
- Listagens limitadas a 500 registros por coleção. Métricas de uma loja com mais registros podem ficar incompletas. Implementar paginação/agregação no backend para escala.
- Devoluções parciais, trocas complexas, políticas fiscais, métodos de reembolso diferentes do pagamento original e reconciliação bancária **não** foram integralmente implementados. Não executar tais cenários em clientes reais sem validação.
- Abertura/fechamento de caixa trata dinheiro físico. PIX e cartões constam no extrato, mas não integram esse saldo físico. Ausência de sessão aberta não impede vendas; movimentos ficam sem `sessionId`.
- Não foi possível reproduzir os erros específicos de anexos no Firebase Storage, nem verificar todas as restrições antigas do Admin e os 41 cenários de aceitação em produção. Anexos dependem de regras Storage, bucket e eventuais ajustes CORS.
- Recebimentos da plataforma SaaS no `/super-admin` permanecem separados do financeiro das lojas. Um pagamento de OS **não** é receita da plataforma.
- Não existem cobrança automática, integração com gateway de pagamentos ou envio real de WhatsApp/e-mail.
- Existe risco de dados financeiros inconsistente anteriores ao patch. Faça backup e conciliação dos lançamentos, sem sobrescrever registros anteriores diretamente.

## Testes realmente executados

- `npm run syntax`: 39 arquivos JS/JSX verificados, 0 erros sintáticos.
- `npm test`: 26 testes Node passaram, 0 falhas (cálculo de OS/financeiro, histórico descritivo, conclusão técnica, permissões, estrutura, imports, recorrências).
- `npm install`: tentativa nesta sessão terminou por timeout ao acesso ao registro npm.
- `npm run build`: executado e falhou: `vite: not found`, porque as dependências não estão instaladas.

## Segurança da chave administrativa enviada na conversa

**Antes de utilizar a atualização no seu projeto Firebase:** a chave privada enviada no chat deve ser considerada exposta. Revogue/exclua essa chave na página **Google Cloud Console → IAM e administrador → Contas de serviço → selecione a conta → Chaves**. Gere nova chave com sua conta autorizada, atualize `FIREBASE_SERVICE_ACCOUNT_JSON` em ambiente privado do Windows/Vercel e nunca a envie por mensagem ou commit. O JSON privado NÃO está neste ZIP. A chave de configuração pública Web é diferente dessa credencial privada.

## Atualizar a instalação no Windows sem perder as lojas

1. Faça cópia de segurança da pasta atual do projeto e exporte/realize backup dos dados do Firestore antes de mudar código.
2. Descompacte este ZIP **numa pasta nova**, não sobrescreva o projeto em uso diretamente.
3. Copie as configurações privadas para o `.env` novo **somente depois de substituir a antiga chave de serviço exposta**. As configurações públicas já estão em `.env.example`.
4. Em terminal dentro da pasta nova execute: `npm install`, `npm run syntax`, `npm test`, `npm run build`. Se qualquer etapa falhar, pare e corrija antes de publicar.
5. Teste em um projeto Firebase separado para homologação; verifique vendas avulsas, entrega/OS, recebimento parcial, permissões de todos os perfis, isolamento entre duas lojas, nomes no histórico, devolução e valores de caixa.
6. Apenas após testes satisfatórios publique na Vercel; configure a **nova** `FIREBASE_SERVICE_ACCOUNT_JSON` no ambiente privado da Vercel, revise as regras do Firebase e monitore os logs.
