/**
 * Demo do grupo 04 — desempenho e convenção. Não é aplicação: são as rotas
 * mínimas que fazem os três middlewares aparecerem no `curl`.
 *
 * Rodar: `node middlewares/04-desempenho-e-convencao/servidor.ts` (porta 6104).
 */
import express from 'express';
import { cacheCondicional } from './cache-condicional/middleware.ts';
import { paginacao } from './paginacao/middleware.ts';
import { jaRespondida, timeout } from './timeout/middleware.ts';

const app = express();
const PORTA = 6104;

const acervo = {
  atualizadoEm: new Date('2026-08-20T09:00:00Z').toISOString(),
  livros: Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    titulo: `Volume ${i + 1} da coleção`,
    emprestado: false,
  })),
};

/**
 * Quantas vezes cada handler REALMENTE rodou. É o placar que prova o falso
 * amigo do cache: com o ETag automático do Express o contador sobe mesmo
 * quando a resposta é 304, porque o corpo precisou ser montado para virar
 * etiqueta.
 */
const execucoes = { acervo: 0, acervoCaro: 0 };

// Primeiro da pilha, porque um teto de espera que só cobre metade dos
// middlewares não é um teto. 1,5 s aqui (e não os 5 s padrão) para a demo
// caber num `curl` sem paciência.
app.use(timeout(1500));

// A versão é barata: um campo que já está em memória. O handler nem roda
// quando a etiqueta bate.
app.get(
  '/acervo',
  cacheCondicional(() => acervo.atualizadoEm),
  (_req, res) => {
    execucoes.acervo += 1;
    res.json(resumo());
  },
);

// A MESMA resposta sem o middleware: o Express gera o ETag sozinho no
// `res.send`, sobre o corpo já montado. Compare os dois contadores em
// `GET /execucoes` depois de repetir as duas rotas com `If-None-Match`.
app.get('/acervo-caro', (_req, res) => {
  execucoes.acervoCaro += 1;
  res.json(resumo());
});

// Muda o acervo e, com ele, a versão — a etiqueta antiga para de bater e o
// próximo `If-None-Match` volta 200 com o corpo novo.
app.post('/livros/:id/emprestimo', (req, res) => {
  const livro = acervo.livros.find((l) => l.id === Number(req.params.id));
  if (!livro) return res.status(404).json({ erro: 'Livro não encontrado' });
  livro.emprestado = true;
  acervo.atualizadoEm = new Date().toISOString();
  res.status(200).json({ id: livro.id, emprestado: true });
});

app.get('/livros', paginacao, (req, res) => {
  const { pagina, limite, offset } = req.paginacao!;
  res.json({
    pagina,
    limite,
    total: acervo.livros.length,
    itens: acervo.livros.slice(offset, offset + limite),
  });
});

// O jeito certo: o handler lento checa antes de responder.
app.get('/relatorio', async (_req, res) => {
  await esperar(3000);
  if (jaRespondida(res)) {
    console.log('[relatorio] terminou depois do timeout; nada a enviar');
    return;
  }
  res.json({ livros: acervo.livros.length });
});

// O jeito errado, de propósito: mesmo handler sem a checagem. O cliente recebe
// o 503 igual; a diferença aparece no log do servidor, com o
// ERR_HTTP_HEADERS_SENT — e o servidor continua de pé.
app.get('/relatorio-sem-guarda', async (_req, res) => {
  await esperar(3000);
  res.json({ livros: acervo.livros.length });
});

app.get('/execucoes', (_req, res) => res.json(execucoes));

// Tratador de erro: 4 argumentos (docs/01-05/05-middlewares.md). Se a resposta já
// saiu, não há o que responder — delegar ao Express é o único caminho honesto,
// e tentar `res.json` aqui só empilharia um segundo ERR_HTTP_HEADERS_SENT.
app.use(
  (
    erro: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error('[erro]', erro instanceof Error ? erro.message : erro);
    if (res.headersSent) return next(erro);
    res.status(500).json({ erro: 'Erro interno' });
  },
);

function resumo() {
  return {
    atualizadoEm: acervo.atualizadoEm,
    total: acervo.livros.length,
    emprestados: acervo.livros.filter((l) => l.emprestado).length,
  };
}

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

app.listen(PORTA, () => console.log(`grupo 04 em http://localhost:${PORTA}`));
