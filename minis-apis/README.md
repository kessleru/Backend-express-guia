# minis-apis

Um repertório de **APIs pequenas e reais**, cada uma resolvendo um problema que
existe no mundo: encurtar um link, inscrever gente num evento, saber para onde
foi o dinheiro do mês, decidir uma coisa por votação, reservar a sala, dividir a
lista de compras, não quebrar a sequência.

## Por que esta pasta existe

Os `docs/` e os `exercicios/` usam um domínio fixo — uma biblioteca, com livros,
autores e empréstimos. Isso é proposital: um domínio só, repetido do módulo 01 ao
20, deixa o assunto de cada módulo aparecer sem competir com um contexto novo.

O preço é conhecido. Quem estuda vinte módulos no mesmo domínio corre o risco de
aprender **a biblioteca**, não o conceito — de saber que `409` é o status do
livro já emprestado sem saber que `409` é o status de qualquer conflito de
estado. O conceito parece colado no exemplo.

Esta pasta é o contraveneno. Mesmos módulos, domínios completamente diferentes.
Quando o `409` reaparece em "esse e-mail já se inscreveu", em "já existe uma
categoria com esse nome" e em "a sala já está ocupada nesse horário", fica claro
o que era do conceito e o que era do empréstimo de livro.

Cada mini API é **lida sozinha**, sem o `docs/` do lado. Por isso o `README.md`
de cada uma começa explicando **o mecanismo da coisa** — o que é um encurtador,
como um formulário chega ao servidor, como dinheiro é guardado, o que uma agenda
realmente guarda — antes de qualquer linha de código.

## As sete

| #   | Mini API                            | Domínio                               | Módulos         | Porta | Persistência    |
| --- | ----------------------------------- | ------------------------------------- | --------------- | ----- | --------------- |
| 1   | [`01-encurtador`](./01-encurtador/) | Encurtador de links                   | 03–05           | 6001  | memória (`Map`) |
| 2   | [`02-inscricoes`](./02-inscricoes/) | Inscrição em evento com vaga limitada | 03–07           | 6002  | memória         |
| 3   | [`03-despesas`](./03-despesas/)     | Controle de gastos pessoais           | 03–09           | 6003  | SQLite          |
| 4   | [`04-enquetes`](./04-enquetes/)     | Enquete com apuração                  | 03–09, sem o 07 | 6004  | SQLite          |
| 5   | [`05-reservas`](./05-reservas/)     | Reserva de sala por horário           | 03–07           | 6005  | memória         |
| 6   | [`06-compras`](./06-compras/)       | Lista de compras compartilhada        | 03–11           | 6006  | Prisma          |
| 7   | [`07-habitos`](./07-habitos/)       | Rastreador de hábitos privado         | 03–11           | 6007  | SQLite          |

O que cada uma ensina:

| #   | O que esta aqui ensina                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Que a **ordem de registro das rotas decide o comportamento**, e que um status HTTP é uma decisão com custo: `302` mantém o contador de cliques vivo, `301` o congela                                           |
| 2   | Que **formato e estado são recusas diferentes** — `422` para o dado malformado, `409` para o dado perfeito que o mundo não aceita — e que validar é trabalho do servidor, não da tela                          |
| 3   | Que **a pergunta é respondida pelo banco**: dinheiro em centavos inteiros, relação 1-N com chave estrangeira, e o total do mês saindo de um `GROUP BY` em vez de um laço em JavaScript                         |
| 4   | Que **um registro é uma linha, não um contador** — voto por linha é o que permite votar uma vez, trocar de voto e recontar. E, ao validar à mão de propósito, mostra o mecanismo que o Zod automatiza          |
| 5   | Que **regra que envolve dois campos não cabe no campo**: `fim > inicio` é do par, o intervalo é semiaberto para duas reuniões poderem se encostar, e o `PATCH` só decide depois de juntar o novo com o gravado |
| 6   | Que **negar acesso e negar permissão são coisas diferentes**: quem não é membro recebe `404` porque `403` confirmaria que a lista existe; quem já enxerga a lista e não é dono recebe `403`                    |
| 7   | Que **privado é diferente de proibido**, que `PUT` existe para o segundo clique dar no mesmo lugar, e que somar o mês é pergunta de banco enquanto contar dias seguidos, honestamente, não é                   |

## Leia nesta ordem

Não é ordem de dificuldade, é **ordem de dor**. Cada uma termina com um problema
que a seguinte resolve.

