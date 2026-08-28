# Mini API — Rastreador de hábitos

📦 Módulos 03–11 · 🔌 porta 6007 · 💾 SQLite

## O problema

Quem decide "vou correr todo dia" descobre em duas semanas que não faz ideia de
como está indo. A memória guarda a última vez e o sentimento geral — "acho que
estou indo bem" —, e o sentimento geral é justamente o que some no dia em que a
pessoa falha três vezes seguidas e não percebe.

O que resolve é ridiculamente simples: marcar o dia em que cumpriu, e conseguir
olhar o mês depois. A partir daí a API precisa de três coisas — saber **de quem**
é cada hábito, aceitar a marcação de um dia **sem duplicar** quando a pessoa
toca no botão duas vezes, e responder "como foi agosto" com números que ela
possa conferir.

---

## Como funciona

Esta seção descreve o mecanismo. Não há nome de biblioteca aqui de propósito:
acompanhar um hábito é um problema que existe antes de qualquer ferramenta.

### O que se guarda é um dia, não um número

O jeito ingênuo é guardar um contador por hábito e somar 1 a cada vez. Ele
responde "quantos dias" e nada mais: não dá para saber **quais** dias, não dá
para desmarcar um dia errado, não dá para contar dias seguidos. O que se guarda
aqui é **um registro por dia cumprido** — a mesma escolha que a
[mini 4](../04-enquetes/README.md) fez para votos, aplicada a outro domínio, e
pelo mesmo motivo: contar vira consequência do registro, e não o contrário.

Um registro tem só duas informações: qual hábito e qual dia. Com elas, "quantos
dias em agosto" é contar registros de agosto, "desmarcar" é apagar um registro, e
"dias seguidos" é olhar se os dias registrados são vizinhos no calendário.

### Dia não é instante

Um instante é um ponto na linha do tempo, igual para o mundo inteiro. **Dia
não.** À meia-noite e meia em São Paulo, em Lisboa já é o dia seguinte — as duas
pessoas estão no mesmo instante e em dias diferentes. "Marquei hoje" só significa
alguma coisa depois de dizer _hoje de quem_.

Por isso o que trafega é a data escrita por extenso, `2026-08-19`, e **quem
decide que dia é hoje é o cliente** — o aplicativo, que roda no relógio e no fuso
da pessoa. O servidor recebe uma data pronta e não a discute.

O custo dessa escolha é declarado, não escondido: como o servidor não sabe que
dia é hoje para quem pediu, ele não tem como recusar uma data de amanhã ou do mês
que vem. Quem quiser marcar dezembro inteiro em agosto, marca. Um rastreador de
hábitos é uma ferramenta para a própria pessoa; trapacear nele é trapacear
sozinho. Numa API em que a marcação valesse dinheiro ou prêmio, a decisão seria
outra — e viria com o fuso da pessoa guardado no cadastro.

### Idempotência: apertar o botão duas vezes

**Idempotente** é o pedido que, repetido, termina no mesmo lugar em que a
primeira vez terminou. Apagar um arquivo é idempotente (depois da segunda vez ele
continua apagado); somar 1 a um contador não é.

Isso não é filosofia: a rede erra. A pessoa toca em "marquei", o celular perde o
sinal antes de a resposta chegar, e o aplicativo — que não sabe se o pedido
chegou — tenta de novo. Se o segundo pedido criasse um segundo registro, o hábito
apareceria cumprido duas vezes no mesmo dia.

Existem duas formas de pedir a marcação, e elas dizem coisas diferentes:

- **"Acrescente uma marcação"** — cada pedido é um acréscimo, e dois pedidos são
  dois acréscimos. Para se defender da repetição, o servidor precisa de uma regra
  extra e de um erro para devolver na segunda vez.
- **"Faça com que este dia esteja marcado"** — o pedido descreve um **estado
  desejado**, não uma ação. Repetir é pedir a mesma coisa de novo, e a resposta
  certa para "já está assim" é _pronto, está assim_ — não um erro.

Esta API usa a segunda forma, e é por isso que a marcação vai em `PUT` (o método
que diz "deixe o recurso neste estado") e não em `POST` (o que diz "acrescente").
A repetição não é tolerada: ela é o comportamento normal.

```mermaid
sequenceDiagram
    autonumber
    participant App as Aplicativo
    participant API
    participant Reg as Registros
    App->>API: que 19/08 esteja marcado
    API->>Reg: grava (Correr, 19/08)
    API-->>App: marcado ✔
    Note over App,API: a resposta se perde na rede
    App->>API: que 19/08 esteja marcado (de novo)
    API->>Reg: grava (Correr, 19/08)
    Reg-->>API: já existe esse par
    API-->>App: marcado ✔ (mesma resposta)
```

### A regra "um por dia" mora no lugar onde se grava

A tentação é conferir antes: _procuro se já existe registro para este dia; se não
existir, gravo_. Funciona quase sempre, e falha exatamente no caso que a
idempotência existe para cobrir — dois pedidos chegando juntos. Os dois procuram,
os dois não encontram nada, os dois gravam.

