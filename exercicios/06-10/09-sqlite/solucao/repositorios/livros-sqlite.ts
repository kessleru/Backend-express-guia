/**
 * `RepositorioLivros` sobre SQLite.
 *
 * Implementa EXATAMENTE a mesma interface de `dominio/livro.ts` que o repositório
 * em memória do exercício 08 implementa. Nenhum service, controller ou rota muda.
 */
import type { DatabaseSync } from 'node:sqlite';
import type {
  AtualizacaoLivro,
  FiltroLivros,
  Genero,
  Livro,
  NovoLivro,
  Pagina,
  RepositorioLivros,
} from '../dominio/livro.ts';

/**
 * A linha como o SQLite devolve: `snake_case`, `0/1` no lugar de boolean, e os
 * gêneros como uma string concatenada.
 *
 * Traduzir isso é o trabalho que o ORM do módulo 10 faz sozinho — e a razão de a
 * camada de repositório existir: o resto do sistema fala `Livro`.
 */
type LinhaLivro = {
  id: number;
  titulo: string;
  autor_id: number;
  ano: number;
  isbn: string | null;
  disponivel: number;
  generos: string | null; // 'fantasia,ficcao' ou null
};

function paraLivro(linha: LinhaLivro): Livro {
  return {
    id: linha.id,
    titulo: linha.titulo,
    autorId: linha.autor_id,
    ano: linha.ano,
    disponivel: linha.disponivel === 1,
    generos: linha.generos ? (linha.generos.split(',') as Genero[]) : [],
    // `exactOptionalPropertyTypes`: a chave só existe se houver valor. NULL do
    // banco vira chave ausente, não `isbn: undefined`.
    ...(linha.isbn !== null ? { isbn: linha.isbn } : {}),
  };
}

/**
 * O SELECT base, com os gêneros trazidos no mesmo statement.
 *
 * `LEFT JOIN` é essencial: com `INNER`, um livro sem gênero desapareceria do
 * resultado — e `buscarPorId` devolveria `null` para um livro que existe.
 *
 * Trazer os gêneros aqui, em vez de uma query por livro, é o que evita o
 * problema N+1 (o assunto do módulo 10) já nesta implementação.
 */
const SELECT_BASE = `
  SELECT l.*, GROUP_CONCAT(g.nome) AS generos
    FROM livros l
    LEFT JOIN livros_generos lg ON lg.livro_id = l.id
    LEFT JOIN generos g         ON g.id = lg.genero_id
`;

