# Onde a sessão parou — 2026-08-27

> Bilhete para a próxima sessão. O planejamento completo continua em
> [`GUIA-IMPLEMENTACAO.md`](GUIA-IMPLEMENTACAO.md) (seção 2 = achados técnicos,
> seção 7 = régua de qualidade de ensino, seção 9 = tabela de fases).

## Resumo em uma linha

**2026-08-27:** nasceu o catálogo `middlewares/` — 14 middlewares prontos em
quatro grupos, cada um com README próprio, mais o link no `docs/05`. O registro
está na seção logo abaixo.

**2026-08-20:** a leva 2 de `minis-apis` (as minis 5, 6 e 7) ficou pronta, a 4
foi documentada retroativamente no briefing e a pasta foi de 4 para 7 minis — o
registro está na seção mais abaixo. O que vem antes é da sessão de 18/08.

Duas entregas: a **solução do exercício 13** ficou pronta, e as **soluções 11, 12
e 13 passaram a usar Prisma** como persistência de produção, com os repositórios
em memória virando dublê de teste. A suíte saiu de 113 para **245 testes**.

Tudo commitado na `main`, no commit `e72911b` ("att") — 75 arquivos, incluindo
`prisma/schema.prisma`, a migration e a correção do `.env.example`.

## ▶ O QUE FAZER NA PRÓXIMA SESSÃO

Em ordem. Os dois primeiros itens são resíduo desta sessão e são rápidos:

1. **Atualizar os enunciados 11, 12 e 13** (`exercicios/NN-*/README.md`). Eles
   ainda descrevem a persistência como estava: o do 11 diz "memória, SQLite ou
   Prisma" sem apontar o que a solução de referência faz, e nenhum menciona a
   suíte de contrato nem o `REPO=memoria`. **O código está pronto; o enunciado
   ficou para trás.**
2. **Conferir se `docs/11`, `docs/12` e `docs/13` afirmam algo que mudou.** Não
   foi verificado nesta sessão. O candidato mais provável é o módulo 12, que fala
   de suíte de contrato e SQLite `:memory:` — agora as soluções têm isso de fato.
3. **Solução do exercício 14** (o enunciado existe desde 2026-08-13). É o que
   fecha a Fase 4 junto com 15 e 16.
4. **Mini desafios dos módulos 02 a 14.** Só o 01 tem. Os achados desta sessão
   (listados abaixo) são material pronto para os módulos 12 e 13.
5. **Seção de Postgres, em pasta à parte.** Pedido do usuário nesta sessão. A
   ideia é uma trilha separada, não um módulo no meio do currículo: o repo
   continua em SQLite por decisão da seção 3 do guia (zero instalação, e SQL que
   transfere). O material tem gancho pronto — as diferenças que o ORM não apaga
   já estão comentadas no código (`enum` que o SQLite não tem,
   `mode: 'insensitive'` ignorado em silêncio, índice único parcial).

## O que foi feito nesta sessão

### 1. Solução do exercício 13 (`exercicios/13-seguranca/solucao/`)

Cópia da solução 12 evoluída — a convenção do repo: cada solução copia a
anterior, e o `diff` entre as duas é o material de estudo.

| Arquivo                    | Mudança                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `app.ts`                   | `helmet()`, `cors` com lista de origens, limitadores       |
| `middlewares/limites.ts`   | **novo** — `criarLimites()`, quatro baldes por finalidade  |
| `middlewares/limitar.ts`   | **apagado** — o escrito à mão no módulo 05 saiu            |
| `servicos/emprestimos.ts`  | `buscarVisivel` fecha o IDOR: empréstimo de outro vira 404 |
| `rotas/emprestimos.ts`     | `GET /emprestimos/:id` e `POST /emprestimos/:id/devolver`  |
| `servicos/arquivos.ts`     | **novo** — resolve o caminho e o confina em `capas/`       |
| `rotas/arquivos.ts`        | **novo** — `GET /arquivos/:nome`, com duas capas SVG       |
| `schemas/livro.ts`         | busca `q`, com teto de 100 caracteres                      |
| `testes/seguranca.test.ts` | de 7 para 25 casos                                         |
| `solucao/README.md`        | **novo** — inclui o registro do `npm audit`                |

Isso fechou a pendência 4 da sessão anterior: `limitar()` escrito à mão foi
trocado por `express-rate-limit`.

