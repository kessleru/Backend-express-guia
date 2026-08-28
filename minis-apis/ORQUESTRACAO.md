# minis-apis — briefing de orquestração

Esta pasta é um **repertório de APIs pequenas e reais**, cada uma resolvendo um
problema que existe no mundo (encurtar link, inscrever gente num evento,
controlar gasto). Serve para ver o conteúdo dos módulos aplicado fora do domínio
da biblioteca, que é o exemplo fixo de `docs/` e `exercicios/`.

Este arquivo é o **briefing dos agentes**: cada agente pega uma tarefa da seção
4, constrói uma mini API completa e para. Ele não é material de ensino — quem
ensina são os `docs/`. Aqui o texto é operacional.

---

## 1. O que vale para todas

| Regra                     | Detalhe                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Piso: módulo 03**       | Toda mini API começa no Express básico. Nenhuma pressupõe leitura anterior além do 03.                                                                                                                                          |
| **Teto: por tarefa**      | Cada tarefa declara o módulo em que para, e nada acima dele entra. A leva 1 inteira fica abaixo do 09; a leva 2 vai até o 11.                                                                                                   |
| **Zero dependência nova** | Nada de `npm install`. Na leva 1, `express`, `cors`, `morgan`, `zod` e `node:sqlite`; a leva 2 abre `@prisma/client`, `argon2` e `jsonwebtoken`, já instalados.                                                                 |
| **Domínio próprio**       | Nenhuma delas é biblioteca/livros/cursos. O ponto da pasta é variar o domínio.                                                                                                                                                  |
| **Pequena de verdade**    | Cada tarefa traz um teto de linhas. Passou muito do teto, o escopo cresceu sozinho — corte, não peça exceção.                                                                                                                   |
| **Roda sem setup**        | `node minis-apis/NN-nome/servidor.ts` e pronto; a de SQLite cria e popula o banco na primeira execução. Única exceção: a `06-compras`, cujo Prisma exige `migrate` e `generate` antes — e o README dela diz isso no `## Rodar`. |

### Convenções técnicas (as mesmas do repositório)

- **ESM**, `import` sempre, `require` nunca.
- **Import relativo com extensão `.ts`**: `import { rotas } from './rotas.ts'`.
- **Sem `enum`, `namespace`, `import =`** — `erasableSyntaxOnly` está ligado.
- **Tudo em português**: nome de arquivo, variável, rota, mensagem de erro, doc.
- **Porta na faixa `600N`**, uma por mini, seguindo a numeração da pasta (`01` →
  6001, `07` → 6007). A faixa `50NN` é dos exemplos e a `4NN0` das soluções; a
  `600N` é desta pasta e não colide com nada.
- **Banco em `data/minis-NN-nome.sqlite`** — o `.gitignore` já ignora `data/*.sqlite`.
- **`src/playground/` é intocável.** Nenhum agente lê, escreve ou cita.

### Comentário: explique o que é fundamental, e uma vez só

Estas APIs são lidas sozinhas, sem o `docs/` do lado — então onde o comentário
existe, ele **explica de verdade**, com o porquê e a consequência, não uma
etiqueta na linha.

Mas **não é regra**: aparecer no arquivo não obriga a explicar. A pergunta é uma
só, e é de julgamento:

> **Sem este comentário, o leitor entende o que está acontecendo e por que foi
> feito assim?** Se sim, o comentário não entra.

Quase sempre é fundamental o que **decide o comportamento** e não se deduz
lendo: a escolha entre duas opções que parecem iguais (302 × 301, 409 × 422), o
porquê daquele número ou flag, a armadilha que morde quem "simplifica" a linha, e
o que a linha faz por baixo quando o efeito não está à vista. Quase nunca é
fundamental o que o nome já diz — `criarRotasLinks()` não precisa de "cria as
rotas de links" em cima.

**E não repita.** Uma explicação por conceito, no lugar onde ele importa mais:

- Explicou `z.coerce.number()` na query de `GET /eventos/:id/inscricoes`? A
  segunda query com `coerce` não recebe comentário nenhum.
- Conceito que os `docs/` já ensinam entra como referência de uma linha
  (`// ordem de rota: módulo 04`), não como reexplicação.
- Comentário que existe só para cumprir régua sai. Um arquivo com três
  comentários certos ensina mais que um com doze corretos e óbvios.

Onde o comentário entra, ele:

- Diz **o problema antes da solução**: "sem isto o SQLite aceita `categoria_id`
  inexistente e você descobre meses depois, com o banco cheio de órfãos" ensina;
  "liga a checagem de chave estrangeira" não.
- Nomeia a **consequência concreta** — o status que muda, o dado que se perde, a
  query que fica lenta. Consequência vaga ("pode dar problema") não conta.
- Tem o tamanho que a explicação pedir, em frase completa e em português.
  Costuma dar duas a cinco linhas; é observação, não cota.
- Fica **em cima** do trecho que explica, quando passa de uma linha.

O cabeçalho de cada arquivo, curto: o que ele faz, de qual módulo vem o conceito
principal, e — no `servidor.ts` — como rodar e em que porta.

```ts
// ❌ Descreve o óbvio — sai
res.redirect(302, link.url); // redireciona

// ✅ Explica a decisão — fica
// 302 (temporário) e não 301 (permanente): o navegador cacheia o 301 e, da
// segunda visita em diante, vai direto ao destino sem passar por aqui. O
// contador de cliques congelaria em 1 e ninguém entenderia por quê.
res.redirect(302, link.url);
```

**O teto de linhas de cada tarefa conta código, não comentário.** Explicar bem
nunca é motivo para cortar escopo, e escopo nunca é desculpa para explicar mal.

### Markdown do README de cada mini API

Markdown puro (sem `> [!NOTE]`, sem sintaxe de extensão). Aviso é `>` com rótulo
em negrito: `> **Atenção:** ...`. Bloco de código sempre com linguagem.

---

## 2. Passo 0 — antes de despachar qualquer agente

> **Feito na leva 1.** O arquivo e o script já existem; a seção fica como
> registro de por que existem.