A saída é não perguntar: declarar, no próprio lugar onde os dados moram, que o
par (hábito, dia) **não pode se repetir**, e simplesmente mandar gravar. Quem
grava é quem decide, e ele decide sobre um pedido de cada vez. Quando a segunda
gravação bate na regra, o servidor não tem um problema — tem a confirmação de que
o estado pedido já vale.

O princípio, em frase comum: **quem confere não é quem grava, e só quem grava
consegue garantir.**

### Quem está pedindo

Um hábito é de alguém, então toda pergunta feita à API é na verdade duas: _o que
você quer_ e _quem é você_. A segunda tem duas partes.

Na primeira, a pessoa prova quem é uma vez, mandando e-mail e senha. O servidor
**não guarda a senha** — guarda uma prova derivada dela, um valor calculado a
partir da senha do qual não se volta; conferir é refazer a conta e comparar os
resultados. A partir daí ele devolve um **crachá assinado**: um texto que diz "o
portador é o usuário 1", com uma marca que só o servidor sabe produzir e que
qualquer um pode conferir. O detalhe do cálculo e da assinatura é o assunto do
[módulo 11](../../docs/11-15/11-autenticacao.md) e da mini 6 (`minis-apis/06-compras/`).

Na segunda parte, o crachá volta **em toda requisição seguinte**. Isso soa
estranho até se ver o motivo: cada pedido feito à API chega sem passado nenhum,
sem lembrança do pedido anterior. "Continuar logado" não é o servidor lembrar de
você — é o cliente reapresentar a prova toda vez.

### Privado é diferente de proibido

Aqui não existe compartilhamento: ninguém convida ninguém para um hábito. Isso
muda a resposta para "pedi o hábito de outra pessoa".

A resposta é **não existe**. Não é "existe, mas você não pode" — porque essa
segunda frase é uma informação, e é uma que quem perguntou não tinha direito de
receber. Alguém varrendo números descobriria, pela diferença entre as duas
respostas, exatamente quais hábitos existem na base e quantos. Do ponto de vista
de quem pergunta, o que não é seu simplesmente não está lá.

A mini 6 responde "você não pode" em alguns casos, e não é contradição: lá as
listas são compartilhadas, então quem já enxerga uma lista **já sabe que ela
existe**. Negar só a permissão não conta nada de novo. A régua é essa — esconder
a existência só faz sentido enquanto ela ainda é segredo.

### O que se pergunta aos dados, e o que se calcula depois

O resumo do mês tem dois tipos de pergunta dentro dele.

"Quantos dias marquei em agosto" é uma pergunta de **agrupar e contar**: os dados
já estão organizados por hábito e por dia, e quem os guarda responde isso sem
esforço, devolvendo um número. É o que a
[mini 3](../03-despesas/README.md) mostra no relatório mensal.

"Quantos dias **seguidos**" é outra coisa. Ela não depende de cada registro
isolado, e sim da **relação entre um registro e o anterior** — 17, 18 e 19 são
três seguidos; 17, 18 e 20 são dois e um. Perguntas sobre ordem entre linhas
existem na linguagem dos bancos, mas custam bastante sintaxe para uma resposta
que cabe numa passada de laço.

A régua que decide não é "no banco" contra "no programa", e sim **o tamanho do
que se traz**. Um mês tem no máximo 31 dias: trazer os dias e contar a sequência
custa nada. O relatório da mini 3 vai para o outro lado pelo mesmo critério — lá
seriam 50 mil lançamentos viajando para produzir cinco somas. Some onde estão os
dados quando o que se descartaria é grande; traga quando o que se traz é pequeno.

---

## Rodar

```bash
node minis-apis/07-habitos/servidor.ts
```

Primeira execução — o banco não existe e a API o cria:

```text
Abrindo banco...
  migration aplicada: 001_usuarios_habitos_marcacoes
Hábitos em http://localhost:6007
Rotas: POST /usuarios  POST /sessoes  /habitos (exige token)
```

Da segunda em diante a linha da migration some: ela já está registrada, e os
dados continuam lá.

Não há dado inicial (_seed_): sem conta criada não existe hábito possível, e a
primeira coisa a fazer é o `POST /usuarios` da seção **Testando**.

O arquivo do banco fica em `data/minis-07-habitos.sqlite`, que o `.gitignore` já
ignora. Apagar esse arquivo é o "reset de fábrica" desta API.

> **Atenção:** o Node imprime um `ExperimentalWarning` sobre SQLite na subida. É
> esperado — `node:sqlite` ainda está marcado como experimental no Node 24.

---

## Como ela foi construída

### 1. As três tabelas, e o índice que é a regra

A modelagem saiu direto do mecanismo: uma conta tem muitos hábitos, um hábito tem
muitas marcações, e uma marcação é o par (hábito, dia).

```mermaid
erDiagram
    USUARIOS ||--o{ HABITOS : "tem"
    HABITOS  ||--o{ MARCACOES : "acumula"
    USUARIOS {
        int id PK
        text email UK "único, ignorando maiúsculas"
        text senha_hash "a prova derivada, nunca a senha"
    }
    HABITOS {
        int id PK
        int usuario_id FK "o dono"
        text nome "único por dono"
    }
    MARCACOES {
        int id PK
        int habito_id FK
        text dia "YYYY-MM-DD, único junto com habito_id"
    }
```

