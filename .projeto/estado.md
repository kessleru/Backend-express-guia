# Estado do projeto

> **Fonte única do progresso.** Nenhum outro arquivo repete estas tabelas — se
> uma delas discordar da árvore, a árvore ganha e a tabela se corrige aqui.
>
> Última sessão registrada: **2026-08-27**. Histórico narrativo em
> [`historico/`](historico/).

## ▶ O que fazer na próxima sessão

Em ordem. Os dois primeiros são resíduo da sessão de 18/08 e são rápidos.

1. **Atualizar os enunciados 11, 12 e 13** (`exercicios/NN-*/README.md`). Eles
   ainda descrevem a persistência como estava: o do 11 diz "memória, SQLite ou
   Prisma" sem apontar o que a solução de referência faz, e nenhum menciona a
   suíte de contrato nem o `REPO=memoria`. **O código está pronto; o enunciado
   ficou para trás.**
2. **Conferir se `docs/11`, `docs/12` e `docs/13` afirmam algo que mudou.** Não
   foi verificado. O candidato mais provável é o módulo 12, que fala de suíte de
   contrato e SQLite `:memory:` — agora as soluções têm isso de fato.
3. **Solução do exercício 14** (o enunciado existe desde 2026-08-13). É o que
   fecha a Fase 4 junto com 15 e 16.
4. **Trilha de Postgres, em pasta à parte.** Pedido do usuário em 20/08. Trilha
   separada, não um módulo no meio do currículo: o repo continua em SQLite por
   decisão registrada em [`decisoes.md`](decisoes.md). O gancho já existe — as
   diferenças que o ORM não apaga estão comentadas no código (`enum` que o
   SQLite não tem, `mode: 'insensitive'` ignorado em silêncio, índice único
   parcial).

## Módulos

| Módulo                 | Doc | Exemplo | Enunciado   | Solução     |
| ---------------------- | --- | ------- | ----------- | ----------- |
| 01 a 10                | ✅  | ✅      | ✅          | ✅          |
| 11 Autenticação        | ✅  | ✅      | ⚠️ atrasado | ✅ + Prisma |
| 12 Testes              | ✅  | ✅      | ⚠️ atrasado | ✅ + Prisma |
| 13 Segurança           | ✅  | ✅      | ⚠️ atrasado | ✅ + Prisma |
| **14 Observabilidade** | ✅  | ✅      | ✅          | ❌ falta    |
| 15 a 20                | 🔲  | 🔲      | 🔲          | ❌          |

⚠️ = o enunciado não menciona a mudança de persistência. É o item 1 da lista
acima.

🔲 = **esqueleto, sem conteúdo.** Os seis módulos existem em disco desde
2026-08-27 (doc com aviso, pasta de exemplo com `.gitkeep`, pasta de exercício
com aviso) só para dar a forma do repositório e matar os 404 dos links. A lista
de nomes está em [`convencoes.md`](convencoes.md).

Apêndices A–E ([`curriculo.md`](curriculo.md)): nenhum escrito. O A (glossário)
existe como `docs/00-glossario.md` e cresce a cada módulo.

## Fases

Cada fase é entregável sozinha; dá para parar entre elas.

| Fase                        | O que entra                                   | Status                                        |
| --------------------------- | --------------------------------------------- | --------------------------------------------- |
| **0 — Base**                | configs, Prettier, `playground/`, `CLAUDE.md` | ✅ menos ESLint (ver bloqueio)                |
| **1 — Fundamentos**         | docs 01–02 + exemplos + exercícios            | ✅                                            |
| **2 — Express**             | docs 03–07 + exemplos + exercícios            | ✅                                            |
| **3 — Arquitetura e dados** | docs 08–12 (SQLite → Prisma → auth → testes)  | ✅                                            |
| **4 — Produção**            | docs 13–16 + exemplos + exercícios            | 🔶 13 pronto; 14 sem solução; 15–16 pendentes |
| **5 — Avançado**            | docs 17–20 + exemplos + exercícios            | ⬜                                            |
| **6 — Apêndices**           | A, B, C, D, E                                 | ⬜                                            |

## Material fora do currículo

| Pasta          | O que é                                            | Estado         |
| -------------- | -------------------------------------------------- | -------------- |
| `middlewares/` | catálogo de 14 middlewares prontos, um README cada | ✅ 2026-08-27  |
| `minis-apis/`  | 7 mini APIs fora do domínio da biblioteca          | ✅ levas 1 e 2 |
| `assets/`      | imagens do README, geradas por `assets/gerar.mjs`  | ✅             |

## Números da última verificação (2026-08-27)

```
npm run typecheck        → passa
npm run typecheck:ex     → passa
npm run typecheck:minis  → passa
npm run typecheck:mw     → passa
npm run format:check     → limpo
npm test                 → 245 testes, 17 arquivos, verde
```

`npm run typecheck:play` falha com **TS18003** ("No inputs were found"), e está
certo: `src/playground/` não tem nenhum `.ts` ainda. O erro some no primeiro
arquivo que você criar lá — e ninguém mais mexe nessa pasta.

A dívida de formatação (90 arquivos fora de padrão no levantamento de 20/08) foi
paga: `npm run format` rodou sobre a árvore inteira e o `format:check` está limpo.
