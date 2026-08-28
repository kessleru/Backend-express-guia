/**
 * Domínio de autor. Também sem nenhum import.
 */

export type Autor = {
  id: number;
  nome: string;
  nacionalidade: string;
  nascimento?: Date | undefined;
};

export type NovoAutor = {
  nome: string;
  nacionalidade: string;
  nascimento?: Date | undefined;
};

export type AlterarAutor = {
  nome?: string | undefined;
  nacionalidade?: string | undefined;
  nascimento?: Date | undefined;
};

export type RepositorioAutores = {
  listar(): Promise<Autor[]>;
  buscarPorId(id: number): Promise<Autor | null>;
  criar(dados: NovoAutor): Promise<Autor>;
  atualizar(id: number, dados: AlterarAutor): Promise<Autor | null>;
  remover(id: number): Promise<boolean>;
};