### 2. Prisma nas soluções 11, 12 e 13

**O motivo, na palavra do usuário:** a ideia do repositório é aprender a fazer
sistemas reais, e num sistema real nenhum `servidor.ts` sobe com array em
memória. Até aqui as soluções 11–13 tinham copiado o **08** (memória) e largado a
progressão 09 → 10 (SQL → ORM) pelo caminho.

**A decisão que orienta tudo:** não é "Prisma ou memória" — num sistema real os
dois existem, em lugares diferentes.

| Onde                   | Implementação | Por quê                                      |
| ---------------------- | ------------- | -------------------------------------------- |
| `servidor.ts`          | Prisma        | produção não pode perder dados no restart    |
| testes de rota/serviço | memória       | suíte em segundos, sem banco nem migration   |
| suíte de contrato      | **as duas**   | pega o dublê desviando da implementação real |

O que entrou:

- `prisma/schema.prisma`: modelos `Usuario`, `Emprestimo` e `RefreshToken`, sob
  um cabeçalho dizendo de qual módulo são. Migration
  `20260818141303_modulo_11_auth_emprestimos`.
- Um schema só para o repositório inteiro, de propósito: um projeto Prisma tem um
  schema, um client e um histórico de migrations. Um segundo projeto obrigaria
  quem estuda o módulo 11 a configurar Prisma antes de aprender autenticação.
- `db/prisma.ts` e cinco `repositorios/*-prisma.ts` em cada uma das três soluções.
- Os repositórios Prisma recebem o **cliente por parâmetro**, com o singleton
  como padrão — é o que permite a suíte de contrato apontar para um banco
  temporário em vez de escrever no `.sqlite` de desenvolvimento.
- `servidor.ts` escolhe a implementação: Prisma por padrão, `REPO=memoria` para
  subir sem nenhum setup de banco.
- `testes/repositorio.test.ts` (soluções 12 e 13): a suíte de contrato.

### 3. `minis-apis/` — leva 1, três mini APIs fora do domínio da biblioteca

Pasta nova, com briefing próprio em
[`minis-apis/ORQUESTRACAO.md`](../minis-apis/ORQUESTRACAO.md). O objetivo é ver o
conteúdo dos módulos aplicado a outro domínio: vinte módulos com livros e
empréstimos ensinam a biblioteca junto com o conceito, e essa pasta separa os
dois.

Toda a leva 1 fica **abaixo do módulo 09**, por pedido do usuário. Cada mini API
foi construída por um agente, em paralelo, a partir da tarefa correspondente da
seção 4 do briefing.

| Mini API        | Domínio                     | Módulos | Porta | Persistência | Linhas de código |
| --------------- | --------------------------- | ------- | ----- | ------------ | ---------------- |
| `01-encurtador` | encurtador de links         | 03–05   | 6001  | `Map`        | 123 (teto ~180)  |
| `02-inscricoes` | inscrição em evento         | 03–07   | 6002  | memória      | 296 (teto ~320)  |
| `03-despesas`   | controle de gastos pessoais | 03–09   | 6003  | SQLite       | 493 (teto ~450)  |

A **3 passou ~10% do teto**. O excedente está no DDL dentro de template string e
nos mapeadores de linha para JSON, não em escopo extra — são os 7 endpoints
pedidos e os 2 recursos. Fica registrado como dívida, não como erro.

O que entrou junto:

- `tsconfig.minis.json` na raiz e o script `typecheck:minis` no `package.json` —
  o `npm run typecheck` cobre só `src/**`, e a pasta ficaria sem checagem
  nenhuma.
- `minis-apis/README.md`: a porta de entrada, com a **ordem de leitura por dor** —
  a 1 valida com `if` na mão (a dor), a 2 resolve com Zod e cria a dor da memória
  volátil, a 3 resolve com banco.

Três coisas que valem virar material dos módulos:

- **`X-Tempo-ms` no `res.on('finish')` não funciona.** Nesse ponto os cabeçalhos
  já saíram e `setHeader` estoura `ERR_HTTP_HEADERS_SENT`. O jeito certo é
  envolver `res.writeHead`. O exemplo do módulo 05 só mostra o `finish`, que
  serve para logar — cabe uma linha na tabela "Erros comuns" do 05.
