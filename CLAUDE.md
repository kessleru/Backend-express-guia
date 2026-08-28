# CLAUDE.md

Repositório de **estudo de backend**: Node.js + Express + TypeScript, do básico
ao avançado. O objetivo é ensinar, não entregar produto.

**Antes de qualquer coisa, leia `.projeto/estado.md`.** Ele diz onde o trabalho
parou e o que fazer em seguida. É o único arquivo de planejamento que toda
sessão precisa abrir.

Depois, só o que a tarefa pedir — o índice com o mapa completo está em
`.projeto/README.md`:

| Vou…                                             | Leia                            |
| ------------------------------------------------ | ------------------------------- |
| escrever ou revisar um módulo                    | `.projeto/padrao-de-escrita.md` |
| planejar o próximo módulo                        | `.projeto/curriculo.md`         |
| instalar ou justificar uma dependência           | `.projeto/ferramentas.md`       |
| escrever código com Express, Zod, Prisma ou Pino | `.projeto/achados.md`           |
| escolher porta, criar tsconfig, subir servidor   | `.projeto/convencoes.md`        |
| mexer em tsconfig, banco, ESM, estrutura         | `.projeto/decisoes.md`          |

## Regras invioláveis

1. **Nunca crie, edite ou apague nada em `src/playground/`.** É o espaço pessoal
   do usuário. Só mexa se ele pedir explicitamente naquele arquivo.
2. **Tudo em português** — documentação, comentários, mensagens de commit.
3. **Todo exemplo tem que rodar.** Antes de dar um módulo como pronto: execute o
   código e rode `npm run typecheck`.

## Estilo de escrita (detalhes em `.projeto/padrao-de-escrita.md`)

Completo em cobertura **e em explicação**. Corte redundância, nunca profundidade
nem clareza — módulo raso é defeito, módulo longo não é.

**Todo conceito passa pelas cinco camadas, nesta ordem** (detalhe no `padrao-de-escrita.md`):
problema → **mecânica** → princípio → trade-off → consequência.

A ordem é obrigatória. O princípio vem **depois** de o leitor ver a coisa
funcionar, e é escrito em frase comum — se precisa ser decorada para fazer
sentido, é aforismo e está errada. "A senha nunca é armazenada" é princípio;
"middleware é composição de funções sobre um valor mutável" é aforismo.

- **Módulo de `docs/`: não tem limite de tamanho.** Termina quando o assunto
  acabou. O corte é por redundância — linha que não muda uma decisão sai.
- Mostre a **dor primeiro**: o jeito ruim (marcado como ruim) antes do bom.
- **Toda decisão tem um porquê.** Nenhum número, flag ou opção entra sem a frase
  que explica a escolha.
- **Diga o custo.** Técnica sem contrapartida declarada não ensina a escolher.
- Exemplo é **progressivo** (cresce do mínimo) e **real** (domínio da biblioteca,
  nunca `foo`/`bar`).
- **Falso amigo vira destaque**: o que parece certo e está errado (`.partial()`
  no PATCH, `decode` no lugar de `verify`).
- **Termo técnico é definido na estreia**, na própria linha ou na seguinte, e
  entra em `docs/00-glossario.md`. Palavra não explicada trava a leitura.
- **Diagrama não adianta módulo**: um mermaid só mostra o que já foi ensinado
  até ali. O resto vai para `## Se quiser ir mais fundo`.
- **Rampa**: `## Conceitos` abre no caso mínimo e cresce. Comparação com outro
  framework e nome acadêmico do padrão saem do corpo.
- Parágrafo: **uma ideia**. O limite é a ideia, não a linha.
- Código mostra o **quê**; o texto ao redor diz o **porquê** e o que observar.
  Bloco de código entre dois títulos, sem texto, é defeito.
- Conceito já explicado vira link para o módulo, não é reexplicado.

Todo módulo segue o template de `docs/` e tem um exercício correspondente em
`exercicios/NN-*/` (formato no `padrao-de-escrita.md`).

