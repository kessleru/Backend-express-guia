# 00 — Glossário

Toda palavra técnica que aparece nos módulos, explicada em uma frase de
linguagem comum.

Se você travou numa palavra durante a leitura, ela tem que estar aqui. **Se não
estiver, é falha do material** — o módulo usou um termo sem explicar, e isso é
defeito pelas regras deste repo, não distração sua.

A explicação daqui é a versão curta, só para destravar a leitura. A coluna
"Onde" aponta o módulo em que a ideia é desenvolvida de verdade — é lá que ela
ganha o problema que resolve, o custo e o exemplo rodando.

<!-- sumario:inicio -->

**Sumário**

- [A](#a)
- [B](#b)
- [C](#c)
- [D](#d)
- [E](#e)
- [F](#f)
- [H](#h)
- [I](#i)
- [K](#k)
- [L](#l)
- [M](#m)
- [N](#n)
- [P](#p)
- [R](#r)
- [S](#s)
- [T](#t)
- [V](#v)

<!-- sumario:fim -->

## A

| Termo                  | O que é                                                                                                                                                                                                          | Onde                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **abstração que vaza** | Toda camada que esconde complexidade acaba deixando algum detalhe do que ela esconde aparecer. Você usa o ORM sem pensar em SQL até o dia em que a consulta fica lenta — e aí precisa saber o SQL que ele gerou. | [10](./06-10/10-prisma-orm.md)                                           |
| **acoplamento**        | O quanto uma parte do código precisa saber sobre outra para funcionar. Acoplamento alto significa que mexer aqui quebra ali.                                                                                     | [12](./11-15/12-testes.md)                                               |
| **adaptador**          | A peça que liga uma porta a uma tecnologia concreta: o Express de um lado, o SQLite do outro. Trocar de tecnologia é trocar de adaptador, sem mexer no núcleo.                                                   | [08.6](./06-10/08-arquitetura-em-camadas/06-hexagonal.md)                |
| **agregado**           | Um grupo de objetos do domínio tratado como uma coisa só, com uma entidade na frente (a **raiz**) por onde todo acesso passa. É carregado inteiro e salvo inteiro.                                               | [08.8](./06-10/08-arquitetura-em-camadas/08-ddd.md)                      |
| **aridade**            | O número de parâmetros que uma função **declara** (não quantos você passa). O Express usa isso para diferenciar um middleware normal, que tem 3, de um tratador de erro, que tem 4.                              | [05](./01-05/05-middlewares.md), [06](./06-10/06-tratamento-de-erros.md) |

## B

| Termo            | O que é                                                                                                                                                  | Onde                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **backpressure** | O que acontece quando quem produz dados é mais rápido que quem consome. O excesso precisa ser segurado em algum lugar — e esse lugar tem tamanho finito. | [14](./11-15/14-observabilidade.md) |

## C

| Termo                     | O que é                                                                                                                                                                                                                  | Onde                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **camada**                | Um grupo de arquivos que cuida de um assunto só — responder HTTP, decidir a regra, guardar o dado — e conversa com os outros grupos por funções bem definidas.                                                           | [08.1](./06-10/08-arquitetura-em-camadas/01-o-problema.md)         |
| **caso de uso**           | Uma operação que o sistema oferece, como "publicar um curso". Na Clean Architecture, cada uma vira um arquivo próprio.                                                                                                   | [08.7](./06-10/08-arquitetura-em-camadas/07-clean-e-onion.md)      |
| **chave de idempotência** | Um identificador único que o cliente inventa para a tentativa e manda junto. O servidor guarda o resultado por chave e, na repetição, devolve o mesmo sem refazer nada. É como API de pagamento evita cobrar duas vezes. | [01](./01-05/01-fundamentos-http.md)                               |
| **claim**                 | Cada pedaço de informação guardado dentro de um token: quem é o usuário, quando o token expira, que papel ele tem.                                                                                                       | [11](./11-15/11-autenticacao.md)                                   |
| **composição**            | Encadear funções pequenas, de forma que uma prepare o terreno para a próxima, em vez de escrever uma função grande que faz tudo.                                                                                         | [05](./01-05/05-middlewares.md)                                    |
| **composition root**      | O único arquivo que conhece todas as camadas e monta as peças. É onde se decide qual banco, qual e-mail, qual relógio — e em nenhum outro lugar.                                                                         | [08.4](./06-10/08-arquitetura-em-camadas/04-injecao-e-montagem.md) |
| **contexto delimitado**   | _Bounded context._ Uma parte do sistema com o próprio modelo e o próprio vocabulário. "Curso" no catálogo e "curso" no financeiro são coisas diferentes, e cada contexto tem o seu.                                      | [08.8](./06-10/08-arquitetura-em-camadas/08-ddd.md)                |
| **controller**            | A camada que traduz HTTP: lê a requisição, chama um método do service e escolhe o status da resposta. Não decide regra.                                                                                                  | [08.2](./06-10/08-arquitetura-em-camadas/02-cada-camada.md)        |
| **CRUD**                  | _Create, Read, Update, Delete._ As quatro operações de um cadastro — criar, ler, alterar, apagar —, sem nenhuma regra além de guardar e devolver.                                                                        | [08.5](./06-10/08-arquitetura-em-camadas/05-quando-nao-usar.md)    |

## D

| Termo       | O que é                                                                                                                                                                          | Onde                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **domínio** | O assunto de que o software trata — a escola, a biblioteca —, com as regras e os termos de quem trabalha nele. No código, a pasta com os tipos que todas as camadas usam.        | [08.2](./06-10/08-arquitetura-em-camadas/02-cada-camada.md), [08.8](./06-10/08-arquitetura-em-camadas/08-ddd.md) |
| **DTO**     | _Data Transfer Object._ Um tipo que só carrega dados de uma camada para outra, sem comportamento. `NovoCurso`, sem `id` nem `publicado`, é o DTO de entrada da criação de curso. | [08.2](./06-10/08-arquitetura-em-camadas/02-cada-camada.md)                                                      |

## E

| Termo                | O que é                                                                                                                                                                                   | Onde                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **efeito colateral** | Qualquer coisa que uma função faz além de devolver um valor: gravar no banco, mandar e-mail, escrever num log, apagar um arquivo. É o que não pode ser desfeito só por ignorar o retorno. | [02](./01-05/02-node-modulos-e-async.md), [13](./11-15/13-seguranca.md)       |
| **entidade**         | Um objeto do domínio que tem identidade: dois cursos com o mesmo título continuam sendo dois cursos, porque o `id` é diferente.                                                           | [08.8](./06-10/08-arquitetura-em-camadas/08-ddd.md)                           |
| **event loop**       | O laço que fica rodando dentro do Node pegando a próxima tarefa pronta e executando. É **um só**, e é por isso que uma função sua que demora trava o servidor inteiro.                    | [02](./01-05/02-node-modulos-e-async.md)                                      |
| **event loop delay** | O tempo que o event loop leva para voltar a atender quando já deveria ter voltado. É a medida de o quanto alguém está travando o servidor.                                                | [02](./01-05/02-node-modulos-e-async.md), [14](./11-15/14-observabilidade.md) |

## F

| Termo           | O que é                                                                                                                                                                                   | Onde                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **função pura** | Uma função cujo resultado depende **só** dos argumentos que recebeu, e que não altera nada fora dela. Dá a mesma resposta toda vez, então dá para testar sem preparar banco nem servidor. | [07](./06-10/07-validacao-zod.md) |

## H

| Termo       | O que é                                                                                                                                                    | Onde                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **handler** | A função que de fato responde a uma rota. No Express ele é o último item da fila de funções daquela requisição — não tem nada de especial além da posição. | [03](./01-05/03-express-basico.md), [05](./01-05/05-middlewares.md) |

## I

| Termo                       | O que é                                                                                                                                                                                               | Onde                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **I/O**                     | _Input/output_, entrada e saída: qualquer operação que sai do processo — ler disco, falar com o banco, chamar a rede. É o que deixa um teste lento e dependente de ambiente.                          | [08.5](./06-10/08-arquitetura-em-camadas/05-quando-nao-usar.md)          |
| **idempotente**             | Repetir a operação 10 vezes deixa o sistema no mesmo estado que fazer 1 vez. `DELETE /livros/7` é idempotente: apagar o que já foi apagado não muda mais nada.                                        | [01](./01-05/01-fundamentos-http.md), [03](./01-05/03-express-basico.md) |
| **índice (da pilha)**       | O contador que o Express usa para lembrar em que altura da fila de funções aquela requisição está. `next()` faz ele andar uma casa; se ninguém chama `next()`, ele para e a requisição nunca termina. | [05](./01-05/05-middlewares.md)                                          |
| **injeção de dependência**  | Passar para uma peça, por parâmetro, aquilo de que ela precisa, em vez de ela importar sozinha. Neste repositório é literalmente um argumento de função.                                              | [08.4](./06-10/08-arquitetura-em-camadas/04-injecao-e-montagem.md)       |
| **instância**               | Uma cópia do seu servidor rodando. Ter três instâncias é ter o mesmo programa aberto em três lugares, atendendo requisições em paralelo.                                                              | [01](./01-05/01-fundamentos-http.md)                                     |
| **inversão de dependência** | Em vez de a peça criar sozinha aquilo que ela usa, ela **recebe pronto** de fora. Isso permite trocar a peça de baixo (o banco, por exemplo) sem tocar na de cima.                                    | [08.3](./06-10/08-arquitetura-em-camadas/03-direcao-das-dependencias.md) |

## K

| Termo          | O que é                                                                                                                                                                       | Onde                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **kernel**     | O núcleo do sistema operacional: a parte que conversa com o hardware e com a rede. É ele que consegue vigiar milhares de conexões de uma vez e avisar quais tiveram novidade. | [02](./01-05/02-node-modulos-e-async.md) |
| **keep-alive** | Reaproveitar a mesma conexão de rede para várias requisições, em vez de abrir uma nova a cada vez. Não muda o seu código, muda o desempenho.                                  | [01](./01-05/01-fundamentos-http.md)     |

## L

| Termo                | O que é                                                                                                                                                                                            | Onde                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **libuv**            | A biblioteca em C que o Node usa por baixo para conversar com o sistema operacional e descobrir quando uma operação de disco ou de rede terminou.                                                  | [02](./01-05/02-node-modulos-e-async.md)            |
| **linguagem ubíqua** | O vocabulário que o time de desenvolvimento e o pessoal do negócio usam igual, na conversa e nos nomes do código. Se a escola diz "publicar", o método se chama `publicar`.                        | [08.8](./06-10/08-arquitetura-em-camadas/08-ddd.md) |
| **load balancer**    | Quem fica na frente de várias cópias do seu servidor e decide qual delas atende cada requisição. Reparte por carga, não por usuário — então duas requisições suas podem cair em cópias diferentes. | [01](./01-05/01-fundamentos-http.md)                |

## M

| Termo              | O que é                                                                                                                                                       | Onde                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **middleware**     | Uma função que roda no meio do caminho entre a requisição chegar e a resposta sair. Pode olhar, alterar, deixar passar adiante ou encerrar ali mesmo.         | [05](./01-05/05-middlewares.md)                     |
| **modelo anêmico** | Objetos do domínio só com dados, e todas as regras num service ao lado. É o que este repositório usa; o DDD propõe o contrário, com a regra dentro do objeto. | [08.8](./06-10/08-arquitetura-em-camadas/08-ddd.md) |
| **multiplexar**    | Deixar várias trocas de mensagem acontecerem ao mesmo tempo dentro de uma conexão só, em vez de uma esperar a outra. É o que o HTTP/2 faz.                    | [01](./01-05/01-fundamentos-http.md)                |

## N

| Termo   | O que é                                                                                                                                                                          | Onde                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **N+1** | O problema de fazer 1 consulta para buscar uma lista e depois mais 1 consulta para cada item dela. Com 100 itens são 101 idas ao banco, e o código que faz isso parece inocente. | [10](./06-10/10-prisma-orm.md) |

## P

| Termo                       | O que é                                                                                                                                                                                           | Onde                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **pilha (de middlewares)**  | A lista de funções que o Express monta conforme você chama `app.use` e `app.get`, na ordem exata em que você escreveu.                                                                            | [05](./01-05/05-middlewares.md)                           |
| **porta**                   | Um contrato (um tipo) na borda do núcleo que diz por onde ele conversa com o mundo. **De entrada:** o que o mundo pede ao núcleo. **De saída:** o que o núcleo pede ao mundo, como guardar dados. | [08.6](./06-10/08-arquitetura-em-camadas/06-hexagonal.md) |
| **preocupação transversal** | Algo que precisa acontecer em quase toda requisição — registrar log, conferir se o usuário está autenticado, medir o tempo — e que não pertence a nenhuma rota específica.                        | [05](./01-05/05-middlewares.md)                           |

## R

| Termo             | O que é                                                                                                                                                                   | Onde                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **rainbow table** | Uma tabela pronta com milhões de senhas comuns e o hash de cada uma. Serve para descobrir a senha original a partir do hash — e é exatamente o que o **salt** inutiliza.  | [11](./11-15/11-autenticacao.md)                            |
| **RBAC**          | _Role-Based Access Control._ Decidir o que cada pessoa pode fazer a partir do papel dela (`admin`, `leitor`), em vez de listar permissão por permissão para cada usuário. | [11](./11-15/11-autenticacao.md)                            |
| **redaction**     | Apagar ou mascarar dados sensíveis (senha, token, cartão) **antes** de eles serem escritos no log. Por configuração, não por disciplina de quem escreve o código.         | [14](./11-15/14-observabilidade.md)                         |
| **repositório**   | A camada que guarda e busca os dados, e só isso. O service fala com ela por uma interface, sem saber se por trás há um array, o SQLite ou o Prisma.                       | [08.2](./06-10/08-arquitetura-em-camadas/02-cada-camada.md) |
| **revogação**     | Cancelar uma credencial antes de ela expirar sozinha — o "sair de todos os dispositivos". É simples com sessão no servidor e difícil com JWT.                             | [11](./11-15/11-autenticacao.md)                            |

## S

| Termo                        | O que é                                                                                                                                             | Onde                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **salt**                     | Um valor aleatório que entra no cálculo do hash junto com a senha. É o que faz duas pessoas com a mesma senha terem hashes diferentes.              | [11](./11-15/11-autenticacao.md)                            |
| **semver**                   | _Semantic Versioning._ A convenção `MAIOR.MENOR.CORREÇÃO` das versões de pacote, em que subir o primeiro número avisa que algo incompatível mudou.  | [02](./01-05/02-node-modulos-e-async.md)                    |
| **sem estado** (_stateless_) | O servidor não guarda nada entre uma requisição e a seguinte. Cada requisição chega tendo que provar sozinha quem é — daí existirem token e cookie. | [01](./01-05/01-fundamentos-http.md)                        |
| **service**                  | A camada onde moram as regras de negócio. Não conhece HTTP nem SQL, e por isso serve igual a uma rota, a um teste e a um script.                    | [08.2](./06-10/08-arquitetura-em-camadas/02-cada-camada.md) |

## T

| Termo           | O que é                                                                                                                                                               | Onde                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **thread pool** | Um grupinho de threads que o Node mantém de lado (4 por padrão) para as tarefas que ele não consegue delegar ao sistema operacional, como ler arquivo e criptografia. | [02](./01-05/02-node-modulos-e-async.md) |

## V

| Termo             | O que é                                                                                                                                                              | Onde                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **valor mutável** | Um objeto que pode ser alterado depois de criado. `req` e `res` são assim, e é o que faz a fila de middlewares funcionar: o que um escreve neles, o próximo enxerga. | [05](./01-05/05-middlewares.md)                     |
| **value object**  | Um objeto definido só pelo valor, como dinheiro ou um título: se valida ao nascer, não muda depois, e dois com o mesmo conteúdo são iguais.                          | [08.8](./06-10/08-arquitetura-em-camadas/08-ddd.md) |

---

Faltou alguma palavra? Ela devia estar aqui. Abra uma issue ou acrescente a
linha — o critério é simples: **se travou a leitura de alguém, entra.**
