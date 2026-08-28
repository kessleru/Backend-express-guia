# Middleware — limitar

📦 módulo 13 · 🧩 grupo 03

Conta requisições por cliente numa janela de tempo e responde **429** quando o
limite estoura. Duas versões lado a lado: a escrita à mão, que mostra o
mecanismo, e a `express-rate-limit`, que é a que vai para produção.

## O problema

Uma senha de seis dígitos tem um milhão de combinações. Um script faz milhares de
tentativas por segundo. Sem limite nenhum, a conta cai em minutos — e o servidor
responde a cada tentativa educadamente, porque cada uma delas é uma requisição
HTTP perfeitamente válida.

O Argon2 do [módulo 11](../../../docs/11-15/11-autenticacao.md#hash-de-senha-por-que-não-sha-256)
torna cada tentativa cara, uns 200 ms de CPU. Isso reduz o ritmo do atacante e
cria um problema novo: agora cada tentativa custa 200 ms **do seu servidor**.
Rate limit é o que transforma "caro" em "inviável", e é o que impede que a defesa
contra força bruta vire ela mesma o vetor de derrubada.

E não é só login. Uma rota de busca que varre o banco, um endpoint que manda
e-mail, um relatório que roda por trinta segundos — qualquer coisa cujo custo por
requisição seja alto precisa de um teto, senão um cliente com laço `while`
consome a capacidade que era de todos os outros.

Feito na rota, isso não existe: contar requisições exige estado que sobreviva
entre requisições, e a rota é justamente o lugar que não tem isso.

## Como funciona

O mecanismo cabe em três coisas: uma **chave** que identifica o cliente, um
**contador** por chave, e um **instante** em que o contador zera.

1. Chega requisição. Descobre a chave — aqui, `req.ip`.
2. Não há contador para essa chave, ou o prazo dela já venceu? Cria um novo, com
   total 1 e prazo em `agora + janelaMs`, e deixa passar.
3. Há contador vivo? Incrementa. Se passou do limite, responde **429** com
   `Retry-After`; senão, deixa passar.

É literalmente isso que a biblioteca faz por baixo. A diferença entre as duas
versões não está no mecanismo — está em quantos casos de borda cada uma acerta, e
é o assunto de [`## As decisões e o porquê`](#as-decisões-e-o-porquê).

O **429 Too Many Requests** é o status certo aqui, e não 403: a negativa é
temporária e o cliente deve tentar de novo mais tarde. O `Retry-After`, em
segundos, é o que diz quando. Sem ele, a reação natural de um cliente ao 429 é
tentar de novo imediatamente — e cada tentativa renova o motivo do bloqueio.

## O código

O arquivo está em [`middleware.ts`](./middleware.ts) e exporta as duas versões.

### Versão 1 — à mão, com `Map`

```ts
export function limitarNaMao({ janelaMs, limite }: ConfiguracaoDeLimite): RequestHandler {
  const contadores = new Map<string, { total: number; reiniciaEm: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const chave = req.ip ?? 'desconhecido';
    const agora = Date.now();
    const atual = contadores.get(chave);

    if (!atual || agora >= atual.reiniciaEm) {
      contadores.set(chave, { total: 1, reiniciaEm: agora + janelaMs });
      return next();
    }

    atual.total += 1;

    if (atual.total > limite) {
      const segundos = Math.ceil((atual.reiniciaEm - agora) / 1000);
      res.setHeader('Retry-After', String(segundos));
      res.status(429).json({
        erro: 'limite_excedido',
        mensagem: `Limite de ${limite} requisições por janela. Tente em ${segundos}s.`,
      });
      return;
    }

    next();
  };
}
```

**O `Map` fica dentro da fábrica, não no topo do arquivo.** Estado no topo do
módulo é compartilhado por todas as rotas que importarem daqui, e aí um limitador
de leitura passa a gastar a cota do de escrita. Dentro da fábrica, cada chamada
de `limitarNaMao(...)` tem o seu contador — que é o que permite o balde separado
por finalidade que o
[módulo 13](../../../docs/11-15/13-seguranca.md#rate-limiting-e-brute-force) recomenda:
uma cota para o login, outra para a navegação normal.

`req.ip` é a aproximação mais grosseira possível de "quem é o cliente". Um
escritório inteiro sai por um IP só e é bloqueado junto; quem tem botnet tem
milhares. É por isso que rate limit é **uma** camada, não a defesa. Depois do
[`autenticar`](../autenticar/README.md), `req.usuario?.id` costuma ser uma chave
melhor — mas só existe depois dele, e a rota de login, que é a que mais precisa
de limite, roda antes.

### O defeito: o dobro passando na virada

A janela acima começa na primeira requisição e vale `janelaMs`. Ela não desliza:
quando o prazo vence, o contador zera inteiro. Isso é **janela fixa**, e o
resultado com `limite: 3` e janela de 10 s é este:

```
00,0s  ██ 1ª  → 200   (janela A começa, reinicia em 10,0s)
09,7s  ██ 2ª  → 200
09,8s  ██ 3ª  → 200   (cota da janela A esgotada)
10,1s  ██ 4ª  → 200   (janela B: o contador zerou, começa do 1)
10,2s  ██ 5ª  → 200
10,3s  ██ 6ª  → 200
```

Seis requisições em 600 milissegundos, com um limite de três por dez segundos.
Nenhuma delas violou a regra escrita. O pico real é **o dobro** do configurado, e
ele acontece exatamente quando alguém está tentando descobrir onde fica a borda.

Para a rota de login com Argon2, o dobro na virada é o dobro de tentativas de
senha por minuto. **A correção não é diminuir o limite** — isso só move a borda
de lugar, mantendo o dobro. É trocar a contagem por uma que não zere de uma vez,
que é o que os `store` da biblioteca oferecem.

### Versão 2 — `express-rate-limit`

```ts
export function limitarComLib({
  janelaMs,
  limite,
}: ConfiguracaoDeLimite): RequestHandler {
  return rateLimit({
    windowMs: janelaMs,
    limit: limite,

    standardHeaders: 'draft-8',
    legacyHeaders: false,

    handler: (_req: Request, res: Response) => {
      const segundos = Number(res.getHeader('Retry-After') ?? 60);
      res.status(429).json({
        erro: 'limite_excedido',
        mensagem: `Limite de ${limite} requisições por janela. Tente em ${segundos}s.`,
      });
    },
  });
}
```

Mesma ideia, três coisas a mais que justificam a dependência:

- **`store` trocável.** O mesmo contador servindo várias instâncias — Redis, no
  módulo 15. É o que conserta o limite honesto do fim desta página, e é a razão
  principal.
- **Cabeçalhos padronizados.** `standardHeaders: 'draft-8'` liga `RateLimit` e
  `RateLimit-Policy`, que um cliente educado lê para se auto-regular **antes** de
  tomar 429. `legacyHeaders: false` desliga os `X-RateLimit-*`, que são anteriores
  ao padrão e nunca foram um: mandar os dois formatos dobra o tamanho do cabeçalho
  em toda resposta para agradar clientes que ninguém identificou.
- **As bordas certas** — a contagem, o `Retry-After` e o momento de zerar — sem
  você manter isso.

O `handler` existe porque a resposta padrão da biblioteca é o texto
`Too many requests, please try again later.`: corpo em inglês, sem JSON,
diferente de todo o resto da API. Um cliente precisaria de um tratamento só para
este status. Com o handler, o 429 sai igual ao da versão à mão — e a biblioteca
já pôs o `Retry-After` antes de ele rodar, o que permite ler o número de volta do
próprio cabeçalho.

## Como usar

```ts
// Uma cota por finalidade, não uma global
const limiteLogin = limitarComLib({ janelaMs: 60_000, limite: 5 });
const limiteBusca = limitarComLib({ janelaMs: 60_000, limite: 60 });

app.post('/sessoes', limiteLogin, handler);
app.get('/busca', limiteBusca, handler);
```

**Cedo na pilha, e antes de qualquer trabalho caro.** O ponto de um limitador é
não gastar recurso com a requisição excedente: registrado depois do `autenticar`,
ele já pagou a verificação do token; depois do parse do corpo, já leu megabytes
do socket. Um limitador que roda tarde ainda responde 429, mas depois de gastar
justamente o que deveria economizar.

**Depois** dos [`cabecalhos-de-seguranca`](../cabecalhos-de-seguranca/README.md),
porém: a resposta 429 também precisa deles, e um middleware que só põe cabeçalho
tem que rodar antes de qualquer coisa capaz de responder.

**Um balde por finalidade, nunca um global.** Um `app.use(limitar(...))` único
faz a navegação normal consumir a cota que deveria proteger a senha: o usuário
que carregou três telas chega ao login já sem crédito. E o número certo é
diferente em cada rota — 5 tentativas por minuto num login, 60 buscas por minuto
numa listagem.

**Todo número tem um porquê.** Na demo, a janela é de 10 segundos e o limite é 3
por um motivo que não é de produção: 10 segundos é o que deixa o teste da virada
de janela caber num `curl` manual. Em produção a janela é de minutos, e o limite
sai da conta "quantas requisições um usuário legítimo faz aqui no pior caso
normal?" — o teto fica acima disso com folga, senão a primeira vítima do
limitador é o cliente honesto.

## As decisões e o porquê

### As duas versões no mesmo arquivo

A versão à mão não vai para produção, e existe assim mesmo. O motivo é que rate
limit é o tipo de coisa que se liga sem entender: `rateLimit({ windowMs, limit })`
funciona, e quem só viu essa linha não sabe o que é uma janela, por que ela vira,
nem por que dois processos mudam o resultado. As 30 linhas do `Map` tornam as três
coisas visíveis.

Custo: duas implementações do mesmo conceito no repositório, e o risco de alguém
copiar a errada. Daí o comentário no arquivo — _escreva uma vez, use nenhuma_ — e
a demo montar cada versão na sua própria rota, para as duas serem exercitáveis
lado a lado.

### Janela fixa na versão à mão, mesmo sabendo do defeito

Poderia estar corrigida ali mesmo: janela deslizante se implementa guardando os
timestamps das requisições em vez de um contador, e descartando os que saíram da
janela a cada chegada.

O que ela custaria: cada chave passa a guardar uma lista em vez de dois números —
com limite de 100, são 100 timestamps por cliente em memória —, e o código dobra
de tamanho justo na pasta que existe para mostrar o mecanismo mínimo. E o defeito
tem valor didático: quem nunca viu a virada de janela acontecer não entende por
que a biblioteca oferece `store` diferentes.

### `Retry-After` mesmo com os cabeçalhos `RateLimit`

Há redundância: o `RateLimit` do draft-8 já traz `t=10`, os segundos até a janela
reabrir. `Retry-After` é o cabeçalho antigo, e continua sendo o único que
bibliotecas de cliente HTTP entendem sem configuração.

Custo: alguns bytes por resposta 429 — e só nas respostas 429. Barato o
suficiente para não valer a discussão.

### O corpo do 429 é JSON, como o resto da API

Um cliente que já trata `{ erro, mensagem }` em todos os outros status não deveria
precisar de um caminho especial para este. A alternativa (deixar o texto padrão da
biblioteca) custa exatamente esse caminho especial, escrito por cada consumidor da
API, para uma resposta que ele quase nunca vê e portanto quase nunca testa.

## Onde é fácil errar

| Sintoma                                                                   | Causa                                                                                                                   |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| O dobro do limite passa em menos de um segundo, sem nada errado no código | **O falso amigo:** janela fixa. Cada requisição respeitou a regra; o pico é na virada, e diminuir o limite não conserta |
| Em produção o teto real é o dobro (ou o quádruplo) do configurado         | Contador em memória com mais de um processo. Cada um conta o seu — veja [`## O que ele não faz`](#o-que-ele-não-faz)    |
| Um deploy no meio de um ataque devolve a cota cheia ao atacante           | Mesmo motivo: o `restart` zera o `Map` e o store padrão da biblioteca                                                   |
| Um escritório inteiro bloqueado por causa de um usuário                   | `req.ip` é a chave, e NAT faz centenas de pessoas saírem por um IP só                                                   |
| Todo mundo bloqueado junto, com um IP só nos contadores                   | API atrás de proxy ou CDN sem `app.set('trust proxy', ...)`: `req.ip` devolve o IP do proxy para todas as requisições   |
| Memória do processo crescendo devagar e sem parar                         | O `Map` da versão à mão só cresce: cada IP novo vira entrada que nunca é removida, mesmo depois de a janela vencer      |
| O usuário chega ao login já sem cota                                      | Um balde global compartilhado entre navegação e login. Um por finalidade                                                |
| A cota conta requisições de arquivo estático, imagem e `/health`          | Limitador registrado com `app.use` global. Rota a rota, ou por router                                                   |
| 429 sem os cabeçalhos de segurança                                        | O limitador registrado antes do `cabecalhosDeSeguranca`. A resposta de erro é a que mais tende a vazar informação       |

## O que ele não faz

- **Não sobrevive a dois processos, em nenhuma das duas versões.** O `Map` e o
  store padrão da biblioteca vivem na memória de **um** processo. Com dois atrás
  de um balanceador — o mínimo de qualquer implantação séria, e o que o `cluster`
  do Node faz numa máquina só —, cada um conta o seu: o atacante alterna entre
  eles sem saber e o teto real vira o dobro; com quatro processos, o quádruplo. O
  conserto é o contador sair do processo e ir para um armazenamento compartilhado,
  que é o Redis do módulo 15. Até lá, **o número configurado aqui é um teto por
  processo** — vale saber disso antes de prometê-lo a alguém.
- **Não limpa a memória, na versão à mão.** Cada chave nova é uma entrada que
  nunca é removida, mesmo com a janela vencida. Numa API pública, isso é vazamento
  de memória em ritmo de tráfego. Consertar pede uma varredura periódica, que é
  mais uma peça para manter — e é um dos motivos de a versão à mão não ir para
  produção.
- **Não distingue cliente atrás de NAT.** Todos compartilham a chave, e são
  bloqueados juntos.
- **Não para um ataque distribuído.** Mil IPs fazendo três requisições cada
  passam por qualquer limite por IP. Esse é o trabalho de uma camada acima — CDN,
  WAF, proteção do provedor —, não de um middleware dentro do processo.
- **Não substitui autenticação nem autorização.** Ele limita quantas vezes, não
  quem nem o quê: um atacante dentro do limite continua entrando. É uma camada da
  [defesa em profundidade](../../../docs/11-15/13-seguranca.md#defesa-em-profundidade).
- **Não avisa ninguém.** Uma rajada de 429 é o sinal mais claro de que algo está
  acontecendo, e transformá-la em alerta é
  [observabilidade](../../../docs/11-15/14-observabilidade.md), do módulo 14.

## Testado assim

Servidor: `node middlewares/03-acesso-e-seguranca/servidor.ts` (porta 6103).

As duas versões estão montadas em rotas diferentes, as duas com
`{ janelaMs: 10_000, limite: 3 }`: `/catalogo` usa a versão à mão e `/busca` a da
biblioteca.

**Doze requisições seguidas em `/busca`:**

```bash
for i in $(seq 12); do curl.exe -s -o /dev/null -w "%{http_code} " http://localhost:6103/busca; done
```

```
200 200 200 429 429 429 429 429 429 429 429 429
```

Três passaram, nove foram barradas — e as nove continuam sendo barradas até a
janela virar. Nenhuma delas chegou ao handler.

**Os cabeçalhos que a biblioteca devolve:**

```http
RateLimit: "3-in-10sec"; r=0; t=10
RateLimit-Policy: "3-in-10sec"; q=3; w=10; pk=:YmIwY2Q1MTM2YWU1:
```

Lendo o que cada campo diz: `r=0` é o que **resta** da cota — zero, já estourou —
e `t=10` são os segundos até a janela reabrir. No `RateLimit-Policy`, `q=3` é a
cota, `w=10` a janela em segundos e `pk` a chave de partição, que é o identificador
do cliente em forma anônima. Um cliente educado lê o `r` e para de mandar **antes**
de tomar 429 — é para isso que o cabeçalho existe.

Repare que os cabeçalhos vêm nas respostas **200** também, não só nas 429: na
primeira requisição eles saem com `r=2`.

**A virada de janela, na versão à mão** (`/catalogo`, janela de 10 s):

```bash
# três agora, três logo depois de a janela virar
curl.exe -s -o /dev/null -w "%{http_code} " http://localhost:6103/catalogo  # 200
curl.exe -s -o /dev/null -w "%{http_code} " http://localhost:6103/catalogo  # 200
curl.exe -s -o /dev/null -w "%{http_code} " http://localhost:6103/catalogo  # 200
curl.exe -s -o /dev/null -w "%{http_code} " http://localhost:6103/catalogo  # 429
# espere passar dos 10 s contados da PRIMEIRA requisição e repita
```

Depois da virada, as três primeiras voltam a responder 200 — é o dobro
atravessando a borda, com o limite de três por dez segundos intacto no papel.

**O corpo do 429, igual nas duas versões:**

```json
{
  "erro": "limite_excedido",
  "mensagem": "Limite de 3 requisições por janela. Tente em 7s."
}
```
