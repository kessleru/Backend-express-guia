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
| **aridade**            | O número de parâmetros que uma função **declara** (não quantos você passa). O Express usa isso para diferenciar um middleware normal, que tem 3, de um tratador de erro, que tem 4.                              | [05](./01-05/05-middlewares.md), [06](./06-10/06-tratamento-de-erros.md) |

## B

| Termo            | O que é                                                                                                                                                  | Onde                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **backpressure** | O que acontece quando quem produz dados é mais rápido que quem consome. O excesso precisa ser segurado em algum lugar — e esse lugar tem tamanho finito. | [14](./11-15/14-observabilidade.md) |

## C

| Termo                     | O que é                                                                                                                                                                                                                  | Onde                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| **chave de idempotência** | Um identificador único que o cliente inventa para a tentativa e manda junto. O servidor guarda o resultado por chave e, na repetição, devolve o mesmo sem refazer nada. É como API de pagamento evita cobrar duas vezes. | [01](./01-05/01-fundamentos-http.md) |
| **claim**                 | Cada pedaço de informação guardado dentro de um token: quem é o usuário, quando o token expira, que papel ele tem.                                                                                                       | [11](./11-15/11-autenticacao.md)     |
| **composição**            | Encadear funções pequenas, de forma que uma prepare o terreno para a próxima, em vez de escrever uma função grande que faz tudo.                                                                                         | [05](./01-05/05-middlewares.md)      |

## E

| Termo                | O que é                                                                                                                                                                                   | Onde                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **efeito colateral** | Qualquer coisa que uma função faz além de devolver um valor: gravar no banco, mandar e-mail, escrever num log, apagar um arquivo. É o que não pode ser desfeito só por ignorar o retorno. | [02](./01-05/02-node-modulos-e-async.md), [13](./11-15/13-seguranca.md)       |
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
| **idempotente**             | Repetir a operação 10 vezes deixa o sistema no mesmo estado que fazer 1 vez. `DELETE /livros/7` é idempotente: apagar o que já foi apagado não muda mais nada.                                        | [01](./01-05/01-fundamentos-http.md), [03](./01-05/03-express-basico.md) |
| **índice (da pilha)**       | O contador que o Express usa para lembrar em que altura da fila de funções aquela requisição está. `next()` faz ele andar uma casa; se ninguém chama `next()`, ele para e a requisição nunca termina. | [05](./01-05/05-middlewares.md)                                          |
| **instância**               | Uma cópia do seu servidor rodando. Ter três instâncias é ter o mesmo programa aberto em três lugares, atendendo requisições em paralelo.                                                              | [01](./01-05/01-fundamentos-http.md)                                     |
| **inversão de dependência** | Em vez de a peça criar sozinha aquilo que ela usa, ela **recebe pronto** de fora. Isso permite trocar a peça de baixo (o banco, por exemplo) sem tocar na de cima.                                    | [08](./06-10/08-arquitetura-em-camadas.md)                               |

## K

| Termo          | O que é                                                                                                                                                                       | Onde                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **kernel**     | O núcleo do sistema operacional: a parte que conversa com o hardware e com a rede. É ele que consegue vigiar milhares de conexões de uma vez e avisar quais tiveram novidade. | [02](./01-05/02-node-modulos-e-async.md) |
| **keep-alive** | Reaproveitar a mesma conexão de rede para várias requisições, em vez de abrir uma nova a cada vez. Não muda o seu código, muda o desempenho.                                  | [01](./01-05/01-fundamentos-http.md)     |

## L

| Termo             | O que é                                                                                                                                                                                            | Onde                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **libuv**         | A biblioteca em C que o Node usa por baixo para conversar com o sistema operacional e descobrir quando uma operação de disco ou de rede terminou.                                                  | [02](./01-05/02-node-modulos-e-async.md) |
| **load balancer** | Quem fica na frente de várias cópias do seu servidor e decide qual delas atende cada requisição. Reparte por carga, não por usuário — então duas requisições suas podem cair em cópias diferentes. | [01](./01-05/01-fundamentos-http.md)     |