`npm run typecheck` cobre só `src/**/*.ts`; esta pasta ficaria sem checagem
nenhuma. O orquestrador cria **uma vez** o `tsconfig.minis.json` na raiz:

```json
// Config para checar os tipos das minis APIs, que ficam fora de src/.
// Uso: npm run typecheck:minis
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "declaration": false,
    "declarationMap": false,
    "sourceMap": false
  },
  "include": ["minis-apis/**/*.ts"],
  "exclude": []
}
```

E o script em `package.json`, ao lado de `typecheck:ex`:

```json
"typecheck:minis": "tsc --noEmit -p tsconfig.minis.json"
```

Sem isso os agentes não têm como cumprir o critério de aceite.

---

## 3. O que cada agente entrega

Para a tarefa `NN-nome`:

```
minis-apis/NN-nome/
├── README.md      ← ensina como a API foi construída (seção 3)
├── servidor.ts    ← único arquivo que chama listen()
└── (demais arquivos conforme a tarefa)
```

### Pasta por camada: a régua

Os nomes de arquivo que cada tarefa cita são indicativos. Quem decide o layout é
o tamanho:

> **Camada com dois ou mais arquivos vira pasta; camada com um arquivo só fica
> plana.**

É por isso que a `03-despesas` e a `04-enquetes` são planas — nelas cada camada
cabe num arquivo, e `repositorios/` com um `repositorio.ts` dentro custa um
clique sem separar nada. E é por isso que a `06-compras` tem `rotas/`: três
grupos de rota em três arquivos são coisas diferentes de verdade.

Onde houver divisão, o layout de referência é o de `src/exemplos/06-10/08-camadas/`
(`rotas/`, `servicos/`, `repositorios/`, `dominio/`) — uma mini que aplica o
módulo 08 usando uma organização que o exemplo do próprio módulo não usa passa a
mensagem trocada.

### O `README.md` ensina — ele não é um índice de rotas

Este é um repositório de estudo: a tabela de endpoints diz **o que** a API faz, e
sozinha ela não ensina nada. O README de cada mini API responde a duas perguntas,
nesta ordem:

1. **Como funciona a coisa?** Um encurtador de link é um mecanismo — existe
   independente de Express, de Node e deste repositório. Quem lê tem que
   terminar sabendo explicar o encurtador para outra pessoa **sem citar
   biblioteca nenhuma**: o que é o código curto, o que o navegador faz quando
   recebe a resposta, de onde sai a contagem de cliques.
2. **Como esta API implementa isso?** Aí sim o código: a ordem em que as peças
   entraram, o problema que cada uma resolveu, o que foi descartado no caminho.

Pular a primeira e ir direto para o código é o defeito que este briefing existe
para evitar. Sem ela o leitor copia um `res.redirect(302, ...)` que funciona e
continua sem saber por que funciona — e não consegue decidir nada num caso que a
mini API não mostrou.

É o mesmo padrão dos `docs/`, aplicado a uma API inteira em vez de a um conceito:
**problema → mecânica → princípio → trade-off → consequência**, nesta ordem. O
princípio vem depois de o leitor ver a coisa funcionar, e em frase comum.

| Seção                        | O que tem que estar lá                                                                                                                                                                                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `# Mini API — Título`        | Abaixo, a linha `📦 Módulos 03–NN · 🔌 porta 600N · 💾 memória` ou `SQLite`                                                                                                                                                                                                                                       |
| `## O problema`              | A situação real que pede esta API, em duas ou três frases. Não "uma API de links": **por que** alguém encurta um link, e o que a API precisa saber para isso.                                                                                                                                                     |
| `## Como funciona`           | **O mecanismo, antes e independente do código.** O que acontece de ponta a ponta quando alguém usa a coisa, quem faz cada parte, e por que o desenho é esse. Sem `app.get`, sem nome de biblioteca. Um `mermaid` de sequência quando ele substituir prosa. O que cada tarefa precisa cobrir aqui está na seção 4. |
| `## Rodar`                   | Bloco `bash` com `node minis-apis/NN-nome/servidor.ts`, a porta, e o que aparece no terminal                                                                                                                                                                                                                      |
| `## Como ela foi construída` | Agora sim o código: a construção em 3 a 5 passos, na ordem em que foram pensados — o que existia, que problema apareceu, o que resolveu. Cada passo com o trecho curto que o representa                                                                                                                           |
| `## Endpoints`               | Tabela: método, rota, o que faz, status possíveis                                                                                                                                                                                                                                                                 |
| `## As decisões e o porquê`  | Uma subseção por escolha não óbvia. Cada uma diz a alternativa que foi descartada e **o que ela custaria** — decisão sem alternativa declarada não ensina a escolher                                                                                                                                              |
| `## Onde é fácil errar`      | Tabela de sintoma → causa: a mensagem ou o status exato que aparece, e por quê. Inclui o falso amigo — o que parece certo e está errado                                                                                                                                                                           |
| `## Testando`                | Quatro a oito `curl` que foram **de fato rodados**, com a resposta real ao lado. Caminho feliz e pelo menos dois erros                                                                                                                                                                                            |
| `## O que ficou de fora`     | O que ela não faz, por que ficou fora e **qual módulo resolve** (ex.: "sem login — módulo 11")                                                                                                                                                                                                                    |
| `## Para estudar`            | Link para os módulos de `docs/` que a mini API aplica                                                                                                                                                                                                                                                             |

Três regras que valem em todo o README:

- **Mostre a dor primeiro.** O jeito ruim, marcado como ruim, antes do bom. A
  validação na mão da tarefa 1 é a dor que justifica o Zod na tarefa 2 — o README
  da 1 tem que deixar essa dor visível, não escondê-la.
- **Todo número tem um porquê.** `limite` padrão de 20, código de 6 caracteres,
  valor em centavos: nenhum entra sem a frase que explica a escolha.
- **Resultado prometido é resultado rodado.** Se o README diz que responde `409`,
  é porque o `curl` respondeu `409` na máquina do agente.
