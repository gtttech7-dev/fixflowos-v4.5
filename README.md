# FixFlowOS V3.3

**Antes de atualizar pela Vercel, consulte [NOTAS_DA_ATUALIZACAO_V3_3.md](./NOTAS_DA_ATUALIZACAO_V3_3.md).** Esse arquivo contém mudanças, índices obrigatórios e limitações de produção.

# FixFlowOS V3.2 — instalação, Firebase e Vercel

**Leia primeiro `docs/ALTERACOES_E_TESTES_V3_2.md`.** Atualização de planos personalizados, finanças, privacidade, interface e permissões. **A chave administrativa compartilhada na conversa deve ser revogada e substituída** antes de qualquer implantação. Apenas as seis variáveis públicas foram pré-preenchidas em `.env.example`. Nunca compartilhe, inclua ou faça commit de `FIREBASE_SERVICE_ACCOUNT_JSON`.

**Não homologado:** a instalação npm e o build completo não foram concluídos neste ambiente; os testes de funções puras e sintaxe foram executados. Faça backup dos dados e rode os testes em um Firebase de homologação antes de publicar.

Este repositório contém a aplicação **FixFlowOS**, com frontend React/Vite, API Node.js para Vercel, Firebase Authentication, Cloud Firestore, Storage, regras, índices e testes locais. A especificação integral recebida está em `docs/ESPECIFICACAO_ORIGINAL_V3.txt`.

> **Situação desta entrega:** o código foi gerado e a sintaxe e os testes puros podem ser verificados localmente. A entrega **não foi homologada em um projeto Firebase real nem submetida a uma build de produção bem-sucedida** no ambiente de elaboração, porque a instalação via registro npm falhou por indisponibilidade de rede. Leia `docs/VALIDACAO_E_LACUNAS.md` antes de tratar o sistema como pronto para clientes. O objetivo destas instruções é configurar os serviços, não ocultar essas limitações.

## 1. Instalar e validar

Requisitos: Node.js 20 ou superior e npm instalado em computador com internet. Descompacte o ZIP e, na pasta `fixflowos`, execute:

```bash
npm install
npm run syntax
npm test
npm run build
```

A saída do build deve criar a pasta `dist`. Não prossiga para clientes reais se houver erros em algum comando. Para iniciar em desenvolvimento depois de configurar `.env`:

```bash
npm run dev
```

O comando sobe frontend e API juntos em `http://localhost:5173`. **O desenvolvimento local exige as variáveis privadas do Firebase Admin em `.env`; nunca disponibilize esse arquivo, a pasta `node_modules` ou credenciais em um repositório público.**

