# Middleware — autenticar

📦 módulo 11 · 🧩 grupo 03

Lê `Authorization: Bearer <token>`, confere a assinatura e deixa em `req.usuario`
quem está falando. Quando qualquer parte disso falha, responde **401**.

## O problema

A API tem uma rota que só o dono do dado pode ver. A pergunta que ela precisa
responder antes de qualquer outra coisa é "quem está pedindo?" — e essa pergunta
não é da rota. É de todas elas.

Escrita dentro do handler, a resposta vira este bloco, repetido:

```ts
// ❌ em cada rota privada
app.get('/emprestimos', (req, res) => {
  const cabecalho = req.header('Authorization');
  const token = cabecalho?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ erro: 'sem token' });
  const usuario = jwt.decode(token); // e aqui já começou o incidente
  // ... a rota, finalmente
});
```

Três coisas dão errado com isso, e nenhuma delas aparece no dia em que o código é
escrito:

- **A rota nova nasce sem o bloco.** Ninguém lembra de colar oito linhas de
  cerimônia numa rota de listagem, e ela fica pública sem que nada nem ninguém
  avise. Não há erro, não há aviso, não há teste que quebre — só uma rota aberta.
- **As cópias divergem.** Uma aceita o token sem o prefixo `Bearer`, outra não;
  uma responde 401, outra 403; uma confere expiração, outra esqueceu. Quem
  consome a API precisa de um tratamento por rota.