- **Termo técnico é definido na estreia** (`Location`, colisão, `GROUP BY`), na
  própria linha ou na seguinte. Palavra não explicada trava a leitura.

Tamanho: sem limite fixo. Acaba quando o assunto acabou — o corte é por
redundância, não por linha.

> **Atenção:** `curl -d '{"json":1}'` com aspas simples não funciona em `cmd.exe`
> nem no PowerShell. Se o README trouxer `curl` com corpo JSON, repita o aviso
> que está no módulo 01.

---

## 4. Leva 1 — as quatro tarefas

### Tarefa 1 — `01-encurtador` · módulos 03 → 05 · porta 6001

Encurtador de links: recebe uma URL longa, devolve um código curto, redireciona
e conta os cliques.

**Teto: ~180 linhas de código, em 2 ou 3 arquivos.** Armazenamento é um `Map` em
memória — sem banco, sem Zod, sem camadas. Validação é `if` na mão **de
propósito**: é a dor que a tarefa 2 resolve com Zod.

| Método   | Rota             | O que faz                                             |
| -------- | ---------------- | ----------------------------------------------------- |
| `POST`   | `/links`         | `{ url, codigo? }` → 201 com `{ codigo, curto, url }` |
| `GET`    | `/links`         | lista os links com contagem de cliques                |
| `GET`    | `/links/:codigo` | estatística de um link                                |
| `DELETE` | `/links/:codigo` | 204, ou 404 se não existe                             |
| `GET`    | `/:codigo`       | **302** para a URL original e soma um clique          |

**O que a seção `## Como funciona` do README precisa explicar** — o mecanismo do
encurtador, sem citar Express:

- **Encurtar não comprime nada.** A URL longa continua inteira, guardada no
  servidor; o que se cria é uma **chave** curta que aponta para ela. O
  "encurtador" é um dicionário `código → URL` com um servidor na frente.
- **O que o navegador faz ao abrir o link curto**, passo a passo: ele pede
  `/abc123` ao servidor do encurtador, recebe uma resposta de redirecionamento
  (status 302) com o cabeçalho **`Location`** — que é o campo onde vai o endereço
  de destino — e **refaz a requisição sozinho** nesse endereço. São duas
  requisições, não uma, e é isso que dá para desenhar num `mermaid` de sequência.
- **De onde sai a contagem de cliques**: como toda visita passa pelo encurtador
  antes de chegar ao destino, contar é somar 1 nessa passagem. Diga também o que
  ela **não** mede — a mesma pessoa abrindo duas vezes conta dois, e o destino
  nunca sabe quantos cliques houve.
- **Como o código curto é gerado e por que ele é assim**: quantos caracteres, de
  que alfabeto, e o que é uma **colisão** (duas URLs sorteando o mesmo código) —
  com a conta de quantas combinações o tamanho escolhido oferece. Explique por
  que um id sequencial (`/1`, `/2`, `/3`) seria pior: qualquer um enumera os
  links de todo mundo digitando números.
- **O limite honesto do modelo**: quem tem o código tem o link. Link curto não é
  link secreto, e o encurtador não tem como saber se quem clicou devia clicar.

O que a tarefa tem que deixar visível no código:

- **A ordem das rotas decide o comportamento** (módulo 04): `/:codigo` casa com
  `links` também. Se ela for registrada antes, `GET /links` vira busca por um
  link de código `"links"` e responde 404. Registrar por último não é estilo, é
  requisito — e o README precisa dizer isso.
- **302 e não 301.** O 301 é permanente e o navegador cacheia: da segunda visita
  em diante ele nem chama a API, e o contador congela. Este é o comentário mais
  importante do arquivo.
- **Middlewares** (módulo 05): `cors()`, `morgan('dev')` e um seu, curto, que
  carimba `X-Tempo-ms` na resposta. Três middlewares, não sete.
- Código repetido → **409**; URL sem `http://`/`https://` → **400** com
  mensagem que diz o campo.

---

### Tarefa 2 — `02-inscricoes` · módulos 03 → 07 · porta 6002

Inscrição em evento com vaga limitada. É a API de formulário: o corpo vem do
cliente e **nada nele é confiável**.

**Teto: ~320 linhas, em 5 ou 6 arquivos** (`servidor.ts`, `rotas.ts`,
`schemas.ts`, `erros.ts`, `validar.ts`, `dados.ts`). Ainda em memória — banco é
a tarefa 3. Dois ou três eventos fixos como dado inicial.

| Método   | Rota                      | O que faz                                       |
| -------- | ------------------------- | ----------------------------------------------- |
| `GET`    | `/eventos`                | lista com vagas restantes                       |
| `GET`    | `/eventos/:id`            | um evento, 404 se não existe                    |
| `POST`   | `/eventos/:id/inscricoes` | inscreve: 201, 409 se lotado ou e-mail repetido |
| `GET`    | `/eventos/:id/inscricoes` | `?pagina=&limite=&busca=`                       |
| `DELETE` | `/inscricoes/:id`         | 204 e devolve a vaga ao evento                  |

**O que a seção `## Como funciona` do README precisa explicar** — o mecanismo de
um formulário que grava, sem citar Zod:

- **O caminho de um formulário**: alguém preenche campos numa tela, o navegador
  monta um JSON e manda no corpo de um `POST`. O servidor **não recebe o
  formulário**, recebe um texto que diz ser JSON — e qualquer um pode montar esse
  texto na mão, sem tela nenhuma.
- **Por que validar no servidor mesmo com validação na tela**: a checagem do
  navegador é conveniência para quem digitou errado, não barreira. Mostre o
  `curl` que passa por cima dela — é o argumento inteiro em uma linha.
- **O que é uma vaga limitada**: um contador contra um teto. Explique por que a
  conferência tem que acontecer no servidor, no momento da gravação, e não na
  tela que mostrou "restam 3 vagas" cinco minutos atrás.
