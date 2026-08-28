# Currículo — 20 módulos

> O estado de cada um está em [`estado.md`](estado.md). O padrão de escrita, em
> [`padrao-de-escrita.md`](padrao-de-escrita.md).

Cada módulo = 1 arquivo em `docs/`. Os marcados com 🧪 têm código executável em
`src/exemplos/`. A coluna de ferramentas mostra o que entra de novo ali.

## Parte I — Fundamentos (antes do framework)

**01 — Fundamentos de HTTP e da web** 🧪 · _`node:http`_
Cliente/servidor, o ciclo request/response. Anatomia de uma requisição: método,
URL, headers, body. Métodos HTTP e seus significados — e o que são idempotência
e segurança de um método. Status codes: as cinco famílias e os ~12 que você usa
de verdade. Headers importantes (`Content-Type`, `Authorization`,
`Cache-Control`). Statelessness: por que o servidor não lembra de você entre
requisições, e o que isso força no design.
_Exemplo: um servidor com `node:http` puro, sem Express — para você ver
exatamente o que o Express faz por você depois._

**02 — Node.js, módulos e assincronia** 🧪 · _`npm`, semver_
O que o Node é (runtime V8 + libuv). Event loop explicado sem mistificação: por
que I/O não bloqueia mas um `for` de 10 milhões de iterações bloqueia. CommonJS
vs ESM e por que este repo usa ESM. `package.json` campo a campo. Semver e o que
`^5.2.1` realmente permite. `dependencies` vs `devDependencies`. Callbacks →
Promises → `async/await`. O `try/catch` que não pega nada.
_Exemplo: o mesmo trabalho feito de forma bloqueante e não-bloqueante, medindo._

## Parte II — Express

**03 — Express básico** 🧪 · _`express`_
O que um framework web resolve. `app`, rotas, `request`, `response`. Os três
tipos de parâmetro e quando usar cada um: **route params** (identificar um
recurso, obrigatório), **query params** (filtro/paginação, opcional), **body**
(dados de criação/edição). `express.json()` e por que sem ele `req.body` é
`undefined`. `res.json()`, `res.status()`, `res.send()`.
_Exemplo: o CRUD de `/courses` do commit original, portado para TypeScript._

**04 — Roteamento e organização de rotas** 🧪
Padrões de rota, parâmetros opcionais, wildcards. `express.Router()` para quebrar
o servidor em arquivos. Prefixos e montagem (`app.use('/api/v1', ...)`). Ordem de
rotas importa: por que `/courses/new` precisa vir antes de `/courses/:id`.
Versionamento de API. Design de URLs REST: substantivo no plural, hierarquia,
o que não fazer (`/getCourses`).
_Exemplo: o CRUD do módulo 03 refatorado em routers separados._

**05 — Middlewares** 🧪 · _`cors`, `morgan`_
O conceito central do Express: uma cadeia de funções com `(req, res, next)`.
Middleware global, de rota e de erro. O que acontece se você esquecer o `next()`.
Ordem de execução. Escrevendo os seus: logger, timer, verificador de API key.
Middlewares de terceiros e onde encaixar.
_Exemplo: uma pilha de middlewares com log mostrando a ordem real de execução._

**06 — Tratamento de erros** 🧪
Por que `throw` dentro de rota async derruba o processo no Express 4 (e o que
mudou no Express 5). Error-handling middleware (a função de 4 argumentos).
Classe `AppError` própria com status code. Erros esperados vs bugs. Nunca vazar
stack trace para o cliente. Formato consistente de resposta de erro.
_Exemplo: um handler de erro central + `AppError` aplicados ao CRUD._

**07 — Validação e contratos de entrada** 🧪 · _`zod`_
Regra de ouro: **nunca confie no cliente**. Validar tipo, formato,
obrigatoriedade e limites. Validação manual e sua dor. Zod: schemas, `parse` vs
`safeParse`, inferência de tipo (`z.infer`) — validação e tipagem da mesma fonte.
Middleware genérico `validate(schema)`. Diferença entre validação (formato) e
regra de negócio.
_Exemplo: `POST /courses` com schema Zod e middleware de validação._

