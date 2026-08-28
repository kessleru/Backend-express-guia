/**
 * Timeout de requisição: desiste de esperar o handler e responde ao cliente.
 *
 * Conceito de middleware: docs/01-05/05-middlewares.md. Status: docs/01-05/01-fundamentos-http.md.
 *
 * O que este arquivo NÃO faz, e é a primeira coisa a saber: ele não cancela o
 * handler. Não existe em Node uma forma de matar uma função que já começou. O
 * handler continua rodando, continua segurando a conexão de banco, continua
 * chegando ao fim — só que ninguém mais está ouvindo. Isto protege o CLIENTE
 * da espera, não o servidor da carga.
 */
import type { NextFunction, Request, Response } from 'express';

/**
 * @param ms Teto de espera. O padrão de 5 s vem de dois lados: acima disso o
 * usuário já assumiu que caiu e recarregou a página (dobrando a carga), e ele
 * fica confortavelmente abaixo dos 30–60 s típicos de um balanceador na frente
 * — assim quem responde é a sua mensagem, e não a página de erro genérica dele.
 */
export function timeout(ms = 5000) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const temporizador = setTimeout(() => {
      // Corrida real: o handler pode ter respondido no milissegundo anterior ao
      // disparo, antes de o `clearTimeout` rodar. Sem esta linha o timeout
      // tentaria escrever cabeçalho numa resposta já enviada — o mesmo
      // `ERR_HTTP_HEADERS_SENT` que o handler lento causa do outro lado.
      if (res.headersSent) return;

      // Sem `Retry-After`, todo cliente que leva 503 tenta de novo na hora, e a
      // rota que já estava lenta recebe o dobro de pedidos. O número é o mesmo
      // teto de espera em segundos: se nem isso bastou, insistir imediatamente
      // não vai bastar também.
      res.setHeader('Retry-After', String(Math.ceil(ms / 1000)));
      res.status(503).json({
        erro: 'A resposta demorou mais do que o limite e foi abandonada',
        limiteMs: ms,
      });
    }, ms);

    // `close` e não `finish`: o `finish` só dispara quando a resposta é enviada
    // com sucesso. Se o cliente desconectar no meio, o `finish` nunca vem, o
    // temporizador sobrevive e segura o event loop até disparar sozinho numa
    // resposta que não existe mais. O `close` cobre os dois desfechos.
    res.on('close', () => clearTimeout(temporizador));

    next();
  };
}

/**
 * A checagem que o handler lento precisa fazer antes de responder.
 *
 * Quando o timeout já respondeu, os cabeçalhos foram enviados; qualquer
 * `res.json`/`res.send` depois disso tenta escrever cabeçalho de novo e lança
 * `ERR_HTTP_HEADERS_SENT`. O erro não corrompe a resposta do cliente (ela já
 * saiu inteira) — ele vira uma exceção no seu servidor, um 500 fantasma no log
 * e um alerta atrás do outro para algo que funcionou como o previsto.
 *
 * Está exportada como função com nome, e não copiada como `if (res.headersSent)`
 * em cada rota, porque o nome é o que faz o leitor da rota perguntar "por que
 * isto está aqui?" — e a resposta é este arquivo.
 */
export function jaRespondida(res: Response): boolean {
  return res.headersSent;
}