- **Duas famílias de recusa, e por que elas são diferentes**: "esse e-mail não é
  um e-mail" é um problema de **formato** — o dado está malformado e nenhuma
  informação sobre o evento muda isso. "Esse e-mail já se inscreveu" e "acabaram
  as vagas" são problemas de **estado**: o dado está perfeito, o mundo é que não
  aceita. É daí que sai a escolha entre 422 e 409, e é o conceito mais
  transferível da mini API.
- **Por que a listagem é paginada**: um evento com 5 mil inscritos numa resposta
  só é lenta para o servidor, para a rede e para quem lê. Página e limite são a
  forma de o cliente pedir um pedaço.

O que a tarefa tem que deixar visível no código:

- **Middleware `validar(schema)` genérico** (módulo 07), aplicado a `body`,
  `params` e `query` — um só middleware, parametrizado, não três cópias.
- **Query string é sempre texto.** `?limite=20` chega como `"20"`; sem
  `z.coerce.number()` a comparação silenciosamente compara string com número.
  Falso amigo que merece comentário.
- **Validação × regra de negócio** — a distinção que o módulo 07 cobra. E-mail
  malformado é formato → **422** com a lista de campos que falharam. Evento
  lotado é regra de negócio → **409**, e o Zod não tem nada a ver com isso.
- **Tratador de erro central + `AppError`** (módulo 06): toda resposta de erro
  sai no mesmo formato, e stack trace nunca vaza para o cliente.
- O `POST` recusa campo desconhecido em vez de ignorar — se o cliente mandou
  `vagas: 999`, é bug dele ou ataque, e silêncio esconde os dois.

---

### Tarefa 3 — `03-despesas` · módulos 03 → 09 · porta 6003 · SQLite

Controle de gastos pessoais: lança despesa numa categoria e fecha o mês. É a
mini API que existe para mostrar **SQL respondendo pergunta** — o relatório é o
ponto alto, não um extra.

**Teto: ~450 linhas**, com as camadas do módulo 08 (`rotas → servico →
repositorio`) e SQL na mão do 09. Dois recursos apenas: `categorias` e
`despesas`, 1-N. Banco em `data/minis-03-despesas.sqlite`, com migration
idempotente e seed de categorias.

| Método   | Rota                 | O que faz                                           |
| -------- | -------------------- | --------------------------------------------------- |
| `GET`    | `/categorias`        | lista                                               |
| `POST`   | `/categorias`        | cria, 409 se o nome repete                          |
| `GET`    | `/despesas`          | `?mes=2026-08&categoria=3&pagina=&limite=`          |
| `POST`   | `/despesas`          | cria, 422 no formato, 404 se a categoria não existe |
| `GET`    | `/despesas/:id`      | uma despesa com o nome da categoria (`JOIN`)        |
| `DELETE` | `/despesas/:id`      | 204                                                 |
| `GET`    | `/relatorios/mensal` | `?mes=2026-08` → total por categoria + total geral  |

**O que a seção `## Como funciona` do README precisa explicar** — o mecanismo de
guardar e somar dinheiro, sem citar SQLite:

- **Por que sai da memória e vai para um banco**: o array morre quando o processo
  reinicia. Um controle de gastos que esquece o mês passado não serve para nada —
  é a primeira mini API da leva em que persistir é requisito, não luxo.
- **Como dinheiro é guardado de verdade**: em número inteiro de centavos. Mostre
  a conta que quebra (`0.1 + 0.2` dá `0.30000000000000004`) e diga onde isso
  aparece: soma de centenas de lançamentos que fecha um centavo fora do extrato,
  todo mês, sem ninguém achar o erro.
- **O que é uma relação 1-N**, em palavras antes de tabela: uma categoria tem
  muitas despesas, cada despesa pertence a uma. Isso vira uma coluna na despesa
  apontando para a categoria — a **chave estrangeira** — e é o que impede
  "Alimentação" escrito de seis jeitos diferentes.
- **Por que a soma é feita pelo banco**: a pergunta "quanto gastei em agosto, por
  categoria" é agrupar linhas e somar. Trazer as linhas todas pela rede para somar
  no JavaScript devolve a mesma resposta com 50 lançamentos e derrete com 50 mil,
  porque paga transporte de dado que vai ser jogado fora. Explique `GROUP BY` e
  `SUM` no nível de "agrupa por categoria e soma o valor de cada grupo".
- **O que é um índice**, com a analogia útil: sem ele o banco lê a tabela inteira
  para achar as despesas de agosto, como procurar um assunto num livro sem
  sumário. O índice é o sumário — custa espaço e um pouco de escrita.
- **O que é uma migration e por que ela mora no código**: o banco começa vazio, e
  alguém precisa criar as tabelas. Guardar esse passo em arquivo versionado é o
  que faz um clone novo chegar ao mesmo banco sem ninguém digitar SQL à mão.

O que a tarefa tem que deixar visível no código:

- **Dinheiro é `INTEGER` em centavos.** `0.1 + 0.2 !== 0.3` em ponto flutuante, e
  em relatório financeiro isso vira centavo perdido que ninguém acha. A API
  aceita reais e converte na borda; o banco só vê centavos.
- **`PRAGMA foreign_keys = ON` é por conexão, não por banco.** Sem ele o SQLite
  aceita `categoria_id` inexistente sem reclamar.
- **Query sempre parametrizada** (`?`), inclusive no filtro montado
  dinamicamente — o filtro opcional é justamente onde a concatenação tenta
  entrar.
- **O relatório é `GROUP BY` com `SUM`**, feito no banco. Trazer tudo e somar em
  JavaScript funciona com 50 linhas e derrete com 50 mil: é a comparação que a
  tarefa precisa registrar no README, em uma frase.
- **Índice em `despesas(mes)`** com o porquê: o filtro mais usado é o mensal, e
  sem índice cada consulta varre a tabela inteira.
- **A camada repositório é o ponto da separação**: só ela escreve SQL. Serviço e
  rota não sabem que existe SQLite.

---

### Tarefa 4 — `04-enquetes` · módulos 03 → 09, **sem o 07** · porta 6004 · SQLite