export function criarRepositorioLivrosSqlite(db: DatabaseSync): RepositorioLivros {
  const stmtPorId = db.prepare(`${SELECT_BASE} WHERE l.id = ? GROUP BY l.id`);
  const stmtPorIsbn = db.prepare(`${SELECT_BASE} WHERE l.isbn = ? GROUP BY l.id`);
  const stmtDisponiveis = db.prepare(
    `${SELECT_BASE} WHERE l.disponivel = 1 GROUP BY l.id ORDER BY l.titulo`,
  );
  const stmtContarPorAutor = db.prepare(
    'SELECT COUNT(*) AS total FROM livros WHERE autor_id = ?',
  );

  const stmtInserir = db.prepare(
    'INSERT INTO livros (titulo, autor_id, ano, isbn) VALUES (?, ?, ?, ?)',
  );
  const stmtLigarGenero = db.prepare(`
    INSERT INTO livros_generos (livro_id, genero_id)
    VALUES (?, (SELECT id FROM generos WHERE nome = ?))
  `);
  const stmtDesligarGeneros = db.prepare('DELETE FROM livros_generos WHERE livro_id = ?');
  const stmtRemover = db.prepare('DELETE FROM livros WHERE id = ?');

  /** Busca por id sem passar pelo tipo público — usada internamente. */
  const lerPorId = (id: number): Livro | null => {
    const linha = stmtPorId.get(id) as LinhaLivro | undefined;
    return linha ? paraLivro(linha) : null;
  };

  return {
    async listar(filtro: FiltroLivros): Promise<Pagina<Livro>> {
      // SQL dinâmico SEGURO: os pedaços são strings literais nossas, só os
      // valores entram por `?`.
      const condicoes: string[] = [];
      const valores: (string | number)[] = [];

      if (filtro.autorId !== undefined) {
        condicoes.push('l.autor_id = ?');
        valores.push(filtro.autorId);
      }
      if (filtro.disponivel !== undefined) {
        condicoes.push('l.disponivel = ?');
        valores.push(filtro.disponivel ? 1 : 0);
      }

      const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

      // O total é do conjunto FILTRADO inteiro, não da página. Contar depois de
      // paginar daria no máximo `porPagina` e quebraria a paginação do front.
      // Sem JOIN nem GROUP BY: contar linhas de `livros` basta e é mais rápido.
      const { total } = db
        .prepare(`SELECT COUNT(*) AS total FROM livros l ${where}`)
        .get(...valores) as { total: number };

      const ordem =
        filtro.ordenar === 'ano'
          ? 'ORDER BY l.ano'
          : filtro.ordenar === 'titulo'
            ? 'ORDER BY l.titulo'
            : 'ORDER BY l.id';

      const linhas = db
        .prepare(`${SELECT_BASE} ${where} GROUP BY l.id ${ordem} LIMIT ? OFFSET ?`)
        // A ordem dos `?` é posicional: primeiro os do WHERE, depois LIMIT/OFFSET.
        .all(...valores, filtro.porPagina, (filtro.pagina - 1) * filtro.porPagina);

      return {
        dados: (linhas as LinhaLivro[]).map(paraLivro),
        pagina: filtro.pagina,
        porPagina: filtro.porPagina,
        total,
      };
    },

    async listarDisponiveis() {
      return (stmtDisponiveis.all() as LinhaLivro[]).map(paraLivro);
    },

    async buscarPorId(id: number) {
      return lerPorId(id);
    },

    async buscarPorIsbn(isbn: string) {
      const linha = stmtPorIsbn.get(isbn) as LinhaLivro | undefined;
      return linha ? paraLivro(linha) : null;
    },

    async contarPorAutor(autorId: number) {
      const { total } = stmtContarPorAutor.get(autorId) as { total: number };
      return total;
    },

    /**
     * Inserir o livro e ligar os gêneros é UMA operação lógica em duas tabelas.
     * Sem transação, um gênero inválido deixaria o livro criado sem gêneros — um
     * estado que a API nunca deveria produzir.
     */
    async criar(dados: NovoLivro) {
      db.exec('BEGIN');
      try {
        const { lastInsertRowid } = stmtInserir.run(
          dados.titulo,
          dados.autorId,
          dados.ano,
          dados.isbn ?? null, // undefined não é aceito como parâmetro: use null
        );
        const id = Number(lastInsertRowid);

        for (const genero of dados.generos) stmtLigarGenero.run(id, genero);

        db.exec('COMMIT');
        return lerPorId(id)!; // acabou de ser criado; não pode ser null
      } catch (erro) {
        db.exec('ROLLBACK');
        throw erro;
      }
    },

    async atualizar(id: number, dados: AtualizacaoLivro) {
      db.exec('BEGIN');
      try {
        // UPDATE parcial: só as colunas presentes entram no SET. Montar
        // `SET isbn = ?` com valor `undefined` gravaria NULL e apagaria o campo —
        // o mesmo bug do spread do módulo 08, agora em SQL.
        const partes: string[] = [];
        const valores: (string | number | null)[] = [];

        if (dados.titulo !== undefined) {
          partes.push('titulo = ?');
          valores.push(dados.titulo);
        }
        if (dados.autorId !== undefined) {
          partes.push('autor_id = ?');
          valores.push(dados.autorId);
        }
        if (dados.ano !== undefined) {
          partes.push('ano = ?');
          valores.push(dados.ano);
        }
        if (dados.isbn !== undefined) {
          partes.push('isbn = ?');
          valores.push(dados.isbn);
        }
        if (dados.disponivel !== undefined) {
          partes.push('disponivel = ?');
          valores.push(dados.disponivel ? 1 : 0);
        }

        if (partes.length > 0) {
          valores.push(id);
          const { changes } = db
            .prepare(`UPDATE livros SET ${partes.join(', ')} WHERE id = ?`)
            .run(...valores);

          if (changes === 0) {
            db.exec('ROLLBACK');
            return null; // id não existe
          }
        } else if (!lerPorId(id)) {
          db.exec('ROLLBACK');
          return null;
        }

        // Gêneros: substituição completa (apaga e reinsere). Mais simples e
        // correto que calcular a diferença, e a tabela de junção é minúscula.
        if (dados.generos !== undefined) {
          stmtDesligarGeneros.run(id);
          for (const genero of dados.generos) stmtLigarGenero.run(id, genero);
        }

        db.exec('COMMIT');
        return lerPorId(id);
      } catch (erro) {
        db.exec('ROLLBACK');
        throw erro;
      }
    },

    async remover(id: number) {
      // As linhas de `livros_generos` somem sozinhas: ON DELETE CASCADE.
      const { changes } = stmtRemover.run(id);
      return changes > 0;
    },
  };
}