A linha mais importante do schema não é uma tabela, é um índice:

```sql
CREATE UNIQUE INDEX idx_marcacoes_habito_dia ON marcacoes(habito_id, dia);
```

É ele que faz a regra "um registro por dia" ser garantia em vez de intenção. E
ele veio de graça com um segundo emprego: como está ordenado por `(habito_id,
dia)`, é exatamente o atalho de que a consulta do resumo precisa — por isso, ao
contrário da mini 3, aqui não existe nenhum índice criado só para consultar.

O outro índice único é o do par `(usuario_id, nome)`. Prender a unicidade só ao
`nome` faria o "Correr" de uma pessoa impedir o de todas as outras — e o conflito
devolvido contaria que aquele nome já existe na base.

### 2. O dono dentro da consulta, não num `if` depois dela

O primeiro rascunho era o óbvio: buscar o hábito pelo id e, no serviço, conferir
se o `usuario_id` bate. Funciona. O problema é que essa proteção depende de
alguém **lembrar** de escrevê-la, e a rota que vai ser escrita daqui a três meses
é justamente a que vai esquecer.

Então o filtro desceu para dentro de cada consulta, e a assinatura do repositório
passou a exigir o dono:

```ts
buscarHabito(usuarioId: number, habitoId: number): Promise<Habito | null>;
```

Não existe caminho que leia a tabela de hábitos sem passar por `WHERE usuario_id
= ?`. Um `if` esquecido não acusa nada; um argumento faltando não compila.

### 3. O `PUT` que virou uma instrução só

A marcação começou com dois comandos — confirmar que o hábito é meu, depois
gravar. Entre os dois havia uma fresta: se o hábito fosse apagado nesse intervalo,
a gravação estouraria um erro de chave estrangeira, e o cliente levaria 500 por
uma situação perfeitamente normal.

Os dois viraram um:

```sql
INSERT INTO marcacoes (habito_id, dia)
SELECT id, ? FROM habitos WHERE id = ? AND usuario_id = ?
```

A linha só nasce se a busca encontrar um hábito com aquele id **e** daquele dono.
Quando não encontra, nada é gravado e o número de linhas afetadas é zero — que é
a informação de que o serviço precisa para responder 404, sem consulta extra.

E quando o dia já estava marcado, o índice único recusa a gravação. Essa recusa
**não vira erro para o cliente**:

```ts
// o par (habito_id, dia) já existe: o estado pedido já é o estado atual
if (ehViolacaoDeUnicidade(erro)) return true;
throw erro;
```

É o trecho em que idempotência deixa de ser palavra. Repare que o mesmo erro do
banco recebe a decisão **oposta** duas funções acima, na criação de hábito: lá o
nome repetido é um conflito de verdade, porque a segunda tentativa não terminaria
no estado que pediu.

### 4. As camadas, e o resumo dividido entre elas

```text
rotas.ts  →  servico.ts  →  repositorio.ts  →  SQLite
   HTTP        regras          o SQL
```

Cada camada coube num arquivo, então nenhuma virou pasta — uma pasta com um
arquivo dentro custa um clique e não separa nada. A pasta inteira:

```text
07-habitos/
├── servidor.ts      ← monta as peças e é o único que chama listen()
├── rotas.ts         ← a borda HTTP
├── servico.ts       ← as regras, inclusive a contagem de dias seguidos
├── repositorio.ts   ← o único arquivo com SQL
├── autenticacao.ts  ← senha, token e o middleware que resolve quem pediu
├── schemas.ts       ← o que o cliente pode mandar
├── dominio.ts       ← os tipos e o contrato do repositório
├── erros.ts         ← AppError e o tratador central
└── db.ts            ← conexão e migration
```

O resumo é onde essa divisão fica visível. O repositório traz os dias do mês —
uma consulta, no máximo 31 linhas. O serviço percorre esses dias uma vez e produz
o que depende da ordem entre eles:

```ts
corrente = anterior !== null && numero === anterior + 1 ? corrente + 1 : 1;
if (corrente > maior) maior = corrente;
```

A contagem que **não** depende de ordem ficou do outro lado. Na listagem de
hábitos, o total de marcações de cada um sai agrupado no banco, com `GROUP BY` —
trazer todas as marcações de todos os hábitos para contar aqui seria pagar o
transporte de dados que iriam virar dois números.

### 5. Autenticar por prefixo

O último passo foi decidir onde o token é exigido. Rota a rota é o jeito comum e
tem um defeito conhecido: a rota nova nasce pública por esquecimento, e nada
acusa — o teste passa, a resposta vem, e ela vem para qualquer um.

```ts
router.use('/habitos', autenticar);
```

O padrão de tudo que fica sob `/habitos` passou a ser "protegido", e abrir uma
exceção exige escrevê-la. As duas rotas públicas — cadastro e login — estão
registradas antes dessa linha, onde a exceção é visível.

---

## Endpoints

Tudo abaixo de `/habitos` exige o cabeçalho
`Authorization: Bearer <token>`; sem ele, ou com um token que não confere, a
resposta é **401**.

