> **Atualização 17/10/2026:** leia `ALTERACOES_E_TESTES_V3_1.md` para o estado da revisão: 26 testes Node passam, 39 arquivos têm sintaxe validada, o build não foi concluído. As métricas e permissões foram ajustadas em código; homologação Firebase/Vercel ainda é necessária. Os números abaixo refletem o pacote original e são mantidos por histórico.

# FixFlowOS — estado verificável da entrega

## Implementado em código

- Frontend React/Vite, rotas protegidas, menu responsivo, modo escuro/claro, login e recuperação Firebase Auth.
- Backend Firebase Admin, verificação de token revogado, `memberships/{uid}` e resolução de loja no servidor, Super Admin manual por Firestore console.
- APIs de CRUD, clientes, aparelhos, OS, estoque/movimentação, PDV, devolução, caixa, financeiro, equipe, planos, assinaturas, despesas da plataforma e criação de loja; Firestore como persistência pretendida.
- Registro de eventos do servidor junto às gravações em transações em processos críticos; seleção de perfis e bloqueio do CRUD direto no Firestore.
- Dashboard de indicadores, busca, filtros, CSV e relatórios calculados a partir dos documentos lidos; módulo separado de aparelhos próprios, custos, margem e resultado de vendas.
- Alertas derivados dos dados, confirmação de leitura salva no Firestore, fotos/PDF no Storage por caminho de loja.
- Regras Firestore de bloqueio total a clientes (acesso somente via backend) e regras Storage por vínculo de loja, índices de exemplo, `.env.example`, scripts de desenvolvimento, teste e build, README.

## Validação realmente executada no ambiente de elaboração

- `node --check` nos arquivos Node backend selecionados: executado com sucesso.
- Parser TypeScript 5.8.3: **34 arquivos** `.js/.jsx/.mjs` analisados com **0 erros sintáticos** (não é compilação Vite).
- `npm test`: **17 testes passaram, 0 falhas**: permissão, status, validação, senha, cálculo de margem, recorrência e estrutura local.
- `npm install`: repetido em 16/10/2026; falhou com `EAI_AGAIN` (DNS/rede indisponível). **Dependências não foram instaladas neste ambiente**.
- `npm run build`: **tentou executar** e falhou (`exit 127`, `sh: vite: not found`), porque o npm não pôde instalar as dependências (`EAI_AGAIN`). Não chegou à etapa de compilação Vite.
- **NÃO** foram executados testes de integração com Firebase real, Firebase Emulator Suite, Vercel publicada, pagamento, Storage, navegadores e telas em dispositivos.

## Lacunas conhecidas: não declarar homologação

1. O frontend não possui todos os detalhes operacionais de cada requisito do Prompt V3, como trocas parciais, reservas financeiras detalhadas e aprovações, histórico avançado de fotos de todos os tipos de registro, todos os filtros e métricas de RH, relatórios por categoria completos.
2. Documentos são listados por páginas limitadas de até 500 itens; relatórios agregados do navegador podem ficar incompletos acima desse limite. Para operação em escala, implementar paginação contínua e agregações no backend.
3. Cobrança automática de assinaturas, confirmação via gateway e envio real de mensagens aos clientes não estão integrados; valores registrados como recebidos são confirmações manuais do operador.
4. Não há processamento contábil/fiscal, NF-e/NFC-e, backup automatizado, políticas de retenção e consentimento LGPD, nem rastreamento de mudanças externas ao FixFlowOS.
5. Regras do Firestore e Storage e as rotas Vercel são fornecidas mas **não testadas no emulador/deploy**. Não afirmar isolamento testado em produção.
6. A regra de senha numérica é aplicada na criação de usuário pela API; os links de recuperação nativos do Firebase não preservam restrição exclusivamente numérica.
7. O sistema usa estimativas de custo registrado e resultado de caixa simplificado; não é um ERP contábil completo. Algumas ações financeiras geram lançamentos refletidos na loja, mas devem ser auditadas em homologação.
8. Regras de CORS do bucket podem precisar ser configuradas para leitura de anexos via SDK Web.
9. Algumas operações administrativas e alertas ainda precisam de testes de concorrência, segurança e carga real; as regras de leitura do Firestore só cobrem coleções conhecidas.

## Próximo requisito para considerar pronto para produção

Em computador/CI com acesso à internet, realizar `npm install && npm run check`; configurar Firebase de homologação e rodar testes de integração com dois tenants diferentes e perfis distintos; testar com dispositivos mobile; validar deploy em Vercel e corrigir todos os problemas observados. **Este documento prevalece sobre a descrição genérica de módulos: não considerar o produto pronto para comercializar enquanto houver lacunas acima.**
