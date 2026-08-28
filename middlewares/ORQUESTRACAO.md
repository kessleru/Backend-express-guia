# middlewares — briefing de orquestração

Esta pasta é um **catálogo de middlewares prontos**, um por pasta, cada um com o
código comentado e um README que ensina o que ele resolve e o que ele custa.

Ela **não é biblioteca**: ninguém importa daqui. As soluções dos exercícios
continuam com as cópias próprias, porque o `diff` entre uma solução e a seguinte
é material de ensino. Quem precisa de um middleware **copia a pasta** e entende o
que copiou — que é justamente o que não acontece quando se cola um trecho achado
na internet.

Este arquivo é o **briefing dos agentes**: cada agente pega um grupo da seção 3,
constrói os middlewares daquele grupo e para.

---

## 1. O que vale para os quatro grupos

| Regra                     | Detalhe                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Não reexplique o 05**   | `docs/01-05/05-middlewares.md` já ensina o que é middleware, a ordem, a fábrica e os 4 argumentos do de erro. Conceito de lá vira **link**, não parágrafo. |
| **Cada pasta é copiável** | O `middleware.ts` não importa nada de outra pasta do catálogo. Se depende de um `AppError`, ele é definido ali ou o README diz o que trocar.               |
| **Zero dependência nova** | Só o que já está no `package.json`: `express`, `zod`, `jsonwebtoken`, `helmet`, `express-rate-limit`, `morgan`, `cors` e os módulos `node:`.               |
| **Uma porta por grupo**   | `6101` a `6104`. A faixa `50NN` é dos exemplos, `4NN0` das soluções e `600N` das minis APIs; a `610N` é desta pasta.                                       |
| **Pequeno de verdade**    | Cada `middleware.ts` fica entre ~30 e ~90 linhas de código. Passou muito disso, ele está fazendo duas coisas — separe ou corte.                            |
| **Roda sem setup**        | `node middlewares/NN-grupo/servidor.ts` e pronto. Sem banco, sem variável de ambiente obrigatória.                                                         |

### Convenções técnicas (as mesmas do repositório)

- **ESM**, `import` sempre, `require` nunca.
- **Import relativo com extensão `.ts`**: `import { validar } from './middleware.ts'`.
- **Sem `enum`, `namespace`, `import =`** — `erasableSyntaxOnly` está ligado.
- **Tudo em português**: arquivo, variável, rota, mensagem de erro, doc.
- **`src/playground/` é intocável.** Nenhum agente lê, escreve ou cita.
- Checagem de tipos: `npx tsc --noEmit -p tsconfig.middlewares.json`.

### Régua de comentário e de Markdown

Valem **iguais** as de `minis-apis/ORQUESTRACAO.md`, seção 1 — leia lá em vez de
adivinhar. O resumo, porque aqui ele decide a entrega:

- Comentário explica **o que decide o comportamento**: a armadilha, o porquê
  daquele número, o que a linha faz por baixo. O que o nome já diz não entra.
- **Uma explicação por conceito.** Explicou `res.locals` num middleware? O
  seguinte não reexplica.
- Markdown puro: nada de `> [!NOTE]`; aviso é `>` com rótulo em negrito. Bloco de
  código sempre com linguagem.

---

## 2. O que cada agente entrega

```
middlewares/NN-grupo/
├── README.md          ← índice curto do grupo + como rodar a demo
├── servidor.ts        ← demo que monta a pilha do grupo, na porta do grupo
├── nome-do-middleware/
│   ├── README.md      ← ensina ESTE middleware (seções abaixo)
│   └── middleware.ts  ← o código, comentado
└── (uma pasta por middleware)
```

O `servidor.ts` do grupo é **demonstração, não aplicação**: ele monta a pilha,
expõe duas ou três rotas mínimas que fazem os middlewares aparecerem, e é o que o
agente usa para exercitar tudo com `curl`. Ele pode importar das pastas irmãs —
a regra de não importar vale entre pastas de middleware, não para a demo.

### O `README.md` de cada middleware