| Método   | Rota                          | O que faz                                      | Status             |
| -------- | ----------------------------- | ---------------------------------------------- | ------------------ |
| `POST`   | `/usuarios`                   | cadastro — `{ email, senha }`                  | 201, 409, 422      |
| `POST`   | `/sessoes`                    | login — devolve o token                        | 200, 401, 422      |
| `GET`    | `/habitos`                    | os meus, com o total de dias de cada um        | 200, 401           |
| `POST`   | `/habitos`                    | cria — `{ nome }`                              | 201, 401, 409, 422 |
| `DELETE` | `/habitos/:id`                | apaga o hábito e as marcações dele             | 204, 401, 404, 422 |
| `PUT`    | `/habitos/:id/marcacoes/:dia` | marca o dia — **idempotente**                  | 200, 401, 404, 422 |
| `DELETE` | `/habitos/:id/marcacoes/:dia` | desmarca — idempotente também                  | 204, 401, 404, 422 |
| `GET`    | `/habitos/:id/resumo`         | `?mes=2026-08` → dias, percentual e sequências | 200, 401, 404, 422 |

Hábito de outra pessoa responde **404**, nunca 403. Rota inexistente responde 404
no mesmo formato de erro das demais.

O corpo do resumo:

```json
{
  "habito": { "id": 1, "nome": "Correr", "criadoEm": "2026-08-19 23:33:10" },
  "mes": "2026-08",
  "diasNoMes": 31,
  "diasCumpridos": 7,
  "percentual": 22.6,
  "dias": ["2026-08-03", "..."],
  "maiorSequencia": 5,
  "sequenciaAtual": 5,
  "ultimoDia": "2026-08-19"
}
```

`maiorSequencia` é a maior fileira de dias vizinhos do mês; `sequenciaAtual` é a
fileira que termina em `ultimoDia`, o último dia marcado. As duas param na
fronteira do mês: uma sequência que começou em julho é contada a partir do dia 1º
de agosto.

---

## As decisões e o porquê

### `PUT` na marcação; `POST` foi descartado

**Alternativa descartada:** `POST /habitos/:id/marcacoes` com o dia no corpo.
Custaria uma resposta de erro para o caso mais comum que existe — o segundo
toque, o retry depois da conexão cair, a sincronização do aplicativo que ficou
offline. O cliente teria que aprender que "409" ali significa "deu certo antes", e
todo cliente novo erraria isso uma vez.

O `PUT` também deixa a rota carregar o dia (`/marcacoes/2026-08-19`), o que torna
o endereço da marcação um endereço de verdade: o mesmo caminho serve para marcar,
desmarcar e — se um dia fizer falta — consultar.

### A violação de unicidade vira sucesso no `PUT`

**Alternativa descartada:** `INSERT OR IGNORE`, que faz o banco engolir a
gravação repetida sem erro nenhum e é uma linha mais curto. Ficou de fora porque
ele ignora **toda** violação, não só a de unicidade: se um dia o `habito_id`
apontasse para um hábito inexistente, o comando não gravaria nada e não diria
nada — e o 404 viraria 200 silencioso. Tratar o código do erro é mais verboso e
recusa exatamente uma coisa.

### Sempre 404, nunca 403

**Alternativa descartada:** 403 para "existe, mas não é seu". Custaria a
privacidade que é o ponto da API: quem varre `/habitos/1`, `/habitos/2`,
`/habitos/3` anota quais responderam 403 e sabe quantos hábitos existem e com
quais ids — sem ter acesso a nenhum. Numa API onde os recursos são compartilhados
(a mini 6), o 403 é a resposta certa, porque quem pergunta já sabia da existência.

### O e-mail repetido é 409; o hábito de nome repetido também, mas por conta

**Alternativa descartada:** 422 para os dois. Ficou de fora porque nada no corpo
está malformado — `"Correr"` é um nome perfeitamente válido. O que recusa é o
estado atual dos dados, e essa diferença é a que permite ao cliente reagir sem
ler a mensagem: 422 pede para corrigir o campo, 409 pede para escolher outro.

A unicidade do hábito é por dono, então duas pessoas podem ter "Correr". A
alternativa — nome único na base inteira — além de absurda no domínio, faria o
409 revelar hábitos alheios.

### O token vale 2 horas

**Alternativa descartada:** os 15 minutos do módulo 11. Lá o prazo curto é seguro
porque existe um segundo token, de renovação, que devolve um novo sem a pessoa
digitar nada. Esta mini não tem esse segundo token — 15 minutos significariam
login de novo no meio da tarde.

O custo está declarado: um token roubado vale por até 2 horas e **não há como
cancelá-lo**. A assinatura é conferida sozinha, sem consultar lugar nenhum onde
riscar o nome dele — e é justamente por não consultar nada que ela é barata.

### O segredo do token vem do ambiente, com um valor embutido

**Alternativa descartada:** exigir `JWT_SECRET` e recusar subir sem ele, que é o
certo em produção. Aqui custaria o "roda sem setup" que vale para todas as minis.
O valor embutido não é um segredo fraco, é um segredo **publicado**: quem lê este
repositório assina um token com o id que quiser. Em produção isso é acesso total
sem senha, e por isso o comentário no código diz para falhar ao subir.