- **A cópia errada se espalha.** O `jwt.decode` da linha acima funciona
  perfeitamente em todos os testes — e é a falha mais grave que se comete com
  JWT. Está explicada em [`## O código`](#o-código) e é o motivo desta pasta
  existir.

Autenticação é o caso de manual do que o
[módulo 05](../../../docs/05-middlewares.md#para-que-serve-a-coisa-que-precisa-acontecer-em-toda-rota)
descreve: a coisa que precisa acontecer antes da rota, decidida num lugar só.

## Como funciona

O middleware fica entre a requisição e o handler e faz quatro perguntas em
sequência. Qualquer resposta negativa encerra ali, com **401** e sem chamar
`next()` — o handler nunca chega a rodar.

1. **O cabeçalho `Authorization` veio?** Sem ele, não há o que conferir.
2. **O formato é exatamente `Bearer <token>`?** Um esquema, um espaço, um token,
   e nada depois.
3. **A assinatura confere e o prazo não venceu?** É o `jwt.verify`, e é a única
   pergunta que precisa do segredo.
4. **A carga tem os campos que a autorização vai precisar?** Assinatura válida
   não garante conteúdo válido.

Passando as quatro, ele **escreve** `req.usuario = { id, papel }` e chama
`next()`. Daí em diante, todo middleware e todo handler abaixo dele na pilha lê
`req.usuario` sem repetir nada disso — inclusive o
[`exigirPapel`](../exigir-papel/README.md), que é o próximo da fila.

Repare no que ele **não** faz: não consulta banco nenhum. A identidade está
dentro do próprio token, assinada; conferir a assinatura é matemática local. É o
que torna JWT barato por requisição, e é também de onde vem a contrapartida
descrita em [`## O que ele não faz`](#o-que-ele-não-faz).

```mermaid
flowchart TD
    R([requisição]) --> A{"cabeçalho Authorization?"}
    A -- não --> E1["401 · Envie Authorization: Bearer &lt;token&gt;"]
    A -- sim --> B{"formato Bearer + token?"}
    B -- não --> E2["401 · Formato esperado"]
    B -- sim --> C{"jwt.verify passa?"}
    C -- não --> E3["401 · Token inválido ou expirado"]
    C -- sim --> D{"tem sub e papel?"}
    D -- não --> E4["401 · Token sem os dados"]
    D -- sim --> OK["req.usuario = &#123; id, papel &#125; → next()"]
    style E1 fill:#fed7aa,stroke:#ea580c,color:#000
    style E2 fill:#fed7aa,stroke:#ea580c,color:#000
    style E3 fill:#fed7aa,stroke:#ea580c,color:#000
    style E4 fill:#fed7aa,stroke:#ea580c,color:#000
    style OK fill:#bbf7d0,stroke:#16a34a,color:#000
```

## O código

O arquivo completo está em [`middleware.ts`](./middleware.ts). Ele tem três
pedaços que valem ser lidos separados: a declaração de tipo que estende o
`Request`, a emissão do token (que existe só para a demo) e o middleware.

### O pedaço que todo mundo copia errado

`req.usuario` não existe no Express. É campo nosso, pendurado num objeto que não
é nosso, e para o TypeScript aceitá-lo sem `any` o tipo `Request` precisa ser
estendido.

```ts
export type Papel = 'leitor' | 'editor' | 'admin';

export type UsuarioAutenticado = {
  /** `sub` do JWT. String por definição da RFC 7519, mesmo quando o id é numérico. */
  id: string;
  papel: Papel;
};

declare module 'express-serve-static-core' {
  interface Request {
    usuario?: UsuarioAutenticado;
  }
}
```

Quatro decisões cabem nessas seis linhas:

- **`'express-serve-static-core'`, não `'express'`.** O `@types/express` declara
  a interface `Request` naquele pacote e apenas a reexporta. Augmentar `'express'`
  compila em alguns projetos e não pega em outros, conforme o pacote foi
  resolvido — augmentar a origem sempre pega.
- **`declare module`, não `declare global { namespace Express { ... } }`.** O
  bloco com `namespace` é o mais colado da internet e está barrado aqui por dois
  motivos independentes: `namespace` é proibido pelo `erasableSyntaxOnly` (o Node
  apaga tipos, não transforma código) e a versão que circula tem `any` dentro,
  anulando o trabalho todo.
- **O campo é opcional.** Numa rota pública o `autenticar` não rodou, e
  `req.usuario` é mesmo `undefined`. Declará-lo obrigatório mentiria para o
  compilador e devolveria, em outra roupa, o mesmo `undefined` sem checagem que o
  `any` já dava.
- **`Papel` é união de literais, não `string`.** Com `string`, `papel === 'admn'`
  compila e nega todo mundo em silêncio.

> **Atenção:** duas condições fazem esse bloco falhar **em silêncio** ao ser
> copiado para outro projeto. O arquivo precisa ser um módulo — ter `import` ou
> `export` —, senão o `declare module` cria um módulo novo em vez de augmentar o
> existente; e o arquivo precisa entrar no programa do `tsc`. Aqui os dois valem
> porque o arquivo importa `express` e o `tsconfig.middlewares.json` inclui a
> pasta inteira.

### `verify`, nunca `decode`

Este é o comentário mais caro do grupo inteiro.

```ts
let carga: JwtPayload | string;
try {
  carga = jwt.verify(token, SEGREDO);
} catch {
  // Assinatura inválida, token expirado e token truncado caem no mesmo 401 com a
  // mesma frase: dizer qual dos três falhou só orienta quem está forjando.
  return recusar(res, 'Token inválido ou expirado');
}
```

`jwt.decode(token)` desfaz o base64 da carga e devolve o objeto. Só isso: ele
**não confere a assinatura** e não olha o `exp`. A parte perigosa é que, com um
token legítimo, `decode` e `verify` devolvem **exatamente o mesmo objeto** —
mesmo `sub`, mesmo `papel`. A troca passa no teste manual, passa no cliente HTTP,
passa na revisão de código: tudo continua funcionando.

O que muda é só o que ninguém testa. A assinatura de um JWT é o que prova que a
carga foi emitida por quem tem o segredo
([módulo 11](../../../docs/11-autenticacao.md#anatomia-de-um-jwt)). Sem conferi-la,
qualquer pessoa monta `{"sub":"eu","papel":"admin"}`, codifica em base64, põe
qualquer lixo no lugar da assinatura, manda, e é admin — sem senha, sem conta,
sem nunca ter tido o segredo. É a falha mais grave que se comete com JWT, e ela
não dá sintoma nenhum até virar incidente.

O `try/catch` está aí porque `verify` **lança** em vez de devolver `false`. Um
`if (!jwt.verify(...))` não compila e, se compilasse, não pegaria nada.

### O parsing do cabeçalho, e por que ele é rígido

```ts
const cabecalho = req.header('Authorization');
if (!cabecalho) return recusar(res, 'Envie Authorization: Bearer <token>');

const [esquema, token, ...sobra] = cabecalho.split(' ');
if (esquema !== 'Bearer' || !token || sobra.length > 0) {
  return recusar(res, 'Formato esperado: Authorization: Bearer <token>');
}
```

Aceitar o token solto, sem o prefixo, parece gentileza com o cliente e cria duas
formas de mandar a mesma coisa. No dia em que um cliente mandar
`Basic <usuario:senha em base64>` — que é HTTP legítimo, só de outro esquema —, o
parsing frouxo trata a senha como token. O `...sobra` fecha o outro lado: sem
ele, `Bearer a b` passaria com o token `a`.

### O último portão: assinatura válida ≠ conteúdo válido

```ts
const sub = typeof carga === 'string' ? undefined : carga.sub;
const papel = typeof carga === 'string' ? undefined : carga.papel;

if (typeof sub !== 'string' || !ehPapel(papel)) {
  return recusar(res, 'Token sem os dados de identificação');
}

req.usuario = { id: sub, papel };
next();
```

O `typeof carga === 'string'` cobre um caso real: `verify` devolve `string`
quando a carga não é JSON — token antigo, ou emitido por outro sistema. Sem a
checagem, `carga.sub` seria `undefined` num caminho que o compilador nem aponta.

E a checagem final vale mesmo com assinatura perfeita: um token emitido por uma
versão antiga do sistema, antes de o campo `papel` existir, é criptograficamente
legítimo e inútil para autorizar. Sem esta linha, o `exigirPapel` receberia
`undefined`, a comparação daria falso, e a resposta seria **403** — negação certa
com a mensagem errada, e uma hora de investigação no lugar errado.

## Como usar

```ts
app.get('/publico', handler); // sem nada: aberto de propósito
app.get('/eu', autenticar, handler); // só autenticado
app.delete('/acervo/:id', autenticar, exigirPapel('admin'), handler); // nesta ordem
```

**Depois** dos middlewares que valem para toda resposta
([`cabecalhosDeSeguranca`](../cabecalhos-de-seguranca/README.md), log, id de
requisição) e **antes** de qualquer coisa que precise saber quem é o usuário.

Aqui ele entra rota a rota, e não com `app.use`. Os dois modos existem:

| Modo                                      | Quando                                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Por rota (`app.get('/x', autenticar, h)`) | A API tem rotas públicas de verdade. É o caso da demo — `/publico` e `POST /sessoes` precisam funcionar sem token             |
| `app.use(autenticar)` no router privado   | Todas as rotas daquele prefixo são privadas. Fecha por padrão: a rota nova nasce protegida, e abri-la é uma decisão explícita |

O segundo é mais seguro e o primeiro é mais flexível, e a escolha tem um nome: no
primeiro, esquecer o middleware **abre** uma rota; no segundo, esquecer de
removê-lo **fecha** uma. Errar para o lado de fechar custa um chamado; errar para
o lado de abrir custa um incidente. Numa API com poucas rotas públicas,
`app.use` no router privado é a escolha certa.

**A ordem em relação ao `exigirPapel` não é negociável**, e está detalhada
[na pasta dele](../exigir-papel/README.md#como-usar): invertida, o `exigirPapel`
lê um `req.usuario` que ainda não foi escrito e nega todo mundo com 401 —
inclusive o admin com token perfeito.

## As decisões e o porquê

### `req.usuario` e não `res.locals.usuario`

O [módulo 05](../../../docs/05-middlewares.md#passando-dados-entre-middlewares)
mostra `res.locals` como o lugar de passar dado entre middlewares, e o
[módulo 11](../../../docs/11-autenticacao.md#permissão-por-papel-rbac) usa
`res.locals.usuario`. Aqui é `req.usuario`, e a diferença é de tipagem.

`res.locals` é tipado como `Record<string, any>`: escrever ali não exige
declaração nenhuma, e ler de lá devolve `any` — o `usuario.paple` volta a passar
batido. `req.usuario` exige as seis linhas de `declare module` acima e, em troca,
o compilador confere cada leitura.

Custo da escolha: aquelas seis linhas precisam existir em algum arquivo que entre
no programa do `tsc`, e quem copia só o `middleware.ts` para um projeto com
`tsconfig` restrito pode ver a augmentação não pegar. `res.locals` funcionaria em
qualquer lugar sem configuração. A troca é configuração por checagem, e numa
peça de segurança a checagem vale mais.

### O 401 é o mesmo nos quatro casos

Cabeçalho ausente, formato errado, assinatura inválida e carga incompleta
respondem `401` com `{ "erro": "nao_autenticado" }`. A mensagem varia só o
suficiente para o desenvolvedor legítimo corrigir o `curl`; ela nunca diz **por
que** o token foi rejeitado.

A alternativa descartada é a mensagem detalhada — `"assinatura inválida"` ×
`"token expirado"`. Ela ajuda a depurar e ajuda mais ainda quem está forjando:
`"assinatura inválida"` significa "o formato está certo, continue tentando o
segredo"; `"expirado"` significa "este token era válido, procure um mais novo".
Custo da escolha feita: um desenvolvedor legítimo com token vencido leva alguns
minutos a mais para descobrir que era só isso.

### O segredo vem do ambiente, com um valor embutido

```ts
const SEGREDO =
  process.env.JWT_SECRET ?? 'segredo-de-desenvolvimento-nao-use-em-producao';
```

O valor embutido existe para a demo subir com `node servidor.ts` e nada mais.
Em produção ele é falha grave — **não por ser curto, mas por estar publicado**:
quem lê este arquivo no GitHub assina um token com `papel: admin` e o servidor
aceita, sem senha e sem conta.

Um serviço de verdade não tem fallback:

```ts
const SEGREDO = process.env.JWT_SECRET;
if (!SEGREDO) throw new Error('JWT_SECRET ausente');
```

A diferença entre as duas versões é **quando** o erro aparece. Com fallback, o
servidor sobe feliz em produção com o segredo público e ninguém descobre. Sem
fallback, ele se recusa a subir — o deploy falha, alguém lê o log em trinta
segundos. Falhar na subida é o barato; falhar em silêncio é o caro.

### 15 minutos de validade

`expiresIn: '15m'` é o número do
[módulo 11](../../../docs/11-autenticacao.md#access--refresh), e ele só é
aceitável junto de um refresh token que renove em silêncio. Sem refresh, isto
significa login de novo no meio da tarde.

O que acontece quando alguém aumenta o número para resolver o incômodo: um token
roubado vale pelo prazo inteiro, e **não há onde riscar o nome dele**. A
assinatura é conferida sozinha, sem consultar lugar nenhum — é justamente a
propriedade que torna JWT barato. Trocar 15 minutos por 7 dias é trocar uma
janela de 15 minutos de estrago por uma de uma semana.

### Só `sub` e `papel` na carga

O payload de um JWT é base64, **não é criptografia**: qualquer um com o token lê
tudo. E-mail, CPF ou saldo ali ficam legíveis para quem interceptar. Entra o
mínimo necessário para autorizar sem bater no banco.

Custo: o `papel` vem congelado no token. Rebaixar alguém de `admin` para `leitor`
só tem efeito quando o token dele expirar — até 15 minutos depois. Se isso for
inaceitável, o papel passa a vir do banco a cada requisição, e você troca
latência por revogação imediata.

## Onde é fácil errar

| Sintoma                                                                | Causa                                                                                                                                                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tudo funciona nos testes; meses depois alguém vira admin sem ter conta | **O falso amigo:** `jwt.decode` no lugar de `jwt.verify`. Com token legítimo os dois devolvem o mesmo objeto, então nada acusa. Sem `verify`, qualquer token forjado passa         |
| `Property 'usuario' does not exist on type 'Request'`                  | A augmentação não pegou: ou foi feita em `'express'` em vez de `'express-serve-static-core'`, ou o arquivo não é módulo (sem `import`/`export`), ou não entra no programa do `tsc` |
| Erro de compilação em `namespace`                                      | O bloco `declare global { namespace Express { ... } }` da internet. `erasableSyntaxOnly` o proíbe — use `declare module`                                                           |
| 403 numa rota em que o token é perfeito e o papel está certo           | O `papel` não chegou em `req.usuario` — token emitido antes de o campo existir. É o que a última checagem transforma em 401 com a mensagem certa                                   |
| 401 em toda rota privada, inclusive com token válido                   | `exigirPapel` registrado **antes** do `autenticar`: ele lê um `req.usuario` que ainda não existe                                                                                   |
| `TypeError: Cannot read properties of undefined` no handler            | `req.usuario!` ou `(req as any).usuario` numa rota onde o `autenticar` não está registrado. O campo é opcional de propósito                                                        |
| Token que deveria estar vencido continua sendo aceito                  | `decode` de novo — ele não olha o `exp`. Só `verify` confere prazo                                                                                                                 |
| Funciona em desenvolvimento, 401 em produção depois do deploy          | `JWT_SECRET` diferente entre a máquina que emitiu e a que verifica. Token assinado com um segredo não valida com outro                                                             |

## O que ele não faz

- **Não faz login.** Ele lê um token que já existe; conferir senha com Argon2 e
  emitir o primeiro token é assunto do
  [módulo 11](../../../docs/11-autenticacao.md). A rota `POST /sessoes` da demo
  não é login: não há senha, e qualquer um pede o papel que quiser.
- **Não faz logout, e não tem como fazer.** Um JWT válido vale até expirar. Não
  existe lista de tokens vivos para riscar um nome — é o preço de não consultar
  banco. Revogar de verdade exige refresh token guardado no banco, também no
  módulo 11.
- **Não autoriza.** Ele responde "quem é você", não "você pode isto". A segunda
  pergunta é do [`exigirPapel`](../exigir-papel/README.md).
- **Não protege por dono do recurso.** Um token válido de `leitor` chega em
  `GET /emprestimos/42` mesmo que o empréstimo 42 seja de outra pessoa. Essa
  checagem precisa buscar o recurso primeiro e por isso mora no service, não num
  middleware — é o
  [Broken Access Control do módulo 13](../../../docs/13-seguranca.md#broken-access-control--o-erro-nº-1-na-prática).
- **Não limita tentativas.** Uma rota de login sem limite cai por força bruta
  mesmo com o token perfeito: é o [`limitar`](../limitar/README.md).
- **Não protege o token em trânsito.** Bearer é um token **ao portador**: quem o
  lê, é você. Sem HTTPS ele viaja em texto puro — daí o `Strict-Transport-Security`
  dos [`cabecalhos-de-seguranca`](../cabecalhos-de-seguranca/README.md).

## Testado assim

Servidor: `node middlewares/03-acesso-e-seguranca/servidor.ts` (porta 6103).

A demo emite token por **query string** (`?papel=`) de propósito: assim o `curl`
cabe numa linha, sem `-H content-type` e sem JSON entre aspas — que o PowerShell
estraga. Numa API de verdade isso seria erro: a query aparece no log de acesso e
no `Referer`.

**Pedindo um token de leitor:**

```bash
curl.exe -s -X POST "http://localhost:6103/sessoes?papel=leitor&usuario=ana"
```

```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX..." }
```

**Papel que não existe — 422, e antes de qualquer token ser assinado:**

```bash
curl.exe -s -X POST "http://localhost:6103/sessoes?papel=xyz"
```

```json
{
  "erro": "papel_invalido",
  "mensagem": "Use ?papel=leitor, ?papel=editor ou ?papel=admin"
}
```

**Sem cabeçalho nenhum — 401:**

```bash
curl.exe -s -i http://localhost:6103/eu
```

```http
HTTP/1.1 401 Unauthorized
```

**Com o token, mas sem o prefixo `Bearer` — 401 mesmo o token sendo legítimo:**

```bash
curl.exe -s http://localhost:6103/eu -H "Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX..."
```

```json
{
  "erro": "nao_autenticado",
  "mensagem": "Formato esperado: Authorization: Bearer <token>"
}
```

Este é o caso que o parsing frouxo aceitaria. O token é válido; o formato não é.

**Token adulterado — um caractere a mais no fim:**

```bash
curl.exe -s -i http://localhost:6103/eu -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX...X"
```

```http
HTTP/1.1 401 Unauthorized
```

**É este o `curl` que separa `verify` de `decode`.** A carga desse token continua
perfeitamente legível — o `X` extra não estragou o base64 do payload, só a
assinatura. Um middleware com `jwt.decode` responderia **200** aqui, com o
usuário certinho no corpo. Nada no comportamento visível denunciaria a diferença
nos outros casos.

**Token íntegro — 200, e é aqui que `req.usuario` aparece:**

```bash
curl.exe -s http://localhost:6103/eu -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpX..."
```

```json
{ "usuario": { "id": "ana", "papel": "leitor" } }
```

O `id` veio do `sub` do token e o `papel` da carga — nenhuma consulta a banco
aconteceu entre a requisição e esta resposta.
