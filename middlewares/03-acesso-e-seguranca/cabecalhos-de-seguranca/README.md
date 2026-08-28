# Middleware — cabecalhos-de-seguranca

📦 módulo 13 · 🧩 grupo 03

`helmet` configurado para uma API que só devolve JSON: liga o que protege, ajusta
o que foi feito para páginas e diz o que cada um dos dois grupos custa.

## O problema

Uma resposta HTTP não é só corpo. Ela carrega instruções sobre **como o cliente
deve tratar aquele conteúdo** — pode renderizar? pode carregar script? pode ir por
HTTP? pode entrar num iframe? Sem essas instruções, o navegador decide sozinho, e
as decisões padrão dele vêm de uma web em que segurança não era requisito.

Três exemplos concretos do que fica aberto:

- A resposta chega sem `X-Content-Type-Options`. O navegador **adivinha** o tipo
  pelo conteúdo, ignorando o `Content-Type` que você mandou. Um JSON cujo primeiro
  campo começa com `<` pode ser tratado como HTML e executado na sua origem, com
  os cookies dela.
- A API está em HTTPS e o cliente digita `http://`. Sem `Strict-Transport-Security`,
  essa primeira requisição sai em texto puro — com o cabeçalho `Authorization`
  dentro. Um token Bearer é ao portador: quem o lê, é você.
- A resposta anuncia `X-Powered-By: Express`. Não abre porta nenhuma; só entrega
  de graça qual stack procurar no próximo scanner.