### Desmarcar responde 204 mesmo quando o dia não estava marcado

**Alternativa descartada:** 404 para "esse dia não estava marcado". Custaria a
simetria com o `PUT`: se marcar duas vezes termina igual, desmarcar duas vezes
também tem que terminar igual. O 404 continua existindo para o hábito — que é
outra pergunta, e por isso o serviço confere o hábito antes de apagar em vez de
olhar só quantas linhas sumiram.

### O total de marcações sai da listagem, e a sequência não

**Alternativa descartada:** trazer todas as marcações e contar tudo em
JavaScript, inclusive o total por hábito. Custaria transporte: são todas as
linhas de todos os hábitos, viajando para virar um número por hábito.

**Alternativa descartada do outro lado:** calcular a sequência no banco, com
função de janela. Ficou de fora porque a entrada são no máximo 31 datas — o
critério é o tamanho do que se traz, e 31 linhas não pagam a complexidade.

---

## Onde é fácil errar

| Sintoma                                                                     | Causa                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{"erro":"Envie o token em ...","status":401}` numa rota que existe         | o cabeçalho tem que ser `Authorization: Bearer <token>`, com o `Bearer` e um espaço. Mandar só o token cai no mesmo 401                                                                                                                                                                                                 |
| `{"erro":"Hábito 1 não existe","status":404}` num hábito que você criou     | o token é de outra conta. Do ponto de vista de quem pergunta, o que não é seu não existe — e é essa a resposta, não 403                                                                                                                                                                                                 |
| Apagar o hábito deixou marcações órfãs no banco                             | faltou `PRAGMA foreign_keys = ON` **nesta conexão**. Sem ele o `ON DELETE CASCADE` é decoração (a mini 3 detalha o PRAGMA)                                                                                                                                                                                              |
| `?mes=2026-8` devolve 422                                                   | o mês tem dois dígitos sempre; `YYYY-MM` é o formato, e é o que faz a comparação de texto coincidir com a ordem do calendário                                                                                                                                                                                           |
| `2026-02-31` devolve 422 mesmo parecendo uma data                           | a expressão de formato aceita, o calendário não. A conferência é o ida-e-volta pelo `Date` (mini 3)                                                                                                                                                                                                                     |
| **Zod 4:** um `dia` malformado devolvendo **500** em vez de 422             | as checagens de um mesmo schema não param na primeira que falha. Com `19-08-2026` a expressão de formato reprova e o `refine` do calendário roda assim mesmo; `toISOString()` sobre um `Invalid Date` **lança** em vez de devolver falso, e a exceção vira 500. O `refine` precisa conferir a data antes de convertê-la |
| **Falso amigo:** o segundo `PUT` no mesmo dia devolvendo 409                | é o erro que esta mini existe para não cometer. O par já gravado significa que o estado pedido já vale — a resposta é a mesma da primeira vez                                                                                                                                                                           |
| **Falso amigo:** `decode` no lugar de `verify` para ler o id do token       | o `decode` lê a carga **sem conferir a assinatura**. Os dois devolvem o mesmo objeto quando o token é legítimo, então a troca passa no teste manual — e aceita qualquer token forjado                                                                                                                                   |
| **Falso amigo:** conferir o dono num `if` depois de buscar o hábito pelo id | funciona hoje e falha na rota que alguém acrescentar sem lembrar do `if`. Na consulta, o filtro não tem como ser esquecido                                                                                                                                                                                              |
| **Falso amigo:** conferir "já marcou?" antes de gravar                      | entre a conferência e a gravação cabe outra requisição. Quem garante é a restrição de unicidade, que decide na escrita                                                                                                                                                                                                  |
| Marcou um dia que ainda não chegou e a API aceitou                          | é o comportamento: o servidor não sabe que dia é hoje no fuso de quem pediu. O custo está declarado em **Como funciona**                                                                                                                                                                                                |

---

## Testando

Todos os `curl` abaixo foram rodados em sequência contra um banco criado do zero,
e a resposta ao lado é a que voltou. O `[201]` ao fim de cada linha é o status.

> **Atenção:** `curl -d '{"json":1}'` com **aspas simples** não funciona em
> `cmd.exe` nem no PowerShell — o `curl` do PowerShell é apelido de
> `Invoke-WebRequest`, que nem entende `-d`. No Windows, rode estes comandos no
> Git Bash usando `curl.exe`.

**Cadastro, e o mesmo e-mail em outra caixa (409):**

```bash
curl.exe -s -X POST localhost:6007/usuarios \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@exemplo.com","senha":"cafedamanha"}'
# {"id":1,"email":"ana@exemplo.com","criadoEm":"2026-08-19 23:33:10"}      [201]

curl.exe -s -X POST localhost:6007/usuarios \
  -H "Content-Type: application/json" \
  -d '{"email":"ANA@exemplo.com","senha":"outrasenha1"}'
# {"erro":"Já existe uma conta com esse e-mail","status":409}              [409]
```

A senha não volta em resposta nenhuma, e o hash dela também não.

**Campos inválidos e campo desconhecido, na mesma resposta (422):**

```bash
curl.exe -s -X POST localhost:6007/usuarios \
  -H "Content-Type: application/json" \
  -d '{"email":"ana","senha":"123","apelido":"aninha"}'
