/**
 * Domínio do exemplo do módulo 12 — a mesma biblioteca, reduzida ao necessário
 * para o assunto ser teste, e não modelagem.
 *
 * Repare que este arquivo, como todo `dominio/` desde o módulo 08, não importa
 * nada. É o que torna o service testável sem servidor e sem banco — e é por isso
 * que a arquitetura em camadas aparece no currículo ANTES de testes: teste bom
 * não é técnica de teste, é consequência de acoplamento baixo.
 */

export type Livro = {
  id: number;
  titulo: string;
  autorId: number;
  ano: number;
  disponivel: boolean;
};

export type NovoLivro = {
  titulo: string;
  autorId: number;
  ano: number;
};

export type AtualizacaoLivro = {
  titulo?: string | undefined;
  ano?: number | undefined;
  disponivel?: boolean | undefined;
};

/**
 * O CONTRATO — e a peça central deste módulo.
 *
 * Uma interface aqui significa que o service depende de um TIPO, não de um
 * arquivo. No teste, você passa um objeto que satisfaz o tipo e pronto: sem
 * `vi.mock`, sem banco, sem servidor.
 *
 * Compare com o que seria preciso se o service importasse o SQLite direto:
 * `vi.mock('node:sqlite')`, um mock que precisa imitar `prepare`, `run`, `all` e
 * `get`, e que quebra quando a query muda. O mock passaria a testar o mock.
 */
export type RepositorioLivros = {
  listar(): Promise<Livro[]>;
  buscarPorId(id: number): Promise<Livro | null>;
  criar(dados: NovoLivro): Promise<Livro>;
  atualizar(id: number, dados: AtualizacaoLivro): Promise<Livro | null>;
  remover(id: number): Promise<boolean>;
};
