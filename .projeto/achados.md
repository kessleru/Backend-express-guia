# Achados de comportamento

> Todos verificados rodando. Cada linha custou tempo de depuração e virou
> conteúdo de módulo — **não repita a descoberta**. Achado novo entra aqui, vira
> comentário no código e uma linha na tabela "Erros comuns" do doc.

Esta é a parte desta seção que não envelhece. Cada linha custou tempo de
depuração e virou conteúdo de módulo — não repita a descoberta.

## Express 5

| Achado                                                                                              | Onde virou conteúdo |
| --------------------------------------------------------------------------------------------------- | ------------------- |
| `req.body` fica **`undefined`** (não `{}`) quando falta o `Content-Type`                            | 03, 07              |
| `req.query` virou **getter**: atribuir (`req.query = validado`) lança `TypeError`. Use `res.locals` | 07                  |
| Wildcard `/*resto` devolve **array** de segmentos, não string                                       | 04                  |
| `*` **exige** nome no caminho; `/:formato?` virou `{/:formato}`                                     | 04                  |
| `throw` em rota `async` agora chega ao tratador sozinho — `asyncHandler` é código morto             | 06                  |

## Zod 4

| Achado                                                                                                                              | Onde |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `schemaComDefault.partial()` **não** serve para PATCH: os `.default()` continuam valendo e sobrescrevem o registro salvo            | 07   |
| `z.string().email()` está deprecado; use `z.email()`                                                                                | 07   |
| `validar()` precisa de `req.body ?? {}`, senão body ausente produz "expected object, received undefined" em vez de listar os campos | 07   |

## Prisma 7

| Achado                                                                                                                              | Onde |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---- |
| O `url` saiu do `datasource` (erro **P1012**): vai para `prisma.config.ts`, e o client recebe um **adapter**                        | 10   |
| O export do adapter é `PrismaBetterSqlite3` — **s** minúsculo, ao contrário do que a doc de várias versões sugere                   | 10   |
| `createMany({ skipDuplicates: true })` não funciona no SQLite                                                                       | 10   |
| `COUNT`/`SUM`/`MIN` via `$queryRaw` voltam `bigint`, e `JSON.stringify` de bigint lança — 500 misterioso                            | 10   |
| `exactOptionalPropertyTypes: true` briga com o idioma do Prisma (`data: { x: undefined }` não compila). Solução: spread condicional | 10   |

## Segurança (módulo 13)

| Achado                                                                                                                                                                                                                                                  | Onde |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `helmet()` liga 12 headers e remove `x-powered-by`. `x-xss-protection` vem **`0`** de propósito: o filtro antigo do navegador tinha bugs que criavam vulnerabilidades. "Corrigir" para `1; mode=block` **piora** a segurança — virou falso amigo no doc | 13   |
| `express-rate-limit` 8 usa `standardHeaders: 'draft-8'`: o header vem como `ratelimit="2-in-1min"; r=0; t=60`, não mais `X-RateLimit-*`                                                                                                                 | 13   |
| `req.params.nome` é `string \| string[] \| undefined` com `noUncheckedIndexedAccess` — normalize com `String(... ?? '')` antes de `resolve()`                                                                                                           | 13   |
| `npm audit` acusou um **high real** (`fast-uri`, transitiva). Virou o exemplo de auditoria, em vez de um caso inventado                                                                                                                                 | 13   |

## Observabilidade (módulo 14)

| Achado                                                                                                                                                                                                                                                                                                                                           | Onde |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| **O `redact` do Pino vazou uma senha durante a escrita do exemplo.** A lista tinha `senha` e `req.body.senha`, mas a rota logava `{ corpo: req.body }` — o caminho real era `corpo.senha`. Ele age nos **caminhos listados**, não no nome do campo em qualquer profundidade. O que pegou o vazamento foi um **teste que procura a senha no log** | 14   |
| `import pinoHttp from 'pino-http'` **não compila** com `verbatimModuleSyntax` (o pacote é CommonJS). Use `import { pinoHttp }`                                                                                                                                                                                                                   | 14   |
| `genReqId`/`customLogLevel` recebem `IncomingMessage`/`ServerResponse` do `node:http`, e **não são inferidos** — anotar é obrigatório (TS7006)                                                                                                                                                                                                   | 14   |
| **Pino não é mais rápido que `JSON.stringify` na mão** (220ms × 156ms, 50 mil linhas). O que ele compra é nível, redação, child logger e serialização de `Error`                                                                                                                                                                                 | 14   |
| `JSON.stringify(new Error('x'))` devolve `{}` — as propriedades são não-enumeráveis, e a stack se perde justamente no log que mais importa                                                                                                                                                                                                       | 14   |

## Testes e build

| Achado                                                                                                                                                                                                                                              | Onde   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `criarApp()` precisou ser extraído: os módulos 01–11 chamam `listen` no topo, e importar isso num teste sobe servidor de verdade (`EADDRINUSE`, o processo não encerra). Os anteriores **não** foram reescritos, e o contraste virou conteúdo do 12 | 12     |
| **Rate limit versus suíte**: baldes separados por rota e `criarApp(deps, { rateLimit: false })` no teste. Nunca afrouxar o limite de produção para o teste caber                                                                                    | 12, 13 |
| `tsconfig.build.json` foi necessário para os testes serem checados por `npm run typecheck` e ficarem **fora** de `dist/`                                                                                                                            | 12     |
| `process.loadEnvFile()` (nativo) no `vitest.setup.ts` é o que faz `npm test` rodar sem `--env-file` e sem `dotenv`                                                                                                                                  | 12     |
| `tsconfig.exercicios.json` precisou de `rootDir: "."` para a solução do 10 importar o Prisma Client gerado em `src/`                                                                                                                                | 10     |

---

## Estado e injeção de dependência (exercícios 12 e 13)

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
