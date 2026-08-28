/**
 * O tratador de erro central e o 404 genérico.
 *
 * Um lugar só decide o formato de toda resposta de erro da API. Sem isso, cada
 * rota inventa o seu (`{erro}`, `{message}`, `{error: {msg}}`) e o cliente
 * precisa de um `if` por endpoint.
 */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from './erro-app.ts';

/** Formato único de resposta de erro. Documente-o e nunca mais mude. */
type RespostaErro = {
  erro: string;
  status: number;
  requestId?: string;
  detalhes?: unknown;
};

/**
 * O 404 de rota inexistente.
 *
 * Vem ANTES do tratador de erro e DEPOIS de todas as rotas. Ele não responde
 * direto: joga um `AppError` para o tratador, e assim o 404 sai no mesmo formato
 * de todos os outros erros.
 */
export function rotaNaoEncontrada(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.path}`, 404));
}

/**
 * O TRATADOR CENTRAL.
 *
 * São os 4 parâmetros que fazem o Express reconhecer isto como tratador de erro.
 * Remover o `_next`, mesmo sem usar, transforma num middleware comum que jamais
 * recebe erro — e você fica com o handler padrão do Express, que devolve HTML
 * com a stack trace inteira.
 */
export function tratarErro(
  erro: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = res.locals.requestId as string | undefined;

  // --- Caso 1: erro que NÓS criamos. Mensagem pode ir ao cliente. ---
  if (erro instanceof AppError) {
    const corpo: RespostaErro = { erro: erro.message, status: erro.status };
    if (requestId) corpo.requestId = requestId;
    if (erro.detalhes !== undefined) corpo.detalhes = erro.detalhes;

    // 4xx é culpa do cliente: não é incidente, não polui o log de erro.
    // 5xx sim — e um AppError de 500 é raro o suficiente para merecer atenção.
    if (erro.status >= 500) console.error(`[${requestId}] AppError 5xx:`, erro);

    return res.status(erro.status).json(corpo);
  }

  // --- Caso 2: JSON malformado. O `express.json()` joga um SyntaxError. ---
  // Sem este bloco o cliente recebe 500 por ter mandado body quebrado — culpa
  // dele virando culpa sua, e você caçando um bug que não existe.
  if (erro instanceof SyntaxError && 'body' in erro) {
    return res
      .status(400)
      .json({ erro: 'JSON inválido no corpo da requisição', status: 400 });
  }

  // --- Caso 3: qualquer outra coisa é BUG. ---
  // Log completo do lado do servidor...
  console.error(`[${requestId}] ERRO NÃO TRATADO:`, erro);

  // ...e para o cliente, só o genérico. A mensagem de um bug frequentemente
  // descreve sua infraestrutura ("connect ECONNREFUSED 10.0.0.5:5432") ou seu
  // schema. Vazar isso é dar um mapa para quem estiver sondando.
  const corpo: RespostaErro = { erro: 'Erro interno do servidor', status: 500 };
  if (requestId) corpo.requestId = requestId; // o cliente cita este id no suporte

  res.status(500).json(corpo);
}
