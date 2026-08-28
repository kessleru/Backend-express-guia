/**
 * Domínio de livro. Este arquivo NÃO importa nada — nem Express, nem Zod, nem
 * banco. É o critério de aceite mais importante do exercício.
 *
 * Consequência prática: o tipo `Livro` aqui é escrito à mão, e não derivado de
 * `z.infer`. Parece uma perda em relação ao módulo 07, mas é uma escolha: o
 * domínio não pode depender da biblioteca de validação. O schema em
 * `schemas/livro.ts` descreve o CONTRATO HTTP; este tipo descreve o NEGÓCIO.
 * Eles se parecem hoje e podem divergir amanhã (um campo interno, por exemplo).
 */

export const GENEROS = ['ficcao', 'fantasia', 'tecnico', 'biografia'] as const;
export type Genero = (typeof GENEROS)[number];

export type Livro = {
  id: number;
  titulo: string;
  autorId: number;
  ano: number;
  isbn?: string | undefined;
  generos: Genero[];
  disponivel: boolean;
};

/** O que se pode criar: sem `id` (do banco) e sem `disponivel` (regra). */
export type NovoLivro = {
  titulo: string;
  autorId: number;
  ano: number;
  isbn?: string | undefined;
  generos: Genero[];
};

/**
 * O `| undefined` explícito é exigência do `exactOptionalPropertyTypes: true`.
 * Sem ele, o resultado do Zod (`{ titulo?: string | undefined }`) não encaixa.
 */
export type AlterarLivro = {
  titulo?: string | undefined;
  autorId?: number | undefined;
  ano?: number | undefined;
  isbn?: string | undefined;
  generos?: Genero[] | undefined;
};

/** O que o repositório aceita gravar — inclui o que o cliente não controla. */
export type AtualizacaoLivro = AlterarLivro & { disponivel?: boolean | undefined };

export type FiltroLivros = {
  autorId?: number | undefined;
  disponivel?: boolean | undefined;
  ordenar?: 'ano' | 'titulo' | undefined;
  pagina: number;
  porPagina: number;
};

/** Resultado paginado. O total vem do repositório porque só ele sabe contar. */
export type Pagina<T> = {
  dados: T[];
  pagina: number;
  porPagina: number;
  total: number;
};

/**
 * O CONTRATO. Todo método é `Promise`, mesmo na implementação em memória, que é
 * síncrona — é o que faz o módulo 09 (SQLite) não mudar assinatura nenhuma.
 *
 * Teste para saber se um método merece estar aqui: "isso faz sentido para SQL,
 * para Prisma E para array?". `buscarPorIsbn` sim. `filtrarComArrayFilter` não.
 */
export type RepositorioLivros = {
  listar(filtro: FiltroLivros): Promise<Pagina<Livro>>;
  listarDisponiveis(): Promise<Livro[]>;
  buscarPorId(id: number): Promise<Livro | null>;
  buscarPorIsbn(isbn: string): Promise<Livro | null>;
  contarPorAutor(autorId: number): Promise<number>;
  criar(dados: NovoLivro): Promise<Livro>;
  atualizar(id: number, dados: AtualizacaoLivro): Promise<Livro | null>;
  remover(id: number): Promise<boolean>;
};
