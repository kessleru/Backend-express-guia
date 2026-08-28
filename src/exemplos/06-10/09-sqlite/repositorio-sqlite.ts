/**
 * O MESMO repositório do módulo 08 — agora sobre SQLite.
 *
 * Repare no import: a interface `RepositorioCursos` vem de
 * `08-camadas/dominio/curso.ts`, sem nenhuma alteração. Este arquivo é a prova
 * do que a camada de repositório prometia: **o service, o controller e as rotas
 * não mudam uma linha** ao trocar array em memória por banco de verdade.
 */
import type { DatabaseSync } from 'node:sqlite';
import type {
  AtualizacaoCurso,
  Curso,
  FiltroCursos,
  NovoCurso,
  RepositorioCursos,
} from '../08-camadas/dominio/curso.ts';

/**
 * A linha como o SQLite devolve: `snake_case` e `publicado` como 0/1.
 *
 * Esse é o trabalho de tradução que um ORM faz para você (módulo 10) — e o
 * motivo de a camada de repositório existir: o resto do sistema fala `Curso`,
 * com `camelCase` e boolean de verdade.
 */
type LinhaCurso = {
  id: number;
  titulo: string;
  horas: number;
  publicado: number; // 0 ou 1
};

const paraCurso = (linha: LinhaCurso): Curso => ({
  id: linha.id,
  titulo: linha.titulo,
  horas: linha.horas,
  publicado: linha.publicado === 1, // 0/1 → boolean
});

export function criarRepositorioSqlite(db: DatabaseSync): RepositorioCursos {
  // Statements preparados UMA vez, no início. `prepare` compila o SQL; reusar o
  // statement evita recompilar a cada requisição. Ganho real em rota quente.
  const stmtPorId = db.prepare('SELECT * FROM cursos WHERE id = ?');
  const stmtPorTitulo = db.prepare(
    'SELECT * FROM cursos WHERE titulo = ? COLLATE NOCASE',
  );
  const stmtInserir = db.prepare(
    'INSERT INTO cursos (titulo, horas, publicado) VALUES (?, ?, 0)',
  );
  const stmtRemover = db.prepare('DELETE FROM cursos WHERE id = ?');

  return {
    async listar(filtro: FiltroCursos) {
      // SQL dinâmico feito com segurança: os PEDAÇOS da query são strings
      // literais nossas; só os VALORES entram por `?`. Nunca concatene valor.
      const condicoes: string[] = [];
      const valores: (string | number)[] = [];

      if (filtro.titulo) {
        condicoes.push('titulo LIKE ?');
        valores.push(`%${filtro.titulo}%`); // o % vai no VALOR, não no SQL
      }
      if (filtro.publicado !== undefined) {
        condicoes.push('publicado = ?');
        valores.push(filtro.publicado ? 1 : 0);
      }

      const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
      const linhas = db
        .prepare(`SELECT * FROM cursos ${where} ORDER BY id`)
        .all(...valores);

      return (linhas as LinhaCurso[]).map(paraCurso);
    },

    async buscarPorId(id: number) {
      const linha = stmtPorId.get(id) as LinhaCurso | undefined;
      return linha ? paraCurso(linha) : null;
    },

    async buscarPorTitulo(titulo: string) {
      const linha = stmtPorTitulo.get(titulo.trim()) as LinhaCurso | undefined;
      return linha ? paraCurso(linha) : null;
    },

    async criar(dados: NovoCurso) {
      const { lastInsertRowid } = stmtInserir.run(dados.titulo, dados.horas);

      // `lastInsertRowid` é `number | bigint`. Reler a linha em vez de montar o
      // objeto na mão garante que defaults e CHECKs do banco estão refletidos.
      const linha = stmtPorId.get(Number(lastInsertRowid)) as LinhaCurso;
      return paraCurso(linha);
    },

    async atualizar(id: number, dados: AtualizacaoCurso) {
      // UPDATE parcial: só as colunas que vieram entram no SET. Montar
      // `SET titulo = ?, horas = ?` com valores `undefined` gravaria NULL e
      // apagaria os campos — é o mesmo bug do spread no módulo 08, em SQL.
      const partes: string[] = [];
      const valores: (string | number)[] = [];

      if (dados.titulo !== undefined) {
        partes.push('titulo = ?');
        valores.push(dados.titulo);
      }
      if (dados.horas !== undefined) {
        partes.push('horas = ?');
        valores.push(dados.horas);
      }
      if (dados.publicado !== undefined) {
        partes.push('publicado = ?');
        valores.push(dados.publicado ? 1 : 0);
      }

      // Nada para atualizar: devolve o estado atual em vez de rodar SQL inválido
      // (`UPDATE cursos SET WHERE id = 1` é erro de sintaxe).
      if (partes.length === 0) return this.buscarPorId(id);

      valores.push(id);
      const { changes } = db
        .prepare(`UPDATE cursos SET ${partes.join(', ')} WHERE id = ?`)
        .run(...valores);

      // `changes === 0` significa que nenhuma linha casou: o id não existe.
      if (changes === 0) return null;

      return this.buscarPorId(id);
    },

    async remover(id: number) {
      const { changes } = stmtRemover.run(id);
      return changes > 0; // 0 = não existia; não é erro, é informação
    },
  };
}