## Parte III — Arquitetura e dados

**08 — Arquitetura em camadas**
O problema: rotas de 200 linhas fazendo tudo. Separação **route → controller →
service → repository**, com a responsabilidade de cada camada. Regra da direção
das dependências. Injeção de dependência sem framework. DTOs. Quando _não_ usar
camadas (projeto pequeno não precisa de 4 níveis). Uma passada honesta em Clean
Architecture e DDD: o que vale a pena e o que é excesso.

**09 — Banco de dados e SQL com SQLite** 🧪 · _`node:sqlite`_
Do array em memória para o banco. Por que SQLite é um ótimo banco de estudo (e
de produção, em muitos casos). SQL na mão: `CREATE TABLE`, `INSERT`, `SELECT`,
`UPDATE`, `DELETE`, `JOIN`, `GROUP BY`. Modelagem relacional: chaves primárias e
estrangeiras, relacionamentos 1-N e N-N, tabela de junção. Normalização o
suficiente. Índices e por que sua query fica lenta sem eles (`EXPLAIN QUERY
PLAN`). Transações e ACID. **SQL injection** e por que query parametrizada
resolve. Migrations escritas à mão.
_Exemplo: o repositório de courses reescrito sobre `node:sqlite`, sem nenhuma
dependência externa — o resto do app não muda, que era o objetivo da camada
repository._

**10 — ORM com Prisma** 🧪 · _`prisma`, `@prisma/client`_
O que um ORM resolve e o que ele cobra em troca. Driver vs query builder vs ORM.
`schema.prisma`: modelos, relações, tipos. `prisma migrate` e por que o schema
vive no git. Prisma Client tipado de ponta a ponta. Queries, includes e o
**problema N+1** — como detectar e resolver. Transações no Prisma. Seeds.
Prisma Studio. Quando cair de volta pra SQL cru. Comparação rápida com Drizzle
e Knex.
_Exemplo: o mesmo repositório do módulo 09, agora com Prisma sobre o mesmo
SQLite — mostrando que só a camada de dados mudou._

**11 — Autenticação e autorização** 🧪 · _`argon2`, `jsonwebtoken`, `cookie-parser`_
A diferença entre as duas (quem você é × o que você pode). Hash de senha: por
que Argon2/bcrypt e nunca SHA-256. Salt e fator de custo. Sessão com cookie vs
JWT: trade-offs reais, não hype. Anatomia de um JWT e o que **não** colocar no
payload. Access token + refresh token. Cookies `httpOnly` e `SameSite`.
Middleware de autenticação e de autorização por papel (RBAC). OAuth2 em visão
geral.
_Exemplo: registro, login, rota protegida e rota só-para-admin._

**12 — Testes** 🧪 · _`vitest`, `supertest`_
A pirâmide: unitário, integração, e2e. O que testar em cada nível. Vitest como
runner. Testando rotas HTTP com Supertest sem subir servidor de verdade. Mocks,
stubs e por que a camada repository torna o service fácil de testar. Fixtures e
banco de teste (SQLite em memória — aqui ele brilha). Cobertura como sintoma,
não como meta. TDD numa feature real.
_Exemplo: suíte cobrindo o CRUD e o fluxo de autenticação._

## Parte IV — Produção

**13 — Segurança** 🧪 · _`helmet`, `express-rate-limit`_
OWASP Top 10 aplicado a uma API Node. Injeção de SQL (retomando o módulo 09).
XSS e por que ainda importa numa API. CSRF e quando você precisa se preocupar.
Rate limiting e brute force. CORS explicado de verdade — o que o header faz e o
que ele **não** faz. `helmet` e os headers que ele liga. Segredos: `.env`,
variáveis de ambiente, o que nunca vai pro git. Validação de upload.
Dependências vulneráveis (`npm audit`).

