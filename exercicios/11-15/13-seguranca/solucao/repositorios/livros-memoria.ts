/**
 * Repositório de livros em memória.
 *
 * Zero regra de negócio: ele não sabe que ISBN é único nem que livro emprestado
 * não pode ser removido. Ele só sabe guardar, buscar e contar.
 */
import type {
  AtualizacaoLivro,
  FiltroLivros,
  Livro,
  NovoLivro,
  Pagina,
  RepositorioLivros,
} from '../dominio/livro.ts';

export function criarRepositorioLivros(iniciais: Livro[] = []): RepositorioLivros {
  // Estado no closure: quem recebe o repositório não alcança o array. Sem isso,
  // um handler distraído faria `livros.push()` e furaria todas as regras.
  const livros: Livro[] = iniciais.map((l) => ({ ...l }));
  let ultimoId = Math.max(0, ...livros.map((l) => l.id));

  /** Cópia defensiva: entregar a referência deixa alterarem o "banco" de fora. */
  const copiar = (l: Livro): Livro => ({ ...l, generos: [...l.generos] });

  return {
    async listar(filtro: FiltroLivros): Promise<Pagina<Livro>> {
      let resultado = livros;

      if (filtro.q !== undefined) {
        // A string do cliente é COMPARADA, nunca interpretada. Aqui isso é de
        // graça — `includes` não é uma linguagem, então `'; DROP TABLE livros; --`
        // é só um título que ninguém tem.
        //
        // A lição não é "use memória, é seguro": é que o valor do cliente tem
        // que chegar ao banco como DADO. Num repositório SQL a mesma busca vira
        // `WHERE titulo LIKE ?` com o parâmetro separado (módulo 09), e a
        // versão concatenada — `WHERE titulo LIKE '%${q}%'` — é a que apaga a
        // tabela.
        const alvo = filtro.q.toLowerCase();
        resultado = resultado.filter((l) => l.titulo.toLowerCase().includes(alvo));
      }

      if (filtro.autorId !== undefined) {
        resultado = resultado.filter((l) => l.autorId === filtro.autorId);
      }
      if (filtro.disponivel !== undefined) {
        resultado = resultado.filter((l) => l.disponivel === filtro.disponivel);
      }

      if (filtro.ordenar === 'ano')
        resultado = [...resultado].sort((a, b) => a.ano - b.ano);
      else if (filtro.ordenar === 'titulo') {
        resultado = [...resultado].sort((a, b) =>
          a.titulo.localeCompare(b.titulo, 'pt-BR'),
        );
      }

      // O total é do conjunto FILTRADO, antes de paginar. Contar depois daria
      // sempre no máximo `porPagina` — e a paginação do front quebraria.
      const total = resultado.length;
      const inicio = (filtro.pagina - 1) * filtro.porPagina;

      return {
        dados: resultado.slice(inicio, inicio + filtro.porPagina).map(copiar),
        pagina: filtro.pagina,
        porPagina: filtro.porPagina,
        total,
      };
    },

    async listarDisponiveis() {
      return livros.filter((l) => l.disponivel).map(copiar);
    },

    async buscarPorId(id: number) {
      const livro = livros.find((l) => l.id === id);
      return livro ? copiar(livro) : null;
    },

    async buscarPorIsbn(isbn: string) {
      const livro = livros.find((l) => l.isbn === isbn);
      return livro ? copiar(livro) : null;
    },

    async contarPorAutor(autorId: number) {
      return livros.filter((l) => l.autorId === autorId).length;
    },

    async criar(dados: NovoLivro) {
      const livro: Livro = {
        id: ++ultimoId,
        titulo: dados.titulo,
        autorId: dados.autorId,
        ano: dados.ano,
        generos: [...dados.generos],
        disponivel: true,
        // `exactOptionalPropertyTypes`: atribuir `undefined` a opcional é erro.
        ...(dados.isbn !== undefined ? { isbn: dados.isbn } : {}),
      };
      livros.push(livro);
      return copiar(livro);
    },

    async atualizar(id: number, dados: AtualizacaoLivro) {
      const indice = livros.findIndex((l) => l.id === id);
      if (indice === -1) return null;

      // `{ ...atual, ...dados }` seria o óbvio e está ERRADO: uma chave
      // `isbn: undefined` presente em `dados` apagaria o ISBN salvo. É esse bug
      // que o `exactOptionalPropertyTypes` recusa em tempo de compilação.
      const atualizado = copiar(livros[indice]!);
      if (dados.titulo !== undefined) atualizado.titulo = dados.titulo;
      if (dados.autorId !== undefined) atualizado.autorId = dados.autorId;
      if (dados.ano !== undefined) atualizado.ano = dados.ano;
      if (dados.isbn !== undefined) atualizado.isbn = dados.isbn;
      if (dados.generos !== undefined) atualizado.generos = [...dados.generos];
      if (dados.disponivel !== undefined) atualizado.disponivel = dados.disponivel;

      livros[indice] = atualizado;
      return copiar(atualizado);
    },

    async remover(id: number) {
      const indice = livros.findIndex((l) => l.id === id);
      if (indice === -1) return false;
      livros.splice(indice, 1);
      return true;
    },
  };
}