| Seção                       | O que tem que estar lá                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `# Middleware — nome`       | Abaixo, a linha `📦 módulo NN · 🧩 grupo NN` e uma frase do que ele faz                                                                                                                     |
| `## O problema`             | A coisa que precisa acontecer em toda rota, e o que dói quando cada rota resolve sozinha. Concreto, não abstrato                                                                            |
| `## Como funciona`          | O mecanismo: o que acontece com a requisição, em que ponto, o que ele lê e o que ele escreve. Aqui **pode** citar Express — ele é o assunto —, mas o que é middleware já foi ensinado no 05 |
| `## O código`               | O middleware inteiro, comentado. É a peça central da pasta                                                                                                                                  |
| `## Como usar`              | Onde na pilha ele entra e **por que ali**. Se a posição errada muda o comportamento, mostre os dois resultados                                                                              |
| `## As decisões e o porquê` | Uma subseção por escolha não óbvia, cada uma com a alternativa descartada e **o que ela custaria**                                                                                          |
| `## Onde é fácil errar`     | Tabela sintoma → causa, incluindo o **falso amigo**: o que parece certo e está errado                                                                                                       |
| `## O que ele não faz`      | O limite honesto e **qual módulo resolve** o que falta                                                                                                                                      |
| `## Testado assim`          | Os `curl` que foram **de fato rodados**, com a resposta real ao lado                                                                                                                        |

> **Atenção:** `curl -d '{"json":1}'` com aspas simples não funciona no
> PowerShell nem no `cmd.exe`. Rode pelo Git Bash com `curl.exe`; se o README
> trouxer `curl` com corpo JSON, repita o aviso do módulo 01.

O `README.md` do **grupo** é curto: o que o grupo reúne, a tabela dos
middlewares com uma linha cada, e como subir a demo.

---

## 3. As quatro tarefas

### Tarefa 1 — `01-requisicao-e-resposta` · porta 6101

O que toda requisição ganha antes de chegar na rota, e o que a resposta leva de
volta.

**`tempo-de-resposta`** — carimba `X-Tempo-ms` na resposta.

- A armadilha é o ponto da pasta e **este repositório já pagou por ela**: em
  `res.on('finish')` os cabeçalhos **já foram enviados**, e `setHeader` ali
  estoura `ERR_HTTP_HEADERS_SENT`. O `finish` serve para _logar_, não para
  carimbar. O jeito que funciona envolve `res.writeHead`.
- Meça com `process.hrtime.bigint()` e diga por que não `Date.now()`: o relógio
  de parede pode andar para trás (ajuste de horário, NTP) e devolver duração
  negativa.
- O custo honesto: isso mede o tempo **do servidor**, não o que o usuário
  esperou. Rede e fila do cliente ficam de fora.

**`id-de-requisicao`** — dá a cada requisição um identificador e o devolve.

- O problema primeiro: com dez requisições ao mesmo tempo, as linhas de log se
  intercalam e não dá para saber quais pertencem à mesma. O id é a chave que
  costura.
- Aceita o `X-Request-Id` que já vier (é assim que o id atravessa vários
  serviços) e gera um com `crypto.randomUUID()` quando não vier.
- **Falso amigo:** confiar no id do cliente cru. Ele entra no log, e um valor com
  quebra de linha forja linhas inteiras de log. Valide o formato e limite o
  tamanho.
- Onde guardar o valor: mostre a escolha entre `res.locals` e um campo em `req`,
  e o que cada uma custa em tipagem.

**`log`** — uma linha por requisição, escrita à mão.

- Comece pela pergunta que decide: **por que não usar só o `morgan`?** Porque a
  linha do morgan é para humano ler no terminal; a hora que alguém precisa
  responder "o que aconteceu com a requisição `abc-123` ontem às 3h", a linha
  precisa ser um objeto com campos. Uma frase, e o link para o módulo 14 — não
  reexplique observabilidade.
- Registre método, rota, status, duração e o id da requisição, aproveitando os
  dois middlewares anteriores. Diga o que **nunca** entra na linha: corpo com
  senha, token, cabeçalho `Authorization`.

---

### Tarefa 2 — `02-validacao-e-erros` · porta 6102

O grupo que decide o que a API responde quando o pedido não presta.

**`validar`** — um middleware parametrizado por schema Zod.

- Um só middleware para `body`, `params` e `query` — não três cópias. É a fábrica
  do módulo 05 aplicada.
- Query string é **sempre texto**: sem `z.coerce`, `?limite=20` compara string
  com número em silêncio.
