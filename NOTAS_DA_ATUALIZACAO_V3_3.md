# FixFlowOS V3.3 — notas da atualização

**Versão de testes, ainda não homologada para lojas reais.** Atualização a partir da V3.2 para continuar no **mesmo projeto Firebase e na mesma Vercel**.

## Melhorias implementadas

- Nova tela **Ordens de serviço** com abas rápidas por status, filtro para todos os status, pesquisa por **número exato de OS** e por **início do nome do cliente**, e paginação de até 20 OS por página no backend.
- O painel geral utiliza **consultas de agregação `count()`** e eventos recentes. Não carrega mais até oito coleções de 500 documentos para produzir um resumo. Indicador de vendas recentes informa que é uma amostra de 24 vendas, não um total contábil.
- Consultas comuns carregam inicialmente 40 registros, com botão **Carregar mais** quando necessário. Os limites podem diferir nos formulários de seleção; ver limitações abaixo.
- **Cache de leituras com prazo limitado e escopo por UID**, sem reutilização de valores entre usuários, com invalidação após alterações e logout. Dados operacionais sensíveis usam tempo reduzido.
- Pesquisa por prefixo de produtos/serviços/aparelhos no caixa, em vez de só itens inicialmente carregados.
- **Custos, margens e lucros somente para Dono/Admin**, validados e removidos das respostas da API para outros perfis. Gerente e vendedores continuam vendo preço de venda e podem operar o caixa conforme autorização. Exibição de dados de custo nos relatórios foi restringida.
- Exibição do **e-mail do funcionário na Equipe** exclusivamente para o Dono/Admin.
- Extrato de pagamentos em cada OS: total, pago, saldo, data, forma e recebedor.
- Botão **Sair da conta** visível na barra superior no celular.
- Super Admin: **Arquivar**, **Restaurar** e fluxo de **Excluir permanentemente** com nome exato da loja e confirmação de backup. Loja suspensa imediatamente durante exclusão, usuários vinculados são removidos de Authentication e Firestore é excluído recursivamente. **Exclusão não homologada para lojas reais/grandes**, veja aviso abaixo.
- Monitor leve no Super Admin com ações da API e tempo de resposta da aba corrente, **não contagem de leituras cobradas**.
- Corrigido erro antigo de estado não declarado nas Configurações (`setAllowDiscount`).
- Conservadas as funções da V3.2: planos, assinaturas, caixa, vendas, permissões, privacidade etc.

## Instalação pelo GitHub → Vercel

1. **Não exclua o repositório GitHub nem o projeto existente na Vercel**. Faça backup do repositório e dos dados antes.
2. No repositório, substitua os arquivos de código da V3.2 pelos da pasta `fixflowos/` da V3.3; inclua arquivos novos e **não envie** `node_modules/`, `dist/`, `.env`, JSON de conta de serviço nem credenciais.
3. Se sua Vercel estiver conectada à mesma branch do GitHub com deploy automático, o novo commit dispara um deploy. Normalmente, **não é necessário recadastrar as variáveis** da Vercel. Elas permanecem no mesmo projeto; não compartilhe o JSON privado.
4. Faça **deploy dos índices do Firestore**, pois a busca/filtro de OS exige índices novos: `firebase deploy --only firestore:indexes --project fixflowos-v3` executado na pasta com `firebase.json`, com a CLI Firebase devidamente autenticada. Alternativamente, crie os índices pelo link mostrado na mensagem de erro `FAILED_PRECONDITION`. Espere a indexação terminar.
5. No seu computador, rode `npm install`, `npm run syntax`, `npm test`, `npm run build`, `npm run dev`. Se o build falhar, **não substitua a V3.2 em produção** até corrigir.
6. Teste em loja fictícia, com Admin/Gerente/Vendedor/Técnico, especialmente consulta de OS por status/nome, venda de estoque e pagamento parcial. Verifique leituras reais em Firebase Console → Firestore → Uso.

## Observações técnicas e limitações (IMPORTANTE)

- Em vários módulos legados, os **relatórios financeiros da loja ainda utilizam listas limitadas e podem não refletir todo o histórico acima de 40 registros carregados**. Não utilize essa V3.3 como fechamento fiscal/contábil. Requeremos agregação paginada server-side com reconciliação ou materialização de saldos como próxima etapa. O Super Admin também mantém varredura paginada para métricas da plataforma.
- Campos de seleção (clientes, produtos e usuários) em alguns fluxos ainda carregam uma amostra recente. Há `Carregar mais` nas listagens e busca sob demanda de itens no PDV, mas buscas de todos os relacionamentos devem ser ampliadas em uma próxima versão.
- Pesquisa por cliente nas OS **diferencia maiúsculas e minúsculas**, busca apenas o início do nome e usa o campo `customerName` salvo. OS antigas sem esse campo não serão encontradas por nome, mas continuam acessíveis por número e status.
- Os alertas legados ainda podem buscar até 400 documentos por coleção e até 300 confirmações de alerta, se a Central de Alertas for aberta. Requerem índices por condições e/ou eventos de alerta materializados para otimização adicional.
- Arquivamento/desativação preserva dados e é preferível. **Exclusão permanente** requer backup verificado, testes isolados e confirmação dos anexos do Firebase Storage, que não são removidos automaticamente por `recursiveDelete`. Lojas grandes podem exceder o limite de tempo da API Vercel de 30 s, deixando a loja bloqueada para retomada manual. Não usar em produção sem um processo assíncrono e teste end-to-end.
- O **monitor de API NÃO informa a quantidade exata de leituras do Firestore**. O número real deve ser verificado no Firebase Console. O painel pode ter atraso e agrega todas as lojas.
- O cache dura até 60 segundos em consultas comuns e até 15 segundos em certas coleções sensíveis. Mudanças feitas em outro navegador podem demorar a aparecer até atualizar a tela ou vencer o cache. O backend sempre confere autorização de novas operações.
- Índices adicionais podem gerar custo de armazenamento e gravação; a economia depende da quantidade de registros retornados e do uso real.
- Fotos/anexos dependem do Firebase Storage e do plano configurado.
- Erros `metrics.js`/`background.js` no Console podem ser causados por extensões do navegador. O aviso `file:///` exige investigar o recurso local que tentou ser carregado; não foi reproduzido/homologado neste ambiente.
- **Atenção**: compilação completa e testes com Firebase/Vercel reais não puderam ser executados no ambiente de criação. Rode `npm run build` no PC ou verifique o build na Vercel e execute a auditoria manual antes de atualizar lojas reais.

## Segurança

Não envie a antiga chave privada do Firebase exposta na conversa ao GitHub. Revogue-a e utilize apenas chave nova na Vercel, variável `FIREBASE_SERVICE_ACCOUNT_JSON`. `VITE_FIREBASE_*` pode ser pública; a credencial administrativa nunca.
