/**
 * O CRUD do módulo 03 quebrado em routers, com versionamento de API.
 *
 * Compare com `src/exemplos/01-05/03-express-basico/crud-cursos.ts`: as rotas são as
 * mesmas. O que mudou é que este arquivo não sabe mais o que é um curso — ele só
 * decide ONDE cada grupo de rotas mora.
 *
 * Rodar:  node src/exemplos/01-05/04-roteamento/servidor.ts
 */
import express, { Router } from 'express';
import { rotasCursos } from './rotas/cursos.ts';
import { rotasInstrutores } from './rotas/instrutores.ts';

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------
// VERSIONAMENTO
// ---------------------------------------------------------------------
// Uma API pública não pode quebrar quem já a usa. Quando o formato de uma
// resposta muda de forma incompatível, sobe a versão e mantém a antiga viva por
// um tempo. Versão no caminho (`/api/v1`) é a forma mais simples e visível —
// dá pra testar no navegador e ler no log.
//
// Alternativa: header `Accept: application/vnd.api.v2+json`. Mais "correto"
// segundo os puristas do HTTP, e bem mais chato de debugar.

const v1 = Router();
v1.use('/cursos', rotasCursos);
v1.use('/instrutores', rotasInstrutores);

app.use('/api/v1', v1);

// Rota de índice: ajuda quem chega na API sem documentação.
app.get('/api/v1', (_req, res) => {
  res.json({
    versao: 'v1',
    recursos: ['/api/v1/cursos', '/api/v1/instrutores'],
  });
});

// ---------------------------------------------------------------------
// PADRÕES DE CAMINHO (Express 5)
// ---------------------------------------------------------------------

// Parâmetro opcional: `{/:formato}` — as chaves marcam o trecho opcional.
// No Express 4 era `/:formato?`, sintaxe que o 5 removeu.
app.get('/relatorio{/:formato}', (req, res) => {
  const formato = req.params.formato ?? 'json'; // ausente → undefined
  res.json({ formato });
});

// Wildcard nomeado: `/*resto` captura tudo depois da barra.
// Cuidado: no Express 5 `req.params.resto` é um **array** de segmentos
// (`/a/b/c.pdf` → `['a','b','c.pdf']`), não a string `'a/b/c.pdf'` do Express 4.
app.get('/arquivos/*resto', (req, res) => {
  const segmentos = req.params.resto;
  res.json({ segmentos, caminho: segmentos.join('/') });
});

// ---------------------------------------------------------------------
// 404 — a rota que casa com tudo, sempre por último
// ---------------------------------------------------------------------
// `app.use` sem caminho roda para qualquer requisição que chegou até aqui — ou
// seja, nenhuma rota acima respondeu. Se este bloco estivesse no topo do
// arquivo, TODA requisição seria 404. Ordem é tudo no Express.

app.use((req, res) => {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.path}` });
});

const PORT = 5052;
app.listen(PORT, () => {
  console.log(`Servidor com routers em http://localhost:${PORT}/api/v1`);
});
