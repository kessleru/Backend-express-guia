/**
 * `AppError` — a classe que separa erro ESPERADO de bug.
 *
 * A ideia central: se você criou o erro de propósito, ele é esperado e a
 * mensagem pode ir para o cliente. Qualquer outra coisa que chegue no tratador é
 * bug, e a mensagem NÃO pode sair — mensagem de bug vaza estrutura interna
 * ("column users.password does not exist" é um mapa do seu banco).
 */

export class AppError extends Error {
  readonly status: number;
  /** Marca "eu criei este erro de propósito". É o que distingue de um bug. */
  readonly esperado = true;
  /** Detalhes opcionais — usado pelo Zod no módulo 07 para listar campos. */
  readonly detalhes?: unknown;

  constructor(mensagem: string, status = 400, detalhes?: unknown) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;

    // `exactOptionalPropertyTypes` está ligado: atribuir `undefined` a uma
    // propriedade opcional é erro de tipo. Daí o if em vez de atribuir direto.
    if (detalhes !== undefined) this.detalhes = detalhes;

    // Sem isto, a stack trace começa dentro deste construtor em vez de onde o
    // erro foi lançado. Detalhe pequeno que economiza muito tempo de debug.
    Error.captureStackTrace?.(this, AppError);
  }
}

// Fábricas nomeadas. O ganho não é digitar menos: é que o status code fica
// definido em UM lugar. Sem isso, metade do código usa 404 e a outra 400 para a
// mesma situação, e o cliente nunca sabe o que esperar.

export const naoEncontrado = (recurso: string, id: string | number) =>
  new AppError(`${recurso} ${id} não encontrado`, 404);

export const requisicaoInvalida = (mensagem: string, detalhes?: unknown) =>
  new AppError(mensagem, 400, detalhes);

/** 409: a requisição está correta, o ESTADO do recurso é que não permite. */
export const conflito = (mensagem: string) => new AppError(mensagem, 409);

export const naoAutenticado = (mensagem = 'Credencial ausente ou inválida') =>
  new AppError(mensagem, 401);

export const semPermissao = (mensagem = 'Sem permissão para esta operação') =>
  new AppError(mensagem, 403);
