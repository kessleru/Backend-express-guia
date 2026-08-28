/**
 * SQL na mão com `node:sqlite` — do CREATE TABLE ao EXPLAIN QUERY PLAN.
 *
 * Nenhuma dependência externa: `node:sqlite` é embutido no Node 24. Roda em
 * memória, então dá para executar quantas vezes quiser sem sujar nada.
 *
 * Rodar:  node --experimental-sqlite src/exemplos/06-10/09-sqlite/01-sql-na-mao.ts
 * (o Node 24 avisa que é experimental; a API funciona)
 */
import { DatabaseSync } from 'node:sqlite';

// ':memory:' = banco que vive só na RAM. Trocar por um caminho de arquivo é a
// única diferença para um banco de verdade — o SQLite É um arquivo.
const db = new DatabaseSync(':memory:');

function titulo(texto: string) {
  console.log(`\n${'─'.repeat(62)}\n${texto}\n${'─'.repeat(62)}`);
}

// =====================================================================
titulo('1. MODELAGEM — CREATE TABLE, chaves e restrições');
// =====================================================================

// PRAGMA obrigatório: o SQLite ignora FOREIGN KEY por padrão, por
// retrocompatibilidade. Sem esta linha suas chaves estrangeiras são comentário.
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE autores (
    id            INTEGER PRIMARY KEY,          -- alias de ROWID: autoincrementa
    nome          TEXT    NOT NULL,
    nacionalidade TEXT    NOT NULL DEFAULT 'desconhecida'
  );

  CREATE TABLE livros (
    id         INTEGER PRIMARY KEY,
    titulo     TEXT    NOT NULL,
    autor_id   INTEGER NOT NULL,
    ano        INTEGER NOT NULL CHECK (ano BETWEEN 1450 AND 2100),
    isbn       TEXT    UNIQUE,                  -- UNIQUE aceita vários NULL
    disponivel INTEGER NOT NULL DEFAULT 1,      -- não existe BOOLEAN: use 0/1

    -- A chave estrangeira faz DUAS coisas: documenta a relação e IMPEDE
    -- inconsistência. RESTRICT recusa apagar um autor que tem livros — é a
    -- mesma regra que escrevemos à mão no módulo 08, agora garantida pelo banco.
    -- Alternativas: ON DELETE CASCADE (apaga os livros) ou SET NULL.
    FOREIGN KEY (autor_id) REFERENCES autores(id) ON DELETE RESTRICT
  );

  -- Tabela de JUNÇÃO para o N-N livro↔genero. Um livro tem vários gêneros e um
  -- gênero tem vários livros; não existe onde guardar isso nas duas tabelas.
  CREATE TABLE generos (
    id   INTEGER PRIMARY KEY,
    nome TEXT UNIQUE NOT NULL
  );

  CREATE TABLE livros_generos (
    livro_id  INTEGER NOT NULL REFERENCES livros(id)  ON DELETE CASCADE,
    genero_id INTEGER NOT NULL REFERENCES generos(id) ON DELETE CASCADE,
    -- Chave primária COMPOSTA: o par é único, então o mesmo gênero não entra
    -- duas vezes no mesmo livro. A restrição no banco dispensa checar no código.
    PRIMARY KEY (livro_id, genero_id)
  );