```

```json
{
  "erro": "Dados inválidos",
  "status": 422,
  "detalhes": [
    { "campo": "email", "mensagem": "`email` precisa ser um e-mail válido" },
    { "campo": "senha", "mensagem": "`senha` precisa de 8+ caracteres" },
    { "campo": "(raiz)", "mensagem": "Unrecognized key: \"apelido\"" }
  ]
}
```

**Senha errada e e-mail inexistente dão a mesma resposta (401):**

```bash
curl.exe -s -X POST localhost:6007/sessoes \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@exemplo.com","senha":"cafedatarde"}'
# {"erro":"E-mail ou senha inválidos","status":401}                        [401]

curl.exe -s -X POST localhost:6007/sessoes \
  -H "Content-Type: application/json" \
  -d '{"email":"ninguem@exemplo.com","senha":"cafedamanha"}'
# {"erro":"E-mail ou senha inválidos","status":401}                        [401]
```

Duas mensagens diferentes transformariam este endereço num consultor de "essa
pessoa tem conta aqui?".

**Login (200):**

```bash
curl.exe -s -X POST localhost:6007/sessoes \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@exemplo.com","senha":"cafedamanha"}'
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODcxODIzOTAsImV4cCI6MTc4NzE4OTU5MCwic3ViIjoiMSJ9.X2lIA0uzGthNTwvNX06tArHo8d9Vix5eA7vaO4bECKc",
  "usuario": { "id": 1, "email": "ana@exemplo.com", "criadoEm": "2026-08-19 23:33:10" }
}
```

Guarde o token numa variável para os comandos seguintes:

```bash
TK='<cole o token aqui>'
```

**Sem token, com o token adulterado e com um token assinado por outro segredo —
tudo 401:**

```bash
curl.exe -s localhost:6007/habitos
# {"erro":"Envie o token em `Authorization: Bearer <token>`","status":401}  [401]

curl.exe -s localhost:6007/habitos -H "Authorization: Bearer ${TK%?}X"
# {"erro":"Token inválido ou expirado","status":401}                        [401]

FORJADO=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({},'segredo-que-eu-inventei',{subject:'1',expiresIn:'2h'}))")
curl.exe -s localhost:6007/habitos -H "Authorization: Bearer $FORJADO"
# {"erro":"Token inválido ou expirado","status":401}                        [401]
```

O token forjado tem a carga certa — dá para lê-la **sem segredo nenhum**, o que é
o ponto:

```bash
node -e "console.log(JSON.stringify(require('jsonwebtoken').decode(process.argv[1])))" "$FORJADO"
# {"iat":1787182390,"exp":1787189590,"sub":"1"}
```

Ler a carga é grátis; produzir a assinatura, não. Trocar `verify` por `decode` no
servidor apagaria essa diferença e faria este token entrar.

**Cria dois hábitos, e tenta repetir o nome em outra caixa (409):**

```bash
curl.exe -s -X POST localhost:6007/habitos \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TK" \
  -d '{"nome":"Correr"}'
# {"id":1,"nome":"Correr","criadoEm":"2026-08-19 23:33:10"}                [201]

curl.exe -s -X POST localhost:6007/habitos \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TK" \
  -d '{"nome":"Ler 20 paginas"}'
# {"id":2,"nome":"Ler 20 paginas","criadoEm":"2026-08-19 23:33:10"}        [201]

curl.exe -s -X POST localhost:6007/habitos \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TK" \
  -d '{"nome":"correr"}'
# {"erro":"Você já tem um hábito com esse nome","status":409}              [409]
```

**O mesmo `PUT`, duas vezes — a prova da idempotência:**

```bash
curl.exe -s -X PUT localhost:6007/habitos/1/marcacoes/2026-08-19 \
  -H "Authorization: Bearer $TK"
# {"habitoId":1,"dia":"2026-08-19","marcado":true}                         [200]

curl.exe -s -X PUT localhost:6007/habitos/1/marcacoes/2026-08-19 \
  -H "Authorization: Bearer $TK"
# {"habitoId":1,"dia":"2026-08-19","marcado":true}                         [200]
```

Mesma resposta, mesmo status, e **um** registro no banco. Marcando o resto do mês
para o resumo ter o que mostrar:

```bash
for d in 2026-08-03 2026-08-10 2026-08-15 2026-08-16 2026-08-17 2026-08-18; do
  curl.exe -s -o /dev/null -w "$d -> %{http_code}\n" \
    -X PUT localhost:6007/habitos/1/marcacoes/$d -H "Authorization: Bearer $TK"
done
# 2026-08-03 -> 200
# 2026-08-10 -> 200
# 2026-08-15 -> 200
# 2026-08-16 -> 200
# 2026-08-17 -> 200
# 2026-08-18 -> 200
```

**Um dia que não existe no calendário (422):**

```bash
curl.exe -s -X PUT localhost:6007/habitos/1/marcacoes/2026-02-31 \
  -H "Authorization: Bearer $TK"
