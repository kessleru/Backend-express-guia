/**
 * Paginação: lê `?pagina=` e `?limite=` uma vez só e entrega à rota os três
 * números que ela precisa — `pagina`, `limite` e `offset`.
 *
 * Conceito de middleware: docs/01-05/05-middlewares.md. Zod: docs/06-10/07-validacao-zod.md.
 */
import { z } from 'zod';
import type { NextFunction, Request, Response } from 'express';

export type Paginacao = {
  pagina: number;
  limite: number;
  /** Quantas linhas pular. É o `OFFSET` do SQL, já calculado. */
  offset: number;
};

/**
 * A forma de estender o `Request` sem `namespace`: aumentar a interface do
 * pacote de tipos onde ela está declarada. `declare module` é sintaxe de tipo
 * pura, some na compilação e passa no `erasableSyntaxOnly` — diferente do
 * `declare global { namespace Express { ... } }` que circula por aí.
 *
 * O campo é opcional (`?`) e isso é proposital: ele só existe nas rotas onde
 * este middleware rodou. Declará-lo obrigatório faria o TypeScript garantir,
 * em TODA rota, um valor que na maioria delas é `undefined`.
 */
declare module 'express-serve-static-core' {
  interface Request {
    paginacao?: Paginacao;
  }
}

/**
 * 20 é o padrão porque é o que cabe numa tela sem rolagem infinita: quem não
 * mandou `?limite=` quase sempre é um cliente novo, e o padrão é o contrato
 * que ele vai herdar sem perceber.
 *
 * 100 é o teto porque o custo de uma página é linear no limite — banco, JSON e
 * memória. Sem teto, `?limite=1000000` é uma requisição que varre a tabela
 * inteira, monta um JSON de dezenas de megabytes e derruba o processo; e é uma
 * linha de `curl`, não um ataque sofisticado. O teto é a diferença entre uma
 * API que responde devagar e uma que sai do ar.
 */
const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

const consultaSchema = z.object({
  // Query string é SEMPRE texto: `?pagina=2` chega como `"2"` e um `z.number()`
  // puro recusaria — corretamente. `z.coerce` roda `Number()` antes de validar,
  // e é o que faz `?pagina=abc` virar `NaN` e cair no erro em vez de passar.
  pagina: z.coerce
    .number({ error: '`pagina` deve ser um número' })
    .int('`pagina` deve ser inteiro')
    .positive('`pagina` começa em 1')
    .default(1),

  limite: z.coerce
    .number({ error: '`limite` deve ser um número' })
    .int('`limite` deve ser inteiro')
    .min(1, '`limite` mínimo é 1')
    .max(LIMITE_MAXIMO, `\`limite\` máximo é ${LIMITE_MAXIMO}`)
    .default(LIMITE_PADRAO),
});

export function paginacao(req: Request, res: Response, next: NextFunction) {
  const resultado = consultaSchema.safeParse(req.query);

  if (!resultado.success) {
    // 422 e não 400: o texto chegou legível, o servidor entendeu, e a regra é
    // que recusou (docs/01-05/01-fundamentos-http.md). Este `res.status` direto é o
    // ponto a trocar por `next(new AppError(422, ...))` se o projeto já tiver
    // um tratador central — o README diz o que muda.
    return res.status(422).json({
      erro: 'Parâmetros de paginação inválidos',
      detalhes: resultado.error.issues.map((problema) => ({
        campo: problema.path.join('.') || '(raiz)',
        mensagem: problema.message,
      })),
    });
  }

  const { pagina, limite } = resultado.data;

  // O `- 1` é a conta que some quando cada rota a refaz: `pagina * limite`
  // pula a primeira página inteira e ninguém percebe, porque a página 2 volta
  // com dados plausíveis. Calculada aqui, ela existe uma vez no projeto.
  req.paginacao = { pagina, limite, offset: (pagina - 1) * limite };

  next();
}