`);

console.log('Tabelas criadas: autores, livros, generos, livros_generos');

// =====================================================================
titulo('2. INSERT — e por que query parametrizada não é opcional');
// =====================================================================

// `prepare` compila a query UMA vez e devolve um statement reutilizável.
// Os `?` são os parâmetros — o valor NUNCA é concatenado no SQL.
const inserirAutor = db.prepare(
  'INSERT INTO autores (nome, nacionalidade) VALUES (?, ?)',
);

const tolkien = inserirAutor.run('J.R.R. Tolkien', 'britânica');
const herbert = inserirAutor.run('Frank Herbert', 'estadunidense');
inserirAutor.run('Ursula K. Le Guin', 'estadunidense');

// `lastInsertRowid` é como você descobre o id gerado.
console.log(`Tolkien inserido com id ${tolkien.lastInsertRowid}`);
console.log(`Herbert inserido com id ${herbert.lastInsertRowid}`);

const inserirLivro = db.prepare(
  'INSERT INTO livros (titulo, autor_id, ano, isbn) VALUES (?, ?, ?, ?)',
);

inserirLivro.run('O Hobbit', 1, 1937, '9788595084742');
inserirLivro.run('O Senhor dos Anéis', 1, 1954, '9788595084759');
inserirLivro.run('Duna', 2, 1965, '9788576573180');
inserirLivro.run('Messias de Duna', 2, 1969, null); // isbn NULL é permitido
inserirLivro.run('A Mão Esquerda da Escuridão', 3, 1969, '9788576572329');

console.log('5 livros inseridos');

// ---------------------------------------------------------------------
// SQL INJECTION — a demonstração
// ---------------------------------------------------------------------
// Se o título viesse concatenado, este valor seria SQL executável:
const malicioso = "x'; DROP TABLE livros; --";

// ERRADO (não faça isto — está aqui só para você ver a forma):
//   db.exec(`SELECT * FROM livros WHERE titulo = '${malicioso}'`)
//   → o banco leria: SELECT ... WHERE titulo = 'x'; DROP TABLE livros; --'
//   → duas instruções, e a segunda apaga a tabela.

// CERTO: com `?`, o valor é tratado como DADO, nunca como instrução.
const busca = db.prepare('SELECT COUNT(*) AS total FROM livros WHERE titulo = ?');
console.log(
  'Busca com valor malicioso:',
  busca.get(malicioso),
  '← 0 resultados, tabela intacta',
);
console.log(
  'Tabela livros ainda existe:',
  db.prepare('SELECT COUNT(*) c FROM livros').get(),
);

// O ponto que costuma passar batido: parametrizar NÃO é "escapar aspas". O valor
// viaja separado do SQL — o banco recebe a query compilada e os dados à parte.
// É por isso que não existe caractere que "escape" da parametrização.

// =====================================================================
titulo('3. SELECT — get, all e o filtro');
// =====================================================================

// `.get()` devolve a primeira linha (ou undefined). `.all()` devolve array.
const umLivro = db.prepare('SELECT * FROM livros WHERE id = ?').get(1);
console.log('get(1):', umLivro);

const de1969 = db
  .prepare('SELECT titulo, ano FROM livros WHERE ano = ? ORDER BY titulo')
  .all(1969);
console.log('all(1969):', de1969);

// LIKE com % para busca parcial. O % vai no PARÂMETRO, não na query.
const comDuna = db.prepare('SELECT titulo FROM livros WHERE titulo LIKE ?').all('%Duna%');
console.log('LIKE %Duna%:', comDuna);

// =====================================================================
titulo('4. JOIN — juntar o que a normalização separou');
// =====================================================================

// Sem JOIN, `livros.autor_id` é só um número. O JOIN traz o nome.
const comAutor = db
  .prepare(
    `SELECT l.titulo, l.ano, a.nome AS autor
       FROM livros l
       JOIN autores a ON a.id = l.autor_id
      ORDER BY l.ano`,
  )
  .all();
console.log('INNER JOIN (só quem tem par):');
for (const linha of comAutor) console.log('  ', linha);

// LEFT JOIN mantém a linha da esquerda mesmo sem par à direita.
// Aqui: todo autor, inclusive quem não tem livro nenhum.
inserirAutor.run('Autor Sem Livros', 'brasileira');
const contagem = db
  .prepare(
    `SELECT a.nome, COUNT(l.id) AS livros
       FROM autores a
       LEFT JOIN livros l ON l.autor_id = a.id
      GROUP BY a.id
      ORDER BY livros DESC, a.nome`,
  )
  .all();
console.log('\nLEFT JOIN + GROUP BY (contagem por autor):');
for (const linha of contagem) console.log('  ', linha);

// Com INNER JOIN, "Autor Sem Livros" simplesmente desapareceria do resultado —
// e você teria um relatório errado sem nenhum erro.

// =====================================================================
titulo('5. GROUP BY e agregação');
// =====================================================================

const porDecada = db
  .prepare(
    `SELECT (ano / 10) * 10 AS decada, COUNT(*) AS quantos, MIN(ano) AS primeiro
       FROM livros
      GROUP BY decada
     HAVING COUNT(*) >= 1
      ORDER BY decada`,
  )
  .all();
console.log('Livros por década:');
for (const linha of porDecada) console.log('  ', linha);

// WHERE filtra LINHAS (antes de agrupar); HAVING filtra GRUPOS (depois).
// Trocar um pelo outro é o erro clássico de quem está aprendendo SQL.

// =====================================================================
titulo('6. N-N com a tabela de junção');
// =====================================================================

const inserirGenero = db.prepare('INSERT INTO generos (nome) VALUES (?)');
for (const nome of ['fantasia', 'ficcao', 'aventura']) inserirGenero.run(nome);

const ligar = db.prepare(
  'INSERT INTO livros_generos (livro_id, genero_id) VALUES (?, ?)',
);
ligar.run(1, 1); // Hobbit → fantasia
ligar.run(1, 3); // Hobbit → aventura
ligar.run(2, 1); // SdA → fantasia
ligar.run(3, 2); // Duna → ficcao

// Dois JOINs para atravessar a tabela de junção.
// `GROUP_CONCAT` junta as linhas do grupo numa string — prático para exibir.
const livrosComGeneros = db
  .prepare(
    `SELECT l.titulo, GROUP_CONCAT(g.nome, ', ') AS generos
       FROM livros l
       LEFT JOIN livros_generos lg ON lg.livro_id = l.id
       LEFT JOIN generos g         ON g.id = lg.genero_id
      GROUP BY l.id
      ORDER BY l.titulo`,
  )
  .all();
for (const linha of livrosComGeneros) console.log('  ', linha);

// A restrição de chave primária composta em ação:
try {
  ligar.run(1, 1); // Hobbit → fantasia, de novo
} catch (erro) {
  console.log('\nInserir o par duplicado falhou:', (erro as Error).message);
}

// =====================================================================
titulo('7. ÍNDICES e EXPLAIN QUERY PLAN');
// =====================================================================

const plano = (sql: string) => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();

console.log('SEM índice em livros.ano:');
console.log(' ', plano('SELECT * FROM livros WHERE ano = 1969')[0]);
// "SCAN livros" = o banco lê TODA a tabela linha por linha. Com 5 livros é
// instantâneo; com 5 milhões é a diferença entre 1ms e 4 segundos.

db.exec('CREATE INDEX idx_livros_ano ON livros(ano)');

console.log('\nCOM índice:');
console.log(' ', plano('SELECT * FROM livros WHERE ano = 1969')[0]);
// "SEARCH livros USING INDEX" = o banco vai direto onde interessa.

console.log('\nA chave primária já é um índice:');
console.log(' ', plano('SELECT * FROM livros WHERE id = 3')[0]);

// Índice não é grátis: ocupa espaço e torna INSERT/UPDATE mais lentos (o índice
// também precisa ser atualizado). Crie índice para a coluna que aparece em
// WHERE, JOIN e ORDER BY das queries que você realmente roda — não para todas.

// =====================================================================
titulo('8. TRANSAÇÕES e ACID');
// =====================================================================

// O problema: duas operações que só fazem sentido juntas. Se a segunda falha, a
// primeira precisa ser desfeita — senão o banco fica num estado impossível.

function emprestarComRegistro(livroId: number, quemPegou: string) {
  db.exec('BEGIN');
  try {
    const r = db.prepare(
      'UPDATE livros SET disponivel = 0 WHERE id = ? AND disponivel = 1',
    );
    const { changes } = r.run(livroId);

    // `changes` é a defesa contra corrida: se outro processo emprestou primeiro,
    // o UPDATE não altera nada e nós descobrimos aqui. Um `SELECT` antes do
    // `UPDATE` teria uma janela entre os dois; isto não tem.
    if (changes === 0) throw new Error('Livro indisponível');

    if (quemPegou === '') throw new Error('Emprestimo sem responsável'); // falha proposital

    db.prepare('INSERT INTO emprestimos (livro_id, quem) VALUES (?, ?)').run(
      livroId,
      quemPegou,
    );
    db.exec('COMMIT');
    return 'ok';
  } catch (erro) {
    // ROLLBACK desfaz TUDO desde o BEGIN. É o "A" de ACID: atomicidade —
    // ou tudo acontece, ou nada acontece.
    db.exec('ROLLBACK');
    return `falhou: ${(erro as Error).message}`;
  }
}

db.exec('CREATE TABLE emprestimos (id INTEGER PRIMARY KEY, livro_id INTEGER, quem TEXT)');

console.log('Empréstimo válido:  ', emprestarComRegistro(1, 'Ana'));
console.log(
  'Livro 1 disponivel: ',
  db.prepare('SELECT disponivel FROM livros WHERE id=1').get(),
);

console.log('\nEmpréstimo que falha no meio:', emprestarComRegistro(2, ''));
console.log(
  'Livro 2 disponivel (deve continuar 1):',
  db.prepare('SELECT disponivel FROM livros WHERE id=2').get(),
);
console.log(
  'Empréstimos registrados:',
  db.prepare('SELECT COUNT(*) c FROM emprestimos').get(),
);

// ACID em uma linha cada:
//   Atomicidade  — tudo ou nada (o ROLLBACK acima)
//   Consistência — as restrições valem no fim da transação (CHECK, FK, UNIQUE)
//   Isolamento   — uma transação não vê o meio de outra
//   Durabilidade — depois do COMMIT, sobrevive a queda de energia

// =====================================================================
titulo('9. A chave estrangeira trabalhando');
// =====================================================================

try {
  db.prepare('DELETE FROM autores WHERE id = 1').run(); // Tolkien tem 2 livros
} catch (erro) {
  console.log('DELETE do autor com livros:', (erro as Error).message);
  console.log('  ← é a regra do módulo 08, agora garantida pelo BANCO.');
}

try {
  db.prepare('INSERT INTO livros (titulo, autor_id, ano) VALUES (?, ?, ?)').run(
    'X',
    999,
    2000,
  );
} catch (erro) {
  console.log('INSERT com autor_id inexistente:', (erro as Error).message);
}

try {
  db.prepare('INSERT INTO livros (titulo, autor_id, ano) VALUES (?, ?, ?)').run(
    'X',
    1,
    1200,
  );
} catch (erro) {
  console.log('INSERT violando o CHECK do ano:', (erro as Error).message);
}

// A diferença entre validar no código e restringir no banco: a validação protege
// da SUA API, a restrição protege de tudo — script de migração, importação em
// massa, alguém no console de produção às 3 da manhã.

db.close();
console.log('\n✓ Fim. Nada foi gravado em disco: o banco era :memory:.');
