# 08 — Arquitetura em camadas

**Em uma frase:** separar "responder HTTP", "decidir a regra" e "guardar o dado"
em arquivos diferentes, com as dependências apontando sempre para dentro.

## Por que importa

- Rota de 200 linhas fazendo tudo é impossível de testar e de reusar.
- A regra de negócio precisa valer também no worker de fila, no seed, no CLI.
- Trocar o banco deve mexer em **um** arquivo, não em vinte.

## Como estudar este módulo

O módulo é grande porque o assunto é grande, e por isso está em partes — uma por
sessão de estudo. Leia na ordem: cada parte usa o que a anterior mostrou.

As **partes 1 a 5** ensinam o que o repositório faz e por quê. As **partes 6 a 8**
apresentam os nomes famosos — Hexagonal, Clean, Onion, DDD — cada um com um
exemplo rodando, para você reconhecer as ideias quando encontrar em outro
projeto. A **parte 9** junta tudo e responde "qual dessas a gente usa".

| Parte | Assunto                                                        | Você sai sabendo                                                                    |
| ----- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1     | [O problema](./01-o-problema.md)                               | por que "tudo na rota" quebra — com o bug acontecendo na sua frente                 |
| 2     | [Cada camada](./02-cada-camada.md)                             | o que rota, controller, service, repositório e domínio fazem, e o que **não** fazem |
| 3     | [A direção das dependências](./03-direcao-das-dependencias.md) | por que as setas apontam para dentro, e o que é inversão de dependência             |
| 4     | [Injeção e montagem](./04-injecao-e-montagem.md)               | como as peças se conectam sem uma importar a outra                                  |
| 5     | [Quando não usar](./05-quando-nao-usar.md)                     | quanto cada camada custa, e como decidir se ela vale                                |
| 6     | [Arquitetura hexagonal](./06-hexagonal.md)                     | portas e adaptadores, e um mesmo núcleo atendendo HTTP e terminal                   |
| 7     | [Clean Architecture e Onion](./07-clean-e-onion.md)            | os quatro círculos, casos de uso, apresentador                                      |
| 8     | [DDD](./08-ddd.md)                                             | entidade, value object, agregado, contexto delimitado, modelo anêmico               |
| 9     | [O que este repositório usa](./09-o-que-este-repo-usa.md)      | o veredito, pasta por pasta, e como reconhecer a arquitetura de outro projeto       |
| 10    | [Referência](./10-referencia.md)                               | erros comuns, cheatsheet, princípios e leituras — para voltar depois                |

## A resposta curta, para quem chegou com a dúvida

"O repositório usa DDD ou Clean Architecture?" **Nenhuma das duas por inteiro.**

Ele usa **camadas** — rota, controller, service, repositório — com um detalhe que
faz toda a diferença: o service não conhece o banco. Ele conhece só um contrato
(um tipo) que diz o que o banco precisa saber fazer, e o banco se encaixa por
fora. Esse detalhe é a ideia central que a Hexagonal e a Clean têm em comum, e é
por isso que o projeto _se parece_ com elas.

Do DDD, ele usa pouco: os nomes do negócio no código. As regras moram nos
services, e não dentro dos objetos, que é o oposto do que o DDD propõe.

Os termos desta resposta ganham explicação de verdade nas partes 6 a 8, e o
veredito completo, com o que falta de cada uma e por quê, está na
[parte 9](./09-o-que-este-repo-usa.md).

## Os exemplos

Todos implementam **a mesma API** de cursos, com os mesmos três cursos iniciais.
O que muda entre eles é só onde cada coisa mora — é isso que torna a comparação
honesta.

| Exemplo                                                                                            | O que mostra                                      | Porta | Usado na parte |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----- | -------------- |
| [`08-camadas/`](../../../src/exemplos/06-10/08-camadas/)                                           | **o que o repositório usa** — o exemplo principal | 5056  | 2 a 5          |
| [`08-arquiteturas/01-tudo-na-rota/`](../../../src/exemplos/06-10/08-arquiteturas/01-tudo-na-rota/) | ❌ o jeito que dói, com o bug reproduzível        | 5081  | 1              |
| [`08-arquiteturas/02-hexagonal/`](../../../src/exemplos/06-10/08-arquiteturas/02-hexagonal/)       | portas e adaptadores, HTTP **e** linha de comando | 5082  | 6              |
| [`08-arquiteturas/03-clean/`](../../../src/exemplos/06-10/08-arquiteturas/03-clean/)               | quatro círculos, um arquivo por caso de uso       | 5083  | 7              |
| [`08-arquiteturas/04-ddd-tatico/`](../../../src/exemplos/06-10/08-arquiteturas/04-ddd-tatico/)     | entidade rica, value objects, agregado            | 5084  | 8              |

As portas 508N ficam fora da faixa 5051–5064 dos outros exemplos: dá para subir
os cinco ao mesmo tempo e comparar as respostas lado a lado.

## Pratique

👉 [`exercicios/06-10/08-camadas/`](../../../exercicios/06-10/08-camadas/) — a
biblioteca refatorada em camadas. O exercício usa só o que as partes 1 a 5
ensinam.
