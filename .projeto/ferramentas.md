# Catálogo de ferramentas

> Regra do repositório: **dependência nova só entra no módulo que a justifica**, e
> a doc precisa dizer que problema ela resolve e o que ela custa.

Ordem de introdução do básico ao avançado. Nada é instalado antes do módulo que
justifica a ferramenta.

## Nível 0 — Já no repositório

| Ferramenta       | Para que serve                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js 24**   | O runtime. Aqui usamos três recursos modernos que dispensam libs: type stripping (`node arquivo.ts`), `--watch` e `--env-file`. |
| **TypeScript 7** | Tipos em tempo de escrita. Neste repo ele **não** compila para rodar — só faz typecheck e o build de produção.                  |
| **Express 5**    | O framework web. Roteamento + middlewares.                                                                                      |
| **npm**          | Gerenciador de pacotes e executor de scripts.                                                                                   |

## Nível 1 — Qualidade de código (Fase 0)

| Ferramenta              | Para que serve                                                                                                                                 | Entra em                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **ESLint**              | Encontra código problemático (variável não usada, `await` esquecido, promise solta). Diferente do TS: o TS checa tipo, o ESLint checa prática. | ⛔ bloqueado — peer exige TS <6.1 |
| **Prettier**            | Formatação automática. Acaba com discussão de estilo.                                                                                          | Fase 0                            |
| **EditorConfig**        | Alinha o editor (indentação, fim de linha) entre máquinas.                                                                                     | Fase 0                            |
| **Husky + lint-staged** | Git hooks: roda lint/format no que você está commitando. Impede commit quebrado.                                                               | Fase 0 (opcional)                 |

## Nível 2 — Aplicação (Parte II)

| Ferramenta | Para que serve                                                                                                                 | Entra em |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| **cors**   | Libera o navegador a chamar sua API de outra origem. Sem isso, front em `localhost:3000` não fala com API em `localhost:5050`. | 05       |
| **morgan** | Log de requisição HTTP pronto. Didático — no módulo 14 é substituído por Pino.                                                 | 05       |
| **zod**    | Valida a entrada **e** gera o tipo TypeScript do mesmo schema. Uma fonte de verdade.                                           | 07       |

## Nível 3 — Dados (Parte III)

| Ferramenta                      | Para que serve                                                                                                     | Entra em  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------- |
| **node:sqlite**                 | Módulo embutido do Node 24. Banco SQL real, zero dependência, banco = 1 arquivo. Aqui você escreve SQL na mão.     | 09        |
| **better-sqlite3**              | Alternativa madura ao `node:sqlite`, síncrona e muito rápida. Citada como comparação.                              | 09 (nota) |
| **prisma** + **@prisma/client** | ORM com schema declarativo, migrations e client totalmente tipado. Sobre o mesmo SQLite.                           | 10        |
| **drizzle-orm** / **knex**      | Alternativas — Drizzle (mais próximo do SQL, tipado) e Knex (query builder clássico). Comparação, sem implementar. | 10 (nota) |

## Nível 4 — Auth e testes

| Ferramenta              | Para que serve                                                                     | Entra em  |
| ----------------------- | ---------------------------------------------------------------------------------- | --------- |
| **argon2**              | Hash de senha. Vencedor da Password Hashing Competition; hoje preferido ao bcrypt. | 11        |
| **bcrypt**              | O padrão anterior, ainda onipresente. Você vai encontrar em código legado.         | 11 (nota) |
| **jsonwebtoken**        | Assina e verifica JWT.                                                             | 11        |
| **cookie-parser**       | Lê cookies do request — necessário para refresh token em cookie `httpOnly`.        | 11        |
| **vitest**              | Test runner rápido, com TypeScript e ESM nativos — sem transformador.              | 12        |
| **supertest**           | Dispara requisições HTTP contra o `app` Express sem abrir porta.                   | 12        |
| **@vitest/coverage-v8** | Relatório de cobertura pelo V8, sem instrumentar o código.                         | 12        |
| **node:test**           | Runner embutido no Node. Citado como alternativa mínima ao Vitest.                 | 12 (nota) |

## Nível 5 — Produção

| Ferramenta                   | Para que serve                                                                       | Entra em |
| ---------------------------- | ------------------------------------------------------------------------------------ | -------- |
| **helmet**                   | Liga headers HTTP de segurança de uma vez.                                           | 13       |
| **express-rate-limit**       | Limita requisições por IP. Freia brute force e abuso.                                | 13       |
| **pino** + **pino-http**     | Log estruturado em JSON, rápido. É o que máquina consegue ler e filtrar.             | 14       |
| **compression**              | Gzip/Brotli nas respostas. Menos banda, resposta mais rápida.                        | 15       |
| **redis** (client `ioredis`) | Cache em memória compartilhado entre instâncias. Também é a base de filas e pub/sub. | 15       |
| **autocannon**               | Load testing por linha de comando. Gera o número que justifica a otimização.         | 15       |
| **Docker**                   | Empacota app + dependências numa imagem que roda igual em qualquer lugar.            | 16       |
| **docker-compose**           | Sobe vários serviços juntos (API + Redis) com um comando.                            | 16       |
| **GitHub Actions**           | CI/CD: roda lint, typecheck e testes a cada push.                                    | 16       |

## Nível 6 — Avançado

| Ferramenta                                  | Para que serve                                                        | Entra em  |
| ------------------------------------------- | --------------------------------------------------------------------- | --------- |
| **bullmq**                                  | Filas e workers sobre Redis. Retry, agendamento, concorrência.        | 17        |
| **ws**                                      | WebSocket cru — o suficiente para entender o protocolo.               | 18        |
| **socket.io**                               | Camada de conveniência sobre WebSocket (salas, reconexão, fallback).  | 18 (nota) |
| **multer**                                  | Upload `multipart/form-data`.                                         | 19        |
| **swagger-ui-express** + **zod-to-openapi** | Documentação OpenAPI navegável gerada dos schemas Zod que já existem. | 20        |
| **OpenTelemetry**                           | Padrão de tracing/métricas. Visão geral, sem implementar.             | 14 (nota) |

## Ferramentas que este repo deliberadamente **não** usa

Vale saber por quê — você vai encontrá-las em tutoriais:

- **nodemon** — `node --watch` faz o mesmo, embutido.
- **ts-node / tsx** — o Node 24 roda `.ts` direto.
- **dotenv** — `node --env-file=.env` é nativo.
- **body-parser** — virou parte do Express (`express.json()`).
- **NestJS** — excelente framework, mas esconde o Express atrás de decorators e
  DI. Ruim para _aprender_ o que está acontecendo por baixo. Vale estudar depois.
