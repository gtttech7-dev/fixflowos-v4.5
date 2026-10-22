# FixFlowOS V3.2 — alterações, validações e pendências

## Entregue em código

1. Planos com periodicidade semanal, mensal, trimestral, anual ou vitalícia; preço por período; quantidade de usuários ativos personalizada ou ilimitada (dono incluído). O backend valida e bloqueia novas contas/reativações após o limite; usuários antigos não são apagados.
2. Novas assinaturas geram seis cobranças futuras nos planos recorrentes ou de 1 a 36 parcelas da compra inicial nos vitalícios. Não houve geração retroativa para assinaturas já existentes.
3. Registro real de recebimentos e pagamentos de despesas no Super Admin, com valores parciais, histórico no backend, forma de pagamento, ID de operação idempotente e indicadores de recebido/despesas/a receber. Gráfico temporal sem valores simulados.
4. Financeiro da loja exclusivo do ADMIN no menu, nas rotas e no backend. Gerente continua podendo registrar recebimento de OS no caixa.
5. Gráfico de receitas, despesas e saldo pendente no Financeiro do Dono, com distinção entre previsão e caixa realizado.
6. Interface refinada com contraste, cartões, espaçamento, foco visível e organização de indicadores. O alerta técnico de `500 registros` saiu da interface e foi movido para README.
7. Corrigido `block={true}` vazando para `<button>` no React. Preferências de rascunhos e de manter a conta conectada disponíveis individualmente; rascunhos são armazenados por UID e loja através do backend autenticado, não em localStorage.
8. Tela de primeira utilização com aceite de termos pelo Dono e ciência de regras de uso pelos demais. Textos legais são MODELOS e requerem personalização antes de uso comercial.
9. Mantido sem notificações push; alertas permanecem na Central do sistema.

## Testes executados no ambiente de preparação

- Checagem de sintaxe dos arquivos JavaScript/JSX via TypeScript, sem erros sintáticos.
- Testes locais `npm test` (lógica de saldos, periodicidades, parcelas, perfis, estrutura, histórico e imports locais).
- Verificação de integridade do ZIP.

**Não foi possível executar um build real nem testes de integração com seu Firebase/Vercel:** a instalação do Vite/dependências não concluiu neste ambiente. Não afirmar que esses fluxos estão homologados. Nenhum dado do projeto remoto foi lido ou modificado.

## Pendências de produção / riscos remanescentes

- Cobranças recorrentes após os seis primeiros vencimentos ainda exigem geração agendada/idempotente. Emissões antigas ou alterações de contrato não recalculam invoices já geradas.
- Para módulos operacionais com mais de 500 registros, acrescentar agregação server-side paginada e relatórios completos (limite citado apenas no README).
- Termos e Política de Privacidade precisam de revisão legal e de dados reais do operador/controlador antes da comercialização.
- Fluxos avançados de estorno de cobranças já pagas, conciliação com gateway, notas fiscais, tributos, backup e recuperação de desastres não estão homologados.
- Testes de UI mobile, login, permissões e Firestore/Storage devem ser repetidos no ambiente de homologação e não podem ser presumidos por testes de funções puras.
- Fotos e anexos dependem da ativação do Firebase Storage. Não habilitados automaticamente.
- Por segurança, chaves privadas jamais são incluídas no projeto; a credencial anteriormente exposta deve ser revogada.
