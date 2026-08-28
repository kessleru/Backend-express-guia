/**
 * O middleware genérico de validação.
 *
 * Escrito uma vez, serve para toda rota da API. É o que tira validação de dentro
 * dos handlers — compare com o módulo 03, onde cada rota tinha 15 linhas de
 * `typeof x !== 'string'`.
 */
import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';
import { AppError } from '../06-erros/erro-app.ts';

/** Onde o dado a validar mora dentro do `req`. */
type Fonte = 'body' | 'query' | 'params';

/**
 * `parse` vs `safeParse`:
 *   parse     → lança `ZodError` se inválido
 *   safeParse → devolve `{ success: true, data }` | `{ success: false, error }`
 *
 * Usamos `safeParse` para converter o erro no nosso `AppError` com `detalhes` no
 * formato que o front espera. Com `parse` daria no mesmo, mas o tratador central
 * (módulo 06) passaria a precisar conhecer `ZodError` — acoplamento a mais.
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

    // GUARDAMOS o dado validado em `res.locals`, não em `req[fonte]`.
    //
    // A tentação é `req[fonte] = resultado.data`, e é o que quase todo tutorial
    // faz. No Express 5 isso EXPLODE para query:
    //   TypeError: Cannot set property query of #<IncomingMessage>
    //              which has only a getter
    // O Express 5 transformou `req.query` em getter com parse lazy. `req.body`
    // ainda é gravável, `req.query` não — e depender dessa inconsistência é
    // pedir para quebrar na próxima versão.
    //
    // Guardar em `res.locals` funciona para as três fontes e deixa o dado
    // original intacto, o que é útil no log de auditoria.
    const validados = (res.locals.validados ?? {}) as Record<string, unknown>;
    validados[fonte] = resultado.data;
    res.locals.validados = validados;

    next();
  };
}

/**
 * Lê o dado validado COM O TIPO CERTO, sem cast.
 *
 * O schema é passado de novo só para o TypeScript inferir o retorno. Em runtime
 * ele não é usado — a validação já aconteceu no middleware.
 *
 *   const { id } = validados(res, idSchema, 'params');  // id: number
 */
export function validados<T>(
  res: Response,
  _schema: ZodType<T>,
  fonte: Fonte = 'body',
): T {
  const guardados = res.locals.validados as Record<string, unknown> | undefined;
  const dado = guardados?.[fonte];

  // Se cair aqui, você esqueceu o `validar(schema, fonte)` naquela rota. Falhar
  // alto é melhor que devolver `undefined` e virar um bug três camadas adiante.
  if (dado === undefined) {
    throw new Error(`validados(): faltou validar('${fonte}') nesta rota`);
  }

  return dado as T;
}

/**
 * Transforma o erro do Zod numa lista `{ campo, mensagem, codigo }`.
 *
 * O formato importa mais do que parece: o front precisa saber QUAL campo marcar
 * de vermelho. Uma string única ("dados inválidos") obriga a interface a mostrar
 * um alerta genérico e o usuário a caçar o próprio erro.
 */
export function formatarErros(erro: ZodError) {
  return erro.issues.map((problema) => ({
    // `path` é array porque pode ser aninhado: ['endereco','cep'] → 'endereco.cep'
    campo: problema.path.join('.') || '(raiz)',
    mensagem: problema.message,
    codigo: problema.code, // 'invalid_type', 'too_small', 'unrecognized_keys'...
  }));
}

/**
 * Fora do Express: valida e lança. Útil em service, worker de fila e script de
 * seed, onde não existe `req`/`res` nenhum.
 */
export function validarDados<T>(schema: ZodType<T>, dados: unknown): T {
  const resultado = schema.safeParse(dados);
  if (!resultado.success) {
    throw new AppError('Dados inválidos', 400, formatarErros(resultado.error));
  }
  return resultado.data;
}

export { ZodError };
