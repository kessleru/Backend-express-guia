# Mini API — Lista de compras compartilhada

📦 Módulos 03–11 · 🔌 porta 6006 · 💾 SQLite (Prisma)

## O problema

Duas pessoas moram juntas e vão ao mercado em dias diferentes. A lista no papel
da geladeira só serve para quem está em casa; a lista no bloco de notas do
celular só serve para quem tem aquele celular. O que falta não é onde escrever —
é o **mesmo** lugar, visto pelos dois, com o que já foi comprado saindo dele em
tempo real.

Assim que a lista passa a ser de duas pessoas, aparecem duas perguntas que a
lista de uma só nunca teve: **quem é você** (senão qualquer um edita a lista de
qualquer um) e **o que você pode fazer nesta lista aqui** (a pessoa que foi
convidada risca item, mas não sai convidando o prédio inteiro).

---

## Como funciona

Esta seção descreve o mecanismo. Não há nome de biblioteca aqui de propósito:
ter conta e dividir uma lista são problemas que existem antes de qualquer
ferramenta, e quem entende o mecanismo escolhe a ferramenta depois.

### A senha nunca é armazenada

A tentação é guardar a senha numa coluna e comparar com o que a pessoa digitou.
Isso funciona — e no dia em que alguém copiar o banco, ele sai com a senha de
todo mundo em texto legível. Como a maioria das pessoas repete senha, o estrago
não fica no seu sistema: vai junto para o e-mail e o banco delas.

O que se guarda no lugar é uma **prova derivada** da senha: um valor calculado a
partir dela por uma conta que **não tem caminho de volta**. Dá para ir da senha
ao valor; não dá para ir do valor à senha. Essa conta chama-se **hash**.

Conferir o login passa a ser: refazer a conta com a senha que acabou de chegar e
comparar os dois resultados. Se batem, é a mesma senha. O servidor nunca precisou
saber qual era.

Falta o detalhe que separa isso de um teatro de segurança. Se a conta fosse
rápida, quem levasse o banco embora testaria bilhões de senhas comuns por segundo
até achar as que produzem os valores gravados. Por isso a conta é **lenta de
propósito** — aqui, cerca de 200 milissegundos. Quem faz login paga esse tempo
uma vez e não percebe; quem tenta adivinhar paga o mesmo tempo a cada tentativa,
e "bilhões por segundo" vira "cinco por segundo".

Sobra um problema, e ele só aparece quando você pensa em duas pessoas em vez de
uma: se a conta depende só da senha, duas pessoas que escolheram `123456` têm
exatamente o mesmo valor gravado. Quem vazar o banco vê de graça quem repetiu
senha — e, pior, pode calcular o valor das mil senhas mais comuns **uma vez** e
comparar com o banco inteiro.

A saída é fazer cada cálculo depender de mais uma coisa, diferente por pessoa: um
número aleatório sorteado no cadastro, que entra na conta junto com a senha. Esse
número chama-se **sal**. Com ele, o `123456` de uma pessoa e o de outra produzem
valores diferentes, e a tabela pré-calculada teria que ser refeita para cada
usuário.

O sal não é segredo — ele precisa ser **diferente**, não escondido —, e por isso
fica guardado junto do resultado, dentro da mesma string. É o que permite
conferir a senha depois sem guardar nada a mais.

### Autenticar e autorizar são duas perguntas

- **Autenticar** responde _quem é você_. Ou você provou ser a dona da conta
  `ana@casa.com`, ou não provou.
- **Autorizar** responde _você pode fazer isto **nesta lista**_. Ana é dona da
  lista do mercado e convidada na lista de churrasco do Bruno. Não existe "o
  papel da Ana" — existe o papel dela em cada lista.

A segunda pergunta só nasceu porque a lista é compartilhada. Numa agenda privada,
em que cada coisa é de uma pessoa só, autenticar resolve tudo.