> **Registro retroativo.** Esta mini foi construída depois das três primeiras e
> antes de existir esta entrada. O texto abaixo descreve **o que ela é hoje**,
> para que o README da pasta e as levas seguintes tenham a referência. Não é um
> briefing a executar.

Enquete com apuração: uma pergunta, um conjunto fechado de opções, um voto por
pessoa, e um resultado que se confere.

O que a separa da tarefa 3 é o **buraco proposital no teto**: ela vai até o
módulo 09 mas **pula o 07**. A validação é escrita à mão — não por limitação, e
sim porque a tarefa 2 já mostrou o Zod resolvendo o problema, e ver o mecanismo
por baixo (ler `req.body` como `unknown`, checar tipo, juntar os erros numa
lista) é o que impede o Zod de virar mágica. O `README.md` dela registra isso na
seção `## O que ficou de fora`, apontando o módulo 07.

Tamanho real: ~1.070 linhas de código em 8 arquivos (`servidor.ts`, `rotas.ts`,
`servico.ts`, `repositorio.ts`, `dominio.ts`, `validacao.ts`, `erros.ts`,
`db.ts`). Banco em `data/minis-04-enquetes.sqlite`.

| Método   | Rota                         | O que faz                                            |
| -------- | ---------------------------- | ---------------------------------------------------- |
| `GET`    | `/enquetes`                  | lista; `?estado=abertas\|encerradas&pagina=&limite=` |
| `POST`   | `/enquetes`                  | cria com 2 a 8 opções                                |
| `GET`    | `/enquetes/:id`              | a cédula: pergunta e opções, sem os números          |
| `DELETE` | `/enquetes/:id`              | apaga a enquete, as opções e os votos                |
| `POST`   | `/enquetes/:id/encerramento` | encerra a votação, uma vez só                        |
| `POST`   | `/enquetes/:id/votos`        | vota; exige `X-Eleitor` e `{ "opcaoId": N }`         |
| `DELETE` | `/enquetes/:id/votos`        | retira o voto de quem está no `X-Eleitor`            |
| `GET`    | `/enquetes/:id/resultado`    | apuração com percentual, vencedora e empate          |

O que ela deixa visível no código, e que as levas seguintes podem citar em vez de
reexplicar:

- **Um voto é uma linha, não um contador.** O campo `total` ao lado da opção
  economiza espaço e perde três coisas: voto único por pessoa, troca de voto e
  recontagem. Contar vira consequência do registro.
- **Identidade declarada não é identidade provada.** O `X-Eleitor` é um
  cabeçalho que qualquer um escreve. A mini assume isso em voz alta e aponta o
  módulo 11 — que é onde as tarefas 6 e 7 desta leva 2 começam.
- **`Number('')` é `0`, não `NaN`.** `?limite=` vazio passa pela checagem "é
  número?" e vira `LIMIT 0`, devolvendo lista vazia sem erro nenhum.
- **Chave repetida na query vira array.** `?pagina=1&pagina=2` chega como
  `['1','2']`, e `Number` disso é `NaN` — o validador à mão precisa tratar o
  caso que o Zod trataria sozinho.

---

## 5. Como despachar

As tarefas de uma mesma leva são independentes — nenhuma importa arquivo da
outra. Despache **em paralelo**, um agente por tarefa, depois do Passo 0 (o
geral da seção 2 e o da própria leva, se houver).

Prompt de cada agente (trocando o que está entre colchetes):

```
Leia CLAUDE.md e minis-apis/ORQUESTRACAO.md (seções 1, 3 e a tarefa [NN]) na
raiz do repositório.

Construa a mini API da Tarefa [NN] em minis-apis/[NN-nome]/, respeitando o
teto de módulos e o teto de linhas.

Isto é material de estudo, então as duas entregas ensinam:
- Comentário: explique o que é fundamental para entender o trecho, com o
  porquê e a consequência. Não comente por aparecer, e não repita o que já
  foi explicado antes no código ou nos docs/ (seção 1).
- README: segue a seção 3. Comece por "Como funciona" — explique o
  mecanismo da coisa (o que acontece de ponta a ponta, quem faz cada parte)
  sem citar Express nem biblioteca, cobrindo os pontos listados na tarefa.
  Só depois "Como ela foi construída", com a ordem em que as peças entraram
  e o problema que cada uma resolveu.

Antes de dizer que terminou:
1. npx tsc --noEmit -p tsconfig.minis.json  → tem que passar limpo
2. suba o servidor na porta [600N] e exercite TODOS os endpoints com curl,
   incluindo os casos de erro da tabela
3. npx prettier --check minis-apis/[NN-nome]  → limpo
4. derrube o servidor

Relate o que rodou e a saída real. Não invente resultado de curl, e não
altere nada fora de minis-apis/[NN-nome]/.
```

### Critérios de aceite (valem para as três)

- [ ] `npx tsc --noEmit -p tsconfig.minis.json` passa
- [ ] `npx prettier --check minis-apis/` limpo
- [ ] Servidor sobe na porta certa e todos os endpoints da tabela foram
      exercitados com `curl` — caminho feliz e erro
- [ ] Nenhuma dependência nova no `package.json`
- [ ] Nenhum arquivo tocado fora da pasta da própria mini API
- [ ] Nenhum recurso acima do teto de módulo da tarefa
- [ ] O que é fundamental para entender está explicado de verdade; o óbvio e o já
      explicado não voltam — nenhum comentário descreve sintaxe ou se repete
- [ ] `README.md` no formato da seção 3 — com **Como funciona** (o mecanismo,
      antes do código, cobrindo os pontos listados na tarefa), **Como ela foi
      construída**, as decisões com a alternativa descartada, e os `curl` que
      foram de fato rodados, com a resposta real

### Fechamento, pelo orquestrador

Depois que as três voltarem:

1. Rodar `npm run typecheck`, `npm run typecheck:minis`, `npm run format:check` e
   `npm test` — a suíte existente não pode ter sido afetada.