- **`unrecognized_keys` do Zod 4 vem com `path` vazio.** Quem monta a lista de
  campos que falharam a partir do `path` perde o nome do campo recusado; é
  preciso ler as chaves de dentro do issue. Material do módulo 07.
- **Corpo JSON com acento se corrompe no pipeline do shell no Windows.** Acento
  vindo do código-fonte e do seed trafega certo; o que quebra é o `curl` com
  `-d`. Soma-se ao aviso de aspas do módulo 01.

Verificação de cada uma, feita pelo agente que a construiu: `tsc --noEmit -p
tsconfig.minis.json` limpo, todos os endpoints exercitados com `curl.exe` no Git
Bash (caminho feliz e os erros da tabela), `prettier --check` limpo, servidor
derrubado. A 3 subiu duas vezes, para provar migration idempotente e persistência.

## Sessão de 2026-08-27 — `middlewares/`: o catálogo

Pasta nova na raiz, irmã de `minis-apis/`: **14 middlewares prontos**, um por
pasta, em quatro grupos. Cada um com o `middleware.ts` comentado e um `README.md`
que diz o que ele resolve, onde entra na pilha e o que custa.

### O que ela é, e o que ela não é

Ela **não é biblioteca** — ninguém importa daqui. As soluções dos exercícios
continuam com as cópias próprias, porque o `diff` entre uma solução e a seguinte
é material de ensino. O catálogo é para **copiar a pasta**, e o que ela tem de
diferente de um trecho colado de tutorial é a explicação junto.

A decisão veio de um número: middleware é a coisa mais duplicada do repositório —
`log.ts` aparece 9 vezes, `autenticar.ts` 9, `limitar.ts` 8, `validar.ts` 7, uma
cópia por solução de exercício. O que faltava não era código compartilhado, era
um lugar onde cada um estivesse explicado uma vez.

### Os quatro grupos

| Grupo                       | Porta | Middlewares                                                            |
| --------------------------- | ----- | ---------------------------------------------------------------------- |
| `01-requisicao-e-resposta`  | 6101  | tempo-de-resposta, id-de-requisicao, log                               |
| `02-validacao-e-erros`      | 6102  | validar, tratador-de-erros, nao-encontrado, assincrono                 |
| `03-acesso-e-seguranca`     | 6103  | autenticar, exigir-papel, limitar, cabecalhos-de-seguranca             |
| `04-desempenho-e-convencao` | 6104  | cache-condicional, timeout, paginacao                                  |

Cada grupo tem um `servidor.ts` que é **demonstração, não aplicação**: monta a
pilha e expõe rotas mínimas, incluindo rotas que existem **para falhar**.

### A régua que decidiu a qualidade: armadilha se demonstra, não se afirma

O briefing exigiu que as armadilhas fossem provadas rodando. As três que
sustentam o catálogo:

- **`setHeader` dentro de `res.on('finish')` não funciona.** A rota `/quebrado`
  responde 200, o cabeçalho não aparece, e o terminal registra
  `ERR_HTTP_HEADERS_SENT`. O jeito que funciona envolve `res.writeHead`.
- **No Express 5 o wrapper `asyncHandler` é desnecessário.** A rota
  `/async/sem-wrapper` lança `AppError(..., 503)` sem wrapper nenhum e o 503
  chega pelo tratador central — byte por byte igual à rota com wrapper. O que
  **continua** não sendo automático é o `throw` dentro de `setTimeout`: ele
  dispara numa pilha nova, vira `uncaughtException` e derruba o processo, não a
  requisição.
- **O timeout não mata o handler.** A rota `/execucoes` mostra o contador do
  handler caro subindo **depois** de a resposta ter sido abandonada: o middleware
  protege quem espera, não o servidor.

E o cache prova o ganho de forma medível: no `304`, o contador do handler caro
**não sobe** — a resposta não foi montada.

### Setup que entrou na raiz

- `tsconfig.middlewares.json` e o script `typecheck:mw` no `package.json`, ao
  lado do `typecheck:minis` — o `npm run typecheck` cobre só `src/**`.
- Um bloco novo no fim de `docs/05-middlewares.md` apontando para o catálogo. Ele
  **aponta e não reexplica**, e avisa que metade dos middlewares usa assunto de
  módulo mais à frente (11, 13, 14).

### Como foi construído, e o que deu errado