## M

| Termo           | O que é                                                                                                                                               | Onde                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **middleware**  | Uma função que roda no meio do caminho entre a requisição chegar e a resposta sair. Pode olhar, alterar, deixar passar adiante ou encerrar ali mesmo. | [05](./01-05/05-middlewares.md)      |
| **multiplexar** | Deixar várias trocas de mensagem acontecerem ao mesmo tempo dentro de uma conexão só, em vez de uma esperar a outra. É o que o HTTP/2 faz.            | [01](./01-05/01-fundamentos-http.md) |

## N

| Termo   | O que é                                                                                                                                                                          | Onde                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **N+1** | O problema de fazer 1 consulta para buscar uma lista e depois mais 1 consulta para cada item dela. Com 100 itens são 101 idas ao banco, e o código que faz isso parece inocente. | [10](./06-10/10-prisma-orm.md) |

## P

| Termo                       | O que é                                                                                                                                                                    | Onde                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **pilha (de middlewares)**  | A lista de funções que o Express monta conforme você chama `app.use` e `app.get`, na ordem exata em que você escreveu.                                                     | [05](./01-05/05-middlewares.md) |
| **preocupação transversal** | Algo que precisa acontecer em quase toda requisição — registrar log, conferir se o usuário está autenticado, medir o tempo — e que não pertence a nenhuma rota específica. | [05](./01-05/05-middlewares.md) |

## R

| Termo             | O que é                                                                                                                                                                   | Onde                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **rainbow table** | Uma tabela pronta com milhões de senhas comuns e o hash de cada uma. Serve para descobrir a senha original a partir do hash — e é exatamente o que o **salt** inutiliza.  | [11](./11-15/11-autenticacao.md)    |
| **RBAC**          | _Role-Based Access Control._ Decidir o que cada pessoa pode fazer a partir do papel dela (`admin`, `leitor`), em vez de listar permissão por permissão para cada usuário. | [11](./11-15/11-autenticacao.md)    |
| **redaction**     | Apagar ou mascarar dados sensíveis (senha, token, cartão) **antes** de eles serem escritos no log. Por configuração, não por disciplina de quem escreve o código.         | [14](./11-15/14-observabilidade.md) |
| **revogação**     | Cancelar uma credencial antes de ela expirar sozinha — o "sair de todos os dispositivos". É simples com sessão no servidor e difícil com JWT.                             | [11](./11-15/11-autenticacao.md)    |

## S

| Termo                        | O que é                                                                                                                                             | Onde                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **salt**                     | Um valor aleatório que entra no cálculo do hash junto com a senha. É o que faz duas pessoas com a mesma senha terem hashes diferentes.              | [11](./11-15/11-autenticacao.md)         |
| **semver**                   | _Semantic Versioning._ A convenção `MAIOR.MENOR.CORREÇÃO` das versões de pacote, em que subir o primeiro número avisa que algo incompatível mudou.  | [02](./01-05/02-node-modulos-e-async.md) |
| **sem estado** (_stateless_) | O servidor não guarda nada entre uma requisição e a seguinte. Cada requisição chega tendo que provar sozinha quem é — daí existirem token e cookie. | [01](./01-05/01-fundamentos-http.md)     |

## T

| Termo           | O que é                                                                                                                                                               | Onde                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **thread pool** | Um grupinho de threads que o Node mantém de lado (4 por padrão) para as tarefas que ele não consegue delegar ao sistema operacional, como ler arquivo e criptografia. | [02](./01-05/02-node-modulos-e-async.md) |

## V

| Termo             | O que é                                                                                                                                                              | Onde                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **valor mutável** | Um objeto que pode ser alterado depois de criado. `req` e `res` são assim, e é o que faz a fila de middlewares funcionar: o que um escreve neles, o próximo enxerga. | [05](./01-05/05-middlewares.md) |

---

Faltou alguma palavra? Ela devia estar aqui. Abra uma issue ou acrescente a
linha — o critério é simples: **se travou a leitura de alguém, entra.**
