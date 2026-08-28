/**
 * Middleware genérico de validação. Escrito uma vez, serve toda a API.
 */
import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodType } from 'zod';
import { AppError } from '../erros/AppError.ts';

type Fonte = 'body' | 'query' | 'params';

/**
 * Valida `req[fonte]` contra o schema.
 *
 * `safeParse` e não `parse` porque queremos traduzir o `ZodError` para o nosso
 * formato de erro — senão o tratador central (módulo 06) precisaria conhecer o
 * Zod, e o acoplamento sobe de graça.
 */
export function validar(schema: ZodType, fonte: Fonte = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    // `?? {}` no body: sem `Content-Type: application/json`, o Express 5 deixa
    // `req.body` como `undefined` (módulo 03). Passar `undefined` a um
    // `z.object()` produz "expected object, received undefined" — mensagem que
    // não diz ao cliente qual campo falta. Com `{}`, ele recebe a lista de
    // campos obrigatórios, que é o que resolve o problema dele.
    const entrada = fonte === 'body' ? (req.body ?? {}) : req[fonte];
    const resultado = schema.safeParse(entrada);

    if (!resultado.success) {
      throw new AppError('Dados inválidos', 400, formatarErros(resultado.error));
    }

    // NÃO faça `req[fonte] = resultado.data`. No Express 5, para query:
    //   TypeError: Cannot set property query of #<IncomingMessage>
    //              which has only a getter
    // O Express 5 tornou `req.query` um getter com parse lazy. `req.body` ainda
    // é gravável, `req.query` não — e depender dessa inconsistência é pedir para
    // quebrar na próxima versão.
    const validadosAqui = (res.locals.validados ?? {}) as Record<string, unknown>;
    validadosAqui[fonte] = resultado.data;
    res.locals.validados = validadosAqui;

    next();
  };
}

/**
 * Lê o dado validado com o tipo certo, sem `as` no handler.
 *
 * O schema é passado de novo só para o TypeScript inferir o retorno — em runtime
 * ele não é usado, a validação já ocorreu no middleware.
 *
 *   const { id } = validados(res, idSchema, 'params');   // id: number
 */
export function validados<T>(
  res: Response,
  _schema: ZodType<T>,
  fonte: Fonte = 'body',
): T {
  const guardados = res.locals.validados as Record<string, unknown> | undefined;
  const dado = guardados?.[fonte];

  // Falhar alto se você esqueceu o middleware é melhor que devolver `undefined`
  // e virar um bug três camadas adiante.
  if (dado === undefined) {
    throw new Error(`validados(): faltou validar(schema, '${fonte}') nesta rota`);
  }

  return dado as T;
}

/**
 * `ZodError` → `[{ campo, mensagem, codigo }]`.
 *
 * O Zod devolve TODOS os problemas de uma vez, não só o primeiro: o usuário
 * corrige o formulário inteiro numa passada. E `campo` é o que permite ao front
 * marcar o input certo em vez de mostrar um alerta genérico.
 */
export function formatarErros(erro: ZodError) {
  return erro.issues.map((problema) => ({
    campo: problema.path.join('.') || '(raiz)', // ['endereco','cep'] → 'endereco.cep'
    mensagem: problema.message,
    codigo: problema.code,
  }));
}

/** Fora do Express: valida e lança. Para seed, worker de fila e script. */
export function validarDados<T>(schema: ZodType<T>, dados: unknown): T {
  const resultado = schema.safeParse(dados);
  if (!resultado.success) {
    throw new AppError('Dados inválidos', 400, formatarErros(resultado.error));
  }
  return resultado.data;
}