Quatro agentes em paralelo, um por grupo. **Os quatro foram interrompidos pelo
limite de sessão no meio do trabalho**: os 14 `middleware.ts` e os 4 `servidor.ts`
ficaram prontos, mas faltavam 12 READMEs e nenhum tinha chegado às verificações.

O que fizemos em vez de simplesmente relançar:

1. **Verificar antes de despachar de novo.** `typecheck:mw` limpo, e as quatro
   demos exercitadas com 48 checagens de `curl`. Nenhum dos quatro grupos tinha
   defeito — as 9 "falhas" da primeira rodada eram todas fixture do roteiro de
   teste (schema com campo que não mandei, rota de sessão que lê query em vez de
   corpo, dois status esperados errados, e o teste feito na rota de contraste em
   vez da rota com o middleware).
2. **Despachar a segunda leva só para os READMEs**, com as saídas reais de `curl`
   entregues prontas no prompt. Isso elimina o risco de README de estudo prometer
   um status que a API não devolve.

Vale registrar dois acertos dos agentes: o do grupo 02 percebeu que uma linha que
ele ia escrever era inferência (eu não tinha fornecido aquela saída), subiu o
servidor e conferiu antes; e o do grupo 04 alertou que rodar `prettier --write`
nos `.ts` descolaria os blocos ` ```ts ` dos READMEs que citam aquelas linhas. O
alerta era correto, e a conferência mostrou que o Prettier já formata código
dentro de bloco Markdown com linguagem declarada — os dois lados foram
reformatados juntos e continuaram idênticos.

### Verificação final

`typecheck:mw` limpo, `prettier --check middlewares/` limpo, as quatro demos
subindo e respondendo, e a suíte existente intacta.

---

## Sessão de 2026-08-20 — `minis-apis`: leva 2, e a 4 finalmente documentada

Três mini APIs novas (`05-reservas`, `06-compras`, `07-habitos`), construídas por
três agentes em paralelo a partir da seção 6 do briefing, que foi escrita nesta
sessão. A pasta foi de 4 para 7 minis.

### O briefing foi reorganizado antes do despacho

O `ORQUESTRACAO.md` só descrevia a leva 1 e falava "as três" em toda parte,
enquanto a pasta já tinha quatro minis. O que mudou:

- **Seção 1** deixou de ser específica da leva 1: o teto virou **por tarefa**, a
  faixa de portas virou `600N` genérica, e a regra "roda sem setup" passou a
  declarar a exceção da 6.
- **Seção 3** ganhou a régua de layout (abaixo).
- **Seção 4** virou "Leva 1 — as quatro tarefas", com a **Tarefa 4 registrada
  retroativamente**: a `04-enquetes` foi construída sem briefing, e agora existe
  a entrada que descreve o que ela é — inclusive o buraco proposital no módulo 07
  — para as levas seguintes poderem citá-la em vez de reexplicar.
- **Seção 6** é a leva 2, com as três tarefas por extenso. **Seção 7** lista o que
  ainda não apareceu em mini nenhuma: teste (12), rate limit (13), log (14),
  cache (15), upload (19).
- Os caminhos `/workspaces/...` do prompt de despacho (resíduo de devcontainer)
  viraram relativos.

### A régua de pasta por camada

Questão levantada pelo usuário no meio da sessão: por que as minis são arquivos
planos se `src/exemplos/08-camadas/` e as soluções dos exercícios usam pastas. A
resposta virou regra escrita na seção 3:

> **Camada com dois ou mais arquivos vira pasta; camada com um arquivo só fica
> plana.**

É por isso que a `03` e a `04` continuam planas (cada camada cabe num arquivo, e
`repositorios/` com um `repositorio.ts` dentro custa um clique sem separar nada),
e a `06` tem `rotas/` (três grupos de recurso em quatro arquivos). A régua foi
enviada aos agentes da 6 e da 7 com eles já em execução — a 6 reorganizou, a 7
conferiu e permaneceu plana, que é o resultado certo para ela.

### As três

| Mini API      | Domínio                        | Módulos | Porta | Persistência | Linhas de código |
| ------------- | ------------------------------ | ------- | ----- | ------------ | ---------------- |
| `05-reservas` | reserva de sala por horário    | 03–07   | 6005  | memória      | 388 (teto ~360)  |
| `06-compras`  | lista de compras compartilhada | 03–11   | 6006  | Prisma       | 543 (teto ~700)  |
| `07-habitos`  | rastreador de hábitos privado  | 03–11   | 6007  | SQLite       | 520 (teto ~650)  |

A **6 e a 7 são um par deliberado**: mesmo teto de módulos, camadas de dados
opostas. Lidas juntas, separam o que era do ORM do que era do problema. E as duas
resolvem "quem pode ver isto?" em formatos diferentes — a 6 compartilha por
papéis, a 7 não compartilha com ninguém.

### A decisão que custou algo: Prisma próprio na 6

A 6 tem projeto Prisma **dentro da pasta** (`prisma/schema.prisma`,
`prisma.config.ts`, migrations próprias, client gerado em `prisma/gerado/`, banco
em `data/minis-06-compras.sqlite`). A alternativa era pendurar os modelos no
`prisma/schema.prisma` da raiz, como as soluções 11–13 fazem — e o comentário
daquele schema até defende isso para os exercícios.

Foi recusada porque poria as tabelas da mini no mesmo banco da biblioteca e
quebraria a regra de a mini ser lida sozinha. **O preço é que a 6 é a única mini
com passo de setup** (`prisma migrate deploy` + `generate` com `--config` antes do
primeiro `node`), declarado no `## Rodar` do README dela e na seção 1 do briefing.
Uma linha nova no `.gitignore` da raiz mantém o client gerado fora do git.