**14 — Observabilidade** 🧪 · _`pino`, `pino-http`_
Logs estruturados (JSON) vs `console.log`. Níveis de log. Request ID para
correlacionar uma requisição inteira. Pino. O que **nunca** logar (senha, token,
CPF). Métricas: RED (Rate, Errors, Duration). Health check e readiness check.
Tracing distribuído e OpenTelemetry em visão geral.
_Exemplo: logger com request ID atravessando toda a stack._

**15 — Performance, cache e escala** 🧪 · _`redis`/`ioredis`, `compression`_
Medir antes de otimizar. Caching: em memória, Redis, HTTP cache headers
(`ETag`, `Cache-Control`). Estratégias e invalidação de cache. Paginação
(offset vs cursor) e por que offset degrada. Compressão. Keep-alive. Escala
vertical vs horizontal. Statelessness como pré-requisito de escala horizontal.
Graceful shutdown. Load balancing e `node:cluster`. Load testing com `autocannon`.
_Exemplo: rota lenta, medida, depois cacheada — com número antes e depois._

**16 — Deploy, Docker e CI/CD** 🧪 · _Docker, GitHub Actions_
Configuração por ambiente sem `if (production)` espalhado. Build de produção.
Docker: Dockerfile multi-stage, `.dockerignore`, imagem pequena, usuário não-root.
`docker-compose` para subir app + Redis junto. Variáveis de ambiente em produção.
CI/CD com GitHub Actions: lint → typecheck → test → build. Migrations no deploy.
Rollback.
_Exemplo: Dockerfile + workflow do GitHub Actions funcionando._

## Parte V — Tópicos avançados

**17 — Jobs, filas e trabalho em background** 🧪 · _`bullmq`_
Por que não fazer trabalho pesado dentro do request. Filas: produtor, consumidor,
worker. BullMQ sobre Redis. Retry, backoff exponencial e dead letter queue.
Idempotência de job (o mesmo job pode rodar duas vezes — e vai). Jobs agendados
(cron). Processamento de e-mail e relatório como casos clássicos.
_Exemplo: envio de e-mail de boas-vindas movido para uma fila._

**18 — Tempo real: WebSocket e SSE** 🧪 · _`ws`_
Quando polling basta e quando não basta. Server-Sent Events vs WebSocket:
trade-offs. Handshake e o ciclo de vida de uma conexão. Broadcast, salas e
autenticação numa conexão WebSocket. O problema de escalar WebSocket
horizontalmente (e o pub/sub do Redis como resposta).
_Exemplo: um chat mínimo e um endpoint SSE de progresso._

**19 — Arquivos e uploads** 🧪 · _`multer`_
`multipart/form-data` e por que `express.json()` não dá conta. Multer: memória vs
disco. Limites de tamanho e validação de tipo real (magic bytes, não a extensão).
Storage local vs S3. URLs pré-assinadas. Streaming de arquivos grandes sem
estourar a memória. Servir estáticos.
_Exemplo: upload de imagem de capa do curso, com validação._

**20 — Além do REST: documentação, GraphQL e RPC** 🧪 · _`swagger-ui-express`, `zod-to-openapi`_
OpenAPI/Swagger: documentação gerada a partir dos schemas Zod que você já
escreveu no módulo 07. Por que doc que não vem do código apodrece. Visão geral e
comparação honesta: REST vs GraphQL vs tRPC vs gRPC — que problema cada um
resolve e quando o custo não compensa. Webhooks.
_Exemplo: Swagger UI navegável servido pela própria API._

## Apêndices

- **A — Glossário** de termos (idempotência, middleware, ORM, JWT, CORS...).
- **B — Cheatsheet HTTP**: métodos, status codes e headers em tabela.
- **C — Checklist de API de produção**: o que revisar antes de subir.
- **D — Erros comuns de iniciante** e como reconhecê-los.
- **E — Catálogo de ferramentas**: o [`ferramentas.md`](ferramentas.md) desta pasta, extraído para consulta.
