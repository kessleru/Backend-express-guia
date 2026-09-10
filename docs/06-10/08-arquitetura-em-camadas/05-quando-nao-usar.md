# 08.5 — Quando não usar

**Em uma frase:** cada camada é uma compra — custa arquivos e indireção, entrega
uma flexibilidade específica —, e só vale comprar a flexibilidade que você vai
usar.

[← Parte 4 — Injeção e montagem](./04-injecao-e-montagem.md) ·
[Índice](./README.md) · [Parte 6 — Arquitetura hexagonal →](./06-hexagonal.md)

<!-- sumario:inicio -->

**Sumário**

- [O problema: separar demais também dói](#o-problema-separar-demais-também-dói)
- [A camada como compra](#a-camada-como-compra)
- [O sinal de que uma camada não está pagando](#o-sinal-de-que-uma-camada-não-está-pagando)
- [O que fazer em cada situação](#o-que-fazer-em-cada-situação)
- [O princípio](#o-princípio)
- [O que isso muda no seu código](#o-que-isso-muda-no-seu-código)

<!-- sumario:fim -->

## O problema: separar demais também dói

As partes 1 a 4 mostraram o custo de separar de menos: a regra copiada, o banco
impossível de trocar. O erro oposto existe e é igualmente real.

Um script de 80 linhas com três rotas e nenhuma regra não precisa de cinco
pastas. Com elas, para entender o que acontece num `GET /cursos` você abre a
rota, que chama o controller, que chama o service, que chama o repositório — e
descobre que só o último fazia alguma coisa.

## A camada como compra

A forma de pensar que evita os dois erros é tratar cada camada como uma
**compra**. Ela custa arquivos, indireção e navegação, e em troca entrega uma
flexibilidade específica. A pergunta fica objetiva: **você vai usar essa
flexibilidade?** Se não vai, pagou a indireção e não levou nada.

| Camada          | O que ela compra                              | Não compre se...                        |
| --------------- | --------------------------------------------- | --------------------------------------- |
| **Service**     | regra testável e reusável fora do HTTP        | não há regra — é só passar dado adiante |
| **Repositório** | trocar de banco, testar sem I/O               | o banco é definitivo e você não testa   |
| **Controller**  | rota legível quando há muito mapeamento       | o handler cabe em 4 linhas              |
| **DTO/Mapper**  | o formato externo variar sem mexer no interno | os dois são iguais e vão continuar      |

_I/O_ (de _input/output_, entrada e saída) é qualquer operação que sai do
processo: ler disco, falar com o banco, chamar a rede. É o que deixa um teste
lento e dependente de ambiente.

## O sinal de que uma camada não está pagando

Ela só **repassa**. `controller.listar()` chama `servico.listar()`, que chama
`repo.listar()`, sem nenhum dos três acrescentar nada. São três arquivos abertos
para ler uma linha útil.

Há um exemplo vivo disso no repositório, escrito de propósito: o caso de uso
[`03-clean/casos-de-uso/listar-cursos.ts`](../../../src/exemplos/06-10/08-arquiteturas/03-clean/casos-de-uso/listar-cursos.ts)
existe só porque a Clean Architecture pede um arquivo por operação:

```ts
export function listarCursos(repositorio: RepositorioCursos): ListarCursos {
  return (filtro) => repositorio.listar(filtro);
}
```

Nesse caso, junte — e separe de novo no dia em que a regra aparecer.

> **Atenção:** o erro oposto é mais caro e mais comum. Adiar a separação até a
> regra estar espalhada por 20 handlers é o que produz o bug da
> [parte 1](./01-o-problema.md) — e tirar a regra de 20 lugares é muito mais
> trabalho do que tê-la posto num desde o começo. Por isso, na dúvida, **service
> primeiro**: é a camada que quase sempre paga.

## O que fazer em cada situação

| Situação                             | Faça                             |
| ------------------------------------ | -------------------------------- |
| Protótipo, script, 3 rotas           | Handler direto. Sem camada.      |
| CRUD simples sem regra               | Rota + repositório. Sem service. |
| Tem regra de negócio                 | Service. É o ganho real.         |
| Vai trocar de banco / testar isolado | Interface de repositório.        |

_CRUD_ é a sigla para as quatro operações básicas de um cadastro — _Create,
Read, Update, Delete_ (criar, ler, alterar, apagar) —, sem nenhuma regra além de
guardar e devolver.

A ordem de adoção que faz sentido, quando o projeto cresce:

1. **Service primeiro** — assim que aparece a primeira regra. É a separação que
   evita a regra copiada.
2. **Repositório depois** — quando o banco entra, ou quando você quer testar o
   service sem ele.
3. **Controller por último** — quando a rota ficar grande de tanto traduzir HTTP.

## O princípio

Separar é uma decisão de custo, não de estilo: **cada camada precisa pagar pelo
que custa**, e o sinal de que ela não paga é só repassar.

## O que isso muda no seu código

- Antes de criar uma camada, diga em voz alta o que ela compra. Se a resposta for
  "é o padrão", ela não compra nada ainda.
- Um projeto pode ter camadas diferentes em partes diferentes: o cadastro de
  categorias sem service, o de pedidos com service, repositório e tudo.
- As arquiteturas das próximas partes — Hexagonal, Clean, DDD — são **compras
  maiores**. As partes 6 a 8 dizem o preço de cada uma.

---

[← Parte 4 — Injeção e montagem](./04-injecao-e-montagem.md) ·
[Índice](./README.md) · [Parte 6 — Arquitetura hexagonal →](./06-hexagonal.md)
