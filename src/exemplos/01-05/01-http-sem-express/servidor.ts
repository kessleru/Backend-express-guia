/**
 * Um servidor HTTP SEM Express, usando só o módulo `node:http`.
 *
 * Objetivo: ver com os próprios olhos o trabalho que o Express faz por você.
 * Tudo aqui é manual — rotear, ler o body, definir header, serializar JSON.
 *
 * Rodar:  node src/exemplos/01-05/01-http-sem-express/servidor.ts
 */
import { createServer } from 'node:http';

const PORTA = 4001;

const servidor = createServer(async (req, res) => {
  // `req.url` vem só com caminho + query ("/ola?nome=ana"), nunca o domínio.
  // O `new URL` precisa de uma base para funcionar, daí o localhost fixo.
  const url = new URL(req.url ?? '/', `http://localhost:${PORTA}`);
  const rota = `${req.method} ${url.pathname}`;

  // Log de depuração: método, caminho e query string.
  console.log(req.method, url.pathname, url.searchParams.toString());
  //          GET         /ola          nome=ana

  // ---- ROTEAMENTO MANUAL ----------------------------------------------
  // No Express isto vira app.get('/ola', ...). Aqui é um switch na mão.

  if (rota === 'GET /') {
    // Sem `Content-Type`, o navegador adivinha o formato — e às vezes erra.
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Olá! Sou um servidor HTTP puro.');
    return;
  }

  if (rota === 'GET /ola') {
    // Query params: opcionais por natureza. Sempre chegam como string.
    const nome = url.searchParams.get('nome') ?? 'desconhecido';
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    // JSON.stringify na mão: no Express, res.json() faz isto e o header acima.
    res.end(JSON.stringify({ mensagem: `Olá, ${nome}!` }));
    return;
  }

  if (rota === 'POST /eco') {
    // O body não chega pronto: ele vem em pedaços (chunks), porque a
    // requisição é um stream. Precisamos juntar os pedaços e só então
    // interpretar. `express.json()` existe exatamente para poupar isto.
    const pedacos: Buffer[] = [];
    for await (const pedaco of req) {
      pedacos.push(pedaco as Buffer);
    }
    const corpoTexto = Buffer.concat(pedacos).toString('utf-8');

    try {
      const corpo: unknown = JSON.parse(corpoTexto);
      // 201 Created: um recurso foi criado. Diferente de 200 OK.
      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ voceEnviou: corpo }));
    } catch {
      // 400: o cliente errou (mandou JSON inválido). Culpa dele, não sua.
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ erro: 'JSON inválido' }));
    }
    return;
  }

  // Nenhuma rota bateu. 404 é obrigação: sem isso a requisição fica pendurada.
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ erro: 'Rota não encontrada', rota }));
});

servidor.listen(PORTA, () => {
  console.log(`Servidor puro em http://localhost:${PORTA}`);
  console.log('Experimente:');
  console.log(`  curl localhost:${PORTA}/`);
  console.log(`  curl "localhost:${PORTA}/ola?nome=ana"`);
  console.log(
    `  curl -X POST localhost:${PORTA}/eco -H "Content-Type: application/json" -d '{"a":1}'`,
  );
  console.log(`  curl -i localhost:${PORTA}/nao-existe`);
});
