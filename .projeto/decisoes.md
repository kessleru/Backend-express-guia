# Decisões técnicas e estrutura

> Por que cada escolha foi feita. Decisão registrada aqui não se revisita por
> preferência de estilo — só por motivo técnico novo.

| Decisão                                     | Motivo                                                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ESM** (`"type": "module"`)                | Exigido pela combinação `verbatimModuleSyntax` + `module: nodenext` já presente no tsconfig. Também é o padrão do ecossistema hoje.                                                                          |
| **Node 24 com type stripping nativo**       | `node src/server.ts` roda TypeScript direto, sem build e sem `ts-node`/`tsx`. Menos ferramenta = menos coisa pra explicar pra quem está estudando.                                                           |
| **`node --watch`** em vez de `nodemon`      | O Node 24 já tem watch mode embutido. O `nodemon` vira dependência morta.                                                                                                                                    |
| **`node --env-file`** em vez de `dotenv`    | O Node moderno lê `.env` nativamente. O `dotenv` só entra na doc como nota histórica (você vai ver em todo tutorial antigo).                                                                                 |
| **`erasableSyntaxOnly: true`**              | O type stripping do Node só apaga tipos, não transforma código. Essa flag faz o `tsc` recusar `enum`, `namespace` e `import =`, que quebrariam em runtime. Erro na hora de escrever, não na hora de rodar.   |
| **`rewriteRelativeImportExtensions: true`** | Permite escrever `import { x } from './foo.ts'` (o que o Node exige ao rodar direto) e mesmo assim gerar `./foo.js` no build.                                                                                |
| **`tsc` só para build e typecheck**         | Rodar (`dev`) não passa pelo `tsc`. Ele existe para checar tipos (`typecheck`) e gerar `dist/` (`build`).                                                                                                    |
| **Banco: SQLite**                           | Zero instalação, banco é um arquivo, e é **SQL de verdade** — o que você aprende transfere para Postgres. Ainda por cima o Node 24 tem `node:sqlite` embutido, então dá pra começar sem dependência nenhuma. |
| **Progressão de acesso a dados**            | `node:sqlite` (SQL na mão) → Prisma (ORM). Nessa ordem, de propósito: quem aprende ORM antes de SQL não entende o que o ORM está fazendo — nem por que ele às vezes gera uma query horrível.                 |
| **Uma dependência por vez, quando dói**     | Cada lib entra no módulo que a justifica, depois de você sentir o problema sem ela. Ver a dor antes do remédio é o que faz a ferramenta fazer sentido.                                                       |
| **Documentação em Markdown puro**           | Sem MDX, AsciiDoc ou Notion — e sem depender de extensão do editor. Detalhe abaixo.                                                                                                                          |

## Por que Markdown puro, e não um formato "mais bonito"

O ganho visual que se quer — diagrama colorido, fórmula, destaque — **já existe
no Markdown**: o VS Code renderiza **mermaid** e KaTeX no preview nativo
(`Ctrl+K V`) desde a versão **1.121**, sem instalar nada, e o GitHub faz o mesmo.

Os formatos descartados, e o motivo:

| Formato               | O que ganharia          | Por que **não** aqui                                                                              |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| **MDX**               | Componente React na doc | Precisa de build, dependência e um site para renderizar. Você aprenderia Docusaurus, não backend. |
| **AsciiDoc**          | Include, PDF, cross-ref | Sintaxe que só ele usa, e o GitHub renderiza pior. Some a portabilidade que o `.md` dá de graça.  |
| **Notion / Obsidian** | Editor bonito           | Sai do git. Doc que não vive ao lado do código apodrece — é o argumento do próprio módulo 20.     |

Pela mesma razão, nada de sintaxe que **só uma extensão entende**: `{cmd=true}`
e `@import "[TOC]"` (Markdown Preview Enhanced) viram lixo visual para quem não a
tem instalada. O `.md` daqui abre igual no VS Code, no GitHub e em qualquer
editor de texto — que é exatamente o ponto.

---

## Estrutura de pastas

Os 20 módulos são agrupados de **cinco em cinco** — `01-05`, `06-10`, `11-15`,
`16-20` — nas três pastas que os espelham: `docs/`, `src/exemplos/` e
`exercicios/`. Sem isso, abrir qualquer uma delas despeja 20 itens de uma vez, e
achar o módulo 07 vira leitura de lista.