- Erro de formato responde **422** com a lista de campos que falharam.
- **Falso amigo, e ele tem dois lados:** `unrecognized_keys` do `.strict()`
  reprova a chave no **objeto**, não num campo, então o `path` do problema vem
  vazio e a lista sai com `(raiz)` no lugar do nome que o cliente precisa
  corrigir — as chaves estão em `problema.keys`. E as checagens de um schema
  **não param na primeira que falha**: um `.refine()` depois de um `.regex()`
  roda mesmo com a string já reprovada, então ele precisa aguentar entrada
  malformada sem lançar.

**`tratador-de-erros`** — o middleware final, com `AppError`.

- **O Express reconhece o tratador pela quantidade de argumentos.** São quatro,
  e apagar o `next` "que não é usado" desliga o tratamento de erro do projeto
  inteiro em silêncio. É o comentário mais importante do arquivo.
- Erro esperado (`AppError`, com status) × erro inesperado: o primeiro vira a
  resposta que ele descreve, o segundo vira 500 com mensagem genérica. **Stack
  trace nunca vai para o cliente** — diga o que ela entrega a quem lê.
- Formato único de resposta de erro, e por que ter um só importa para quem
  consome a API.

**`nao-encontrado`** — o 404 que fecha a pilha.

- Por que ele vem **depois de todas as rotas e antes do tratador de erro**, e o
  que acontece se inverter cada uma das duas.
- Por que ele existe: sem ele o Express responde um HTML de 404 numa API que só
  fala JSON, e o cliente quebra ao tentar interpretar.

**`assincrono`** — a pasta que existe para dizer "não escreva isto".

- No Express 4, uma rota `async` que rejeitava não chegava ao tratador: a
  requisição pendurava até o timeout. O wrapper `asyncHandler` existia para isso,
  e está em milhares de tutoriais.
- **No Express 5 o framework encaminha a promise rejeitada sozinho** — e este
  repositório usa Express 5. A pasta mostra o wrapper, mostra a rota `async` que
  lança **sem** wrapper nenhum, e prova com `curl` que as duas terminam no mesmo
  500 do tratador central.
- Feche com o que ainda **não** é automático, para o leitor não achar que virou
  imune: erro lançado dentro de um `setTimeout` ou de um `.on('error')` não tem
  como voltar para a requisição, porque a requisição já saiu daquela pilha.

---

### Tarefa 3 — `03-acesso-e-seguranca` · porta 6103

Quem é, o que pode, e quanto pode pedir.

**`autenticar`** — resolve o token e diz quem está falando.

- `Authorization: Bearer <token>`, com o prefixo e o espaço; o que responder
  quando o cabeçalho falta, quando o formato está errado e quando a assinatura
  não confere — os três são **401**.
- **`jwt.verify`, nunca `jwt.decode`.** O `decode` lê a carga **sem conferir a
  assinatura**: os dois devolvem o mesmo objeto quando o token é legítimo, então
  a troca passa no teste manual e aceita qualquer token forjado.
- `req.usuario` com **tipo declarado**, não `any` — mostre a declaração que
  estende o tipo do Express, porque é o pedaço que todo mundo copia errado.
- O segredo vem do ambiente, com um valor de desenvolvimento embutido para a
  demo rodar sem setup — e o comentário dizendo por que isso em produção é falha
  grave.

**`exigir-papel`** — a fábrica que autoriza.

- Autorizar é decisão **diferente** de autenticar, e separá-las é o que impede a
  regra de sumir dentro da rota. Este middleware assume que o outro já rodou, e o
  README diz o que acontece se a ordem for trocada.
- **Falha fechado**: sem papel reconhecido, nega. A lista é de quem **pode**,
  nunca de quem não pode — a lista negativa esquece o caso novo por omissão.
- **401 × 403**: um diz "não sei quem você é", o outro "sei, e não pode".

**`limitar`** — duas versões, lado a lado.

- Primeiro a **escrita à mão** com `Map`, para o mecanismo ficar visível: chave
  por cliente, contador, janela de tempo. Mostre o defeito que ela tem: na janela
  fixa, quem manda o limite no fim de uma janela e de novo no começo da seguinte
  passa o dobro num piscar.
- Depois a `express-rate-limit`, com o que ela resolve além disso (cabeçalhos
  `RateLimit-*`, janela deslizante, `429`).