E elas falham de formas diferentes: quem não provou quem é recebe **401**
("não sei quem você é"); quem provou e mesmo assim não pode recebe **403** ("sei
quem você é, e você não pode"). Trocar os dois faz o cliente tentar consertar a
coisa errada — pedir permissão quando o problema era o login vencido.

### Cada requisição chega sem passado

O protocolo da web não lembra de nada. Duas requisições seguidas do mesmo
navegador são, para o servidor, dois desconhecidos. Não existe "estar logado" do
lado do servidor: o que existe é o cliente **reapresentar uma prova a cada
pedido**.

Essa prova é o que o login devolve.

```mermaid
sequenceDiagram
    autonumber
    participant P as Pessoa
    participant S as Servidor
    P->>S: e-mail + senha
    S->>S: refaz a conta e compara com a prova guardada
    S-->>P: crachá assinado, válido por 15 minutos
    P->>S: "minhas listas" + crachá
    S->>S: a assinatura fecha? de quem é o crachá?
    S-->>P: as listas de quem o crachá identifica
    P->>S: "convidar alguém na lista 1" + crachá
    S->>S: e nesta lista, qual é o papel dessa pessoa?
    S-->>P: 403 se não for dona
```

### O crachá assinado

O crachá é um texto com dois pedaços: **o que ele diz** (aqui, só o número da
conta) e **uma assinatura** desse texto, produzida com um segredo que só o
servidor conhece. Qualquer um confere que a assinatura fecha; ninguém consegue
produzir uma nova sem o segredo. É por isso que o servidor pode confiar num
crachá que ele mesmo não guardou em lugar nenhum — a validade está dentro do
próprio papel.

Duas consequências disso quase sempre saem trocadas:

1. **O conteúdo não é secreto.** O texto do crachá é legível por qualquer pessoa
   que o tenha em mãos — a assinatura garante que ele não foi **alterado**, não
   que ele seja **secreto**. Nada sigiloso entra ali: nem senha, nem documento,
   nem endereço. Nesta API entra só o número da conta.
2. **Um crachá emitido não pode ser rasgado.** Não existe uma lista central de
   crachás cancelados — é justamente por não precisar consultar nada que ele é
   barato. Trocar a senha, sair de uma lista, apagar a conta: nada disso alcança
   um crachá que já está na mão de alguém.

A segunda é o que obriga o **prazo curto de validade**. Se não dá para cancelar,
a única defesa é ele morrer sozinho rápido — aqui, 15 minutos. É o tamanho da
janela em que um crachá copiado ainda serve. O preço é ter que fazer login de
novo quando ele vence.

### 404 e 403: por que a escolha vaza informação

Duas recusas parecidas, e a diferença entre elas é a informação que a resposta
entrega.

**Pedir uma lista que não é sua responde 404** — "não existe". Parece mentira, e
é de propósito. Se a resposta fosse 403, ela estaria confirmando que aquela lista
existe. Quem estiver sondando pede a lista 1, a 2, a 3, anota quais responderam
403 e sai com o mapa das listas alheias: quantas são, em que faixa de números
estão, onde há atividade. Com 404 em todos os casos, "não existe" e "não é sua"
ficam indistinguíveis de fora, que é exatamente o que se quer.

**Convidar alguém para uma lista que você já enxerga responde 403.** Aqui a
existência não é segredo — quem faz o pedido já vê a lista, o nome dela, os itens
e os membros. Esconder a existência não protegeria nada, e ainda mandaria a
pessoa procurar um número errado quando o que falta é permissão.

A régua que decide, e que serve para qualquer outro domínio:

> **Negar revela alguma coisa que quem perguntou ainda não tinha?** Se revela, 404. Se não revela, 403.

O preço do 404 é uma mensagem de erro pior para quem tinha o link legítimo e
perdeu o convite: ele lê "não existe" quando o problema é permissão. Aceita-se,
porque o outro lado da troca é entregar a estrutura dos dados alheios a quem
souber escrever um laço de repetição.

### Por que dois papéis bastam

**Dono** é quem criou a lista: convida e faz tudo que o convidado faz.
**Convidado** mexe nos itens — acrescenta, marca como comprado, apaga. É só isso.

O convite existe para que a outra pessoa **use** a lista; um convidado que não
pudesse riscar item tornaria o convite inútil. E a única pergunta de permissão
que sobra — "é o dono?" — cabe numa checagem só, feita num lugar só.

Um terceiro papel muda isso de figura. Um "leitor", que enxerga sem editar,
obrigaria **toda** rota de escrita a consultar o papel antes de agir: a
autorização deixaria de caber num ponto único e viraria uma condição repetida em
cada operação — e o custo real não é escrever essas condições, é a que alguém vai
esquecer na próxima rota. Enquanto a permissão for uma pergunta só, ela pode
morar num lugar só.

---

## Rodar

Esta é a **única mini API da pasta com passo de setup**, e a razão é o projeto de
banco próprio: ela tem o seu esquema e o seu histórico de mudanças, dentro da
própria pasta, para não misturar as tabelas dela com as de nenhuma outra. Esse
histórico é um conjunto de arquivos versionados que ainda não foi aplicado no seu
disco, e o código que conversa com o banco é **gerado** a partir do esquema —
nenhuma das duas coisas existe num clone recém-baixado. Os dois comandos abaixo
criam as duas, e depois disso a API sobe como as outras.

```bash
npx prisma migrate deploy --config minis-apis/06-compras/prisma.config.ts
npx prisma generate --config minis-apis/06-compras/prisma.config.ts
node minis-apis/06-compras/servidor.ts
```

> **Atenção:** o `--config` não é opcional. Sem ele a CLI acha o
> `prisma.config.ts` da **raiz** e aplica as migrations da biblioteca (o exemplo
> do módulo 10) — no banco errado, e sem erro nenhum para avisar.

Saída dos três comandos, em um clone sem o banco criado:

```text
The following migration(s) have been applied:

migrations/
  └─ 20260819232056_inicial/
    └─ migration.sql

All migrations have been successfully applied.

✔ Generated Prisma Client (7.9.1) to .\minis-apis\06-compras\prisma\gerado in 37ms

Compras em http://localhost:6006
Comece por: POST /usuarios  →  POST /sessoes  →  POST /listas
```

O arquivo do banco fica em `data/minis-06-compras.sqlite`, que o `.gitignore` já
ignora. Apagá-lo e rodar o `migrate deploy` de novo é o "reset de fábrica" desta
API.

O `prisma/gerado/` também não vai para o git: é artefato, recriado pelo
`generate`. As **migrations**, sim, vão — elas são o histórico que faz um clone
novo chegar ao mesmo banco.

---

## Como ela foi construída

```text
minis-apis/06-compras/
├── prisma/
│   ├── schema.prisma      as quatro tabelas
│   └── migrations/        o histórico, versionado
├── prisma.config.ts       onde a CLI acha o schema e o banco
├── servidor.ts            monta as camadas e chama listen()
├── rotas/                 a borda HTTP, um arquivo por grupo
│   ├── index.ts           a ordem: contas → autenticar → o resto
│   ├── contas.ts          cadastro e login (as duas rotas abertas)
│   ├── listas.ts          listas e convite
│   └── itens.ts           itens da lista
├── servico.ts             as regras, e a escolha entre 404 e 403
├── repositorio.ts         o único arquivo que conhece o Prisma
├── auth.ts                senha, crachá e os dois middlewares
├── schemas.ts             o que o cliente pode mandar
├── dominio.ts             os tipos e o contrato do repositório
├── erros.ts               AppError e o tratador central
└── db.ts                  a instância do client
```

Só `rotas/` virou pasta, porque tem mais de um arquivo: cadastro/login, listas e
itens são grupos que se leem separados. As outras camadas cabem num arquivo cada
e ficam planas — uma pasta para hospedar um arquivo só custa um clique e não
separa nada.

### 1. As quatro tabelas, e a que decide tudo

`Usuario` e `Lista` são óbvias. `Item` é quase óbvia. A tabela que carrega o
desenho inteiro é `Membro`: quem participa de qual lista, e em que papel.

```prisma
model Membro {
  listaId   Int    @map("lista_id")
  usuarioId Int    @map("usuario_id")
  papel     String

  @@id([listaId, usuarioId])
  @@index([usuarioId])
}
```

A alternativa seria uma coluna `donoId` dentro de `Lista`. Ela resolve o dono e
**não resolve o convidado**: para compartilhar, seria preciso criar a tabela de
membros de qualquer forma — e aí haveria dois lugares dizendo quem manda, que
podem discordar. Com uma tabela só, a resposta a "quem participa desta lista?" e
a "qual é o papel dele?" vem da mesma linha.

A chave primária é o **par** `(listaId, usuarioId)`. É o que faz o convite
repetido ser recusado pelo banco em vez de por um `if` — e um `if` sempre tem uma
janela entre conferir e gravar.

### 2. A conta: cadastro, login e o crachá

Duas rotas abertas, e são as duas únicas da API. O cadastro calcula o hash da
senha; o login refaz a conta e emite o crachá.

```ts
if (!usuario || !(await conferirSenha(usuario.senhaHash, senha))) {
  throw naoAutenticado('E-mail ou senha inválidos');
}
```

A mensagem é **uma só** para os dois casos, de propósito. "Esse e-mail não
existe" entregaria a lista de quem tem conta: bastaria tentar mil e-mails e
anotar quais responderam "senha incorreta" para saber em quem mirar.

### 3. O `autenticar`, e a linha que protege as rotas de amanhã

O crachá chega no cabeçalho `Authorization: Bearer <token>`, é conferido, e o
número da conta fica pendurado na requisição para quem vier depois. Em
`rotas/index.ts`, três linhas desenham a fronteira da API inteira:

```ts
router.use(criarRotasContas(servico)); // cadastro e login: abertos
router.use(autenticar); // ← daqui para baixo, tudo exige crachá
router.use(criarRotasListas(servico));
router.use(criarRotasItens(servico));
```

A alternativa é repetir o `autenticar` em cada rota. Dá no mesmo até o dia em que
alguém acrescenta a décima rota e esquece — e uma rota que esquece de autenticar
não quebra: ela **responde**, com os dados de outra pessoa, para quem não mandou
crachá nenhum. Assim, esquecer passa a significar registrar o grupo novo acima da
linha errada, que é um erro bem mais visível: o desenho fecha por padrão em vez
de abrir por padrão.

### 4. A autorização, separada e visível

`exigirDono` é um segundo middleware, e aparece na linha da rota:

```ts
router.post('/listas/:id/membros', soODono, async (req, res) => { ... });
```

Ele não consulta nada — quem decide entre 404 e 403 é o serviço. O middleware
existe para que dê para **ler quem pode usar cada rota** sem abrir o serviço. Se
a checagem fosse a primeira linha do handler, ela sumiria na próxima rota escrita
por cópia.

### 5. As camadas, para o ORM não vazar

`rotas → servico → repositorio`, e só o repositório importa o cliente do banco. O
serviço não sabe o que é `findUnique`; ele sabe o que é "não é membro" e o que
isso vale em HTTP.

```ts
async function exigirMembro(listaId: number, usuarioId: number): Promise<Papel> {
  const papel = await repositorio.buscarPapel(listaId, usuarioId);
  if (!papel) throw naoEncontrado(`Lista ${listaId} não existe`);
  return papel;
}
```

Essa função é o ponto por onde passa toda leitura e toda escrita dentro de uma
lista. É por isso que a regra do 404 não precisa ser repetida em nenhum handler —
e é o que a mini 07 troca por SQL escrito à mão sem tocar em `servico.ts`.

---

## Endpoints

Todas as rotas abaixo de `/listas` exigem `Authorization: Bearer <token>` e
respondem **401** sem ele.

| Método   | Rota                        | O que faz                           | Status                      |
| -------- | --------------------------- | ----------------------------------- | --------------------------- |
| `POST`   | `/usuarios`                 | cadastro                            | 201 · 409 · 422             |
| `POST`   | `/sessoes`                  | login; devolve o token              | 200 · 401 · 422             |
| `GET`    | `/listas`                   | as minhas — como dona ou convidada  | 200 · 401                   |
| `POST`   | `/listas`                   | cria; quem criou vira dona          | 201 · 401 · 422             |
| `GET`    | `/listas/:id`               | a lista com membros e itens         | 200 · 401 · 404             |
| `POST`   | `/listas/:id/membros`       | convida por e-mail — **só a dona**  | 201 · 401 · 403 · 404 · 409 |
| `POST`   | `/listas/:id/itens`         | acrescenta item                     | 201 · 401 · 404 · 422       |
| `PATCH`  | `/listas/:id/itens/:itemId` | marca comprado ou muda a quantidade | 200 · 401 · 404 · 422       |
| `DELETE` | `/listas/:id/itens/:itemId` | apaga o item                        | 204 · 401 · 404             |

---

## As decisões e o porquê

### O papel não vai dentro do crachá

O caminho comum em API com login é gravar o papel no token (`admin`, `leitor`) e
autorizar sem tocar no banco. Aqui isso não funciona: **papel é por lista**. A
mesma conta é dona de uma e convidada em outra, e não existe um papel que
descreva a pessoa inteira.

O que custaria insistir: um token com `papel: "dono"` estaria certo para uma
lista e errado para as outras, e a autorização precisaria consultar a lista de
qualquer jeito — sobraria só o campo a mais no crachá, dizendo algo falso.

A contrapartida da escolha feita é uma consulta a mais por requisição, a
`buscarPapel`. Ela é uma busca por chave primária, e o índice em `usuario_id`
existe justamente para isso.

### 15 minutos de validade, e nenhum refresh

O crachá vale 15 minutos porque não há como cancelá-lo antes. A alternativa —
emitir um segundo token, de vida longa, guardado no banco para poder ser revogado
— resolve o incômodo de fazer login de novo e custa uma tabela, uma rota de
renovação e a rotação desse token a cada uso. É o `refresh` do
[módulo 11](../../docs/11-15/11-autenticacao.md), e ele não cabe no escopo desta mini.

O que essa ausência significa na prática: remover alguém de uma lista (rota que
esta API também não tem) não expulsaria a pessoa na hora — ela continuaria
entrando até o crachá vencer.

### O token vem no corpo da resposta, não num cookie

O login devolve `{ "token": "..." }` e o cliente decide onde guardar. Um cookie
`httpOnly` seria mais seguro contra roubo por script na página, e é a recomendação
do módulo 11 para o token de vida longa.

O que ele custaria aqui: cookie exige tratar CSRF (`SameSite`), tratar `secure`
diferente em `localhost` e produção, e uma biblioteca a mais para ler o cabeçalho
— três assuntos que pertencem ao módulo 13. Com o token no corpo, o `curl` da
seção **Testando** mostra o mecanismo inteiro em duas linhas.

### O convite é por e-mail, e só para quem já tem conta

Convidar `carla@casa.com` quando a Carla não tem conta responde **404**. A
alternativa — criar um convite pendente e mandar um e-mail — exige envio de
e-mail, uma tabela de convites e um fluxo de aceite.

O custo aceito é um vazamento pequeno e real: a resposta admite se aquele e-mail
tem conta na API. É o mesmo vazamento do 409 no cadastro, e vale registrar que os
dois são escolhas conscientes, não descuido.

### `onDelete`: `Cascade` nos itens e nos membros, `Restrict` no usuário

Apagar uma lista leva junto os itens e as linhas de membro: nenhum dos dois
significa coisa alguma sem a lista, e deixá-los para trás produziria itens que
ninguém alcança, ocupando espaço para sempre.

Apagar um **usuário** que é dono de alguma lista é recusado pelo banco. Com
`Cascade` também aqui, a linha de membro sumiria e a lista sobreviveria **sem
dono nenhum** — invisível para todo mundo, porque toda consulta desta API passa
pela tabela de membros, e impossível de apagar pela API. Um dado que ninguém vê e
ninguém remove é pior do que um erro na hora de apagar.

### `include` em vez de buscar item por item

`GET /listas` traz as listas e a contagem de itens de cada uma. Buscar as listas e
depois pedir os itens de cada uma numa volta seria **uma consulta por lista**;
`include` traz tudo de uma vez, num número fixo de consultas.

Medido com o registro de consultas ligado (`PRISMA_LOG=1`), para uma conta com
duas listas:

```text
prisma:query SELECT ... FROM `membros` WHERE `usuario_id` = ? ORDER BY `lista_id` ASC
prisma:query SELECT ..., COALESCE(`aggr_selection_0_Item`.`_aggr_count_itens`, 0)
             FROM `listas` LEFT JOIN (SELECT `lista_id`, COUNT(*) ... GROUP BY `lista_id`)
             ... WHERE `listas`.`id` IN (?,?)
```

Duas consultas — e continuariam duas com quinhentas listas. A contagem também é
feita pelo banco: trazer os itens só para medir o tamanho do array pagaria
transporte de dado que ia ser jogado fora.

### Dois arquivos dizem onde o banco está, com caminhos diferentes

`prisma.config.ts` aponta para `file:../../data/minis-06-compras.sqlite` e
`db.ts`, para `file:./data/minis-06-compras.sqlite`. Não é descuido: a ferramenta
de linha de comando resolve o caminho a partir do **arquivo de configuração**, e
o servidor, a partir do **diretório de onde o processo foi iniciado** — a raiz do
repositório.

O que acontece ao copiar a mesma string nos dois: nascem dois arquivos `.sqlite`,
um migrado e vazio, outro sem tabela nenhuma. E o erro só aparece na primeira
query, com o servidor já tendo subido sem reclamar de nada.

---

## Onde é fácil errar

| Sintoma                                                                           | Causa                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{"erro":"Lista 1 não existe","status":404}` numa lista que você sabe que existe  | você não é membro dela. O 404 é a resposta certa: um 403 confirmaria a existência a quem estiver sondando números                                                                                        |
| `{"erro":"Só o dono da lista pode convidar","status":403}`                        | você é membro, mas foi convidado. Aqui a existência já é sua conhecida, então esconder não protege nada                                                                                                  |
| `Error: P1012` ou "table does not exist" na primeira requisição, com o boot limpo | faltou o `migrate deploy`, ou os caminhos de `prisma.config.ts` e `db.ts` apontam para arquivos diferentes. O servidor sobe sem tocar no banco — a falha espera a primeira query                         |
| A CLI aplicou as migrations da biblioteca                                         | faltou `--config minis-apis/06-compras/prisma.config.ts`. Sem ele, o `prisma.config.ts` da raiz é o que vale                                                                                             |
| `Cannot find module './prisma/gerado/client.ts'`                                  | faltou o `prisma generate`. O cliente é artefato, não vai para o git                                                                                                                                     |
| Cadastrou com `Ana@Casa.com`, tenta entrar com `ana@casa.com` e leva 401          | seria isso sem o `.toLowerCase()` no schema, que normaliza o e-mail antes de qualquer comparação. Com ele, as duas formas são a mesma conta — e o segundo cadastro dá 409                                |
| `{"erro":"Dados inválidos", ... "Unrecognized key: \"papel\""}` num cadastro      | o schema recusa campo desconhecido. Mandar `papel` no corpo é bug do cliente ou tentativa; ignorar em silêncio esconde os dois                                                                           |
| **Falso amigo:** `jwt.decode` no lugar de `jwt.verify`                            | `decode` só desfaz o base64 — **não confere a assinatura**. Um token montado à mão com `{"sub":"1"}` seria aceito, e nada apareceria no log. As duas funções devolvem o mesmo objeto no caminho feliz    |
| **Falso amigo:** comparar hashes com `===` no login                               | dois hashes da mesma senha são diferentes, porque os sais são diferentes. O `===` dá falso sempre e ninguém entra; conferir tem função própria, que lê o sal de dentro do hash guardado                  |
| **Falso amigo:** `PATCH` com todos os campos opcionais aceita `{}`                | corpo vazio é sempre engano do cliente (campo escrito errado, JSON montado errado), e responder 200 sem ter mudado nada esconde o engano. Daí a checagem de "ao menos um campo", que o transforma em 422 |
| **Falso amigo:** buscar o item só por `id` e conferir a lista depois num `if`     | dá o mesmo resultado e é esquecível — quem escrever a próxima rota copia a busca, não o `if`. O `listaId` vive dentro do `where`                                                                         |

---

## Testando

Os `curl` abaixo foram rodados contra um banco criado do zero, na ordem em que
aparecem, e a resposta ao lado é a que voltou. O `[status]` no fim de cada linha
é o código HTTP.

> **Atenção:** `curl -d '{"json":1}'` com **aspas simples** não funciona em
> `cmd.exe` nem no PowerShell — o `curl` do PowerShell é apelido de
> `Invoke-WebRequest`, que nem entende `-d`. No Windows, rode estes comandos no
> Git Bash usando `curl.exe`.

**Cadastro, e o mesmo e-mail em outra caixa (409):**

```bash
curl.exe -s -X POST http://localhost:6006/usuarios \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@casa.com","senha":"pao-de-queijo-9"}'
# {"id":1,"email":"ana@casa.com"}                              [201]

curl.exe -s -X POST http://localhost:6006/usuarios \
  -H "Content-Type: application/json" \
  -d '{"email":"Ana@Casa.com","senha":"outra-senha-123"}'
# {"erro":"E-mail já cadastrado","status":409}                 [409]

curl.exe -s -X POST http://localhost:6006/usuarios \
  -H "Content-Type: application/json" \
  -d '{"email":"bruno@casa.com","senha":"cafe-com-leite-7"}'
# {"id":2,"email":"bruno@casa.com"}                            [201]
```

**Três recusas de formato numa resposta só (422):**

```bash
curl.exe -s -X POST http://localhost:6006/usuarios \
  -H "Content-Type: application/json" \
  -d '{"email":"nao-e-email","senha":"123","papel":"dono"}'
```

```json
{
  "erro": "Dados inválidos",
  "status": 422,
  "detalhes": [
    { "campo": "email", "mensagem": "`email` precisa ser um e-mail válido" },
    { "campo": "senha", "mensagem": "`senha` precisa de 8+ caracteres" },
    { "campo": "(raiz)", "mensagem": "Unrecognized key: \"papel\"" }
  ]
}
```

**Login: senha errada e e-mail inexistente dão a MESMA resposta (401):**

```bash
curl.exe -s -X POST http://localhost:6006/sessoes \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@casa.com","senha":"senha-errada-1"}'
# {"erro":"E-mail ou senha inválidos","status":401}            [401]

curl.exe -s -X POST http://localhost:6006/sessoes \
  -H "Content-Type: application/json" \
  -d '{"email":"ninguem@casa.com","senha":"senha-errada-1"}'
# {"erro":"E-mail ou senha inválidos","status":401}            [401]
```

**Login certo devolve o crachá (200):**

```bash
curl.exe -s -X POST http://localhost:6006/sessoes \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@casa.com","senha":"pao-de-queijo-9"}'
# {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiaWF0IjoxNzg3MTgyNjA2
#           LCJleHAiOjE3ODcxODM1MDZ9.kAgOoVOmDB9VPEvOiPr1i_auK0HKntCq6S0B-dRAtDQ",
#  "usuario":{"id":1,"email":"ana@casa.com"}}                  [200]
```

Guarde os dois tokens em variáveis — o resto da sessão usa `$ANA` e `$BRU`:

```bash
ANA=$(curl.exe -s -X POST http://localhost:6006/sessoes -H "Content-Type: application/json" \
  -d '{"email":"ana@casa.com","senha":"pao-de-queijo-9"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
BRU=$(curl.exe -s -X POST http://localhost:6006/sessoes -H "Content-Type: application/json" \
  -d '{"email":"bruno@casa.com","senha":"cafe-com-leite-7"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
```

**Sem crachá, com crachá adulterado e com crachá forjado à mão (401 nos três):**

```bash
curl.exe -s http://localhost:6006/listas
# {"erro":"Header Authorization ausente","status":401}         [401]

curl.exe -s http://localhost:6006/listas -H "Authorization: Bearer ${ANA}x"
# {"erro":"Token inválido","status":401}                       [401]

# payload legível dizendo `{"sub":"1"}`, assinatura inventada — é exatamente o
# token que um `jwt.decode` aceitaria:
curl.exe -s http://localhost:6006/listas \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.assinatura-inventada"
# {"erro":"Token inválido","status":401}                       [401]
```

**Cada uma cria a sua lista; o `Location` aponta para a nova (201):**

```bash
curl.exe -s -i -X POST http://localhost:6006/listas \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ANA" \
  -d '{"nome":"Mercado da semana"}'
# HTTP/1.1 201 Created
# Location: /listas/1
# {"id":1,"nome":"Mercado da semana"}                          [201]

curl.exe -s -X POST http://localhost:6006/listas \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BRU" \
  -d '{"nome":"Churrasco de sabado"}'
# {"id":2,"nome":"Churrasco de sabado"}                        [201]
```

**Lista de outra pessoa: 404, e não 403 (é a decisão central desta mini):**

```bash
curl.exe -s http://localhost:6006/listas/1 -H "Authorization: Bearer $BRU"
# {"erro":"Lista 1 não existe","status":404}                   [404]
```

**O convite, e as quatro formas de ele ser recusado:**

```bash
curl.exe -s -X POST http://localhost:6006/listas/1/membros \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ANA" \
  -d '{"email":"bruno@casa.com"}'
# {"usuarioId":2,"email":"bruno@casa.com","papel":"convidado"}           [201]

curl.exe -s -X POST http://localhost:6006/listas/1/membros \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ANA" \
  -d '{"email":"bruno@casa.com"}'
# {"erro":"bruno@casa.com já participa desta lista","status":409}        [409]

curl.exe -s -X POST http://localhost:6006/listas/1/membros \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ANA" \
  -d '{"email":"carla@casa.com"}'
# {"erro":"Ninguém com o e-mail carla@casa.com tem conta","status":404}  [404]

# Bruno já é membro: ele VÊ a lista, então esconder a existência não protege
# nada — 403.
curl.exe -s -X POST http://localhost:6006/listas/1/membros \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BRU" \
  -d '{"email":"ana@casa.com"}'
# {"erro":"Só o dono da lista pode convidar","status":403}               [403]

# Ana não é membro da lista 2: a existência dela É segredo — 404.
curl.exe -s -X POST http://localhost:6006/listas/2/membros \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ANA" \
  -d '{"email":"ana@casa.com"}'
# {"erro":"Lista 2 não existe","status":404}                             [404]
```

**Os dois acrescentam itens na mesma lista — é o ponto do compartilhamento:**

```bash
curl.exe -s -X POST http://localhost:6006/listas/1/itens \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BRU" \
  -d '{"nome":"Carvao","quantidade":2}'
# {"id":1,"nome":"Carvao","quantidade":2,"comprado":false,"listaId":1}   [201]

curl.exe -s -X POST http://localhost:6006/listas/1/itens \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ANA" \
  -d '{"nome":"Cafe em po"}'
# {"id":2,"nome":"Cafe em po","quantidade":1,"comprado":false,"listaId":1}  [201]

curl.exe -s -X POST http://localhost:6006/listas/1/itens \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ANA" \
  -d '{"nome":"Sal grosso","quantidade":1}'
# {"id":3,"nome":"Sal grosso","quantidade":1,"comprado":false,"listaId":1} [201]

# `comprado` não é campo de criação: item nasce por comprar.
curl.exe -s -X POST http://localhost:6006/listas/1/itens \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ANA" \
  -d '{"nome":"Gelo","comprado":true}'
# {"erro":"Dados inválidos","status":422,
#  "detalhes":[{"campo":"(raiz)","mensagem":"Unrecognized key: \"comprado\""}]}  [422]
```

**Marcar comprado, mudar quantidade, e os dois erros do `PATCH`:**

```bash
curl.exe -s -X PATCH http://localhost:6006/listas/1/itens/1 \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BRU" \
  -d '{"comprado":true}'
# {"id":1,"nome":"Carvao","quantidade":2,"comprado":true,"listaId":1}    [200]

curl.exe -s -X PATCH http://localhost:6006/listas/1/itens/2 \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ANA" \
  -d '{"quantidade":3}'
# {"id":2,"nome":"Cafe em po","quantidade":3,"comprado":false,"listaId":1}  [200]

curl.exe -s -X PATCH http://localhost:6006/listas/1/itens/2 \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ANA" -d '{}'
# {"erro":"Dados inválidos","status":422,"detalhes":[{"campo":"(raiz)",
#  "mensagem":"Mande ao menos um campo: \`nome\`, \`quantidade\` ou \`comprado\`"}]}  [422]

curl.exe -s -X PATCH http://localhost:6006/listas/1/itens/99 \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ANA" \
  -d '{"comprado":true}'
# {"erro":"Item 99 não existe na lista 1","status":404}                  [404]
```

**A lista inteira, e as listas de cada um com o papel de cada um:**

```bash
curl.exe -s http://localhost:6006/listas/1 -H "Authorization: Bearer $ANA"
```

```json
{
  "id": 1,
  "nome": "Mercado da semana",
  "membros": [
    { "usuarioId": 1, "email": "ana@casa.com", "papel": "dono" },
    { "usuarioId": 2, "email": "bruno@casa.com", "papel": "convidado" }
  ],
  "itens": [
    { "id": 1, "nome": "Carvao", "quantidade": 2, "comprado": true, "listaId": 1 },
    { "id": 2, "nome": "Cafe em po", "quantidade": 3, "comprado": false, "listaId": 1 },
    { "id": 3, "nome": "Sal grosso", "quantidade": 1, "comprado": false, "listaId": 1 }
  ]
}
```

```bash
curl.exe -s http://localhost:6006/listas -H "Authorization: Bearer $BRU"
# [{"id":1,"nome":"Mercado da semana","papel":"convidado","totalItens":3},
#  {"id":2,"nome":"Churrasco de sabado","papel":"dono","totalItens":0}]  [200]
```

**Apagar um item, e apagá-lo de novo (204, depois 404):**

```bash
curl.exe -s -i -X DELETE http://localhost:6006/listas/1/itens/3 \
  -H "Authorization: Bearer $BRU"
# HTTP/1.1 204 No Content                                                [204]

curl.exe -s -X DELETE http://localhost:6006/listas/1/itens/3 \
  -H "Authorization: Bearer $BRU"
# {"erro":"Item 3 não existe na lista 1","status":404}                   [404]
```

**Id que não é número, e rota que não existe:**

```bash
curl.exe -s http://localhost:6006/listas/abc -H "Authorization: Bearer $ANA"
# {"erro":"Dados inválidos","status":422,
#  "detalhes":[{"campo":"id","mensagem":"\`id\` deve ser um número"}]}   [422]

curl.exe -s http://localhost:6006/carrinho -H "Authorization: Bearer $ANA"
# {"erro":"Rota não encontrada: GET /carrinho","status":404}             [404]
```

---

## O que ficou de fora

| O que não tem                                      | Por quê                                                                                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renovar o crachá (`refresh`) e sair                | exige guardar o token no banco e uma rota de rotação — [módulo 11](../../docs/11-15/11-autenticacao.md). Sem isso, quem é removido de uma lista continua entrando por até 15 min |
| Token em cookie `httpOnly`                         | traz CSRF, `SameSite` e `secure` por ambiente junto — [módulo 13](../../docs/11-15/13-seguranca.md)                                                                              |
| Remover membro, sair da lista, apagar lista        | são variações da mesma checagem de dono que a rota de convite já mostra                                                                                                          |
| Convite por link e convite para quem não tem conta | precisa de envio de e-mail e de uma tabela de convites pendentes — escopo de produto, não de módulo                                                                              |
| Um terceiro papel (leitor)                         | espalharia a autorização por todas as rotas de escrita; a seção **Como funciona** explica a conta                                                                                |
| Paginação em `/listas` e nos itens                 | uma pessoa tem dezenas de listas, não milhares. A mecânica está na [mini 03](../03-despesas/README.md)                                                                           |
| Limite de tentativas de login                      | o hash lento já encarece a força bruta, mas quem quer barrar de fato precisa de rate limit — [módulo 13](../../docs/11-15/13-seguranca.md)                                       |
| Testes automatizados                               | [módulo 12](../../docs/11-15/12-testes.md) — o serviço já está pronto para isso, porque recebe o repositório em vez de importá-lo                                                |

---

## Para estudar

| Módulo                                                                       | O que desta API vem dele                                             |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [03 — Express básico](../../docs/01-05/03-express-basico.md)                 | app, `express.json()`, rota e status                                 |
| [04 — Roteamento](../../docs/01-05/04-roteamento.md)                         | `Router`, rota aninhada e parâmetro de rota                          |
| [05 — Middlewares](../../docs/01-05/05-middlewares.md)                       | `cors`, `morgan`, `router.use` e a ordem da pilha                    |
| [06 — Tratamento de erros](../../docs/06-10/06-tratamento-de-erros.md)       | `AppError` e o tratador central de 4 parâmetros                      |
| [07 — Validação com Zod](../../docs/06-10/07-validacao-zod.md)               | schemas, `.strict()`, `z.coerce` e formato × regra de negócio        |
| [08 — Arquitetura em camadas](../../docs/06-10/08-arquitetura-em-camadas.md) | rotas → serviço → repositório e injeção de dependência               |
| [10 — ORM com Prisma](../../docs/06-10/10-prisma-orm.md)                     | schema, migrations, adapter do Prisma 7, `include`, `_count` e N+1   |
| [11 — Autenticação](../../docs/11-15/11-autenticacao.md)                     | argon2 e o sal, JWT, `verify` × `decode`, 401 × 403 e login genérico |
