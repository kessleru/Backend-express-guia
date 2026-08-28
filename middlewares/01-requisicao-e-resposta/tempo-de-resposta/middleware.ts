/**
 * tempo-de-resposta — carimba `X-Tempo-ms` na resposta com o tempo que o
 * servidor levou para produzi-la.
 *
 * Conceito de middleware, ordem e `res.on('finish')`: docs/01-05/05-middlewares.md.
 * Copiável: não importa nada de outra pasta do catálogo.
 */
import type { NextFunction, Request, Response } from 'express';

export function tempoDeResposta(_req: Request, res: Response, next: NextFunction) {
  // `process.hrtime.bigint()` lê um relógio monotônico: ele conta nanossegundos
  // desde um ponto arbitrário e só anda para frente. `Date.now()` lê o relógio de
  // parede, que o NTP e o ajuste de horário empurram para trás algumas vezes por
  // dia — uma requisição atravessada por um desses ajustes devolveria
  // `X-Tempo-ms: -412.00`, e o número negativo só aparece em produção, nunca no
  // teste local. Bigint porque nanossegundo não cabe com precisão em `number`.
  const inicio = process.hrtime.bigint();

  // `bind(res)` guarda a função original **antes** de trocá-la. Sem o bind, o
  // `res.writeHead` de dentro da nova função apontaria para ela mesma e a
  // primeira resposta entraria em recursão infinita até estourar a pilha.
  const escreverCabecalhos = res.writeHead.bind(res);

  // O ponto da pasta: o carimbo tem que acontecer no último instante em que os
  // cabeçalhos ainda são editáveis, e esse instante é `writeHead`. O Node o chama
  // uma única vez por resposta, logo antes de a linha de status ir para o socket
  // — inclusive quando ninguém o chama à mão, porque `res.end`/`res.json`
  // disparam o `_implicitHeader`, que é `writeHead`. Trocar a função por uma que
  // carimba e depois delega é como todo middleware de tempo de resposta funciona
  // por baixo, do `response-time` para baixo.
  res.writeHead = function (...argumentos: Parameters<typeof escreverCabecalhos>) {
    const duracaoMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    res.setHeader('X-Tempo-ms', duracaoMs.toFixed(2));
    return escreverCabecalhos(...argumentos);
  } as typeof res.writeHead;

  next();
}

/**
 * ❌ A versão errada, que está em meia internet. Ela existe aqui para ser
 * executada, não para ser copiada — a certa é a de cima.
 *
 * Em `finish` a resposta inteira já foi para o socket: os cabeçalhos saíram
 * antes do corpo, e não há como voltar atrás. `res.setHeader` confere
 * `res.headersSent` e lança `ERR_HTTP_HEADERS_SENT`.
 */
export function tempoDeRespostaQuebrado(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const inicio = process.hrtime.bigint();

  res.on('finish', () => {
    const duracaoMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    // O `try` não faz parte da armadilha: ele existe porque uma exceção lançada
    // dentro de um listener de evento não tem `next()` para onde ir, vira
    // `uncaughtException` e derruba o processo. Sem ele, a demo morreria na
    // primeira chamada desta rota em vez de mostrar o erro.
    try {
      res.setHeader('X-Tempo-ms', duracaoMs.toFixed(2));
    } catch (erro) {
      const codigo = (erro as { code?: string }).code ?? 'desconhecido';
      console.error(`[quebrado] setHeader dentro de finish falhou: ${codigo}`);
    }
  });

  next();
}