### Verificação

Além da que cada agente fez, o orquestrador rodou uma bateria própria contra as
**sete** minis: **150 checagens de endpoint com `curl.exe`, 0 defeitos**. As
falhas da primeira rodada eram todas fixture do teste — o seed da 5 ocupa 09h–11h
na sala 1, e o `id` vazio derrubou cinco testes em cascata; na 6, o 403 tinha sido
pedido a quem ainda não era membro, que por definição recebe 404.

O que a bateria confirmou, que é o que cada mini existe para ensinar:

- **5** — a reserva das 11h entra em cima do fim da das 10h (intervalo semiaberto),
  sobreposição dá 409 e formato dá 422, e o `PATCH` só com `fim` é comparado com o
  `inicio` **já gravado** e recusado.
- **6** — a convidada, que enxerga a lista, recebe **403** ao tentar convidar; um
  estranho com token perfeitamente válido recebe **404** na mesma rota, sem
  descobrir que a lista existe.
- **7** — o segundo `PUT` no mesmo dia devolve 200 igual ao primeiro, e o resumo
  recalcula ao desmarcar (`diasCumpridos` 3 → 2, `sequenciaAtual` 3 → 2).

`typecheck:minis` limpo, `prettier --check minis-apis/` limpo, `npm test` com os
**245 testes passando** — a suíte existente não foi afetada.

### Dois achados que valem virar material de módulo

- **Zod 4 não para na primeira checagem que falha.** Com `19-08-2026` num
  `z.string().regex(...).refine(...)`, a expressão de formato reprova e o `refine`
  roda mesmo assim, sobre a string já sabidamente malformada. Se ele fizer
  `new Date(...).toISOString()`, o `Invalid Date` **lança `RangeError`** em vez de
  devolver falso — e o erro de digitação vira **500 no lugar de 422**. Confirmado
  rodando os dois schemas lado a lado. Material do módulo 07, e já está na tabela
  "Onde é fácil errar" do README da 7.
- **`unrecognized_keys` com `path` vazio mordeu de novo**, agora na 6: o
  `.strict()` reprova a chave desconhecida no objeto, não num campo, e a lista de
  erros mostrava `(raiz)` em vez do nome que o cliente precisa corrigir. O achado
  já estava registrado na leva 1 e continua sem virar linha no módulo 07 — é a
  segunda vez que custa tempo.

### Uma armadilha de ambiente, não do repositório

O `npm run typecheck:ex` quebrava com 50 erros de `Property 'usuario' does not
exist on type 'PrismaClient'`. A causa não é o código: o client gerado em
`src/exemplos/10-prisma/gerado/` está no `.gitignore` e o desta máquina era
**anterior** aos modelos do módulo 11. `npx prisma generate` resolveu e o
`typecheck:ex` passou limpo. Vale lembrar em qualquer clone novo.

Sobra, como dívida **pré-existente e não relacionada**, o `npm run format:check`
apontando 90 arquivos fora de padrão — 68 em `exercicios/`, 15 em `docs/`, 1 em
`src/`, 1 em `assets/`. Nenhum em `minis-apis/`.

