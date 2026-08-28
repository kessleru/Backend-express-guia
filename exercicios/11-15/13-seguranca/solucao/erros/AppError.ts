/**
 * Erro de aplicação — o que separa "situação prevista" de bug.
 *
 * Quem lança um AppError está dizendo: eu previ isso, a mensagem é minha e pode
 * ir para o cliente. Qualquer outro erro que chegue ao tratador é bug, e a
 * mensagem fica no servidor.
 */
export class AppError extends Error {
  readonly status: number;
  readonly esperado = true;
  readonly detalhes?: unknown;

  constructor(mensagem: string, status = 400, detalhes?: unknown) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;

    // `exactOptionalPropertyTypes` proíbe atribuir `undefined` a opcional.
    if (detalhes !== undefined) this.detalhes = detalhes;

    // Faz a stack começar em quem lançou, não dentro deste construtor.
    Error.captureStackTrace?.(this, AppError);
  }
}

// Fábricas nomeadas: o status de cada situação fica definido em UM lugar.
// Sem elas, um dia o "não encontrado" é 404 e no outro é 400.

export const naoEncontrado = (recurso: string, id: string | number) =>
  new AppError(`${recurso} ${id} não encontrado`, 404);

export const requisicaoInvalida = (mensagem: string, detalhes?: unknown) =>
  new AppError(mensagem, 400, detalhes);

/** 409: requisição correta, estado do recurso é que não permite. */
export const conflito = (mensagem: string) => new AppError(mensagem, 409);

export const naoAutenticado = (mensagem = 'Credencial ausente ou inválida') =>
  new AppError(mensagem, 401);

export const semPermissao = (mensagem = 'Sem permissão para esta operação') =>
  new AppError(mensagem, 403);

export const servicoIndisponivel = (mensagem: string) => new AppError(mensagem, 503);
