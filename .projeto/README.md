# .projeto — planejamento interno

Nada aqui é material de estudo. É o que faz uma sessão nova entender o
repositório sem redescobrir tudo.

O repo transforma este projeto num **guia de estudo de Express e backend**:
teoria em `docs/`, exemplo executável em `src/exemplos/`, exercício em
`exercicios/`, e `src/playground/` reservado para o usuário. Português em tudo.
Cobertura completa **e** explicação completa — o corte é por redundância, nunca
por profundidade.

## Comece por aqui

**[`estado.md`](estado.md)** — onde o trabalho parou e o que fazer em seguida.
Na maioria das sessões é o único arquivo desta pasta que você precisa abrir.

## Depois, só o que a tarefa pedir

| Vou…                                               | Leia                                                 |
| -------------------------------------------------- | ---------------------------------------------------- |
| escrever ou revisar um módulo de `docs/`           | [`padrao-de-escrita.md`](padrao-de-escrita.md)       |
| saber o que um módulo cobre, ou planejar o próximo | [`curriculo.md`](curriculo.md)                       |
| instalar ou justificar uma dependência             | [`ferramentas.md`](ferramentas.md)                   |
| mexer em tsconfig, banco, ESM, estrutura de pasta  | [`decisoes.md`](decisoes.md)                         |
| escrever código que toca Express/Zod/Prisma/Pino   | [`achados.md`](achados.md)                           |
| escolher porta, criar tsconfig, subir um servidor  | [`convencoes.md`](convencoes.md)                     |
| entender por que algo ficou como ficou             | [`historico/`](historico/)                           |
| melhorar o `README.md` da raiz                     | [`referencia/`](referencia/readme-impressionante.md) |

## As duas regras da pasta

**Um fato mora num arquivo só.** Progresso vive em `estado.md`, e em nenhum
outro lugar. Achado técnico vive em `achados.md`. Quando dois arquivos
discordam, alguém leu o errado — o custo dessa pasta ser confiável é nunca
duplicar.

**`historico/` é arquivo morto, não fonte.** Cada sessão deixa seu registro lá,
mas o que continua valendo é promovido antes: achado vai para `achados.md`,
convenção para `convencoes.md`, progresso para `estado.md`. Não leia
`historico/` para trabalhar — leia para investigar uma decisão passada.

## Ao terminar uma sessão

1. Atualizar as tabelas de [`estado.md`](estado.md) e a lista "o que fazer na
   próxima sessão".
2. Promover achado novo para [`achados.md`](achados.md) — e, como manda o
   `CLAUDE.md`, virar comentário no código e linha na tabela "Erros comuns" do
   doc.
3. Convenção nova (porta, tsconfig, setup) para [`convencoes.md`](convencoes.md).
4. Narrativa da sessão em `historico/AAAA-MM-DD.md`, se houver o que contar.

As regras de trabalho (playground intocável, português, todo exemplo roda) estão
no [`CLAUDE.md`](../CLAUDE.md) da raiz e não se repetem aqui.

## Utilitário

`gerar-sumarios.mjs` — insere um sumário navegável no topo de cada
`docs/NN-*.md`. Idempotente; rode da raiz com `node .projeto/gerar-sumarios.mjs`.