A **1** valida com `if` na mão. São quatro condições para dois campos, o
`req.body` chega como `any`, e a mensagem de erro é escrita à mão em cada ramo.
Funciona — e cresce mal. Essa é a dor.

A **2** resolve exatamente essa dor: um schema declara a forma esperada, um único
middleware aplica o schema a `body`, `params` ou `query`, e a mensagem de erro
sai pronta com a lista de campos que falharam. Em troca, aparece uma dor nova: os
dados vivem num array em memória e somem quando o processo reinicia. Uma lista de
inscritos que desaparece não é uma lista de inscritos.

A **3** resolve essa: o dado vai para um banco em disco, criado por uma migration
versionada, e o relatório mensal passa a ser uma pergunta feita ao banco.

A **4** volta de propósito ao validador escrito à mão, agora com banco. Parece um
passo atrás e é o contrário: depois de ver o Zod funcionando, escrever a
validação por baixo é o que impede ele de virar mágica — e é ali que aparecem os
detalhes que a biblioteca escondia, como `Number('')` ser `0` em vez de `NaN`.

A **5** fecha o teto do módulo 07 com o caso que o schema simples não resolve: a
regra que só existe entre dois campos, e o `PATCH` que precisa do valor já
gravado para decidir. É a última sem login.

A **6** e a **7** sobem ao módulo 11: cadastro, senha guardada como prova
derivada, e requisição que chega provando quem é. Elas são **um par** — mesmo
teto de módulos, camadas de dados opostas. A 6 usa Prisma, a 7 escreve o SQL na
mão; a 6 divide o dado entre dono e convidado, a 7 não divide com ninguém. Ler as
duas é o jeito de separar o que era do ORM do que era do problema.

Ler fora de ordem funciona — cada README se sustenta sozinho. Mas quem lê a 2
antes da 1 vê o Zod como "o jeito de validar" em vez de como **a resposta a um
problema concreto**, e é o problema que ensina a escolher.

## Rodar qualquer uma

```bash
node minis-apis/01-encurtador/servidor.ts   # porta 6001
node minis-apis/02-inscricoes/servidor.ts   # porta 6002
node minis-apis/03-despesas/servidor.ts     # porta 6003
node minis-apis/04-enquetes/servidor.ts     # porta 6004
node minis-apis/05-reservas/servidor.ts     # porta 6005
node minis-apis/07-habitos/servidor.ts      # porta 6007
```

Sem passo de instalação, sem build, sem variável de ambiente. As de SQLite criam
e populam o banco sozinhas na primeira execução, em `data/minis-NN-nome.sqlite`.

A **6 é a exceção**, e por um motivo que vale saber: o Prisma gera o código do
client a partir do schema, e esse código não vai para o git. Antes do primeiro
`node`, ela precisa de dois comandos — um para criar as tabelas, outro para gerar
o client:

```bash
npx prisma migrate deploy --config minis-apis/06-compras/prisma.config.ts
npx prisma generate --config minis-apis/06-compras/prisma.config.ts
node minis-apis/06-compras/servidor.ts      # porta 6006
```

> **Atenção:** `curl -d '{"json":1}'` com aspas simples não funciona no
> PowerShell nem no `cmd.exe`. Use o Git Bash com `curl.exe`, ou troque as aspas
> conforme o aviso do módulo 01.

## Checar os tipos

```bash
npm run typecheck:minis
```

Esta pasta fica fora de `src/`, então o `npm run typecheck` não a enxerga. A
configuração está em `tsconfig.minis.json`, na raiz.

## Os tetos, e por que eles existem

As minis são divididas em levas, e cada leva declara onde para:

- **Leva 1 (1 a 4)** — teto no módulo **09**. Sem autenticação, sem ORM, sem
  teste automatizado, sem log estruturado.
- **Leva 2 (5 a 7)** — a 5 fica no **07**; a 6 e a 7 vão até o **11**, que é onde
  entra login de verdade.

O teto não é limitação, é o método: uma mini API que usa tudo não mostra nada.
Cada `README.md` tem uma seção `## O que ficou de fora` dizendo o que falta e
**qual módulo resolve**.

Ainda não apareceu em mini nenhuma: teste automatizado (12), rate limit e
cabeçalhos de segurança (13), log estruturado (14), cache (15) e upload (19). O
briefing de quem constrói as próximas está em
[`ORQUESTRACAO.md`](./ORQUESTRACAO.md).