## 2. Criar projeto no Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com/), selecione **Adicionar projeto**, escolha nome e região apropriados.
2. Em **Configurações do projeto**, crie um aplicativo **Web**. Copie as informações de configuração web exibidas pelo console (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
3. O nome do aplicativo Web não precisa ser idêntico ao nome comercial FixFlowOS. Não ative recursos que você não utiliza.

## 3. Ativar Firebase Authentication

1. No menu **Build > Authentication > Começar**, ative o provedor **E-mail/senha**.
2. Em **Authentication > Configurações > Domínios autorizados**, inclua o domínio da Vercel e seu domínio próprio, se houver; inclua localhost quando necessário para desenvolvimento e se o console permitir.
3. O FixFlowOS não possui cadastro público. Usuários das lojas são criados por Admin de loja via backend; proprietários são criados por Super Admin.
4. As APIs de criação de usuário exigem uma senha inicial com **somente números, no mínimo 8 dígitos**. Configure proteção de conta no console e oriente a troca segura de senha. **A recuperação de senha padrão do Firebase não restringe a senha nova a caracteres numéricos da mesma forma que a API do FixFlowOS; para impor isso integralmente nesse fluxo, seria necessário um fluxo de redefinição próprio**. O sistema não implementa essa restrição adicional no link padrão de redefinição.

## 4. Criar Cloud Firestore

1. Em **Build > Firestore Database > Criar banco de dados**, selecione o banco padrão `(default)` e uma região adequada.
2. Use o modo de produção/bloqueado, nunca regras que liberem acesso global.
3. Os documentos são organizados em `stores/{storeId}/...`, `memberships/{uid}` e `platform/...`. A API usa o UID verificado da sessão para ler o vínculo da loja; **o frontend não determina a loja efetiva que o backend consulta**.
4. As regras em `firestore.rules` proíbem leituras **e** gravações diretas do aplicativo Web: todos os fluxos de consulta e gravação passam pelas rotas autenticadas com Firebase Admin no servidor. O Admin SDK ignora Security Rules, portanto a validação por papel e por loja na API é essencial.

## 5. Configurar Firebase Storage

1. Em **Build > Storage**, siga o fluxo para criar o bucket. Observe os requisitos de faturamento atuais do Firebase para habilitar o Storage no seu projeto.
2. Copie o nome exato do bucket (por exemplo, `seu-projeto.firebasestorage.app`) para `VITE_FIREBASE_STORAGE_BUCKET`.
3. O arquivo `storage.rules` permite arquivos de imagem/PDF de até **10 MiB**, em caminhos `stores/{storeId}/...`, apenas para funcionários ativos daquela loja. Alterações e exclusões diretas de anexos são bloqueadas.
4. Para a leitura de arquivos via SDK web (`getBlob`), configure CORS no bucket para seus domínios permitidos caso o navegador apresente erro de CORS. CORS **não substitui** autenticação nem Storage Rules.

## 6. Publicar as regras e os índices

Pode utilizar a aba **Rules** dos consoles Firestore e Storage para colar o conteúdo de `firestore.rules` e `storage.rules`. Para publicar também os índices definidos, utilize a CLI oficial do Firebase:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Execute esses comandos **na pasta do projeto** após selecionar o projeto correto pelo `firebase use --add`. Confira se os índices apareceram no console Firestore e estão ativos. Quando um índice novo exigir tempo de construção, espere a confirmação do Firebase antes dos testes.

**Nunca substitua** as regras do projeto por `allow read, write: if true` durante a publicação.

## 7. Variáveis de ambiente locais e na Vercel

Copie `.env.example` para `.env` (o `.gitignore` impede a inclusão involuntária). Preencha as variáveis públicas usando a configuração do aplicativo Web do Firebase:

| Variável | Origem | Exposição |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Configuração do app Web | Pública |
| `VITE_FIREBASE_AUTH_DOMAIN` | Configuração do app Web | Pública |
| `VITE_FIREBASE_PROJECT_ID` | Configuração do app Web | Pública |
| `VITE_FIREBASE_STORAGE_BUCKET` | Configuração do Storage | Pública |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Configuração do app Web | Pública |
| `VITE_FIREBASE_APP_ID` | Configuração do app Web | Pública |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Conta de serviço da seção 8 | **Privada** |
| `APP_DATA_ENCRYPTION_KEY` | Reservada para funcionalidade futura de cifragem | Privada/opcional |

**Não crie** `VITE_FIREBASE_SERVICE_ACCOUNT_JSON`. Prefixo `VITE_` significa que o Vite poderá colocar a variável dentro do pacote do navegador.

## 8. Configurar Firebase Admin no servidor

1. No Firebase Console abra **Configurações do projeto > Contas de serviço**.
2. Gere uma chave JSON nova somente se sua política de segurança autorizar essa abordagem.
3. Armazene-a em gerenciador de segredos. Converta o conteúdo JSON para **uma única linha**, mantendo escapes `\\n` do campo `private_key`. Cole **todo o JSON** como valor de `FIREBASE_SERVICE_ACCOUNT_JSON` no ambiente seguro de execução do servidor.
4. No painel Vercel, configure a variável em **Settings > Environment Variables** nos ambientes desejados. Evite imprimir a chave em logs ou compartilhar arquivos JSON.
5. Não suba o arquivo da conta de serviço para GitHub, ZIP público, Storage ou frontend. Revogue chaves vazadas imediatamente no console do Google Cloud.

## 9. Criar o único Super Admin manualmente

Este passo deve ser feito por quem controla o Firebase. **O site não possui registro nem promoção de Super Admin na interface.**

1. Em **Firebase Console > Authentication > Users**, clique **Adicionar usuário** e crie a conta usando e-mail e senha.
2. Copie o **UID exato** do usuário criado.
3. Em **Firestore > Dados**, crie o caminho de documentos abaixo. O console permite criar as coleções e documentos na sequência:

```text
platform (coleção)
  admins (documento)
    users (subcoleção)
      SEU_UID (documento)
        enabled: true             (booleano)
        email: superadmin@exemplo.com  (string com o e-mail exato da conta)
```

4. Não crie um documento `memberships/{UID}` para esse Super Admin global. O backend verifica o token Firebase, busca `platform/admins/users/{UID}` e exige `enabled == true` e e-mail idêntico ao da sessão.
5. Faça login no sistema com essa conta. A rota será `/super-admin`; use **Nova loja** para cadastrar a primeira loja e seu proprietário.
6. Uma loja nova ganha automaticamente um usuário proprietário com o papel `ADMIN`, pertencente apenas àquela loja. Esse proprietário não vira Super Admin.

**Segurança:** um usuário comum não consegue criar/editar `platform/admins/users` por Firestore Rules; apenas o operador com acesso administrativo ao Firebase Console pode preparar a autorização.

## 10. Importar para Vercel e realizar deploy

1. Crie um repositório Git privado com todo o conteúdo da pasta `fixflowos` — excluindo `.env`, credenciais e `node_modules` — e envie ao GitHub/GitLab/Bitbucket disponível no Vercel. Alternativamente, utilize a CLI `vercel` com uma conta Vercel vinculada.
2. Na [Vercel](https://vercel.com/dashboard), selecione **Add New > Project** e importe esse repositório.
3. Nas configurações de Build, selecione framework **Vite** (autodetecção), instalação **`npm install`**, build **`npm run build`**, saída **`dist`** e Node.js suportado (`>=20`). O arquivo `vercel.json` já prevê a função `api/index.js` e o fallback de SPA para URLs internas.
4. Em **Settings > Environment Variables**, configure todas as variáveis da seção 7, incluindo `FIREBASE_SERVICE_ACCOUNT_JSON` **sem** `VITE_`.
5. Faça o deploy e confirme que a saída da Vercel não apresenta erros de instalação, compilação, API ou variáveis.
6. Abra `/login`, entre com o Super Admin manual, crie uma loja, entre com o proprietário, crie uma OS, produto, venda e verifique os registros persistidos no Firestore.
7. Antes de usar dados reais, teste com **duas lojas distintas**: uma conta da loja A não pode acessar nem listar qualquer dado da loja B. Confirme que o Técnico não altera estoque diretamente e que a API rejeita usuários inativos.

A Vercel publica as rotas da API com autenticação por token Firebase. Se `POST /api/index` retornar `401` sem Authorization, isso é um comportamento esperado de proteção (não é falha do deploy).

## 11. Domínio próprio

Na Vercel, abra o projeto publicado, vá a **Settings > Domains**, adicione seu domínio e siga a indicação de registros DNS (A/CNAME ou nameservers) exibida pela própria Vercel. Aguarde a verificação/SSL. Adicione também esse domínio aos **Authorized domains** do Firebase Authentication.

## 12. Problemas comuns

| Mensagem/erro | Verificação |
|---|---|
| `Credenciais administrativas Firebase não configuradas` | `FIREBASE_SERVICE_ACCOUNT_JSON` não existe no servidor ou não foi incluída no deploy correto. |
| `FIREBASE_SERVICE_ACCOUNT_JSON inválido` | O valor não é JSON válido; preserve aspas e as quebras de linha escapadas da private_key. |
| `auth/invalid-api-key`, `auth/invalid-credential` | Confirme variáveis `VITE_`, projeto e e-mail/senha; faça novo build depois de alterar variáveis frontend. |
| `auth/unauthorized-domain` | Cadastre o domínio da Vercel/domínio próprio em Authentication. |
| `Usuário sem loja ativa` | A conta não está ligada a `memberships/{uid}` ou está desativada; usuários comuns são criados pelo Admin da loja. |
| `Acesso exclusivo do Super Admin` | Verifique documento `platform/admins/users/{UID}`, e-mail e valor booleano `enabled`. |
| `Sem permissão` | Confira o papel em `memberships/{UID}`; não manipule papéis diretamente pelo frontend. |
| `The caller does not have permission`, `permission-denied` | Leituras/gravações diretas no Firestore Web são deliberadamente proibidas; valide acesso via API e, para Storage, suas regras e o vínculo à loja. |
| Fotos não abrem / erro de CORS | Habilite Firebase Storage, confira regras por loja e configuração de CORS no bucket. |
| `404` em página interna | Verifique o fallback SPA em `vercel.json`. |
| `404` em `/api/index` | Verifique se o arquivo `api/index.js` foi publicado e não se houve erro de build da função. |
| `npm install` falha | Verifique conexão com `registry.npmjs.org`, DNS, proxy, Node.js e versão das dependências. |
| Sem dados no dashboard | O sistema não insere dados fictícios. Crie registros operacionais reais de teste com o Super Admin/loja. |

## 13. Checklist antes da abertura comercial

- Executar `npm install`, `npm run syntax`, `npm test` e **`npm run build`** com sucesso.
- Verificar estrutura de lojas, autenticação, UI mobile, API, leitura/gravação no Firestore, Storage, regras e índices num ambiente Firebase de homologação.
- Executar cenários de pagamento, devolução, concorrência de estoque/caixa, papéis e troca de loja com ao menos dois usuários e duas lojas.
- Conferir logs Vercel/Firebase, regras da LGPD, backup, retenção de dados, limites de uso e controle de custo.
- Ler `docs/VALIDACAO_E_LACUNAS.md`: este pacote deve passar por homologação antes de clientes reais.

**Custos de aparelhos recebidos por troca:** se `acquisitionCost` estiver vazio/zero, o cálculo usa `tradeValue` como custo de aquisição. Se ambos forem preenchidos, `acquisitionCost` prevalece, evitando duplicar o custo de entrada.

**Observação:** ainda não há integração de cobrança externa, nem envio de WhatsApp/e-mail operacional. PIX, Cartão e Dinheiro são meios de pagamento **registrados pelo operador**, não cobranças executadas pelo sistema.


## 14. Mudanças da V3.2 e migração a partir da V3.1

Leia `docs/ALTERACOES_E_TESTES_V3_2.md` antes de atualizar. Faça backup de sua pasta e de seus dados. A V3.2 usa **o mesmo projeto Firebase**, a mesma estrutura de coleções e os mesmos IDs; não apague suas lojas e não recrie o Super Admin. Descompacte o ZIP em uma **pasta nova** e configure o `.env` com as seis variáveis públicas. **Gere uma nova conta de serviço/chave JSON e revogue a que foi compartilhada em conversa**. Não inclua JSON privado no ZIP/GitHub.

- Planos: `platform/data/plans/{id}` aceita `period` (`Semanal`, `Mensal`, `Trimestral`, `Anual`, `Vitalício`) e `userLimit` (número de usuários ativos, dono incluído, ou `null` para ilimitado). Planos antigos sem limites continuam sem limites até serem editados. Os usuários existentes não são automaticamente excluídos ao reduzir um limite; novos usuários/reativações são bloqueados no servidor ao atingi-lo. A contagem fica em `stores/{id}.activeUserCount` e é inicializada a partir da coleção de usuários para lojas antigas.
- Assinaturas novas: o sistema gera **as seis primeiras cobranças recorrentes** com IDs determinísticos para planos semanais, mensais, trimestrais e anuais. **A geração continuada após essas seis cobranças NÃO está automatizada**; deve ser planejada antes da operação comercial de longo prazo. Planos vitalícios podem gerar de 1 a 36 parcelas da aquisição inicial, sem renovação do plano. Assinaturas antigas não recebem cobranças retroativas automaticamente.
- Super Admin: em `Cobranças e recebimentos`, abra `Receber`; em `Despesas`, clique em `Pagar`. Informe valor e data, inclusive parcialmente. O sistema registra autoria, método e operação única; um valor ainda não recebido permanece em `A receber`. Cadastrar preço de plano NÃO registra pagamento. Para atualizar valores históricos, não altere registros liquidados sem revisar auditoria.
- Financeiro da loja: rota `/financeiro` e respostas da coleção `finance` passam a ser exclusivas do dono `ADMIN`. Gerentes podem registrar recebimentos de OS e operar o caixa conforme a função, sem ver o dashboard financeiro.
- Termos/privacidade: modelos de documentos em `public/legal/termos.html` e `public/legal/privacidade.html` **precisam ser revisados por responsável jurídico e preenchidos com a identificação da empresa antes do uso com clientes**. O sistema exige aceite dos termos do dono e ciência de funcionários. Preferências opcionais de rascunhos e sessão são independentes, guardadas em `userPolicies/{uid}` no servidor. Rascunhos ficam em `stores/{loja}/userDrafts/{uid}/items/...`, com acesso pela API e limite de tamanho. Podem incluir dados pessoais de formulários; considere retenção e políticas LGPD.
- Na tela de login é possível marcar `Manter conectado`; nas preferências, qualquer usuário pode mudar essa escolha. Em computadores compartilhados, mantenha desativado.
- O aviso técnico de contagem foi retirado da interface. **Limitação real:** módulos da loja ainda listam até 500 registros por coleção na API e podem requerer agregação paginada no backend para relatórios precisos em grande volume. Os indicadores globais do Super Admin usam consulta paginada para até 50 mil registros por coleção. Esses limites devem ser reavaliados antes do fechamento financeiro/contábil e da escala da plataforma. O dashboard não substitui um sistema fiscal.
- As chaves de Firebase Web no `.env.example` são de configuração pública; **FIREBASE_SERVICE_ACCOUNT_JSON é segredo de servidor**.

## 15. Testar a V3.2 antes de substituir a anterior

1. Extraia o ZIP em uma pasta nova, confirme `fixflowos/package.json`, copie somente suas configurações públicas e use uma chave privada **nova** no `.env`.
2. Execute `npm install`, `npm run syntax`, `npm test`, `npm run build` e `npm run dev` na pasta `fixflowos`.
3. Entre como Super Admin e crie um plano semanal com limite de 2 usuários; teste que só entram proprietário + 1 funcionário. Teste a recusa de um terceiro no backend, depois configure como ilimitado e crie o terceiro.
4. Crie um plano vitalício de R$ 100 parcelado em 3 cobranças (R$ 33,34, R$ 33,33, R$ 33,33); registre pagamento de uma parcela e confira que o dashboard exibe apenas o valor recebido, sem dar baixa indevida nas demais.
5. Cadastre uma despesa pendente e use `Pagar`. Confira despesa realizada, prevista e resultado. Faça pagamentos parciais.
6. Entre como Gerente: `/financeiro` deve negar acesso; o menu não deve exibi-la; testar `records.list` para `finance` pela API deve retornar 403. O Dono continua podendo acessar.
7. Faça login com funcionário novo e confira a janela de ciência de privacidade. Ative rascunhos e feche um formulário; ao abrir novamente, verifique recuperação somente na mesma conta e loja.
8. Confira se a mensagem React `Received true for non-boolean attribute block` desapareceu.
9. Verifique mobile de 360, 375, 390 e 414 px, rotas protegidas e isolamento com duas lojas. Só publique depois dos testes de regressão.
