/**
 * Service de empréstimos — o coração do módulo 11, e onde o 13 fecha o IDOR.
 *
 * O módulo 13 acrescentou `buscarPorId` e `devolverPorEmprestimo`. Repare em
 * onde eles foram parar: aqui, e não num middleware novo. A razão é a mesma de
 * sempre, e está escrita por extenso logo abaixo.
 *
 * ---------------------------------------------------------------------
 * POR QUE A AUTORIZAÇÃO POR DONO MORA AQUI
 * ---------------------------------------------------------------------
 * `exigirPapel('admin')` cabe num middleware porque a resposta está DENTRO do
 * token: o papel viaja no JWT, e decidir não custa nem uma consulta.
 *
 * "Este empréstimo é seu?" não cabe. Para responder, é preciso buscar o
 * empréstimo do livro — ou seja, tocar nos dados. Um middleware que faz isso:
 *
 *   1. duplica a busca (ele consulta, e o service consulta de novo);
 *   2. precisa saber de onde tirar o id na URL, virando específico da rota;
 *   3. deixa a regra valer só para quem entra pelo HTTP — o worker de fila do
 *      módulo 17 e o script de importação passariam por fora dela.
 *
 * Princípio: **autorização que depende dos dados é regra de negócio.** Ela mora
 * junto com a regra, e o service é quem lança 403.
 *
 * A divisão prática que vale levar para qualquer projeto:
 *
 *   | Pergunta                        | Onde     | Precisa dos dados? |
 *   | ------------------------------- | -------- | ------------------ |
 *   | Você está logado?               | middleware | não              |
 *   | Você é admin?                   | middleware | não              |
 *   | Este recurso é seu?             | service    | SIM              |
 *   | Você tem saldo para isto?       | service    | SIM              |
 */
import type { Emprestimo, RepositorioEmprestimos } from '../dominio/emprestimo.ts';
import type { RepositorioLivros } from '../dominio/livro.ts';
import type { Papel } from '../dominio/usuario.ts';
import { conflito, naoEncontrado, semPermissao } from '../erros/AppError.ts';

/**
 * Quem está pedindo. Os dois campos vêm do TOKEN, nunca do corpo ou da query —
 * o controller garante isso (`middlewares/autenticar.ts`).
 *
 * Passar um objeto em vez de `(usuarioId, papel)` soltos não é estética: com dois
 * parâmetros do mesmo tipo primitivo lado a lado, trocar a ordem numa chamada
 * compila e vira falha de autorização silenciosa.
 */
export type Solicitante = { id: number; papel: Papel };