2. Escrever `minis-apis/README.md`: a porta de entrada da pasta. Explica **por
   que ela existe** (ver o conteúdo dos módulos fora do domínio da biblioteca),
   em que ordem ler as três — a 1 cria a dor que a 2 resolve, a 2 cria a que a
   3 resolve — e a tabela com domínio, faixa de módulos, porta e a frase de "o
   que esta aqui ensina".
3. Registrar a leva em `.projeto/estado.md` e, se houver o que contar, em `.projeto/historico/AAAA-MM-DD.md`.

---

---

## 6. Leva 2 — as três tarefas

A leva 1 parou no módulo 09 e não tinha login em nenhuma das quatro. Esta sobe o
teto: a **5** fica no 07 (memória, Zod fazendo o que `if` não faz) e a **6** e a
**7** vão até o **11** — cadastro, senha guardada como hash e requisição
autenticada.

O par 6 × 7 é **deliberado**: mesmo teto de módulos, camadas de dados opostas. A
6 usa Prisma (módulo 10), a 7 escreve SQL na mão (módulo 09), e as duas
respondem "quem pode ver isto?" em formatos diferentes. Quem ler as duas enxerga
o que era do ORM e o que era do problema.

### Passo 0 da leva 2 — feito pelo orquestrador, antes de despachar

A 6 é a única mini com projeto Prisma próprio, e o client gerado não entra no
git. Uma linha no `.gitignore` da raiz:

```
minis-apis/06-compras/prisma/gerado/
```

Fora isso, nada na raiz muda. O `tsconfig.minis.json` da seção 2 já cobre a
pasta inteira.

---

### Tarefa 5 — `05-reservas` · módulos 03 → 07 · porta 6005 · memória

Reserva de sala por intervalo de tempo: quem pega a sala, de quando até quando, e
o que acontece quando duas pessoas querem o mesmo horário.

**Teto: ~360 linhas de código, em 5 ou 6 arquivos** (`servidor.ts`, `rotas.ts`,
`schemas.ts`, `validar.ts`, `erros.ts`, `dados.ts`). Armazenamento em memória —
banco está acima do teto. Três salas fixas como dado inicial, com capacidades
diferentes.

| Método   | Rota                  | O que faz                                          |
| -------- | --------------------- | -------------------------------------------------- |
| `GET`    | `/salas`              | lista as salas                                     |
| `GET`    | `/salas/:id/reservas` | agenda da sala; `?data=2026-08-19&pagina=&limite=` |
| `POST`   | `/salas/:id/reservas` | reserva: 201, 409 se o horário choca               |
| `GET`    | `/reservas/:id`       | uma reserva, 404 se não existe                     |
| `PATCH`  | `/reservas/:id`       | remarca: muda início, fim ou título                |
| `DELETE` | `/reservas/:id`       | 204, ou 404 se não existe                          |

**O que a seção `## Como funciona` do README precisa explicar** — o mecanismo de
uma agenda, sem citar biblioteca nenhuma:

- **Uma agenda não guarda "ocupado", guarda intervalos.** Não existe um campo
  dizendo que a sala está livre às 14h: existem as reservas, e "livre" é o que
  sobra. Isso muda a pergunta que o sistema responde — de "está livre?" para
  "este intervalo encosta em algum outro?".
- **A conta da sobreposição, em uma linha.** Dois intervalos `[a, b)` e `[c, d)`
  se sobrepõem quando `a < d` **e** `c < b`. Mostre por que essa dupla de
  comparações cobre os quatro casos que alguém tentaria enumerar à mão (começa
  antes e termina dentro, engole o outro inteiro, cabe dentro dele, começa
  dentro e termina depois) — e por que enumerar é justamente onde se esquece um.
- **Por que o intervalo é semiaberto**, com o fim de fora. A reserva das 10h às
  11h e a das 11h às 12h **não** conflitam. Se o fim entrasse na conta, toda
  reserva bloquearia o instante seguinte e duas reuniões nunca poderiam se
  encostar. É a decisão que mais gera "achei que estava livre" quando tomada ao
  contrário.
- **Por que a conferência acontece no servidor, no momento da gravação.** A tela
  que mostrou a sala livre é uma foto de alguns minutos atrás. Quem decide é
  quem grava.
- **Instante × horário local.** "14:00" sozinho não é um instante: depende de
  onde a pessoa está. A API troca datas em ISO 8601 com fuso
  (`2026-08-19T14:00:00-03:00`) e diz o que quebra ao aceitar a forma solta —
  duas pessoas em fusos diferentes reservando "14:00" e nenhuma das duas
  errando.
- **O limite honesto**: duas reservas chegando ao mesmo tempo. Aqui elas não se
  atropelam, porque é um processo só e a checagem e a gravação acontecem sem
  pausa entre elas; explique que num banco, com dois processos, essa garantia
  desaparece e o assunto passa a ser transação — e aponte o módulo.

O que a tarefa tem que deixar visível no código:

- **Middleware `validar(schema)` genérico** (módulo 07) aplicado a `body`,
  `params` e `query` — um só, parametrizado.
- **Regra que envolve dois campos não cabe no campo.** `fim > inicio` não é
  validação de `fim`: é do par, e por isso vive num `.refine()` sobre o objeto.
  Tentar prendê-la ao campo é o falso amigo aqui.
- **`z.coerce` na query** — `?pagina=2` chega como texto. Conceito já explicado
  na tarefa 2: referência de uma linha, não reexplicação.
- **Campo desconhecido é recusado**, não ignorado: `strict()`. Mandar
  `capacidade: 999` numa reserva é bug do cliente ou tentativa; silêncio esconde
  os dois.
- **A divisão entre 422 e 409, e o critério que a decide.** Duração acima do teto
  e horário fora do expediente são **422**: dá para recusar olhando só o corpo,
  sem consultar nada. Sobreposição é **409**: o corpo está perfeito, o que nega é
  o estado da agenda. O README precisa registrar esse critério — "dá para decidir
  sem olhar o resto do mundo?" — porque é ele que transfere para outro domínio.