O corte é por número, não por Parte do currículo, de propósito: as Partes têm
2, 5, 5, 4 e 4 módulos, então o nome da pasta teria que ser decorado. `06-10` se
resolve de cabeça — quem procura o 07 sabe onde clicar sem abrir nada. O custo é
que a fronteira do grupo não coincide com a fronteira temática, e é por isso que
os nomes são só números: rótulo prometeria uma coesão que não existe.

`00-glossario.md` fica fora dos grupos, na raiz de `docs/`: ele não é módulo, é
consultado a partir de todos eles.

```
Backend-express/
├── CLAUDE.md                    # regras curtas para o Claude Code
├── README.md                    # porta de entrada + índice do currículo
├── .env.example                 # variáveis de ambiente documentadas
├── package.json
├── prisma.config.ts             # onde o `url` do datasource passou a morar
├── vitest.config.ts
├── tsconfig.json                # cobre só src/ — cada pasta fora dele tem o seu
├── tsconfig.build.json          # tira os testes de dist/ sem tirar do typecheck
├── tsconfig.exercicios.json
├── tsconfig.middlewares.json
├── tsconfig.minis.json
├── tsconfig.playground.json
│
├── .projeto/                    # 🔧 INTERNO — nada aqui é material de estudo
│   ├── README.md                #    índice: por onde começar
│   ├── estado.md                #    onde parou + o que vem (fonte única)
│   ├── curriculo.md             #    os 20 módulos
│   ├── ferramentas.md           #    catálogo: o que entra em qual módulo
│   ├── padrao-de-escrita.md     #    template e régua de qualidade de ensino
│   ├── decisoes.md              #    este arquivo
│   ├── achados.md               #    comportamento verificado de cada lib
│   ├── convencoes.md            #    portas, tsconfigs, setup, restrições
│   ├── historico/               #    registro por sessão (arquivo morto)
│   └── referencia/              #    material de consulta pontual
│
├── assets/                      # 🖼️ imagens do README (geradas por gerar.mjs)
│
├── docs/                        # 📚 TEORIA — um arquivo por módulo
│   ├── 00-glossario.md          #    fora de grupo: atravessa o curso inteiro
│   ├── 01-05/                   #    HTTP · Node · Express · rotas · middlewares
│   │   ├── 01-fundamentos-http.md
│   │   └── ...
│   ├── 06-10/                   #    erros · validação · camadas · SQL · ORM
│   ├── 11-15/                   #    auth · testes · segurança · logs · cache
│   └── 16-20/                   #    deploy · filas · tempo real · upload · docs
│
├── src/
│   ├── server.ts                # servidor principal, evolui junto com o curso
│   │
│   ├── exemplos/                # 🧪 CÓDIGO DE ESTUDO — referência, não editar
│   │   ├── 01-05/
│   │   │   ├── 01-http-sem-express/
│   │   │   └── ...              # uma pasta por módulo que tem código
│   │   ├── 06-10/
│   │   ├── 11-15/
│   │   └── 16-20/
│   │
│   └── playground/              # 🔒 SEU ESPAÇO — ninguém mexe aqui
│       ├── README.md            # explica as regras da área
│       └── .gitkeep
│
├── exercicios/                  # 🏋️ EXERCÍCIOS — um enunciado por módulo
│   ├── README.md                # como a API de biblioteca cresce módulo a módulo
│   ├── 01-05/
│   │   ├── 01-fundamentos-http/
│   │   │   ├── README.md        # enunciado, critérios de aceite, dicas
│   │   │   └── solucao/         # resolução comentada (só depois de tentar)
│   │   └── ...
│   ├── 06-10/
│   ├── 11-15/
│   └── 16-20/
│
├── middlewares/                 # 🧰 catálogo avulso, um README por middleware
├── minis-apis/                  # 🍱 APIs pequenas fora do domínio da biblioteca
│
├── prisma/                      # schema e migrations (a partir do módulo 10)
├── data/                        # arquivos .sqlite (ignorados no git)
└── dist/                        # gerado por `npm run build` (ignorado no git)
```

## A regra do `src/playground/`

Esta é a parte mais importante da organização:

- **`docs/` e `src/exemplos/`** são material didático. O Claude pode criar,
  editar e reorganizar à vontade.
- **`src/playground/`** é seu. Sessões futuras do Claude **não devem criar,
  editar ou apagar nada aí dentro sem você pedir explicitamente**. Se você pedir
  ajuda com um arquivo do playground, aí sim.

Essa regra fica registrada no `CLAUDE.md` para valer em toda sessão futura.