---

## Quatro achados desta sessão, todos verificados rodando

Os quatro estão escritos por extenso no código, e três mudaram decisão de
desenho. São material pronto para mini desafio.

### 1. `export const rateLimit(...)` prende o balde ao MÓDULO, não ao app

Um teste recebia 429 porque o caso anterior gastara as cinco tentativas — **em
outro app, criado do zero, com outros repositórios.** O contador vivia no módulo.
Virou a fábrica `criarLimites()`, chamada dentro de `criarApp`.

### 2. O path traversal cru nem chega ao seu código

`GET /arquivos/../../.env` responde **404**: são quatro segmentos, a rota
`/:nome` casa com um só, e o handler nunca roda. Só a forma codificada
(`..%2f..%2f.env`) chega ao service e leva 400. Quem testa só a forma crua vê
404 e conclui que está protegido sem ter exercitado uma linha da defesa.

> **Atenção:** o `curl` normaliza `../` antes de enviar. Sem `--path-as-is` você
> mede outra coisa. O Supertest não normaliza.

### 3. O payload de injeção famoso não é o que morde

Sabotando o repositório de propósito (`$queryRawUnsafe`), `'; DROP TABLE
livros; --` **não apaga a tabela**: o `better-sqlite3` recusa mais de uma
instrução por consulta, e o `;` torna o payload duas. Quem testa só com ele se
protege do payload de camiseta, não de injeção.

O que passa é o de **uma instrução**: `' OR 1=1 --` devolve a tabela inteira —
vazamento, que é o que a maioria dos incidentes reais é. O teste afirma as duas
coisas: a busca não quebra **e o filtro continua filtrando**.

### 4. `describe.runIf(false)` marca como PULADO, não deixa de registrar

A suíte de contrato pula a parte Prisma quando o client não está gerado. A
primeira versão usava `describe.runIf`, e o aviso "rode db:generate" aparecia no
resumo **até quando o Prisma estava rodando** — aviso mentiroso. Trocado por um
`if` comum em volta do `describe`.

O princípio que ficou: teste que exige infraestrutura é **pulado com aviso
visível**, nunca sumido em silêncio. Sem o marcador, 26 casos desapareciam de um
total de 245 sem nada indicar.

## Um bug PRÉ-EXISTENTE corrigido no caminho

`.env` e `.env.example` traziam `DATABASE_URL_PRISMA=file:../data/prisma-10.sqlite`.
O `../` só faz sentido rodando de dentro de uma subpasta, e **todos os comandos
documentados são rodados da raiz** — então o `better-sqlite3` procurava a pasta
fora do repositório.

O efeito: **a solução do módulo 10 estava quebrada**. O servidor subia sem erro e
a primeira query devolvia 500 com `Cannot open database because the directory
does not exist`. Corrigido para `file:./data/prisma-10.sqlite` nos dois arquivos,
com o porquê no `.env.example`. Verificado: as soluções 10 e 11 voltaram a
responder.

O `.env` é local e não versionado — num clone novo, quem copiar o `.env.example`
já pega a versão certa.

## Como foi verificado

```
npm run typecheck        → passa
npm run typecheck:ex     → passa
npm run format:check     → limpo
npm test                 → 245 testes, 17 arquivos, verde (eram 113 em 10)
npx vitest run exercicios/13-seguranca → 110 testes
```

Servidores no ar, um por um:

| Solução | Porta | O que foi conferido                                                         |
| ------- | ----- | --------------------------------------------------------------------------- |
| 10      | 4100  | voltou a responder depois da correção do `.env`                             |
| 11      | 4110  | registrar → login → `/auth/eu` → emprestar → `/meus`, tudo gravado no banco |
| 12      | 4120  | sobe com Prisma e lista livros do banco                                     |
| 13      | 4130  | idem, e também com `REPO=memoria`                                           |

E na solução 13, com o servidor no ar:

