/**
 * Demo do grupo 01 — requisição e resposta.
 *
 * Não é aplicação: são as rotas mínimas que fazem os três middlewares do grupo
 * aparecerem numa resposta de `curl`.
 *
 * Rodar:  node middlewares/01-requisicao-e-resposta/servidor.ts
 * Porta:  6101
 */
import express from 'express';
import {
  tempoDeResposta,
  tempoDeRespostaQuebrado,
} from './tempo-de-resposta/middleware.ts';
import { idDeRequisicao, lerIdDaRequisicao } from './id-de-requisicao/middleware.ts';
import { log } from './log/middleware.ts';

const PORTA = 6101;
const app = express();

// A ordem dos três, e o porquê de cada posição (a regra geral está no módulo 05):
//
// 1. `tempoDeResposta` primeiro porque ele só mede o que vem **depois** dele.
//    Colocado no fim da pilha, o número passa a ignorar tudo que roda antes e o
//    cabeçalho vira otimismo.
// 2. `idDeRequisicao` em seguida: ele é a única fonte do id, e nada abaixo dele
//    pode citar um id que ainda não existe.
// 3. `log` por último dos três. Ele não precisa vir antes do id porque só lê o
//    valor no `finish`, quando a requisição inteira já passou — mas fica acima
//    das rotas, para registrar inclusive o que for rejeitado por elas.
app.use((req, res, next) => {
  // Exceção só para a demonstração: a rota `/quebrado` existe para mostrar a
  // versão que falha, e se o middleware certo rodasse nela o cabeçalho apareceria
  // na resposta e esconderia exatamente o que se quer ver.
  if (req.path === '/quebrado') return next();
  tempoDeResposta(req, res, next);
});
app.use(idDeRequisicao);
app.use(log);

app.get('/', (_req, res) => {
  res.json({
    grupo: '01-requisicao-e-resposta',
    rotas: {
      'GET /lento/:ms': 'dorme :ms milissegundos — mostra o X-Tempo-ms crescer',
      'GET /eco': 'devolve no corpo o id que o middleware resolveu',
      'GET /quebrado': 'a versão que carimba em finish — sem X-Tempo-ms na resposta',
    },
  });
});

app.get('/lento/:ms', async (req, res) => {
  // Teto de 2000: sem ele, `/lento/999999999` prende uma conexão do servidor por
  // onze dias. Numa demo isso é chateação; numa API pública é um pedido de
  // derrubada aceito de graça.
  const pedido = Number(req.params.ms);
  const ms = Number.isFinite(pedido) ? Math.min(Math.max(pedido, 0), 2000) : 0;

  await new Promise((resolver) => setTimeout(resolver, ms));

  res.json({ dormiu: ms, id: lerIdDaRequisicao(res) });
});

app.get('/eco', (_req, res) => {
  // O mesmo valor sai em dois lugares: no cabeçalho `X-Request-Id` (para quem
  // automatiza) e no corpo (para quem lê a resposta na tela e vai colar o id num
  // chamado de suporte).
  res.json({ id: lerIdDaRequisicao(res) });
});

app.get('/quebrado', tempoDeRespostaQuebrado, (_req, res) => {
  res.json({
    aviso: 'confira: esta resposta não tem X-Tempo-ms, e o terminal diz por quê',
  });
});

// 404 em JSON: sem isto o Express devolve HTML numa API que só fala JSON (módulo
// 04). Aqui ele também serve para o log mostrar `rota` caindo no caminho cru,
// porque nenhuma rota casou e `req.route` é `undefined`.
app.use((req, res) => {
  res.status(404).json({ erro: `Rota ${req.method} ${req.originalUrl} não existe` });
});

app.listen(PORTA, () => {
  console.log(`Demo do grupo 01 em http://localhost:${PORTA}`);
});