- O limite honesto das duas: contador em memória **não sobrevive a dois
  processos** — cada um conta o seu, e o teto real vira o dobro. Aponte o módulo
  em que isso vira Redis.

**`cabecalhos-de-seguranca`** — `helmet`, sem cerimônia.

- Um por um, o que cada cabeçalho relevante evita, com o ataque em uma frase.
- E a parte que quase nenhum tutorial diz: numa API que só devolve JSON, **CSP e
  boa parte dos cabeçalhos de HTML não fazem quase nada** — eles protegem página,
  e aqui não há página. Diga quais realmente valem no caso JSON.

---

### Tarefa 4 — `04-desempenho-e-convencao` · porta 6104

Os que mudam o custo da resposta e os que padronizam o pedido.

**`cache-condicional`** — ETag e `304`.

- O mecanismo antes do código: o servidor manda uma etiqueta junto da resposta; o
  cliente devolve a etiqueta no `If-None-Match` da próxima vez; se nada mudou, a
  resposta é **`304 Not Modified` sem corpo nenhum**. O que economiza é o corpo,
  não a viagem.
- **Falso amigo:** o Express **já** gera ETag no `res.send` por padrão, e é uma
  etiqueta fraca calculada sobre o corpo já montado — ou seja, o trabalho de
  produzir a resposta aconteceu inteiro. Diga o que muda quando a etiqueta vem de
  um dado barato (uma data de atualização, uma versão).
- `Cache-Control` ao lado, porque etiqueta sem política de cache resolve metade.

**`timeout`** — desiste de esperar.

- A verdade que a maioria dos exemplos esconde: **você não mata o handler**. Ele
  continua rodando, continua ocupando conexão de banco, continua chegando ao fim
  — você só para de responder. O middleware protege **o cliente** da espera, não
  o servidor da carga.
- Daí sai a armadilha concreta: quando o handler lento finalmente responde,
  `res.send` acontece numa resposta já encerrada. Mostre a checagem que evita o
  `ERR_HTTP_HEADERS_SENT`.
- O status é **503** ou **504**, e o README diz qual escolheu e por quê.

**`paginacao`** — lê `?pagina=&limite=` uma vez só.

- O problema: cada rota que lista reimplementa o mesmo parse, com padrões
  ligeiramente diferentes, e a API fica com três comportamentos para a mesma
  query.
- **Todo número tem um porquê**: padrão 20 e teto 100 entram com a frase que
  explica a escolha — sem teto, `?limite=1000000` é um pedido de derrubada.
- Deixe pronto em `req` o que a rota precisa (`pagina`, `limite`, `offset`), e
  diga por que o `offset` é calculado aqui e não na rota.
- O limite honesto: paginação por `offset` fica cara em página alta e pode
  repetir ou pular item quando o dado muda entre uma página e outra. Cite o nome
  da alternativa (cursor) em uma linha, sem virar aula.

---

## 4. Como despachar

Os quatro grupos são independentes — nenhum importa arquivo de outro grupo.
Despache **em paralelo**, um agente por grupo, depois do Passo 0 (o
`tsconfig.middlewares.json` e o script `typecheck:mw`, já feitos).

Antes de encerrar, cada agente:

1. `npx tsc --noEmit -p tsconfig.middlewares.json` → limpo
2. sobe `node middlewares/NN-grupo/servidor.ts` e exercita **cada** middleware
   do grupo com `curl`, incluindo o caso de erro e o falso amigo quando ele for
   demonstrável
3. `npx prettier --check middlewares/NN-grupo` → limpo
4. derruba o servidor

### Critérios de aceite

- [ ] `npx tsc --noEmit -p tsconfig.middlewares.json` passa
- [ ] `npx prettier --check middlewares/` limpo
- [ ] A demo sobe na porta certa e cada middleware do grupo foi exercitado com
      `curl` — efeito visível e caso de erro
- [ ] Nenhuma dependência nova
- [ ] Nenhum arquivo tocado fora da pasta do próprio grupo
- [ ] Nenhum `middleware.ts` importa de outra pasta de middleware
- [ ] Nenhum README reexplica o que o módulo 05 já ensina
- [ ] Cada README tem o falso amigo, a alternativa descartada com o custo, e os
      `curl` que foram de fato rodados com a resposta real
