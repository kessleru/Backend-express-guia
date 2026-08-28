/**
 * O tratador central. Um lugar decide o formato de TODA resposta de erro.
 */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from './AppError.ts';

/** Formato único. Documente-o e não mude mais — o cliente depende disso. */
type RespostaErro = {
  erro: string;
  status: number;
  requestId?: string;
  detalhes?: unknown;
  stack?: string; // só fora de produção (desafio extra)
};

const EM_PRODUCAO = process.env.NODE_ENV === 'production';

/**
 * 404 de rota inexistente. Não responde: joga, para sair no mesmo formato dos
 * outros erros. Vai depois de todas as rotas e antes do tratador.
 */
export function rotaNaoEncontrada(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.path}`, 404));
}

/**
 * 4 PARÂMETROS. É a aridade que faz o Express reconhecer o tratador de erro.
 * Com 3, ele vira middleware comum, nunca recebe erro, e o handler padrão do
 * Express devolve HTML com a stack inteira para o cliente.
 */
export function tratarErro(
  erro: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = res.locals.requestId as string | undefined;

  // --- 1. Erro que nós criamos: mensagem vai ao cliente ---
  if (erro instanceof AppError) {
    const corpo: RespostaErro = { erro: erro.message, status: erro.status };
    if (requestId) corpo.requestId = requestId;
    if (erro.detalhes !== undefined) corpo.detalhes = erro.detalhes;

    // 4xx é rotina, não incidente — não polui o log de erro. 5xx sim.
    if (erro.status >= 500) console.error(`[${requestId}] AppError 5xx: ${erro.message}`);

    return res.status(erro.status).json(corpo);
  }

  // --- 2. JSON malformado: o express.json() lança SyntaxError com `body` ---
  // Sem este bloco, body quebrado do cliente vira 500 e você caça um bug seu
  // que não existe.
  if (erro instanceof SyntaxError && 'body' in erro) {
    const corpo: RespostaErro = {
      erro: 'JSON inválido no corpo da requisição',
      status: 400,
    };
    if (requestId) corpo.requestId = requestId;
    return res.status(400).json(corpo);
  }

  // --- 3. Qualquer outra coisa é BUG ---
  // Log completo no servidor: aqui você quer a stack toda.
  console.error(`[${requestId}] ERRO NÃO TRATADO:`, erro);

  const corpo: RespostaErro = { erro: 'Erro interno do servidor', status: 500 };
  if (requestId) corpo.requestId = requestId;

  // Desafio extra: stack só fora de produção. O risco de errar isso é alto —
  // por isso o módulo 12 tem um teste que garante que a stack nunca vaza.
  if (!EM_PRODUCAO && erro instanceof Error && erro.stack) corpo.stack = erro.stack;

  res.status(500).json(corpo);
}
