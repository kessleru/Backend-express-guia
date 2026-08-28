/**
 * `RepositorioAutores` sobre SQLite.
 */
import type { DatabaseSync } from 'node:sqlite';
import type {
  AlterarAutor,
  Autor,
  NovoAutor,
  RepositorioAutores,
} from '../dominio/autor.ts';

type LinhaAutor = {
  id: number;
  nome: string;
  nacionalidade: string;
  nascimento: string | null; // ISO 8601 em TEXT
};

function paraAutor(linha: LinhaAutor): Autor {
  return {
    id: linha.id,
    nome: linha.nome,
    nacionalidade: linha.nacionalidade,
    // TEXT ISO → Date. É aqui que a fronteira "formato do banco" ↔ "tipo do
    // domínio" é atravessada. O domínio não sabe que existe TEXT.
    ...(linha.nascimento !== null ? { nascimento: new Date(linha.nascimento) } : {}),
  };
}

/** `Date` → `'1892-01-03'`. Só a data, sem hora: é uma data de nascimento. */
const paraTexto = (d: Date) => d.toISOString().slice(0, 10);

export function criarRepositorioAutoresSqlite(db: DatabaseSync): RepositorioAutores {
  const stmtListar = db.prepare('SELECT * FROM autores ORDER BY nome');
  const stmtPorId = db.prepare('SELECT * FROM autores WHERE id = ?');
  const stmtInserir = db.prepare(
    'INSERT INTO autores (nome, nacionalidade, nascimento) VALUES (?, ?, ?)',
  );
  const stmtRemover = db.prepare('DELETE FROM autores WHERE id = ?');

  const lerPorId = (id: number): Autor | null => {
    const linha = stmtPorId.get(id) as LinhaAutor | undefined;
    return linha ? paraAutor(linha) : null;
  };

  return {
    async listar() {
      return (stmtListar.all() as LinhaAutor[]).map(paraAutor);
    },

    async buscarPorId(id: number) {
      return lerPorId(id);
    },

    async criar(dados: NovoAutor) {
      const { lastInsertRowid } = stmtInserir.run(
        dados.nome,
        dados.nacionalidade,
        dados.nascimento ? paraTexto(dados.nascimento) : null,
      );
      return lerPorId(Number(lastInsertRowid))!;
    },

    async atualizar(id: number, dados: AlterarAutor) {
      const partes: string[] = [];
      const valores: (string | number | null)[] = [];

      if (dados.nome !== undefined) {
        partes.push('nome = ?');
        valores.push(dados.nome);
      }
      if (dados.nacionalidade !== undefined) {
        partes.push('nacionalidade = ?');
        valores.push(dados.nacionalidade);
      }
      if (dados.nascimento !== undefined) {
        partes.push('nascimento = ?');
        valores.push(paraTexto(dados.nascimento));
      }

      // `UPDATE autores SET WHERE id = 1` é erro de sintaxe — não rode SQL vazio.
      if (partes.length === 0) return lerPorId(id);

      valores.push(id);
      const { changes } = db
        .prepare(`UPDATE autores SET ${partes.join(', ')} WHERE id = ?`)
        .run(...valores);

      return changes === 0 ? null : lerPorId(id);
    },

    /**
     * O `ON DELETE RESTRICT` faz este DELETE FALHAR se o autor tiver livros.
     *
     * O service checa antes com `contarPorAutor` e devolve um 409 com mensagem
     * clara — que é o que o cliente precisa. A restrição do banco é a segunda
     * linha de defesa: protege de script, migration e console de produção, que
     * não passam pelo service.
     *
     * Duas defesas para a mesma regra não é redundância: uma dá boa mensagem, a
     * outra dá garantia.
     */
    async remover(id: number) {
      const { changes } = stmtRemover.run(id);
      return changes > 0;
    },
  };
}
