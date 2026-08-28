/**
 * Segurança aplicada: helmet, rate limit por finalidade, path traversal,
 * injeção, enumeração de usuário e CORS.
 *
 * Cada rota existe em par — a versão INSEGURA e a SEGURA — para você comparar
 * a resposta das duas com `curl`. As inseguras estão marcadas e nunca devem ser
 * copiadas para código de verdade.
 *
 * Rodar:  node src/exemplos/11-15/13-seguranca/servidor.ts
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { resolve, sep } from 'node:path';
import { timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const PORTA = 5063;
const app = express();
app.use(express.json());

// ---------------------------------------------------------------------
// 1. HELMET — 12 headers de defesa, e um a menos entregando a stack
// ---------------------------------------------------------------------

// helmet() é um bom PADRÃO, não uma decisão terceirizada: numa API que só
// devolve JSON o CSP quase não importa; numa que serve HTML, ele é a defesa
// principal e precisa ser ajustado à mão.
app.use(helmet());

// ---------------------------------------------------------------------
// 2. CORS — protege o USUÁRIO no navegador, não o servidor
// ---------------------------------------------------------------------

// Listar a origem é obrigatório quando há credencial: `origin: '*'` combinado
// com `credentials: true` é recusado pelo próprio navegador.
app.use(
  cors({
    origin: ['http://localhost:3000'],
    credentials: true,
  }),
);

// ---------------------------------------------------------------------
// "Banco" e usuários de exemplo
// ---------------------------------------------------------------------

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE livros (id INTEGER PRIMARY KEY, titulo TEXT NOT NULL, autor TEXT NOT NULL);
  INSERT INTO livros (titulo, autor) VALUES
    ('O Hobbit', 'Tolkien'), ('Duna', 'Herbert'), ('Neuromancer', 'Gibson');
`);

// A senha real seria um hash Argon2 (módulo 11). Aqui o foco é outro.
const usuarios = [{ id: 1, email: 'ana@exemplo.com', senha: 'segredo-correto' }];

// Empréstimos de dois donos diferentes — é o que torna o IDOR demonstrável.
const emprestimos = [
  { id: 1, usuarioId: 1, livro: 'O Hobbit' },
  { id: 2, usuarioId: 2, livro: 'Duna' }, // pertence a OUTRA pessoa
];

// Finge um usuário autenticado (o de verdade viria do token — módulo 11).
const autenticar: express.RequestHandler = (req, _res, next) => {
  (req as express.Request & { usuario: { id: number; papel: string } }).usuario = {
    id: 1,
    papel: 'usuario',
  };
  next();
};

// ---------------------------------------------------------------------
// 3. RATE LIMIT — um balde por FINALIDADE
// ---------------------------------------------------------------------

// Baldes separados. Se login e navegação dividissem o mesmo balde, navegar
// consumiria a cota que existia para proteger a senha.
const limiteLogin = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-8', // headers `RateLimit` e `RateLimit-Policy`
  legacyHeaders: false, // sem os antigos `X-RateLimit-*`
  message: { erro: 'muitas tentativas de login, tente em 1 minuto' },
});

const limiteLeitura = rateLimit({
  windowMs: 60_000,
  limit: 100, // navegar é barato: o limite existe contra abuso, não contra uso
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

// ---------------------------------------------------------------------
// 4. ENUMERAÇÃO DE USUÁRIO — a resposta não pode contar quem existe
// ---------------------------------------------------------------------

// Hash descartável usado quando o e-mail NÃO existe. Sem ele, a rota responde
// instantaneamente para e-mail inexistente e devagar para e-mail real — e o
// atacante descobre sua base de clientes com um cronômetro.
const HASH_FALSO = createHash('sha256').update(randomUUID()).digest();

function comparaConstante(a: string, b: string): boolean {
  // `===` para no primeiro byte diferente e vaza informação pelo tempo.
  // timingSafeEqual exige o mesmo tamanho, daí comparar os hashes (tamanho fixo).
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

app.post('/auth/login', limiteLogin, (req, res) => {
  const { email, senha } = (req.body ?? {}) as { email?: string; senha?: string };
  if (typeof email !== 'string' || typeof senha !== 'string') {
    return res.status(400).json({ erro: 'email e senha são obrigatórios' });
  }

  const usuario = usuarios.find((u) => u.email === email);

  // Trabalho equivalente nos dois caminhos: existindo ou não o usuário, uma
  // comparação de hash acontece. O tempo de resposta deixa de ser um sinal.
  const confere = usuario
    ? comparaConstante(senha, usuario.senha)
    : timingSafeEqual(HASH_FALSO, HASH_FALSO) && false;

  // MESMA mensagem e MESMO status para "não existe" e "senha errada".
  if (!usuario || !confere) {
    return res.status(401).json({ erro: 'credenciais inválidas' });
  }
  res.json({ ok: true, mensagem: 'login aceito (token viria aqui — módulo 11)' });
});

// ❌ INSEGURA — para comparar. Conta ao atacante quais e-mails existem.
app.post('/inseguro/login', (req, res) => {
  const { email, senha } = (req.body ?? {}) as { email?: string; senha?: string };
  const usuario = usuarios.find((u) => u.email === email);
  if (!usuario) return res.status(404).json({ erro: 'e-mail não cadastrado' });
  if (usuario.senha !== senha) return res.status(401).json({ erro: 'senha incorreta' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// 5. INJEÇÃO DE SQL — parametrizar, nunca concatenar
// ---------------------------------------------------------------------

app.get('/busca', limiteLeitura, (req, res) => {
  const q = String(req.query.q ?? '');

  // O `?` mantém o valor como DADO. O banco nunca o interpreta como comando,
  // por mais que ele pareça SQL.
  const linhas = db.prepare('SELECT * FROM livros WHERE titulo LIKE ?').all(`%${q}%`);
  res.json({ busca: q, encontrados: linhas.length, livros: linhas });
});

// ❌ INSEGURA — a string do cliente vira parte do comando.
app.get('/inseguro/busca', (req, res) => {
  const q = String(req.query.q ?? '');
  try {
    const sql = `SELECT * FROM livros WHERE titulo LIKE '%${q}%'`;
    res.json({ sql, livros: db.prepare(sql).all() });
  } catch (erro) {
    // Um `'` sozinho já quebra a query: é o teste clássico de injeção.
    res
      .status(500)
      .json({ erro: 'a query quebrou', detalhe: String(erro).slice(0, 120) });
  }
});

// ---------------------------------------------------------------------
// 6. PATH TRAVERSAL — resolver o caminho e confinar na raiz
// ---------------------------------------------------------------------

const RAIZ_UPLOADS = resolve('uploads');

app.get('/arquivos/:nome', limiteLeitura, (req, res) => {
  // `req.params.nome` é `string | string[] | undefined` com
  // `noUncheckedIndexedAccess` ligado — normalizar antes de usar é obrigatório.
  const nome = String(req.params.nome ?? '');

  // `resolve` normaliza o `..`; a comparação confirma que o resultado continua
  // dentro da pasta permitida. Checar a string ANTES de resolver não funciona:
  // dá para escondê-la com codificação de URL.
  const alvo = resolve(RAIZ_UPLOADS, nome);
  if (!alvo.startsWith(RAIZ_UPLOADS + sep)) {
    return res.status(400).json({ erro: 'caminho inválido', tentou: alvo });
  }
  res.json({ ok: true, serviria: alvo });
});

// ❌ INSEGURA — `../../.env` sai da pasta e alcança qualquer arquivo.
app.get('/inseguro/arquivos/:nome', (req, res) => {
  res.json({ serviria: `${RAIZ_UPLOADS}${sep}${req.params.nome}` });
});

// ---------------------------------------------------------------------
// 7. BROKEN ACCESS CONTROL (IDOR) — o erro nº 1 do OWASP Top 10
// ---------------------------------------------------------------------

app.get('/emprestimos/:id', autenticar, limiteLeitura, (req, res) => {
  const usuario = (req as express.Request & { usuario: { id: number; papel: string } })
    .usuario;
  const emp = emprestimos.find((e) => e.id === Number(req.params.id));
  if (!emp) return res.status(404).json({ erro: 'não encontrado' });

  // Autorização por DONO precisa do recurso em mãos — por isso não cabe num
  // middleware genérico (módulos 08 e 11).
  const ehDono = emp.usuarioId === usuario.id;
  if (!ehDono && usuario.papel !== 'admin') {
    // 404, não 403: um 403 confirmaria que o empréstimo 2 existe.
    return res.status(404).json({ erro: 'não encontrado' });
  }
  res.json(emp);
});

// ❌ INSEGURA — autenticada, porém sem autorização: lê o empréstimo de qualquer um.
app.get('/inseguro/emprestimos/:id', autenticar, (req, res) => {
  const emp = emprestimos.find((e) => e.id === Number(req.params.id));
  res.json(emp ?? { erro: 'não encontrado' });
});

// ---------------------------------------------------------------------
// 8. Rotas para comparar os headers
// ---------------------------------------------------------------------

app.get('/publico', (_req, res) =>
  res.json({ ok: true, dica: 'veja os headers com curl -i' }),
);

// Um app separado, SEM helmet, na porta seguinte — para o diff de headers.
const semHelmet = express();
semHelmet.get('/sem-helmet', (_req, res) => res.json({ ok: true, helmet: false }));

app.listen(PORTA, () => {
  console.log(`seguro     → http://localhost:${PORTA}`);
  console.log(`sem helmet → http://localhost:${PORTA + 1}/sem-helmet`);
  console.log('\nCompare os pares:');
  console.log(`  curl -i localhost:${PORTA}/publico`);
  console.log(`  curl -i localhost:${PORTA + 1}/sem-helmet`);
  console.log(`  curl "localhost:${PORTA}/inseguro/busca?q='"`);
  console.log(`  curl localhost:${PORTA}/inseguro/emprestimos/2`);
});
semHelmet.listen(PORTA + 1);
