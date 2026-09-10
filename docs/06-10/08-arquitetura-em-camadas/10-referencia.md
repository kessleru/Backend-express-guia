# 08.10 — Referência

**Em uma frase:** o resumo do módulo para voltar depois — erros comuns,
cheatsheet, princípios e o que ler a seguir.

[← Parte 9 — O que este repositório usa](./09-o-que-este-repo-usa.md) ·
[Índice](./README.md)

<!-- sumario:inicio -->

**Sumário**

- [Erros comuns](#erros-comuns)
- [Cheatsheet](#cheatsheet)
- [Os princípios deste módulo](#os-princípios-deste-módulo)
- [Se quiser ir mais fundo](#se-quiser-ir-mais-fundo)
- [Para ir além](#para-ir-além)
- [Pratique](#pratique)

<!-- sumario:fim -->

## Erros comuns

| Erro                                                           | O que acontece                                                                   | Correção                                                            |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Regra no controller ou no handler                              | Worker, CLI e outras rotas a ignoram ou a copiam ([parte 1](./01-o-problema.md)) | Regra no service                                                    |
| Copiar a regra para uma rota nova                              | As cópias divergem: `publicar-todos` publica curso de 1h                         | Chamar a mesma função, nunca reescrever                             |
| Service importando `express`                                   | Não dá para testar nem reusar sem HTTP                                           | Só domínio                                                          |
| Repositório com `if` de negócio                                | Regra em dois lugares                                                            | Repositório só guarda                                               |
| Service importando o repositório concreto                      | Trocar banco quebra o service                                                    | Depender da interface, receber por parâmetro                        |
| Interface síncrona no repositório                              | O banco real, assíncrono, muda a assinatura e o service junto                    | `Promise` sempre                                                    |
| Interface com cara de banco (`findBySQL`, retorno com colunas) | O service passa a saber SQL                                                      | Métodos e tipos na língua do domínio                                |
| Repositório devolvendo referência interna                      | Quem recebeu altera o "banco" pelas costas                                       | Devolva cópia                                                       |
| `{ ...atual, ...dados }` no update                             | `undefined` apaga campo; com `exactOptionalPropertyTypes`, nem compila           | Copiar só o definido                                                |
| Service recebendo outro service                                | Dois pontos de entrada para a mesma regra; risco de dependência circular         | Service recebe repositórios, nunca services                         |
| `try/catch` em todo controller                                 | Repete o tratador central                                                        | Deixe o erro subir                                                  |
| Camadas num script de 3 rotas                                  | 12 arquivos para nada                                                            | Handler direto                                                      |
| Camada que só repassa                                          | Três arquivos abertos para ler uma linha                                         | Junte; separe quando a regra aparecer                               |
| Erro do núcleo com status HTTP e um adaptador que não é HTTP   | O terminal ou o worker recebe um `409` que não sabe interpretar                  | Erro com tipo; cada adaptador traduz ([parte 6](./06-hexagonal.md)) |
| `res.json(entidade)` com campos `#privados`                    | Responde `{"id":1}` e mais nada, sem erro de compilação                          | Mapear para objeto simples na borda HTTP                            |
| `===` entre dois value objects                                 | `false` mesmo com o mesmo conteúdo — compara endereço de memória                 | Método `igual()` que compara os valores                             |
| Repositório guardando a própria instância da entidade          | Um `curso.publicar()` sem `salvar` já altera o "banco"                           | Guardar uma fotografia e reconstituir a cada busca                  |
| Achar que DDD é ter pastas `domain/` e `application/`          | Pastas certas com modelo anêmico: o custo do DDD sem o benefício                 | DDD é regra dentro do objeto e contextos bem divididos              |

## Cheatsheet

O que o repositório usa:

```text
rotas/        → caminho + método + validação de formato
controllers/  → req → service → status + res
servicos/     → REGRA. lança AppError. sem HTTP, sem SQL
repositorios/ → guarda. sem regra. devolve cópia
dominio/      → tipos + interface do repositório. importa nada
servidor.ts   → composition root: monta tudo, de dentro para fora
```

```ts
// injeção de dependência, versão completa
export function criarServicoX(repo: RepositorioX) { return { ... }; }
export type ServicoX = ReturnType<typeof criarServicoX>;

const repo = criarRepositorioSQLite(db);  // troque aqui, só aqui
const servico = criarServicoX(repo);
```

As arquiteturas, numa linha cada:

```text
Camadas     → cada assunto no seu grupo de arquivos
Hexagonal   → núcleo + portas (entrada e saída) + adaptadores trocáveis
Clean       → 4 círculos: entidades, casos de uso, adaptadores, frameworks
Onion       → a mesma seta; o banco é casca, não centro
DDD tático  → regra dentro do objeto: entidade, value object, agregado
DDD estrat. → um modelo por contexto; a palavra muda, o modelo muda
Regra comum → import só aponta para dentro
```

## Os princípios deste módulo

Recapitulando — cada linha é uma conclusão que o módulo mostrou acontecer:

| A ideia                                                                                                                      | Onde volta |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Uma regra precisa de um endereço: um lugar só, de onde todo mundo a chama em vez de copiar.                                  | 12, 17     |
| O que quase nunca muda não pode depender do que muda toda hora. Regra de negócio com `import express` vira refém do Express. | 09, 10, 12 |
| Uma dependência importada é uma decisão já tomada; recebida por argumento, é uma decisão deixada para quem tem contexto.     | 12         |
| As decisões concretas ficam num arquivo só, o mais tarde possível. Trocar de banco vira uma linha, não uma caçada.           | 11, 12, 16 |
| Cada camada é uma compra: custa indireção e entrega uma flexibilidade. Se você não vai usar a flexibilidade, não compre.     | 10, 20     |
| Não aceitar um campo na entrada não é detalhe de tipagem — é a regra de segurança que impede alguém de se tornar admin.      | 11         |
| O núcleo não sabe por onde foi chamado nem onde os dados ficam — e é por não saber que ele serve a qualquer um.              | 12, 17     |
| A regra mora junto do dado que ela protege.                                                                                  | —          |
| Uma arquitetura não se escolhe inteira: cada ideia entra quando o problema que ela resolve aparece.                          | 20         |

## Se quiser ir mais fundo

Nomes e conexões que são verdade mas atrapalhariam a primeira leitura:

- **Inversão de dependência** é o "D" do SOLID, um conjunto de cinco princípios
  de design orientado a objetos reunidos por Robert C. Martin. A formulação
  original: módulos de alto nível não devem depender de módulos de baixo nível;
  os dois devem depender de abstrações.
- Os services deste repositório seguem o padrão que Fowler chama de **Service
  Layer** (camada de serviço): uma camada que define as operações disponíveis e
  coordena a resposta de cada uma. Cada método deles, por sua vez, é um
  **Transaction Script**: um procedimento que trata uma requisição do começo ao
  fim. Fowler considera o Transaction Script uma escolha legítima para regras
  simples — o problema do modelo anêmico só existe quando se diz estar fazendo
  um modelo de domínio.
- A Clean Architecture também cita duas propostas menos conhecidas, que você pode
  encontrar em material antigo: **DCI** (_Data, Context, Interaction_) e **BCE**
  (_Boundary, Control, Entity_).
- Um sistema dividido em contextos delimitados, cada um num serviço separado com o
  próprio banco, é o ponto de partida dos **microsserviços** — que cobram, em
  rede, deploy e consistência, um preço muito maior que o de módulos separados
  dentro do mesmo processo.

## Para ir além

As fontes primárias, quase todas curtas e gratuitas. Elas discordam entre si em
alguns pontos, e isso é bom: é o que evita tratar qualquer uma como dogma.

- **[Cockburn — _Hexagonal Architecture_](https://alistair.cockburn.us/hexagonal-architecture/)**
  O texto original de portas e adaptadores. Leia pela intenção (o parágrafo do
  começo) e pela explicação de por que o desenho é um hexágono. Tem o diagrama
  original.
- **[Martin — _The Clean Architecture_](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)**
  O artigo que deu origem ao livro e ao desenho dos círculos. Leia com filtro: a
  regra da seta é ótima; a quantidade de camadas costuma ser exagero para projeto
  pequeno — e o próprio texto diz que os círculos são só um esquema.
- **[Martin — _Screaming Architecture_](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html)**
  Por que a pasta de cima deveria dizer o assunto do sistema, não o framework.
- **[Palermo — _The Onion Architecture_](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/)**
  O diagnóstico das camadas tradicionais e a frase "o banco não é o centro".
- **[Fowler — _Presentation Domain Data Layering_](https://martinfowler.com/bliki/PresentationDomainDataLayering.html)**
  O contraponto honesto: por que separar em camadas, quando não vale, e por que
  sistemas grandes devem dividir primeiro por assunto.
- **[Fowler — _Anemic Domain Model_](https://martinfowler.com/bliki/AnemicDomainModel.html)**
  A crítica ao modelo que este repositório usa — leia sabendo que ela se aplica a
  quem diz fazer DDD, e não a quem escolheu Transaction Script de propósito.
- **[Fowler — _Domain Driven Design_](https://martinfowler.com/bliki/DomainDrivenDesign.html)**,
  **[_Bounded Context_](https://martinfowler.com/bliki/BoundedContext.html)**,
  **[_DDD Aggregate_](https://martinfowler.com/bliki/DDD_Aggregate.html)** e
  **[_Value Object_](https://martinfowler.com/bliki/ValueObject.html)**
  Quatro verbetes curtos, um conceito cada. O de contexto delimitado tem a
  história do "medidor".
- **[Fowler — _Patterns of Enterprise Application Architecture_](https://martinfowler.com/eaaCatalog/)**
  O catálogo que define Repository, Service Layer, Transaction Script e DTO — os
  nomes que este módulo usa.

## Pratique

👉 [`exercicios/06-10/08-camadas/`](../../../exercicios/06-10/08-camadas/)

**Desafio extra — a mesma regra em duas arquiteturas:** pegue a regra nova do
exercício ("livro emprestado não pode ser removido") e implemente-a de novo no
estilo do exemplo `04-ddd-tatico`: um método `garantirQuePodeSerRemovido()` numa
classe `Livro` com `#emprestado` privado. Depois compare as duas versões e
responda: quantos lugares do código conseguem mudar `emprestado` em cada uma?

---

[← Parte 9 — O que este repositório usa](./09-o-que-este-repo-usa.md) ·
[Índice](./README.md)