# {"erro":"Dados inválidos","status":422,
#  "detalhes":[{"campo":"dia","mensagem":"`dia` não é uma data existente no calendário"}]}  [422]
```

**A lista, com o total que veio agrupado do banco:**

```bash
curl.exe -s localhost:6007/habitos -H "Authorization: Bearer $TK"
```

```json
[
  {
    "id": 1,
    "nome": "Correr",
    "criadoEm": "2026-08-19 23:33:10",
    "totalMarcacoes": 7
  },
  {
    "id": 2,
    "nome": "Ler 20 paginas",
    "criadoEm": "2026-08-19 23:33:10",
    "totalMarcacoes": 0
  }
]
```

O hábito sem marcação nenhuma aparece com zero — é o que garante que a lista de
quem acabou de criar um hábito não volte vazia.

**O resumo, com dias seguidos de verdade:**

```bash
curl.exe -s "localhost:6007/habitos/1/resumo?mes=2026-08" \
  -H "Authorization: Bearer $TK"
```

```json
{
  "habito": { "id": 1, "nome": "Correr", "criadoEm": "2026-08-19 23:33:10" },
  "mes": "2026-08",
  "diasNoMes": 31,
  "diasCumpridos": 7,
  "percentual": 22.6,
  "dias": [
    "2026-08-03",
    "2026-08-10",
    "2026-08-15",
    "2026-08-16",
    "2026-08-17",
    "2026-08-18",
    "2026-08-19"
  ],
  "maiorSequencia": 5,
  "sequenciaAtual": 5,
  "ultimoDia": "2026-08-19"
}
```

Os dias 15, 16, 17, 18 e 19 são a fileira de cinco; o 3 e o 10 estão sozinhos.
Como a fileira termina no último dia marcado, `sequenciaAtual` é a mesma coisa
aqui — o que não acontece mais adiante, depois de desmarcar o dia 19.

**Mês sem marcação, mês malformado e mês ausente:**

```bash
curl.exe -s "localhost:6007/habitos/1/resumo?mes=2026-07" -H "Authorization: Bearer $TK"
# {"habito":{...},"mes":"2026-07","diasNoMes":31,"diasCumpridos":0,"percentual":0,
#  "dias":[],"maiorSequencia":0,"sequenciaAtual":0,"ultimoDia":null}       [200]

curl.exe -s "localhost:6007/habitos/1/resumo?mes=agosto" -H "Authorization: Bearer $TK"
# {"erro":"Dados inválidos","status":422,
#  "detalhes":[{"campo":"mes","mensagem":"`mes` deve estar no formato YYYY-MM"}]}    [422]

curl.exe -s "localhost:6007/habitos/1/resumo" -H "Authorization: Bearer $TK"
# {"erro":"Dados inválidos","status":422,
#  "detalhes":[{"campo":"mes","mensagem":"`mes` é obrigatório, no formato YYYY-MM"}]} [422]
```

**Outra pessoa entra — e o hábito da Ana some do mapa dela:**

```bash
curl.exe -s -X POST localhost:6007/usuarios \
  -H "Content-Type: application/json" \
  -d '{"email":"bruno@exemplo.com","senha":"bicicleta10"}'
# {"id":2,"email":"bruno@exemplo.com","criadoEm":"2026-08-19 23:33:11"}    [201]

# (login do Bruno, e o token dele em $TKB)
curl.exe -s -X POST localhost:6007/habitos \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TKB" \
  -d '{"nome":"Correr"}'
# {"id":3,"nome":"Correr","criadoEm":"2026-08-19 23:33:11"}                [201]

curl.exe -s localhost:6007/habitos -H "Authorization: Bearer $TKB"
# [{"id":3,"nome":"Correr","criadoEm":"2026-08-19 23:33:11","totalMarcacoes":0}]     [200]
```

"Correr" foi aceito mesmo já existindo — a unicidade é por dono. E o hábito 1, que
é da Ana, responde a mesma coisa que um hábito que nunca existiu:

```bash
curl.exe -s "localhost:6007/habitos/1/resumo?mes=2026-08" -H "Authorization: Bearer $TKB"
# {"erro":"Hábito 1 não existe","status":404}                              [404]

curl.exe -s -X PUT localhost:6007/habitos/1/marcacoes/2026-08-19 -H "Authorization: Bearer $TKB"
# {"erro":"Hábito 1 não existe","status":404}                              [404]

curl.exe -s "localhost:6007/habitos/999/resumo?mes=2026-08" -H "Authorization: Bearer $TKB"
# {"erro":"Hábito 999 não existe","status":404}                            [404]
```

As três respostas iguais são a decisão inteira: pelo status, não dá para
distinguir "não é seu" de "não existe".

**Desmarcar, duas vezes (204 nas duas):**

```bash
curl.exe -s -i -X DELETE localhost:6007/habitos/1/marcacoes/2026-08-19 \
  -H "Authorization: Bearer $TK" | head -1
# HTTP/1.1 204 No Content

curl.exe -s -i -X DELETE localhost:6007/habitos/1/marcacoes/2026-08-19 \
  -H "Authorization: Bearer $TK" | head -1
# HTTP/1.1 204 No Content

