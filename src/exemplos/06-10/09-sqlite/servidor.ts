/**
 * O servidor do módulo 08, com SQLite no lugar do array.
 *
 * ABRA OS DOIS ARQUIVOS LADO A LADO:
 *   src/exemplos/06-10/08-camadas/servidor.ts
 *   src/exemplos/06-10/09-sqlite/servidor.ts
 *
 * A diferença são as linhas do repositório. Service, controller, rotas, schemas e
 * tratador de erro: idênticos, importados dos módulos anteriores sem cópia.
 *
 * Isso não é sorte — é o retorno do investimento feito no módulo 08.
 *
 * Rodar:  node src/exemplos/06-10/09-sqlite/servidor.ts
 * O banco fica em `data/exemplo-09.sqlite` (ignorado pelo git).
 */
import express from 'express';
import { randomUUID } from 'node:crypto';
import { rotaNaoEncontrada, tratarErro } from '../06-erros/tratador.ts';
import { criarRotasCursos } from '../08-camadas/rotas/cursos.ts';
import { criarServicoCursos } from '../08-camadas/servicos/cursos.ts';
import { abrirBanco } from './db.ts';
import { criarRepositorioSqlite } from './repositorio-sqlite.ts';

// ---------------------------------------------------------------------
// A ÚNICA parte que mudou em relação ao módulo 08
// ---------------------------------------------------------------------

console.log('Abrindo banco e aplicando migrations...');
const db = abrirBanco('data/exemplo-09.sqlite');

const repositorio = criarRepositorioSqlite(db);

// Seed idempotente: só insere se a tabela está vazia. Rodar o servidor duas vezes
// não duplica dados — e o índice UNIQUE no título recusaria de qualquer forma.
const { total } = db.prepare('SELECT COUNT(*) AS total FROM cursos').get() as {
  total: number;
};
if (total === 0) {
  const inserir = db.prepare(
    'INSERT INTO cursos (titulo, horas, publicado) VALUES (?, ?, ?)',
  );
  inserir.run('Fundamentos de HTTP', 4, 1);
  inserir.run('Express do zero', 8, 0);
  inserir.run('Curso relâmpago', 1, 0);
  console.log('  seed inserido (3 cursos)');
} else {
  console.log(`  banco já tem ${total} cursos — seed não rodou`);
}

// ---------------------------------------------------------------------
// Daqui para baixo: COPIADO DO MÓDULO 08, sem uma vírgula de diferença
// ---------------------------------------------------------------------

const servico = criarServicoCursos(repositorio);
const rotasCursos = criarRotasCursos(servico);

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.locals.requestId = randomUUID().slice(0, 8);
  next();
});

app.use('/api/v1/cursos', rotasCursos);
app.use(rotaNaoEncontrada);
app.use(tratarErro);

const PORT = 5057;
const servidor = app.listen(PORT, () => {
  console.log(`API sobre SQLite em http://localhost:${PORT}/api/v1/cursos`);
});

// ---------------------------------------------------------------------
// Fechar o banco ao encerrar
// ---------------------------------------------------------------------
// Com WAL ligado, existem arquivos `-wal` e `-shm` ao lado do `.sqlite`. Fechar
// direito faz o SQLite consolidá-los. Não fechar não corrompe o banco (ele é
// resiliente), mas deixa lixo e atrasa a próxima abertura.
// Graceful shutdown completo — esperar requisições em andamento — é o módulo 15.

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    console.log(`\n${sinal} recebido, encerrando...`);
    servidor.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
