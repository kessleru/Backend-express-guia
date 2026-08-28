/**
 * O MESMO contrato, agora sobre `node:sqlite` (módulo 09).
 *
 * Ele existe neste módulo por um motivo específico: mostrar que o repositório em
 * memória **não prova** que o de banco funciona. Os dois passam nos testes do
 * service — porque o service só conhece a interface —, mas só o de banco pode
 * errar o SQL, esquecer um índice ou traduzir tipo errado.
 *
 * Daí a regra: **teste unitário valida a REGRA; teste de integração valida a
 * TRADUÇÃO.** Um não substitui o outro, e quem tem só o primeiro descobre o SQL
 * quebrado em produção.
 */
import { DatabaseSync } from 'node:sqlite';
import type {
  AtualizacaoLivro,
  Livro,
  NovoLivro,
  RepositorioLivros,
} from '../dominio.ts';

/**
 * `':memory:'` é o banco de teste ideal, e é aqui que o SQLite brilha.
 *
 * Ele é um banco SQL DE VERDADE — mesmas queries, mesmas constraints, mesmos
 * tipos — que vive na RAM e desaparece quando a conexão fecha. Consequências:
 *
 *   - Cada teste ganha um banco vazio em microssegundos, sem `TRUNCATE`, sem
 *     transação-e-rollback, sem container de Postgres subindo no CI.
 *   - Testes podem rodar em PARALELO: cada um tem o próprio banco, não há
 *     tabela compartilhada para dar conflito.
 *
 * O custo honesto: SQLite não é Postgres. Se o projeto usa Postgres em produção,
 * testar em SQLite deixa passar diferença de dialeto (tipos, `ON CONFLICT`,
 * checagem de constraint). Aí o certo é rodar a integração contra o banco real
 * em container. Aqui os dois são SQLite, então o teste é fiel.
 */
export function criarRepositorioSqlite(caminho = ':memory:'): RepositorioLivros & {
  fechar(): void;
} {
  const db = new DatabaseSync(caminho);

  // A migration mora junto da criação para o teste não precisar de passo extra.
  // Num projeto real isto é o arquivo de migration versionado (módulo 09) — o
  // MESMO que roda em produção. Se o teste criar a tabela com um SQL próprio,
  // ele passa a validar um schema que não existe em lugar nenhum.
  db.exec(`
    CREATE TABLE IF NOT EXISTS livros (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo     TEXT    NOT NULL,
      autor_id   INTEGER NOT NULL,
      ano        INTEGER NOT NULL,
      disponivel INTEGER NOT NULL DEFAULT 1
    );
  `);

  /** SQLite não tem BOOLEAN: guarda 0/1. A conversão fica num lugar só. */
  type LinhaLivro = {
    id: number;
    titulo: string;
    autor_id: number;
    ano: number;
    disponivel: number;
  };

  const paraLivro = (linha: LinhaLivro): Livro => ({
    id: linha.id,
    titulo: linha.titulo,
    autorId: linha.autor_id,
    ano: linha.ano,
    disponivel: linha.disponivel === 1,
  });

  return {
    async listar() {
      const linhas = db.prepare('SELECT * FROM livros ORDER BY id').all() as LinhaLivro[];
      return linhas.map(paraLivro);
    },

    async buscarPorId(id) {
      // `?` parametrizado, sempre — o antídoto de SQL injection (módulo 09).
      const linha = db.prepare('SELECT * FROM livros WHERE id = ?').get(id) as
        LinhaLivro | undefined;
      return linha ? paraLivro(linha) : null;
    },

    async criar(dados: NovoLivro) {
      const resultado = db
        .prepare('INSERT INTO livros (titulo, autor_id, ano) VALUES (?, ?, ?)')
        .run(dados.titulo, dados.autorId, dados.ano);

      // `lastInsertRowid` é `bigint` no node:sqlite. `JSON.stringify` de bigint
      // LANÇA — é o 500 misterioso do módulo 10. `Number()` resolve.
      return {
        id: Number(resultado.lastInsertRowid),
        ...dados,
        disponivel: true,
      };
    },

    async atualizar(id, dados: AtualizacaoLivro) {
      const partes: string[] = [];
      const valores: (string | number)[] = [];

      if (dados.titulo !== undefined) {
        partes.push('titulo = ?');
        valores.push(dados.titulo);
      }
      if (dados.ano !== undefined) {
        partes.push('ano = ?');
        valores.push(dados.ano);
      }
      if (dados.disponivel !== undefined) {
        partes.push('disponivel = ?');
        valores.push(dados.disponivel ? 1 : 0);
      }

      // Nada a atualizar: um `UPDATE livros SET WHERE id = ?` seria erro de
      // sintaxe. É o tipo de caso que só o teste de integração pega — em memória
      // um PATCH vazio passa sem reclamar.
      if (partes.length === 0) return this.buscarPorId(id);

      valores.push(id);
      db.prepare(`UPDATE livros SET ${partes.join(', ')} WHERE id = ?`).run(...valores);
      return this.buscarPorId(id);
    },

    async remover(id) {
      return db.prepare('DELETE FROM livros WHERE id = ?').run(id).changes > 0;
    },

    /** O teste chama isto no `afterEach`. Conexão aberta vaza entre arquivos. */
    fechar() {
      db.close();
    },
  };
}