curl.exe -s "localhost:6007/habitos/1/resumo?mes=2026-08" -H "Authorization: Bearer $TK"
# {..., "diasCumpridos":6, "percentual":19.4,
#  "dias":["2026-08-03","2026-08-10","2026-08-15","2026-08-16","2026-08-17","2026-08-18"],
#  "maiorSequencia":4,"sequenciaAtual":4,"ultimoDia":"2026-08-18"}          [200]
```

Agora a fileira caiu para quatro dias, e `ultimoDia` recuou para o 18.

**Apagar o hábito leva as marcações junto (a cascata):**

```bash
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('data/minis-07-habitos.sqlite');console.log(JSON.stringify(db.prepare('SELECT habito_id, COUNT(*) AS total FROM marcacoes GROUP BY habito_id').all()));"
# [{"habito_id":1,"total":6}]

curl.exe -s -i -X DELETE localhost:6007/habitos/1 -H "Authorization: Bearer $TK" | head -1
# HTTP/1.1 204 No Content

curl.exe -s -X DELETE localhost:6007/habitos/1 -H "Authorization: Bearer $TK"
# {"erro":"Hábito 1 não existe","status":404}                              [404]

node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('data/minis-07-habitos.sqlite');console.log(JSON.stringify(db.prepare('SELECT habito_id, COUNT(*) AS total FROM marcacoes GROUP BY habito_id').all()));"
# []
```

As seis marcações sumiram sem nenhum comando que falasse delas. Quem fez isso foi
o `ON DELETE CASCADE` — e ele só funcionou porque a conexão ligou
`PRAGMA foreign_keys = ON`.

**Um id que não é número, e uma rota que não existe:**

```bash
curl.exe -s "localhost:6007/habitos/abc/resumo?mes=2026-08" -H "Authorization: Bearer $TK"
# {"erro":"Dados inválidos","status":422,
#  "detalhes":[{"campo":"id","mensagem":"`id` deve ser um número"}]}       [422]

curl.exe -s localhost:6007/estatisticas -H "Authorization: Bearer $TK"
# {"erro":"Rota não encontrada: GET /estatisticas","status":404}           [404]
```

---

## O que ficou de fora

| O que não tem                          | Por quê                                                                                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token de renovação e logout            | exigiria guardar cada token emitido para poder cancelá-lo. É o access + refresh do módulo 11, e o custo dessa ausência está na decisão sobre as 2 horas                             |
| Sequência que atravessa o mês          | o resumo é de um mês, e contar além dele exigiria buscar dias fora do período pedido. A régua do "tamanho do que se traz" continua valendo — mudaria o intervalo, não o método      |
| Hábito com meta ("3× por semana")      | muda a pergunta do resumo de "quantos dias" para "quantas semanas bateram a meta", e é outra mini API                                                                               |
| Editar o nome do hábito                | `PATCH` não acrescenta nada ao ponto desta mini; a mecânica de atualização parcial está na mini 5                                                                                   |
| Compartilhar um hábito com alguém      | é o que a mini 6 (`minis-apis/06-compras/`) faz, e é lá que o 403 passa a fazer sentido                                                                                             |
| Fuso da pessoa guardado no cadastro    | com ele o servidor poderia recusar dia futuro. Ficou de fora porque acrescenta um campo e uma classe inteira de erros de conversão para proteger contra a pessoa enganar a si mesma |
| Comparação em tempo constante no login | a defesa contra medir o tempo da resposta para descobrir quais e-mails existem. É assunto do módulo 11, e a mensagem única já cobre a parte visível                                 |
| Testes automatizados                   | módulo 12 — o serviço já está pronto para isso, porque recebe o repositório em vez de importá-lo                                                                                    |

---

## Para estudar

| Módulo                                                                       | O que desta API vem dele                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [03 — Express básico](../../docs/01-05/03-express-basico.md)                 | app, `express.json()`, rota e status                                      |
| [04 — Roteamento](../../docs/01-05/04-roteamento.md)                         | `Router`, parâmetro de rota, middleware por prefixo                       |
| [05 — Middlewares](../../docs/01-05/05-middlewares.md)                       | `cors`, `morgan` e a ordem da pilha                                       |
| [06 — Tratamento de erros](../../docs/06-10/06-tratamento-de-erros.md)       | `AppError` e o tratador central de 4 parâmetros                           |
| [07 — Validação com Zod](../../docs/06-10/07-validacao-zod.md)               | schemas, `.strict()`, `z.coerce` e formato × regra de negócio             |
| [08 — Arquitetura em camadas](../../docs/06-10/08-arquitetura-em-camadas.md) | rotas → serviço → repositório e injeção de dependência                    |
| [09 — SQLite e SQL](../../docs/06-10/09-sqlite-e-sql.md)                     | migrations, `?`, índice único, `GROUP BY`, `ON DELETE CASCADE`            |
| [11 — Autenticação](../../docs/11-15/11-autenticacao.md)                     | argon2, `jwt.verify`, `Authorization: Bearer`, 401 × 403 e mensagem única |

Vale ler ao lado a mini 6 (`minis-apis/06-compras/`): mesmo teto de módulos, o
mesmo módulo 11, e a camada de dados escrita com ORM em vez de SQL na mão. O que
sobra igual entre as duas era do problema; o que muda era da ferramenta.
