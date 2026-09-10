# 08.6 — Arquitetura hexagonal (portas e adaptadores)

**Em uma frase:** o sistema tem um núcleo que não sabe por onde é chamado nem
onde os dados ficam, e conversa com o mundo só por contratos — as portas — nos
quais se plugam peças trocáveis — os adaptadores.

[← Parte 5 — Quando não usar](./05-quando-nao-usar.md) · [Índice](./README.md) ·
[Parte 7 — Clean Architecture e Onion →](./07-clean-e-onion.md)

<!-- sumario:inicio -->

**Sumário**

- [O problema que ela quis resolver](#o-problema-que-ela-quis-resolver)
- [A mecânica](#a-mecânica)
- [O desenho](#o-desenho)
- [Na prática](#na-prática)
- [O princípio](#o-princípio)
- [O custo](#o-custo)
- [O que isso muda no seu código](#o-que-isso-muda-no-seu-código)

<!-- sumario:fim -->

## O problema que ela quis resolver

Em 2005, Alistair Cockburn descreveu um problema que você já viu na
[parte 1](./01-o-problema.md): a regra de negócio vazando para dentro da tela e
do banco. O efeito que ele apontou é o mesmo — não dá para testar sem a tela, não
dá para rodar a regra num processo em lote, não dá para outro sistema usar a
regra.

O objetivo, nas palavras dele, é permitir que a aplicação seja **usada da mesma
forma por pessoas, por outros programas, por testes automáticos ou por scripts**,
e desenvolvida sem depender do banco e dos dispositivos que ela vai usar de
verdade.

Repare que isso é uma ambição maior que a das partes 1 a 5. Lá, o objetivo era
**trocar o banco**. Aqui é trocar **qualquer coisa do lado de fora**, inclusive
quem chama a aplicação.

## A mecânica

O exemplo desta parte é
[`src/exemplos/06-10/08-arquiteturas/02-hexagonal/`](../../../src/exemplos/06-10/08-arquiteturas/02-hexagonal/),
a mesma API de cursos organizada assim:

```text
02-hexagonal/
├── nucleo/                ← o lado de dentro. Não importa nada de fora.
│   ├── curso.ts           tipos + o erro do núcleo
│   ├── portas.ts          os contratos: entrada e saída
│   └── catalogo.ts        as regras
├── adaptadores/           ← o lado de fora. Cada um fala com uma tecnologia.
│   ├── http/rotas.ts      Express → porta de entrada
│   ├── cli/comandos.ts    terminal → porta de entrada
│   ├── memoria/           porta de saída → array
│   └── console/           porta de saída → console.log
├── servidor.ts            monta com HTTP
└── cli.ts                 monta com terminal
```

### Porta: um contrato na borda do núcleo

Uma **porta** é um tipo que diz "por aqui o núcleo conversa com o mundo". Você já
conhece uma: o `RepositorioCursos` da [parte 3](./03-direcao-das-dependencias.md)
é uma porta. O que a hexagonal acrescenta é perceber que existem **dois sentidos**
de conversa:

```ts
// nucleo/portas.ts

// PORTA DE ENTRADA — o que o mundo pode pedir ao núcleo
export type CatalogoDeCursos = {
  listar(filtro: FiltroCursos): Promise<Curso[]>;
  buscar(id: number): Promise<Curso>;
  criar(dados: NovoCurso): Promise<Curso>;
  publicar(id: number): Promise<Curso>;
  remover(id: number): Promise<void>;
};

// PORTAS DE SAÍDA — o que o núcleo precisa que alguém faça por ele
export type RepositorioCursos = {/* guardar e buscar */};
export type Notificador = {
  avisarPublicacao(curso: Curso): Promise<void>;
};
```

A porta de entrada é a **lista do que o sistema sabe fazer**, escrita como tipo.
As portas de saída são **o que ele precisa de fora**. E as duas moram dentro do
núcleo, escritas na língua dele.

Repare no `Notificador`. Ele está aqui para mostrar que "o lado de fora" não é só
o banco: e-mail, fila, relógio, API de pagamento — cada coisa externa vira uma
porta. E o nome é `avisarPublicacao`, não `enviarEmail`. O núcleo diz **o que**
quer; se é e-mail, push ou uma linha no terminal, é problema de quem se plugar.

### Adaptador: a peça que fala com a tecnologia

Um **adaptador** é o código que liga uma porta a uma tecnologia concreta. Eles
também vêm em dois tipos, conforme quem toma a iniciativa:

- **Adaptador condutor** (do inglês _driving_): ele **chama** o núcleo. Chega uma
  requisição HTTP, uma linha de comando, um teste — e ele traduz para uma chamada
  da porta de entrada.
- **Adaptador conduzido** (_driven_): o núcleo **chama** ele. O núcleo pede
  "guarde isto", e o adaptador traduz para um `INSERT`, um `push` no array, um
  e-mail.

O adaptador HTTP é o único arquivo do exemplo que sabe o que é status code:

```ts
// adaptadores/http/rotas.ts
router.post('/:id/publicar', validar(idSchema, 'params'), async (_req, res) => {
  res.json(await catalogo.publicar(validados(res, idSchema, 'params').id));
});

// A tradução "tipo de problema do núcleo → status HTTP" em UM lugar.
const STATUS_POR_TIPO: Record<TipoDeErro, number> = {
  'nao-encontrado': 404,
  conflito: 409,
  'regra-violada': 400,
};
```

### O erro que não sabe o que é HTTP

Esse `STATUS_POR_TIPO` é a diferença mais sutil em relação ao exemplo principal.
Lá, o service lança `conflito(...)`, um `AppError` com o número 409 dentro. Aqui,
o núcleo lança um erro que diz só **que tipo** de problema aconteceu:

```ts
// nucleo/curso.ts
export type TipoDeErro = 'nao-encontrado' | 'conflito' | 'regra-violada';

export class ErroDoNucleo extends Error {
  readonly tipo: TipoDeErro;
  // ...
}
```

Por que o trabalho a mais? Porque existe um **segundo** adaptador de entrada, e
ele não fala HTTP.

### O mesmo núcleo, no terminal

```ts
// adaptadores/cli/comandos.ts
const CODIGO_DE_SAIDA: Record<TipoDeErro, number> = {
  'nao-encontrado': 2,
  conflito: 3,
  'regra-violada': 3,
};
```

No terminal, a tradução do erro é para **código de saída** — o número que um
programa devolve ao terminar, em que 0 é sucesso e qualquer outro número é
falha. Um script que chame este comando consegue distinguir "não existe" (2) de
"a regra não deixou" (3).

Se o núcleo lançasse `AppError` com status 409, o terminal teria que entender
HTTP para dar uma resposta. Com `ErroDoNucleo`, cada adaptador traduz para a
própria língua.

## O desenho

Com as peças vistas, o hexágono é só a figura que as organiza:

![O núcleo no centro em forma de hexágono, com a porta de entrada à esquerda e as portas de saída à direita. À esquerda, os adaptadores condutores HTTP, linha de comando e teste chamam a porta de entrada. À direita, os adaptadores conduzidos memória, SQLite, Prisma e console implementam as portas de saída.](./img/hexagono.svg)

A regra da figura é a mesma da [parte 3](./03-direcao-das-dependencias.md):
**toda seta de `import` aponta para o núcleo.** O núcleo não importa nenhum
adaptador; quem liga um no outro é o arquivo de montagem.

> **Atenção:** o hexágono **não** tem seis lados porque são seis camadas, nem
> seis portas. O próprio Cockburn explica que escolheu o hexágono só para ter
> espaço de desenhar quantas portas e adaptadores precisasse — e para fugir do
> desenho de camadas empilhadas, que sugere "em cima" e "embaixo". O que importa é
> **dentro** e **fora**.

## Na prática

O servidor responde igual aos outros exemplos. A diferença aparece no log, onde o
adaptador de console avisa da publicação:

```bash
node src/exemplos/06-10/08-arquiteturas/02-hexagonal/servidor.ts
curl -X POST localhost:5082/api/v1/cursos/2/publicar
```

```text
{"id":2,"titulo":"Express do zero","horas":8,"publicado":true}
```

E, no terminal do servidor:

```text
Hexagonal em http://localhost:5082/api/v1/cursos
[aviso] curso publicado: #2 "Express do zero"
```

Agora a prova do padrão. Sem servidor nenhum, o mesmo núcleo pelo terminal:

```bash
node src/exemplos/06-10/08-arquiteturas/02-hexagonal/cli.ts listar
node src/exemplos/06-10/08-arquiteturas/02-hexagonal/cli.ts publicar 2
node src/exemplos/06-10/08-arquiteturas/02-hexagonal/cli.ts publicar 3; echo "exit $?"
node src/exemplos/06-10/08-arquiteturas/02-hexagonal/cli.ts publicar 9; echo "exit $?"
```

```text
#1  publicado  4h  Fundamentos de HTTP
#2  rascunho   8h  Express do zero
#3  rascunho   1h  Curso relâmpago

[aviso] curso publicado: #2 "Express do zero"
ok: "Express do zero" publicado

erro: Curso precisa de ao menos 2h para ser publicado
exit 3

erro: Curso 9 não encontrado
exit 2
```

A regra das 2 horas valeu no terminal sem nenhuma linha copiada. Compare com a
[parte 1](./01-o-problema.md), em que uma segunda porta de entrada — o
`publicar-todos` — precisou copiar a regra e errou.

O repositório é em memória, então cada execução do `cli.ts` começa dos três
cursos iniciais. Com um adaptador SQLite plugado nos dois arquivos de montagem, o
que o terminal publicasse o servidor enxergaria.

## O princípio

O núcleo não sabe **por onde** foi chamado nem **onde** os dados ficam — e é por
não saber que ele serve a qualquer um.

## O custo

| O que a hexagonal pede               | O que custa                                             | Quando paga                                           |
| ------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------- |
| Erro do núcleo sem status HTTP       | uma tabela de tradução **em cada** adaptador de entrada | quando existe mais de um adaptador de entrada         |
| Porta de entrada como tipo explícito | um tipo a mais para manter junto da implementação       | quando outros times ou programas chamam o núcleo      |
| Uma porta para cada coisa externa    | um tipo e um adaptador por serviço externo              | quando você quer testar sem e-mail, fila, pagamento   |
| Dois ou mais arquivos de montagem    | a montagem se repete                                    | quando o mesmo núcleo roda como API **e** como worker |

Com um adaptador de entrada só — uma API HTTP e nada mais — metade da hexagonal
é cerimônia. A outra metade, a porta de saída para o banco, é exatamente o que o
exemplo principal já faz.

## O que isso muda no seu código

- Toda coisa externa que o núcleo usa ganha um tipo com nome de intenção
  (`Notificador`, `Relogio`, `CobrancaDeCartao`) antes de ganhar uma
  implementação.
- Status HTTP, código de saída e formato de mensagem de fila ficam nos
  adaptadores, nunca no núcleo.
- No [módulo 17](../../16-20/17-jobs-e-filas.md), um worker de fila é só mais um
  adaptador condutor, e o núcleo não percebe a diferença.

---

[← Parte 5 — Quando não usar](./05-quando-nao-usar.md) · [Índice](./README.md) ·
[Parte 7 — Clean Architecture e Onion →](./07-clean-e-onion.md)
