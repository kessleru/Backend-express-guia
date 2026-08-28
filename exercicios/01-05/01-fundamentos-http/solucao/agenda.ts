/**
 * Solução do exercício 01 — agenda de contatos com `node:http` puro.
 *
 * Rodar:  node exercicios/01-05/01-fundamentos-http/solucao/agenda.ts
 *
 * Esta é UMA solução, não A solução. Se a sua passa nos critérios de aceite,
 * ela está certa também.
 */
import { createServer } from 'node:http';
// `import type` some por completo no JavaScript final — é só para o TypeScript.
import type { IncomingMessage, ServerResponse } from 'node:http';

const PORTA = 4010;

type Contato = {
  id: number;
  nome: string;
  email: string;
};

// "Banco de dados" em memória: some quando o processo morre.
// A partir do módulo 09 isto vira SQLite de verdade.
const contatos: Contato[] = [
  { id: 1, nome: 'Ana Souza', email: 'ana@exemplo.com' },
  { id: 2, nome: 'Bruno Lima', email: 'bruno@exemplo.com' },
];

// Contador separado, que só cresce. Se derivássemos o id do tamanho do array,
// deletar um contato faria o próximo reaproveitar um id já usado.
let proximoId = 3;

/** Atalho para responder JSON: status + header + serialização num lugar só. */
function responderJson(
  res: ServerResponse,
  status: number,
  dados: unknown,
  headersExtras: Record<string, string> = {},
) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headersExtras,
  });
  res.end(JSON.stringify(dados));
}

/** Junta os pedaços (chunks) do body e devolve como texto. */
async function lerBody(req: IncomingMessage): Promise<string> {
  const pedacos: Buffer[] = [];
  for await (const pedaco of req) {
    pedacos.push(pedaco as Buffer);
  }
  return Buffer.concat(pedacos).toString('utf-8');
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORTA}`);
  // "/contatos/7" → ['contatos', '7']. O filter(Boolean) tira as strings
  // vazias que o split gera por causa das barras nas pontas.
  const partes = url.pathname.split('/').filter(Boolean);
  const metodo = req.method ?? 'GET';

  const recurso = partes[0]; // string | undefined (noUncheckedIndexedAccess)
  const idTexto = partes[1];

  if (recurso !== 'contatos') {
    responderJson(res, 404, { erro: 'Rota não encontrada' });
    return;
  }

  // ---- GET /contatos (com filtro opcional) ----------------------------
  if (metodo === 'GET' && idTexto === undefined) {
    const filtro = url.searchParams.get('nome');
    // Sem filtro devolvemos tudo. Filtro é query param: opcional por natureza.
    const resultado = filtro
      ? contatos.filter((c) => c.nome.toLowerCase().includes(filtro.toLowerCase()))
      : contatos;
    responderJson(res, 200, resultado);
    return;
  }

  // ---- POST /contatos --------------------------------------------------
  if (metodo === 'POST' && idTexto === undefined) {
    const texto = await lerBody(req);

    let corpo: unknown;
    try {
      corpo = JSON.parse(texto);
    } catch {
      // JSON quebrado é erro DO CLIENTE → 400, nunca 500.
      responderJson(res, 400, { erro: 'JSON inválido' });
      return;
    }

    // `corpo` é unknown: precisamos provar que tem o formato esperado antes
    // de usar. No módulo 07 o Zod faz isto de forma bem mais elegante.
    const dados = corpo as Partial<Contato>;
    if (typeof dados.nome !== 'string' || typeof dados.email !== 'string') {
      responderJson(res, 400, { erro: 'Campos obrigatórios: nome, email' });
      return;
    }

    const novo: Contato = { id: proximoId++, nome: dados.nome, email: dados.email };
    contatos.push(novo);

    // 201 + Location: o padrão HTTP para "criei, e está aqui".
    responderJson(res, 201, novo, { Location: `/contatos/${novo.id}` });
    return;
  }

  // Daqui pra baixo, toda rota precisa de um id válido.
  if (idTexto === undefined) {
    responderJson(res, 404, { erro: 'Rota não encontrada' });
    return;
  }

  const id = Number(idTexto);
  if (!Number.isInteger(id)) {
    // "/contatos/abc" é uma requisição malformada, não um recurso ausente.
    responderJson(res, 400, { erro: 'O id precisa ser um número inteiro' });
    return;
  }

  // ---- GET /contatos/:id -----------------------------------------------
  if (metodo === 'GET') {
    const contato = contatos.find((c) => c.id === id);
    if (!contato) {
      responderJson(res, 404, { erro: `Contato ${id} não encontrado` });
      return;
    }
    responderJson(res, 200, contato);
    return;
  }

  // ---- DELETE /contatos/:id --------------------------------------------
  if (metodo === 'DELETE') {
    const indice = contatos.findIndex((c) => c.id === id);
    if (indice === -1) {
      responderJson(res, 404, { erro: `Contato ${id} não encontrado` });
      return;
    }
    contatos.splice(indice, 1);
    // 204 = sucesso sem conteúdo. Nada de body aqui, nem `{}`.
    res.writeHead(204);
    res.end();
    return;
  }

  // ---- DESAFIO EXTRA: PATCH /contatos/:id ------------------------------
  if (metodo === 'PATCH') {
    const contato = contatos.find((c) => c.id === id);
    if (!contato) {
      responderJson(res, 404, { erro: `Contato ${id} não encontrado` });
      return;
    }

    const texto = await lerBody(req);
    let corpo: unknown;
    try {
      corpo = JSON.parse(texto);
    } catch {
      responderJson(res, 400, { erro: 'JSON inválido' });
      return;
    }

    const dados = corpo as Partial<Contato>;
    // A diferença entre PATCH e PUT mora aqui: só sobrescrevemos o que veio.
    // Um PUT substituiria o recurso inteiro, apagando o que não foi enviado.
    if (typeof dados.nome === 'string') contato.nome = dados.nome;
    if (typeof dados.email === 'string') contato.email = dados.email;

    responderJson(res, 200, contato);
    return;
  }

  // Método que não tratamos nesta rota.
  // 405 é mais preciso que 404: o recurso existe, o método é que não serve.
  responderJson(res, 405, { erro: `Método ${metodo} não permitido em /contatos` });
});

servidor.listen(PORTA, () => {
  console.log(`Agenda rodando em http://localhost:${PORTA}`);
});
