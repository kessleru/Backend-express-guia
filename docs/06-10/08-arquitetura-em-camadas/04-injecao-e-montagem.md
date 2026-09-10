# 08.4 — Injeção e montagem

**Em uma frase:** cada peça recebe por parâmetro aquilo de que precisa, e um
único arquivo decide quais peças de verdade entram.

[← Parte 3 — A direção das dependências](./03-direcao-das-dependencias.md) ·
[Índice](./README.md) · [Parte 5 — Quando não usar →](./05-quando-nao-usar.md)

<!-- sumario:inicio -->

**Sumário**

- [O problema que sobrou da parte 3](#o-problema-que-sobrou-da-parte-3)
- [Injeção de dependência sem framework](#injeção-de-dependência-sem-framework)
- [Composition root: o único lugar que decide](#composition-root-o-único-lugar-que-decide)
- [O que isso muda no seu código](#o-que-isso-muda-no-seu-código)

<!-- sumario:fim -->

## O problema que sobrou da parte 3

A parte 3 terminou com o service dependendo só de um tipo, `RepositorioCursos`.
Mas um tipo não guarda dado nenhum — em algum momento o service precisa de um
repositório **de verdade** para chamar. Se ele importar o repositório de memória
para conseguir um, a seta volta a apontar para fora e todo o trabalho se perde.

A saída é o service não **buscar** o repositório: ele **recebe**.

## Injeção de dependência sem framework

```ts
// servicos/cursos.ts
export function criarServicoCursos(repositorio: RepositorioCursos) {
  return {
    async criar(dados: NovoCurso) {
      const existente = await repositorio.buscarPorTitulo(dados.titulo);
      if (existente) throw conflito('Já existe um curso com esse título');
      return repositorio.criar(dados);
    },
    // ...
  };
}
```

O service é uma função que **recebe** o repositório como argumento e devolve um
objeto com os métodos. Dentro dos métodos, `repositorio` é o que foi passado —
seja ele qual for.

Compare as duas versões pensando em **quem decide** qual banco usar:

```ts
// ❌ Importado: a decisão de qual banco usar está tomada, aqui, para sempre.
import { repositorioPrisma } from '../../repositorios/cursos-prisma.ts';

// ✅ Recebido: este arquivo não decide nada. Quem chamar decide.
export function criarServicoCursos(repositorio: RepositorioCursos) { ... }
```

Na primeira, testar o service exige fazer o Node devolver outro módulo quando
alguém importa aquele caminho — o que é frágil, lento, e quebra quando o arquivo
muda de lugar. Na segunda, testar é passar outro argumento.

Passar a dependência de fora, em vez de a peça buscá-la sozinha, tem um nome
grande: **injeção de dependência**. Aqui ela é, literalmente, um parâmetro de
função. Nada de NestJS, decorator ou container.

**O princípio.** Uma dependência importada é uma decisão já tomada; uma
dependência recebida é uma decisão deixada para quem tem contexto para tomá-la.

E "quem tem contexto" muda conforme quem chama:

| Quem monta              | Passa                    |
| ----------------------- | ------------------------ |
| `servidor.ts`           | o repositório de verdade |
| O teste (módulo 12)     | um em memória, isolado   |
| Um script de importação | um que grava em lote     |
| Um worker de fila (17)  | o mesmo de produção      |

### O tipo sai de graça

Com o service sendo uma função, o tipo dele não precisa ser escrito à mão:

```ts
export type ServicoCursos = ReturnType<typeof criarServicoCursos>;
```

`ReturnType<typeof f>` pede ao TypeScript "o tipo do que `f` devolve". É o que o
controller e a rota usam para receber o service. Mesma ideia do `z.infer` do
[módulo 07](../07-validacao-zod.md): uma fonte de verdade só, sem um tipo escrito
à mão que pode ficar para trás.

### Um service com vários repositórios

Um service pode receber mais de uma dependência. No exercício da biblioteca, o
service de livros precisa conferir se o autor existe — regra do livro que precisa
consultar autores:

```ts
export function criarServicoLivros(
  repoLivros: RepositorioLivros,
  repoAutores: RepositorioAutores,
) { ... }
```

> **Importante:** o que o service **não** deve receber é outro service. Aí a
> mesma regra ganha dois pontos de entrada, e cedo ou tarde aparece a dependência
> circular — o service A precisa do B, que precisa do A, e nenhum dos dois
> consegue ser criado primeiro.

### O custo

> **Atenção:** o custo é real. O `servidor.ts` cresce, e responder "o que este
> service usa?" exige olhar quem o construiu, não o topo do arquivo. Em projeto
> pequeno isso é burocracia.
>
> A linha divisória prática: injete o que **tem mais de uma implementação
> plausível** — banco, envio de e-mail, relógio, gerador de id — e importe o resto
> direto. Ninguém injeta `Math.max`.

Os frameworks de injeção (o NestJS, por exemplo) acrescentam uma coisa: descobrir
sozinhos quem passa o quê, lendo anotações no código. Isso é útil quando existem
centenas de peças para montar, e desnecessário quando você consegue escrever a
montagem à mão em cinco linhas.

## Composition root: o único lugar que decide

Se toda peça recebe o que precisa, alguém tem que entregar. Esse alguém é **um
arquivo só**, que conhece todas as camadas e monta de dentro para fora:

```ts
// servidor.ts
const repositorio = criarRepositorioEmMemoria(dadosIniciais); // ← trocar isto = trocar de banco
const servico = criarServicoCursos(repositorio);
const rotas = criarRotasCursos(servico);
app.use('/api/v1/cursos', rotas);
```

Esse arquivo tem nome: **composition root** — "a raiz da composição", o lugar
onde as peças são compostas. É a resposta para "onde a decisão concreta — qual
banco, de verdade — é tomada?". Aqui, e só aqui.

Repare que a decisão foi empurrada para o último momento possível e para um lugar
só. Imagine o contrário: `new PrismaClient()` espalhado por 12 arquivos. Trocar
de banco vira uma caçada, e a chance de esquecer um é alta. Concentrado aqui, é
uma linha.

**O princípio.** As decisões concretas ficam num arquivo só, o mais tarde
possível.

### Uma consequência que só aparece nos testes

O composition root é justamente o que **não** se testa: ele não tem lógica, só
montagem. E como toda a lógica está nas peças que ele monta, testar a lógica
nunca exige subir a aplicação inteira. É o que o
[módulo 12](../../11-15/12-testes.md) aproveita, e a razão de todo app a partir
dali se montar com `criarApp(deps)`: **separar montar de rodar**.

### Dois composition roots, um núcleo

O exemplo hexagonal leva a ideia ao limite: ele tem **dois** arquivos de
montagem, `servidor.ts` e `cli.ts`. Os dois montam o mesmo núcleo com as mesmas
peças de dados — só muda quem recebe as requisições (HTTP num, terminal no outro).
A [parte 6](./06-hexagonal.md) mostra os dois rodando.

## O que isso muda no seu código

- Toda função de camada vira uma **fábrica**: `criarServicoX(deps)`,
  `criarRotasX(servico)`, `criarRepositorioX(dados)`. Ela recebe o que precisa e
  devolve o objeto pronto.
- Nenhum arquivo, fora o composition root, escolhe uma implementação concreta.
- Trocar uma implementação — banco, e-mail, relógio — é mexer numa linha do
  composition root.

---

[← Parte 3 — A direção das dependências](./03-direcao-das-dependencias.md) ·
[Índice](./README.md) · [Parte 5 — Quando não usar →](./05-quando-nao-usar.md)