## Markdown: só o padrão

Os `.md` usam **Markdown puro**, sem depender de extensão nenhuma. O que
renderiza igual no VS Code e no GitHub:

| Recurso                 | Quando usar                                          |
| ----------------------- | ---------------------------------------------------- |
| ` ```mermaid `          | Fluxo, sequência, camadas, ER, estado                |
| `**Atenção:**` numa `>` | Armadilha e erro que custa caro                      |
| `<details>`             | Aprofundamento opcional — nunca o conteúdo principal |
| `- [ ]`                 | Critérios de aceite dos exercícios                   |
| Linguagem no bloco      | ` ```ts `, ` ```sql `, ` ```http `, ` ```bash `      |

Regras:

- **Nada de `> [!NOTE]`/`[!WARNING]`/`[!CAUTION]`.** Aviso é `>` com o rótulo em
  negrito: `> **Atenção:** ...`.
- **Nada de sintaxe de Markdown Preview Enhanced** — sem `{cmd=true}` e sem
  `@import "[TOC]"`. Não renderizam fora daquela extensão.
- **Diagrama substitui prosa, não soma.** Ao inserir um mermaid, corte o
  parágrafo que ele tornou redundante — o problema é a repetição, não o tamanho.
- ASCII art só sobrevive onde é mais claro que um diagrama (árvore de pastas,
  anatomia de string, cheatsheet).

## Comentários no código

- Comentário de exemplo é **material didático**, não anotação: explica o
  princípio e a armadilha, não a sintaxe. `// faz o hash da senha` sai; "o salt
  não é passado porque o argon2 gera um por senha e o embute" fica.
- Comentário existe para o que **muda uma decisão**: o ponto-chave do trecho, a
  armadilha, o porquê. Descrição óbvia (`// monta o objeto`) não entra.
- `// TODO` marca o que um módulo mais à frente resolve.
- Todo achado de comportamento (Express 5, Zod 4, Prisma 7) vira comentário no
  código e uma linha na tabela "Erros comuns" do doc.
- Código errado só aparece de propósito se vier acompanhado da versão correta
  logo abaixo.

## Convenções técnicas

- **ESM**, não CommonJS. `import`, nunca `require`.
- **Imports relativos com extensão `.ts`** — o Node exige ao rodar direto, e o
  `rewriteRelativeImportExtensions` converte para `.js` no build.
- **Sem `enum`, `namespace` ou `import =`** — `erasableSyntaxOnly` está ligado
  porque o Node só apaga tipos, não transforma código.
- **Nada de `ts-node`, `nodemon` ou `dotenv`** — Node 24 resolve os três
  nativamente (`node arquivo.ts`, `--watch`, `--env-file`).
- **Banco: SQLite.** `node:sqlite` (SQL na mão) no módulo 09, Prisma no 10.
- **Dependência nova só entra no módulo que a justifica** (catálogo em
  `.projeto/ferramentas.md`), e a doc precisa dizer que problema ela resolve.

## Estrutura

| Pasta             | O que é                          | Pode editar? |
| ----------------- | -------------------------------- | ------------ |
| `docs/`           | Teoria, um arquivo por módulo    | Sim          |
| `src/exemplos/`   | Código de referência dos módulos | Sim          |
| `exercicios/`     | Enunciados + soluções            | Sim          |
| `src/playground/` | Espaço do usuário                | **Não**      |
| `src/server.ts`   | Servidor principal               | Sim          |

## Comandos

```bash
npm run dev             # servidor com reload (node --watch)
npm run typecheck       # checa tipos do projeto
npm run typecheck:play  # checa tipos do playground
npm run build           # gera dist/
npm run format          # Prettier
```

## Pendência conhecida

ESLint ainda não foi instalado: o `typescript-eslint` exige TypeScript `<6.1.0`
e o projeto usa TS 7. Reavaliar quando houver suporte.