export function criarServicoEmprestimos(
  repoEmprestimos: RepositorioEmprestimos,
  repoLivros: RepositorioLivros,
) {
  /**
   * Busca um empréstimo COM a regra de visibilidade aplicada.
   *
   * ---------------------------------------------------------------
   * POR QUE 404 AQUI, SE `/livros/:id/devolver` RESPONDE 403
   * ---------------------------------------------------------------
   * Parece incoerência e não é. A diferença está no que o recurso já revela por
   * outros caminhos.
   *
   * O livro é PÚBLICO: `GET /livros/1` conta a qualquer pessoa que ele existe e
   * que está emprestado. Um 403 em `/livros/1/devolver` não entrega nada que a
   * rota pública já não entregasse — e o 403 informa melhor, porque diz ao
   * cliente "sua credencial está ótima, insistir não adianta".
   *
   * O empréstimo é PRIVADO: não existe rota que confirme a existência do
   * empréstimo nº 7 para quem não é dono. Aqui o 403 seria a única fonte dessa
   * informação — e um atacante iteraria `/emprestimos/1..500` contando os 403
   * para descobrir quantos empréstimos a biblioteca tem e em que faixas de id
   * eles caem.
   *
   * Princípio: **404 e 403 escolhem entre esconder a existência do recurso e
   * explicar a recusa.** A escolha é por recurso, e o critério é se a existência
   * dele já é pública por outro caminho. Fazer os dois iguais "por consistência"
   * é escolher sem olhar.
   *
   * Repare que os dois `throw` abaixo são a MESMA chamada, com os MESMOS
   * argumentos. É de propósito: mensagem, status e corpo idênticos. Uma
   * diferença de uma palavra reabriria exatamente o vazamento que o 404 fechou.
   */
  async function buscarVisivel(
    id: number,
    solicitante: Solicitante,
  ): Promise<Emprestimo> {
    const emprestimo = await repoEmprestimos.buscarPorId(id);
    if (!emprestimo) throw naoEncontrado('Empréstimo', id);

    const ehDono = emprestimo.usuarioId === solicitante.id;
    if (!ehDono && solicitante.papel !== 'admin') {
      throw naoEncontrado('Empréstimo', id);
    }

    return emprestimo;
  }

  return {
    /**
     * `GET /emprestimos/:id`.
     *
     * A correção de IDOR do módulo 13 mora aqui, e não num middleware, pelo
     * mesmo motivo de sempre: para saber de quem é o empréstimo é preciso
     * buscá-lo. Ver o bloco no topo deste arquivo.
     */
    async buscarPorId(id: number, solicitante: Solicitante): Promise<Emprestimo> {
      return buscarVisivel(id, solicitante);
    },

    /**
     * `POST /emprestimos/:id/devolver` — devolver pelo ID DO EMPRÉSTIMO.
     *
     * Convive com `POST /livros/:id/devolver`, que devolve pelo id do LIVRO e
     * continua respondendo 403 para quem não é dono. Duas rotas para a mesma
     * ação existem porque os dois caminhos são naturais: quem está na tela do
     * livro tem o id do livro; quem está na lista "meus empréstimos" tem o id do
     * empréstimo.
     *
     * O custo dessa conveniência é real e vale declarar: **a mesma regra passou
     * a ter dois pontos de entrada.** Foi para pagar esse custo uma vez só que a
     * checagem virou `buscarVisivel` — se cada rota trouxesse a sua cópia do
     * `if`, o dia em que uma delas mudasse produziria uma brecha visível só na
     * outra.
     */
    async devolverPorEmprestimo(
      id: number,
      solicitante: Solicitante,
    ): Promise<Emprestimo> {
      const emprestimo = await buscarVisivel(id, solicitante);

      // 409: o pedido está correto, é o estado que impede. Repare que este erro
      // só aparece para quem JÁ passou pela regra de visibilidade — quem não é
      // dono recebeu 404 antes de chegar aqui e não descobre nem que o
      // empréstimo já tinha sido devolvido.
      if (emprestimo.devolvidoEm) throw conflito('Empréstimo já foi devolvido');

      const devolvido = await repoEmprestimos.registrarDevolucao(
        emprestimo.id,
        new Date(),
      );
      if (!devolvido) throw naoEncontrado('Empréstimo', id);

      await repoLivros.atualizar(emprestimo.livroId, { disponivel: true });
      return devolvido;
    },

    /**
     * Pegar um livro emprestado.
     *
     * `usuarioId` é PARÂMETRO da função, e o controller o tira do token. Se ele
     * viesse do body, qualquer pessoa pegaria livro no nome de outra — e o
     * service não teria como saber. Princípio: **nada que identifica o autor da
     * ação vem do cliente.** Vale igual para `papel`, `criadoPor` e `contaId`.
     */
    async emprestar(livroId: number, usuarioId: number): Promise<Emprestimo> {
      const livro = await repoLivros.buscarPorId(livroId);
      if (!livro) throw naoEncontrado('Livro', livroId);

      // 409 e não 400: o pedido está correto, é o ESTADO do acervo que impede.
      // 400 diria ao cliente para corrigir o body, e não há nada a corrigir.
      if (!livro.disponivel) throw conflito('Livro já está emprestado');

      // ---------------------------------------------------------------
      // AS DUAS ESCRITAS QUE DEVERIAM SER UMA
      // ---------------------------------------------------------------
      // Criar o empréstimo e marcar o livro como indisponível são uma operação
      // lógica só. Em memória, o processo não morre no meio de duas linhas
      // síncronas — mas num banco, uma falha entre as duas deixaria o livro
      // indisponível SEM empréstimo registrado: ninguém consegue devolvê-lo, e
      // nenhuma tela mostra o porquê.
      //
      // A resposta é transação: `BEGIN`/`COMMIT` no SQLite (módulo 09) ou
      // `prisma.$transaction(async (tx) => ...)` no Prisma (10) — atomicidade, o
      // "A" de ACID. Aqui a ordem é escolhida para falhar do lado menos ruim: se
      // a segunda linha não rodasse, sobraria um empréstimo aberto de um livro
      // marcado como disponível — visível e corrigível.
      //
      // TODO(módulo 12): este é um bom caso para teste de integração, com um
      // repositório que falha de propósito na segunda escrita.
      const emprestimo = await repoEmprestimos.criar({ livroId, usuarioId });
      await repoLivros.atualizar(livroId, { disponivel: false });

      return emprestimo;
    },

    /**
     * Devolver — a regra de dono, escrita por extenso.
     *
     * A ordem das checagens não é aleatória. Primeiro "existe?" (409), depois "é
     * seu?" (403). Invertendo, um 403 para um livro que nem está emprestado
     * revelaria... nada de útil, mas confundiria o cliente. A regra geral é ir do
     * fato mais geral para o mais específico.
     */
    async devolver(
      livroId: number,
      usuarioId: number,
      papel: Papel,
    ): Promise<Emprestimo> {
      const livro = await repoLivros.buscarPorId(livroId);
      if (!livro) throw naoEncontrado('Livro', livroId);

      const emprestimo = await repoEmprestimos.buscarAbertoPorLivro(livroId);
      if (!emprestimo) throw conflito('Livro não está emprestado');

      // A LINHA DO MÓDULO.
      //
      // `usuarioId` veio do token (o controller garante), `papel` também. Nada
      // aqui é influenciável pelo cliente — é o que faz a checagem valer.
      if (emprestimo.usuarioId !== usuarioId && papel !== 'admin') {
        throw semPermissao('Só quem pegou o livro (ou um admin) pode devolvê-lo');
      }

      const devolvido = await repoEmprestimos.registrarDevolucao(
        emprestimo.id,
        new Date(),
      );
      if (!devolvido) throw naoEncontrado('Empréstimo', emprestimo.id);

      await repoLivros.atualizar(livroId, { disponivel: true });
      return devolvido;
    },

    /**
     * Os empréstimos do próprio usuário.
     *
     * Sem parâmetro de filtro vindo do cliente, de propósito. Um
     * `listarPorUsuario(id)` exposto direto na rota seria IDOR (Insecure Direct
     * Object Reference): trocar `?usuarioId=1` por `?usuarioId=2` na barra de
     * endereços leria o histórico do vizinho. É uma das falhas mais comuns em
     * API real justamente porque o código parece inocente.
     */
    async listarMeus(usuarioId: number): Promise<Emprestimo[]> {
      return repoEmprestimos.listarPorUsuario(usuarioId);
    },

    /** Só admin chega aqui — quem garante é o `exigirPapel` na rota. */
    async listarTodos(): Promise<Emprestimo[]> {
      return repoEmprestimos.listarTodos();
    },
  };
}

export type ServicoEmprestimos = ReturnType<typeof criarServicoEmprestimos>;