- **O `PATCH` e o falso amigo do `.partial()`.** Tornar tudo opcional aceita
  corpo vazio e, pior, aceita `{ "fim": ... }` sozinho — e aí o `fim` novo é
  comparado com o `inicio` antigo, que o schema não enxerga. A checagem do par
  tem que acontecer **depois** de juntar o que veio com o que já estava gravado.
- **Tratador de erro central + `AppError`** (módulo 06): formato único de erro,
  stack trace nunca no cliente.
- Middlewares: `cors()` e `morgan('dev')`. Não invente um terceiro para cumprir
  cota — a tarefa 1 já mostrou middleware próprio.

---

### Tarefa 6 — `06-compras` · módulos 03 → 11 · porta 6006 · Prisma

Lista de compras compartilhada: cada pessoa tem conta, cria listas, convida
outras e marca o que já foi comprado.

**Teto: ~700 linhas de código**, com as camadas do módulo 08
(`rotas → servico → repositorio`), Prisma do módulo 10 e autenticação do 11. É a
maior da pasta, e o escopo é o teto: dois papéis, quatro tabelas, nada de
notificação, histórico ou convite por link.

**Esta mini tem projeto Prisma próprio, dentro da pasta:**

```
minis-apis/06-compras/
├── prisma/schema.prisma   ← output = "./gerado", provider sqlite
├── prisma.config.ts       ← url = file:../../data/minis-06-compras.sqlite
└── prisma/migrations/     ← vai para o git
```

O schema da raiz não é tocado. A alternativa — pendurar os modelos lá — poria as
tabelas da mini no mesmo banco da biblioteca e quebraria a regra de a mini ser
lida sozinha. O preço aceito é que **esta é a única mini com passo de setup**, e
o `## Rodar` do README precisa trazê-lo antes do `node servidor.ts`:

```bash
npx prisma migrate deploy --config minis-apis/06-compras/prisma.config.ts
npx prisma generate --config minis-apis/06-compras/prisma.config.ts
node minis-apis/06-compras/servidor.ts
```

Modelos: `Usuario` (e-mail único, `senhaHash`), `Lista`, `Membro` (chave primária
composta `[listaId, usuarioId]` e `papel` em texto — SQLite não tem `enum`, e o
Prisma recusa `enum` neste provider) e `Item` (nome, quantidade, `comprado`).

| Método   | Rota                        | O que faz                                  |
| -------- | --------------------------- | ------------------------------------------ |
| `POST`   | `/usuarios`                 | cadastro: 201, 409 se o e-mail repete      |
| `POST`   | `/sessoes`                  | login: 200 com o token, 401 se não confere |
| `GET`    | `/listas`                   | as minhas — como dono ou como convidado    |
| `POST`   | `/listas`                   | cria; quem criou vira dono                 |
| `GET`    | `/listas/:id`               | a lista com membros e itens                |
| `POST`   | `/listas/:id/membros`       | convida por e-mail — **só o dono**         |
| `POST`   | `/listas/:id/itens`         | acrescenta item                            |
| `PATCH`  | `/listas/:id/itens/:itemId` | marca comprado ou muda a quantidade        |
| `DELETE` | `/listas/:id/itens/:itemId` | 204                                        |

**O que a seção `## Como funciona` do README precisa explicar** — o mecanismo de
ter conta e de dividir uma lista, sem citar biblioteca nenhuma:

- **A senha nunca é armazenada.** O servidor guarda uma **prova derivada** dela:
  um valor calculado a partir da senha do qual não se volta. Conferir é refazer a
  conta e comparar os resultados. Explique por que a conta é **lenta de
  propósito** — quem levar o banco embora precisa testar senha por senha, e cada
  tentativa custa — e o que é o **sal**: um valor aleatório por senha, guardado
  junto, que faz duas pessoas com a mesma senha terem provas diferentes.
- **Autenticar × autorizar**, com o domínio na mão: autenticar responde "quem é
  você"; autorizar responde "você pode fazer isto **nesta lista**". A segunda
  pergunta só existe porque a lista é compartilhada.
- **HTTP não lembra.** Cada requisição chega sem passado. "Continuar logado" é o
  cliente reenviar uma prova a cada pedido — e a prova é o crachá assinado que o
  login devolveu.
- **O que é um crachá assinado**: um texto legível por qualquer um, com uma
  assinatura que só o servidor sabe produzir. Diga as duas consequências que
  quase todo mundo inverte — o conteúdo **não é secreto** (não ponha nada
  sigiloso nele) e ele **não pode ser rasgado depois de emitido**, e é daí que
  sai o prazo curto de validade.
- **404 × 403, e por que a escolha vaza informação.** Pedir uma lista que não é
  sua responde **404**: dizer "403" confirmaria que aquela lista existe, e quem
  varre os números anota quais deram 403 e monta o mapa das listas alheias. Já
  convidar alguém para uma lista que você **já enxerga** responde **403** — ali a
  existência não é segredo, só a permissão falta. É o conceito mais transferível
  desta mini, e precisa aparecer no código com comentário.
- **Por que dois papéis bastam** — dono e convidado — e o que custaria um
  terceiro.

O que a tarefa tem que deixar visível no código:

- **`argon2.hash` no cadastro, `argon2.verify` no login.** O sal não é passado
  porque o argon2 gera um por senha e o embute no resultado. Comparar hash com
  `===` é erro; a verificação tem função própria.
- **Login com mensagem única** — "e-mail ou senha inválidos" nos dois casos.
  Dizer "esse e-mail não existe" entrega ao curioso a lista de quem tem conta.
- **`jwt.verify`, nunca `jwt.decode`.** O `decode` lê a carga **sem conferir a
  assinatura**: qualquer um forja um token com `usuarioId: 1` e entra. É o falso
  amigo mais caro do módulo 11 e merece o comentário mais longo do arquivo.
- **O segredo vem do ambiente**, com um valor de desenvolvimento embutido para a
  mini rodar sem setup — e um comentário dizendo por que esse valor embutido
  seria falha grave em produção.
- **Middleware `autenticar`** que resolve o token e preenche `req.usuario` (com o
  tipo declarado, não `any`), e **`exigirDono`** separado — autorizar é uma
  decisão diferente de autenticar, e separá-los é o que impede a regra de sumir
  no meio da rota.