| O quê          | Resultado observado                                                                    |
| -------------- | -------------------------------------------------------------------------------------- |
| helmet         | CSP, HSTS, `nosniff`, `X-Frame-Options`; `x-powered-by` ausente                        |
| rate limit     | `401 401 401 401 401 429`, com `Retry-After: 60` e corpo no formato da API             |
| leitura        | `GET /livros` segue 200 com a cota de login esgotada                                   |
| path traversal | cru → 404 (roteamento), codificado → 400 (a defesa), capa → 200 `image/svg+xml`        |
| CORS           | origem listada recebe o `allow-origin`; a não listada **recebe os dados sem o header** |
| IDOR           | dona 200, admin 200, terceiro 404 — corpo idêntico ao de um id que nunca existiu       |

A suíte de contrato foi verificada nos dois cenários: com o client gerado (52
casos, os mesmos contra memória e Prisma) e com a pasta `gerado/` renomeada para
simular clone novo (26 passam, 2 pulados com o aviso visível).

E o teste de injeção foi verificado **sabotando o repositório de propósito** —
ficou vermelho, como tinha que ficar. O arquivo foi restaurado e conferido com
`diff` contra a cópia limpa.

## Estado do que está pronto

| Módulo                 | Doc | Exemplo | Enunciado   | Solução      |
| ---------------------- | --- | ------- | ----------- | ------------ |
| 01 a 10                | ✅  | ✅      | ✅          | ✅           |
| 11 Autenticação        | ✅  | ✅      | ⚠️ atrasado | ✅ + Prisma  |
| 12 Testes              | ✅  | ✅      | ⚠️ atrasado | ✅ + Prisma  |
| 13 Segurança           | ✅  | ✅      | ⚠️ atrasado | ✅ **novo**  |
| **14 Observabilidade** | ✅  | ✅      | ✅          | ❌ **falta** |
| 15–20                  | ❌  | ❌      | ❌          | ❌           |

⚠️ = o enunciado não menciona a mudança de persistência. É o item 1 da lista do
topo.

## Convenções que se firmaram e valem manter

- **Portas:** exemplo do módulo NN → `50NN`; solução do exercício NN → `4NN0`;
  mini API NN → `600N`. O módulo 01 usa 4001/4010. **Os exemplos 13 e 14 colidem
  na 5064** — não subir os dois juntos.
- **Cada pasta fora de `src/` precisa do seu `tsconfig`:** já são três
  (`playground`, `exercicios`, `minis`), com o script `typecheck:*` ao lado.
- **Setup de banco agora vale para 10, 11, 12 e 13:** `db:generate` →
  `db:migrate` → `db:seed`. Sem ele, os servidores dessas soluções falham na
  primeira query (mas `npm test` continua verde, e a suíte de contrato pula com
  aviso).
- **Um schema, um client, um banco** para toda a biblioteca. O arquivo se chama
  `prisma-10.sqlite` porque nasceu no módulo 10; o nome ficou.
- Cada exercício NN copia a solução do NN−1 e evolui. O 11 copiava o **08**
  (memória) — essa exceção acabou nesta sessão.
- **A partir do 12, todo app novo se monta com `criarApp(deps)`;** só
  `servidor.ts` chama `listen`, e é o único arquivo que sabe se existe banco.
- **Estado que não parece estado também entra por injeção.** Contador de rate
  limit, cache em memória e cliente de banco são globais se declarados no topo do
  módulo. Foi o achado nº 1 desta sessão.
- Todo achado de comportamento vira comentário no código **e** uma linha na
  tabela "Erros comuns" do doc.
- `curl -d '{"json":1}'` com aspas simples não funciona em `cmd.exe` nem
  PowerShell. São 17 ocorrências em 8 módulos; o aviso está no módulo 01.
- **`morgan` não pode sair do `package.json`**, mesmo o exercício 14 pedindo: o
  repositório tem um `package.json` só, e o exemplo do módulo 05 usa `morgan`.
  Registrar a decisão no README da solução 14.

## Restrições do repositório que valem lembrar

- `npm audit --omit=dev` acusa **4 high**, todas transitivas da CLI do Prisma.
  Nenhuma roda no caminho de uma requisição; `npm audit fix --force` rebaixaria o
  `prisma` de major e quebraria o módulo 10. Registro completo em
  `exercicios/13-seguranca/solucao/README.md`.
- ESLint continua fora: `typescript-eslint` exige TypeScript `<6.1.0` e o projeto
  usa TS 7.
- `PROMPT.md` foi removido no commit `ce49d57` e não está mais na árvore. O
  aviso antigo ("deletado, não commitado de propósito") não vale mais — a
  deleção já entrou no histórico.
