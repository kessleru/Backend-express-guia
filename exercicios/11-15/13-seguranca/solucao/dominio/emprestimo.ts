/**
 * Domínio de empréstimo — a entidade que dá dono ao recurso.
 *
 * Até o módulo 10 o "empréstimo" era um booleano dentro do livro
 * (`disponivel`). Bastava enquanto ninguém perguntava QUEM pegou. A partir do
 * momento em que existe autorização por dono, o empréstimo precisa ser uma
 * entidade própria, com `usuarioId` e datas.
 *
 * Vale reparar no que aconteceu: uma exigência de SEGURANÇA mudou a MODELAGEM.
 * É o normal — "quem pode fazer o quê" quase sempre vira relacionamento no
 * modelo, não um `if` espalhado.
 */

export type Emprestimo = {
  id: number;
  livroId: number;
  usuarioId: number;
  pegoEm: Date;
  /** `undefined` = ainda está com o usuário. É o que define "aberto". */
  devolvidoEm?: Date | undefined;
};

export type NovoEmprestimo = {
  livroId: number;
  usuarioId: number;
};

/**
 * O contrato.
 *
 * `buscarAbertoPorLivro` é o método que a regra de dono exige: para saber se
 * quem pede a devolução pode devolver, é preciso primeiro descobrir de quem é
 * o empréstimo aberto daquele livro.
 *
 * Repare que ele não recebe `usuarioId`. Um `buscarAbertoPorLivroEUsuario`
 * seria mais direto, mas devolveria `null` tanto para "não está emprestado"
 * quanto para "está, mas é de outro" — e a API perderia a distinção entre 409 e
 * 403. Manter as duas respostas separadas é o que permite dizer ao cliente o
 * que de fato aconteceu.
 */
export type RepositorioEmprestimos = {
  buscarPorId(id: number): Promise<Emprestimo | null>;
  buscarAbertoPorLivro(livroId: number): Promise<Emprestimo | null>;
  listarPorUsuario(usuarioId: number): Promise<Emprestimo[]>;
  listarTodos(): Promise<Emprestimo[]>;
  criar(dados: NovoEmprestimo): Promise<Emprestimo>;
  registrarDevolucao(id: number, devolvidoEm: Date): Promise<Emprestimo | null>;
};
