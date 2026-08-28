/**
 * Repositório de autores em memória.
 */
import type {
  AlterarAutor,
  Autor,
  NovoAutor,
  RepositorioAutores,
} from '../dominio/autor.ts';

export function criarRepositorioAutores(iniciais: Autor[] = []): RepositorioAutores {
  const autores: Autor[] = iniciais.map((a) => ({ ...a }));
  let ultimoId = Math.max(0, ...autores.map((a) => a.id));

  const copiar = (a: Autor): Autor => ({ ...a });

  return {
    async listar() {
      return autores.map(copiar);
    },

    async buscarPorId(id: number) {
      const autor = autores.find((a) => a.id === id);
      return autor ? copiar(autor) : null;
    },

    async criar(dados: NovoAutor) {
      const autor: Autor = {
        id: ++ultimoId,
        nome: dados.nome,
        nacionalidade: dados.nacionalidade,
        ...(dados.nascimento !== undefined ? { nascimento: dados.nascimento } : {}),
      };
      autores.push(autor);
      return copiar(autor);
    },

    async atualizar(id: number, dados: AlterarAutor) {
      const indice = autores.findIndex((a) => a.id === id);
      if (indice === -1) return null;

      const atualizado = copiar(autores[indice]!);
      if (dados.nome !== undefined) atualizado.nome = dados.nome;
      if (dados.nacionalidade !== undefined)
        atualizado.nacionalidade = dados.nacionalidade;
      if (dados.nascimento !== undefined) atualizado.nascimento = dados.nascimento;

      autores[indice] = atualizado;
      return copiar(atualizado);
    },

    async remover(id: number) {
      const indice = autores.findIndex((a) => a.id === id);
      if (indice === -1) return false;
      autores.splice(indice, 1);
      return true;
    },
  };
}