- **A camada é o ponto**: só o repositório conhece o Prisma. O serviço decide 403
  × 404 e não sabe o que é `findUnique`.
- **`include` e o N+1**, em uma frase: buscar as listas e depois pedir os itens de
  cada uma numa volta é uma consulta por lista; `include` traz tudo de uma vez.
- **`onDelete` escolhido, não herdado**: `Cascade` em itens e membros — apagar a
  lista leva junto o que só existe dentro dela; `Restrict` no usuário, porque
  apagar quem é dono deixaria a lista sem dono. Diga a alternativa e o que ela
  custaria.

---

### Tarefa 7 — `07-habitos` · módulos 03 → 11 · porta 6007 · SQLite (`node:sqlite`)

Rastreador de hábitos privado: cada pessoa tem os seus, marca o dia em que
cumpriu e olha o resumo do mês.

**Teto: ~650 linhas de código**, com as camadas do módulo 08, SQL na mão do 09 e
autenticação do 11. Banco em `data/minis-07-habitos.sqlite`, com migration
idempotente. **Sem Prisma** — o contraste com a tarefa 6 é o ponto.

Tabelas: `usuarios`, `habitos` (com `usuario_id`) e `marcacoes` (`habito_id`,
`dia` em texto `YYYY-MM-DD`, com unicidade no par).

| Método   | Rota                          | O que faz                                  |
| -------- | ----------------------------- | ------------------------------------------ |
| `POST`   | `/usuarios`                   | cadastro: 201, 409 se o e-mail repete      |
| `POST`   | `/sessoes`                    | login: 200 com o token, 401                |
| `GET`    | `/habitos`                    | os meus                                    |
| `POST`   | `/habitos`                    | cria; 409 se eu já tenho um com esse nome  |
| `DELETE` | `/habitos/:id`                | 204, e leva as marcações junto             |
| `PUT`    | `/habitos/:id/marcacoes/:dia` | marca o dia — **idempotente**              |
| `DELETE` | `/habitos/:id/marcacoes/:dia` | desmarca                                   |
| `GET`    | `/habitos/:id/resumo`         | `?mes=2026-08` → dias, percentual, seguida |

**O que a seção `## Como funciona` do README precisa explicar** — o mecanismo de
acompanhar um hábito, sem citar biblioteca nenhuma:

- **O que se guarda é uma linha por dia cumprido**, não um contador — a mesma
  escolha da mini 4, aplicada a outro domínio. Uma linha de referência a ela
  basta; não reexplique.
- **Dia não é instante.** "Marquei hoje" depende de onde a pessoa está: à
  meia-noite e meia em São Paulo, em Lisboa já é outro dia. A API grava
  `2026-08-19`, e quem decide que dia é hoje é o cliente. Diga o custo dessa
  escolha: quem quiser, marca o mês inteiro de uma vez — o servidor não tem como
  saber que não foi ontem.
- **O que é idempotência**, e por que marcar o dia é `PUT` e não `POST`. Apertar
  o botão duas vezes tem que terminar no mesmo lugar. Com `POST` a segunda vez
  criaria a segunda marcação — ou precisaria de um erro para se defender; com
  `PUT` o segundo pedido apenas confirma o que já vale.
- **Privado é diferente de proibido.** Aqui não existe compartilhamento: hábito
  de outra pessoa não é "acesso negado", é **inexistente** do ponto de vista de
  quem perguntou — sempre 404. Diga em uma frase por que a mini 6 responde 403 em
  alguns casos e esta nunca responde: lá a existência já é conhecida por quem
  pergunta.
- **O que o banco responde bem, e o que não.** "Quantos dias em agosto" é agrupar
  e contar — pergunta de banco. "Quantos dias seguidos até hoje" é uma pergunta
  sobre a **ordem entre as linhas**, e a resposta honesta é trazer os dias do mês
  (31 linhas, não 50 mil) e contar em JavaScript. É a contra-lição do relatório
  da mini 3, e ela precisa vir com a régua: o que muda a decisão é o **tamanho do
  que se traz**, não onde a conta é escrita.
- **A regra "um por dia" mora no banco.** Um `if` conferindo antes de inserir
  falha no dia em que dois pedidos chegam juntos; a restrição de unicidade não
  falha, porque quem decide é quem grava.

O que a tarefa tem que deixar visível no código:

- **Unicidade em `(habito_id, dia)`** e o que fazer com a violação: em `PUT`, o
  erro de unicidade do SQLite não vira 409 — vira **sucesso**, porque o estado
  pedido já é o estado atual. É o trecho onde idempotência deixa de ser palavra.
- **O `WHERE usuario_id = ?` vive no repositório**, em toda consulta, não num
  `if` no serviço. A diferença é que um `if` dá para esquecer numa rota nova; a
  cláusula na consulta, não.
- **404 sempre, nunca 403** — com o comentário dizendo por quê e apontando a mini
  6 como o caso em que 403 é o certo.
- **Consulta sempre parametrizada** (`?`), inclusive no filtro de mês montado
  dinamicamente. Conceito da mini 3: referência de uma linha.
- **`PRAGMA foreign_keys = ON` é por conexão** — referência à mini 3, não
  reexplicação. O que muda aqui é o apagamento em cascata das marcações.
- **Argon2 e JWT como na mini 6**, sem repetir a explicação: uma linha de
  referência, e comentário só onde esta mini decide diferente.
- **O resumo**: `GROUP BY` para o mês, contagem de dias seguidos em JavaScript, e
  o comentário que diz por que cada metade está onde está.

---

## 7. Próximas levas

O que ainda não apareceu em mini nenhuma: **testes automatizados** (12) — todas
foram conferidas com `curl` na mão —, **rate limit e cabeçalhos de segurança**
(13), **log estruturado** (14), **cache** (15) e **upload** (19). São os
candidatos naturais da leva 3. Cada leva vira uma nova seção deste arquivo, com
as tarefas numeradas na sequência (`08-`, `09-`, ...).