E existe a razão de este middleware existir em vez de um `res.setHeader` na rota:
são doze cabeçalhos, cada um com um valor cheio de detalhes, e nenhum deles
pertence a uma rota específica. Escritos à mão, eles divergem entre rotas e somem
na rota nova. É o caso do
[módulo 05](../../../docs/01-05/05-middlewares.md#para-que-serve-a-coisa-que-precisa-acontecer-em-toda-rota),
com um agravante: aqui a ausência não dá erro nenhum. A resposta sai igual, com
status 200, e ninguém percebe.

## Como funciona

`helmet()` é uma função que devolve um middleware. Esse middleware chama
`res.setHeader` uma dúzia de vezes e `next()` — não lê corpo, não decide nada, não
tem estado. Ele **liga 12 cabeçalhos e remove 1**.

Ligados desta vez, na resposta da demo:

```http
Content-Security-Policy: default-src 'none';frame-ancestors 'none'
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Frame-Options: SAMEORIGIN
X-Permitted-Cross-Domain-Policies: none
X-XSS-Protection: 0
```

Removido: `X-Powered-By: Express`.

O que importa aqui não é a lista — o
[módulo 13](../../../docs/11-15/13-seguranca.md#helmet-os-headers-e-por-que-cada-um-existe)
já tem a tabela de o que cada um evita. É a pergunta que quase nenhum tutorial
faz: **quais destes fazem alguma coisa numa API que só devolve JSON?**

A resposta é: três, e o resto é seguro para deixar ligado. O porquê é a próxima
seção.

## O código

O arquivo está em [`middleware.ts`](./middleware.ts). Ele é uma chamada de
`helmet()` com quatro opções, e cada opção existe porque tem uma decisão atrás.

```ts
import helmet from 'helmet';

export const cabecalhosDeSeguranca = helmet({
  noSniff: true,
  hsts: { maxAge: 31_536_000, includeSubDomains: true },
  referrerPolicy: { policy: 'no-referrer' },
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
});
```

### Os que valem numa API JSON

**`X-Content-Type-Options: nosniff` — vale, e muito.**

É o único cabeçalho da lista que fecha um buraco que existe mesmo numa API que
nunca serve página. Sem ele, o navegador pode ignorar o `Content-Type` e adivinhar
o tipo pelo conteúdo; uma resposta JSON que comece com `<` — um campo `nome`
guardado como `<script>...` e devolvido no primeiro atributo — pode ser tratada
como HTML e **executada na sua origem**. Está no padrão do helmet; a opção está no
arquivo só para o comentário ter onde morar.

**`Strict-Transport-Security` — vale quando a API está atrás de HTTPS.**

Ele diz ao navegador "nos próximos 365 dias, nunca fale comigo em HTTP", o que
mata o ataque de downgrade descrito no problema acima. Em `http://localhost` o
cabeçalho é enviado e o navegador o ignora, porque HSTS só é aceito sobre HTTPS —
não atrapalha o desenvolvimento.

`preload` **não** está ligado, e é decisão: entrar na lista embutida nos
navegadores é fácil e sair leva meses. E `includeSubDomains` derruba qualquer
subdomínio que ainda viva em HTTP — de propósito, e é melhor decidir isso antes do
que descobrir pelo padrão.

**`Referrer-Policy: no-referrer` — vale pouco, e é barato.**

Evita que a URL da requisição atual vaze no `Referer` da próxima. Numa API isso só
importa quando alguém põe dado sensível na query (`?token=`, `?email=`), que é
justamente o que não se deve fazer — segunda linha de defesa para um erro que
acontece. A demo, aliás, comete esse erro de propósito no `POST /sessoes?papel=`,
para o `curl` caber numa linha.

### A parte que quase nenhum tutorial diz

A CSP padrão do helmet é `default-src 'self'; script-src 'self'; ...` e uma dúzia
de diretivas mais. **É uma política de página**: ela diz de onde o navegador pode
carregar script, estilo e imagem **ao renderizar este documento**.

Uma resposta `application/json` não renderiza nada e não carrega sub-recurso
nenhum. A política inteira governa um comportamento que não vai acontecer. Ela não
é errada — é **inaplicável**. Mandá-la em cada resposta são cerca de 180 bytes por
requisição em troca de zero, e tem um custo pior que os bytes: dá a sensação de
que a API está protegida contra XSS. Quem defende contra XSS numa API é a
validação da entrada e o escape de quem renderiza
([módulo 13](../../../docs/11-15/13-seguranca.md#xss-por-que-ainda-importa-numa-api-que-só-devolve-json)).

A decisão aqui não é `contentSecurityPolicy: false`, que perderia o único caso em
que ela ainda serve, nem manter a padrão. É trocá-la pela política de duas linhas
que descreve a verdade desta API:

| Diretiva                 | O que diz                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default-src 'none'`     | Esta resposta não carrega nada. Se um dia ela virar HTML sem querer — página de erro do Express, stack trace, arquivo servido por engano —, nenhum script dentro dela roda |
| `frame-ancestors 'none'` | Ninguém põe esta resposta dentro de um iframe. É a versão moderna do `X-Frame-Options`, e é o que a OWASP recomenda para API                                               |

`useDefaults: false` é o que faz valer só o que está escrito. Com ele ligado, as
diretivas padrão continuam presentes e a política volta ao tamanho de antes.

### O que fica ligado e quase não faz nada

`X-Frame-Options`, `X-DNS-Prefetch-Control`, `X-Download-Options`,
`X-Permitted-Cross-Domain-Policies`, `Origin-Agent-Cluster`,
`Cross-Origin-Opener-Policy` e `Cross-Origin-Embedder-Policy` são todos instruções
para o navegador **enquanto ele monta uma página**: iframe, janela, prefetch de
DNS, download, política de Flash. Um `curl`, um app móvel ou um `fetch` que lê
JSON não faz nada disso.

Ficam ligados assim mesmo, e o motivo é honesto: custam alguns bytes por resposta
e cobrem o dia em que a mesma aplicação passar a servir um HTML — uma página de
documentação, um `/health` bonitinho, uma tela de callback de OAuth. Desligar um
por um economiza pouco e cria a chance de esquecer de religar.

Duas exceções merecem decisão em vez de padrão:

**`Cross-Origin-Resource-Policy: same-origin`** instrui o navegador a recusar a
resposta quando ela é embutida por outra origem sem CORS — um `<img src>` ou
`<script src>` apontando para a sua API. Ele não substitui o CORS nem interfere
num `fetch` que negocia CORS direito. Se a API serve arquivo público consumido por
outro domínio (avatar, capa), este é o cabeçalho que quebra isso, e o conserto é
`crossOriginResourcePolicy: { policy: 'cross-origin' }` naquela rota.

**`X-XSS-Protection: 0`** — o helmet **desliga** o filtro de XSS antigo do
navegador, e isso é proposital. O filtro tinha bugs que criavam brecha onde não
havia. "Corrigir" para `1; mode=block` piora a segurança: é o falso amigo clássico
deste conjunto.

## Como usar

```ts
app.use(cabecalhosDeSeguranca); // PRIMEIRO de todos
app.use(limitarNaMao({ ... }));
app.get('/eu', autenticar, handler);
```

**Primeiro da pilha**, e a posição é o ponto. Um middleware que só põe cabeçalho
precisa rodar antes de qualquer coisa capaz de responder. Registrado depois do
[`limitar`](../limitar/README.md), o 429 sairia sem os cabeçalhos de segurança — e
a resposta de erro é justamente a que mais tende a vazar informação (versão do
framework, caminho de arquivo, estrutura interna).

O mesmo vale para o tratador de erros do grupo 02: um 500 sem `nosniff` é uma
resposta que o navegador pode adivinhar o tipo, e páginas de erro do Express são
HTML.

`app.use` sem caminho, de nível de aplicação, é o registro certo — ao contrário
do [`limitar`](../limitar/README.md#como-usar) e do
[`exigirPapel`](../exigir-papel/README.md#como-usar), aqui **não existe rota que
não queira** estes cabeçalhos.

## As decisões e o porquê

### Usar helmet em vez de escrever os `setHeader` à mão

Doze cabeçalhos, cada um com sintaxe própria e valores que mudam com o consenso da
área — `X-XSS-Protection` já foi `1; mode=block` e hoje é `0`, e essa inversão só
está refletida em quem acompanha. À mão, a lista congela no dia em que foi escrita.

Custo da dependência: uma a mais no `package.json`, com o que isso implica de
superfície ([módulo 13](../../../docs/11-15/13-seguranca.md#dependências-vulneráveis)),
e um comportamento padrão que muda entre versões maiores — a CSP padrão do helmet
já mudou, e um `npm update` pode alterar cabeçalho sem ninguém pedir. Por isso a
CSP aqui está escrita explicitamente em vez de herdada.

### CSP mínima em vez de `contentSecurityPolicy: false`

Desligar seria coerente com o argumento de que CSP é política de página. Mas
custaria o caso em que ela ainda protege: o dia em que uma resposta desta API sair
como HTML sem que ninguém tenha planejado — página de erro padrão do Express,
stack trace vazado, um arquivo servido por engano. Nesse dia, `default-src 'none'`
é o que impede um script dentro daquele HTML de rodar.

As duas diretivas custam cerca de 45 bytes por resposta contra os ~180 da padrão,
e cobrem o único cenário realista.

### `maxAge` de um ano no HSTS

`31_536_000` segundos são 365 dias, e é o valor que a lista de preload exige — o
que mantém a porta aberta para entrar nela sem mexer em nada. Um ano também é o
que faz o cabeçalho valer para o usuário que volta depois de meses.

Custo: se a API precisar voltar a HTTP por qualquer motivo, os navegadores que já
viram o cabeçalho **se recusam a conectar** por até um ano, e não há como
cancelar do lado do servidor a não ser mandando `max-age=0` e esperando cada
cliente passar de novo. Um ano é aposta em HTTPS permanente — que é o caso, mas
vale saber que é aposta.

### Helmet não é decisão terceirizada

`app.use(helmet())` sem argumento nenhum funciona e é melhor do que nada. O que
esta pasta faz é o passo seguinte: olhar a lista e perguntar o que cada item faz
**nesta** API. O resultado foi mudar uma opção (CSP), confirmar três e deixar as
outras oito como estão, sabendo por quê.

Custo da escolha: quatro opções escritas à mão é código para manter. O ganho é que
ninguém precisa adivinhar se a CSP daqui foi pensada ou é a que veio na caixa.

## Onde é fácil errar

| Sintoma                                                             | Causa                                                                                                                                                                                   |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O time "corrige" `X-XSS-Protection: 0` para `1; mode=block`         | **O falso amigo:** o zero é proposital. O filtro antigo do navegador tinha bugs que criavam brecha onde não havia, e ligá-lo de volta piora a segurança                                 |
| CSP configurada com capricho e o XSS acontece mesmo assim           | CSP é política de página; numa API JSON ela governa um comportamento que não existe. Quem defende contra XSS aqui é validação de entrada e escape na renderização                       |
| A resposta 429 ou 500 sai sem nenhum cabeçalho de segurança         | O helmet registrado depois do limitador ou do tratador de erros. Ele tem que ser o primeiro                                                                                             |
| Imagem servida pela API para de carregar em outro domínio           | `Cross-Origin-Resource-Policy: same-origin`, padrão do helmet. Conserto: `{ policy: 'cross-origin' }` naquela rota                                                                      |
| Requisição do front bloqueada e o erro fala em CORS                 | Helmet não faz CORS e não substitui o pacote `cors`. São problemas diferentes ([módulo 13](../../../docs/11-15/13-seguranca.md#cors-o-que-ele-faz-e-o-que-ele-definitivamente-não-faz)) |
| HSTS não parece ter efeito em desenvolvimento                       | Correto: o navegador só aceita HSTS sobre HTTPS. Em `http://localhost` o cabeçalho é enviado e ignorado                                                                                 |
| A API precisou voltar a HTTP e os navegadores se recusam a conectar | HSTS com `max-age` de um ano, já visto pelo cliente. Só `max-age=0` — e esperar cada cliente passar de novo — desfaz                                                                    |
| Um subdomínio interno em HTTP parou de abrir                        | `includeSubDomains`. É o comportamento pedido, e é o motivo de a opção merecer decisão explícita                                                                                        |
| `npm update` e um cabeçalho mudou de valor sozinho                  | Padrões do helmet mudam entre versões maiores. O que precisa ser estável vai escrito nas opções, como a CSP daqui                                                                       |

## O que ele não faz

- **Não protege contra XSS.** Ele manda instruções para o navegador; a defesa é
  validar a entrada e escapar na renderização. Numa API que só devolve JSON, o
  papel dela é **não estocar a munição**
  ([módulo 13](../../../docs/11-15/13-seguranca.md#xss-por-que-ainda-importa-numa-api-que-só-devolve-json)).
- **Não faz CORS.** Nenhum destes cabeçalhos libera ou bloqueia origem para um
  `fetch`; isso é o pacote `cors`, e os dois costumam ser confundidos porque os
  nomes se parecem.
- **Não protege cliente que não é navegador.** `curl`, app móvel e serviço a
  serviço ignoram a maior parte da lista. O que sobra para eles é o `nosniff` e o
  HSTS — que só vale se o cliente implementar HSTS, o que quase nenhum implementa.
- **Não substitui HTTPS.** `Strict-Transport-Security` numa API servida em HTTP é
  um cabeçalho que o navegador descarta. O TLS de verdade termina no proxy ou no
  balanceador, fora deste processo.
- **Não esconde erro nenhum.** Remover `X-Powered-By` é ofuscação, não defesa: o
  atacante descobre o stack pelo formato da página de erro em dois minutos. O que
  não vaza informação é o
  [tratador de erros do grupo 02](../../02-validacao-e-erros/tratador-de-erros/README.md),
  que mantém a stack trace longe do cliente.
- **Não valida nada da requisição.** Ele só escreve na resposta. O que entra é
  assunto do [`validar`](../../02-validacao-e-erros/validar/README.md).

## Testado assim

Servidor: `node middlewares/03-acesso-e-seguranca/servidor.ts` (porta 6103).

O middleware é `app.use` global, então qualquer rota serve. A `/publico` não tem
mais nenhum middleware, o que deixa a resposta limpa para ler os cabeçalhos.

```bash
curl.exe -s -i http://localhost:6103/publico
```

```http
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'none';frame-ancestors 'none'
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Frame-Options: SAMEORIGIN
X-Permitted-Cross-Domain-Policies: none
X-XSS-Protection: 0
Content-Type: application/json; charset=utf-8

{"acervo":"Biblioteca da praça","aberto":true}
```

Duas coisas para conferir nessa saída:

**O `X-Content-Type-Options: nosniff` está lá** — é o único da lista que fecha um
buraco real nesta API, e a resposta acima é a prova de que ele sai em toda
requisição sem nenhuma rota ter pedido.

**O `X-Powered-By: Express` não está.** Compare com qualquer outra demo deste
catálogo, onde ele aparece logo depois do `HTTP/1.1 200 OK` — a
[do grupo 01](../../01-requisicao-e-resposta/tempo-de-resposta/README.md#testado-assim)
tem a saída lado a lado. É o único cabeçalho que o helmet **remove** em vez de
adicionar, e a ausência dele é o efeito mais fácil de verificar de todo o
middleware.

**E a CSP tem duas diretivas, não doze.** `default-src 'none';frame-ancestors
'none'` é o resultado do `useDefaults: false` — sem ele, a mesma linha traria
`script-src`, `style-src`, `img-src`, `font-src`, `object-src`, `base-uri`,
`form-action`, `upgrade-insecure-requests` e mais algumas, todas governando um
documento que esta resposta não é.
