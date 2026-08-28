# Convenções e restrições vivas

> O que já se firmou e vale manter, mais o que o repositório não faz e por quê.

## Esqueletos dos módulos 15 a 20

Os seis existem em disco desde 2026-08-27, vazios de propósito: um `docs/NN-*.md`
que só diz "ainda não escrito" e aponta para o currículo, mais
`src/exemplos/NN-*/` e `exercicios/NN-*/` com o mesmo aviso. Servem para dar a
forma do repositório inteiro de uma vez e para os links de módulos futuros
pararem de dar 404.

| Módulo | Grupo   | Doc                         | Pasta de exemplo e exercício |
| ------ | ------- | --------------------------- | ---------------------------- |
| 15     | `11-15` | `15-performance-e-cache.md` | `15-performance`             |
| 16     | `16-20` | `16-deploy-docker-ci.md`    | `16-deploy`                  |
| 17     | `16-20` | `17-jobs-e-filas.md`        | `17-filas`                   |
| 18     | `16-20` | `18-websocket-e-sse.md`     | `18-tempo-real`              |
| 19     | `16-20` | `19-arquivos-e-uploads.md`  | `19-uploads`                 |
| 20     | `16-20` | `20-alem-do-rest.md`        | `20-alem-do-rest`            |

> **Atenção:** os três primeiros nomes são **citados por outros docs** (06 e 09).
> Renomear qualquer um quebra link em módulo já escrito.

Ao escrever o módulo de verdade: apague o `.gitkeep` de `src/exemplos/NN-*/`,
substitua o aviso do `docs/NN-*.md` pelo template de
[`padrao-de-escrita.md`](padrao-de-escrita.md) e troque "ainda esqueleto" por
nada nos docs que o citam.

## Setup numa árvore recém-clonada

Duas coisas do módulo 10 não vêm no git, e cada uma quebra de um jeito diferente:

| O que falta                     | Como se manifesta                                                      | Resolve com           |
| ------------------------------- | ---------------------------------------------------------------------- | --------------------- |
| Prisma Client (`gerado/`)       | `npm run typecheck` acusa 4 erros em `src/exemplos/06-10/10-prisma/`   | `npm run db:generate` |
| Banco `data/*.sqlite` (migrado) | O exemplo roda e lança **P2021**: "table `main.livros` does not exist" | `npm run db:migrate`  |

A sequência completa:

```bash
npm install
npm run db:generate   # gera o client em src/exemplos/06-10/10-prisma/gerado/
npm run db:migrate    # cria as tabelas
npm run db:seed       # popula (2 autores, 3 livros)
```

Sem o terceiro passo o exemplo roda, mas devolve listas vazias — o que confunde
mais do que um erro.

---

> **Atenção:** desde 2026-08-18 as soluções dos exercícios **11, 12 e 13** também
> usam Prisma, não só o módulo 10. Sem `db:generate` + `db:migrate` + `db:seed`
> os servidores delas falham na primeira query. `npm test` continua verde — os
> testes usam repositórios em memória, e a suíte de contrato se pula sozinha com
> aviso visível. Para subir qualquer uma sem banco: `REPO=memoria node ...`.

---

## Convenções que se firmaram e valem manter

- **Módulo mora num grupo de cinco:** `01-05`, `06-10`, `11-15`, `16-20`, igual
  nas três pastas (`docs/`, `src/exemplos/`, `exercicios/`). O porquê está em
  [`decisoes.md`](decisoes.md). Módulo novo entra no grupo do seu número — nunca
  solto na raiz.
- **Ao mover pasta, `grep` não acha caminho montado em runtime.** Reagrupar os
  módulos quebrou `resolve(import.meta.dirname, '../../../..')` nos dois testes
  de contrato: o `../` a mais nunca aparece numa busca por `src/exemplos/`, e o
  efeito não foi teste vermelho — foi a suíte Prisma **se pulando**, 245 casos
  virando 221. Depois de qualquer movimentação de pasta, procure também
  `import.meta.dirname`, `__dirname`, `process.cwd()` e `import(` dinâmico, e
  confira a **contagem** de testes, não só a cor.
- **Portas:** exemplo do módulo NN → `50NN`; solução do exercício NN → `4NN0`;
  mini API NN → `600N`. O módulo 01 usa 4001/4010. **Os exemplos 13 e 14 colidem
  na 5064** — não subir os dois juntos.
- **Cada pasta fora de `src/` precisa do seu `tsconfig`:** já são quatro
  (`playground`, `exercicios`, `minis`, `middlewares`), cada um com o script
  `typecheck:*` ao lado — `:play`, `:ex`, `:minis`, `:mw`.
- **Setup de banco agora vale para 10, 11, 12 e 13:** `db:generate` →
  `db:migrate` → `db:seed`. Sem ele, os servidores dessas soluções falham na
  primeira query (mas `npm test` continua verde, e a suíte de contrato pula com
  aviso).
- **Um schema, um client, um banco** para toda a biblioteca. O arquivo se chama
  `prisma-10.sqlite` porque nasceu no módulo 10; o nome ficou.
- Cada exercício NN copia a solução do NN−1 e evolui. O 11 copiava o **08**
  (memória) — essa exceção acabou em 2026-08-18.
- **A partir do 12, todo app novo se monta com `criarApp(deps)`;** só
  `servidor.ts` chama `listen`, e é o único arquivo que sabe se existe banco.
- **Estado que não parece estado também entra por injeção.** Contador de rate
  limit, cache em memória e cliente de banco são globais se declarados no topo do
  módulo. É o primeiro achado de [`achados.md`](achados.md).
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
  `exercicios/11-15/13-seguranca/solucao/README.md`.
- ESLint continua fora: `typescript-eslint` exige TypeScript `<6.1.0` e o projeto
  usa TS 7.
- `PROMPT.md` foi removido no commit `ce49d57` e não está mais na árvore. O
  aviso antigo ("deletado, não commitado de propósito") não vale mais — a
  deleção já entrou no histórico.
