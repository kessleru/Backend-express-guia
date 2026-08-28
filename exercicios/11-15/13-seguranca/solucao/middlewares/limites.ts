/**
 * Rate limit por FINALIDADE, agora com `express-rate-limit`.
 *
 * ---------------------------------------------------------------------
 * O QUE SAIU DAQUI, E O QUE A LINHA DE CONFIG COMPROU
 * ---------------------------------------------------------------------
 * Até o módulo 12 este projeto usava `middlewares/limitar.ts`, escrito à mão no
 * módulo 05: um `Map` de IP para contagem, com janela fixa. Ele foi apagado
 * nesta solução. Valeu escrever uma vez — sem isso, "instale a lib" é fé, não
 * decisão. Mas ele tinha três limites reais, e todos aparecem em produção:
 *
 *   | Problema do limitar() à mão              | O que a lib faz                     |
 *   | ---------------------------------------- | ----------------------------------- |
 *   | O Map morre no restart                   | `store` trocável (Redis, módulo 15) |
 *   | 3 instâncias = 3 contadores separados    | mesmo `store` para todas            |
 *   | Headers `X-RateLimit-*`, que são antigos | `RateLimit` do draft-8 da IETF      |
 *
 * O que ela NÃO conserta: a janela continua sendo fixa por padrão, então a
 * rajada na virada (5 no fim de uma janela + 5 no começo da próxima = 10 em
 * milissegundos) continua possível. Quem precisa fechar isso troca o store por
 * um que implemente janela deslizante. Instalar a lib não é o fim do assunto.
 *
 * ---------------------------------------------------------------------
 * POR QUE TRÊS LIMITADORES E NÃO UM
 * ---------------------------------------------------------------------
 * Cada chamada de `rateLimit()` cria um contador independente. Um limitador
 * global de 100/min pareceria mais simples e seria pior: navegar 100 vezes
 * gastaria a cota que existia para proteger o login, e o ataque de força bruta
 * passaria a caber dentro do orçamento de quem só estava lendo a lista de
 * livros.
 *
 * O princípio é o do módulo 11, agora com números: cada limite protege um
 * recurso, e recursos com custos diferentes recebem baldes diferentes. Login
 * custa ~200ms de CPU (Argon2, módulo 11); um GET custa microssegundos. Não faz
 * sentido cobrarem do mesmo orçamento.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit, { type Options } from 'express-rate-limit';
import { AppError } from '../erros/AppError.ts';

/**
 * A configuração que todos compartilham.
 *
 * `standardHeaders: 'draft-8'` liga os headers padronizados pela IETF —
 * `RateLimit: limit=5, remaining=2, reset=41` e `RateLimit-Policy`. Um cliente
 * educado lê isso e se auto-regula antes de tomar 429.
 *
 * `legacyHeaders: false` desliga os `X-RateLimit-*`. Eles são anteriores ao
 * draft e nunca foram padrão; mandar os dois formatos dobra o tamanho do header
 * em TODA resposta para agradar clientes que ninguém identificou.
 *
 * `handler` existe para o 429 sair no MESMO formato de erro das outras respostas
 * (módulo 06). O padrão da lib responde `{ "message": "Too many requests" }` —
 * um corpo diferente de todo o resto da API, em inglês, que obrigaria o cliente
 * a escrever um tratamento só para este status.
 *
 * Repare que o `handler` chama `next(erro)` em vez de responder: é o tratador
 * central que decide o corpo. O header `Retry-After` já foi posto pela lib antes
 * de o handler rodar — header e corpo são independentes até a resposta sair,
 * como em `limitar.ts` (módulo 05).
 */
function baseDeConfig(mensagem: string): Partial<Options> {
  return {
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req: Request, res: Response, next: NextFunction) => {
      // `Retry-After` vem em segundos e é o que evita o cliente martelar em loop.
      // A lib já o definiu; aqui só o repassamos ao corpo para quem lê JSON.
      const segundos = Number(res.getHeader('Retry-After') ?? 60);
      next(new AppError(`${mensagem} Tente novamente em ${segundos}s.`, 429));
    },
  };
}

/**
 * ---------------------------------------------------------------------
 * POR QUE UMA FÁBRICA, E NÃO QUATRO `export const`
 * ---------------------------------------------------------------------
 * A forma que todo tutorial mostra é declarar os limitadores no topo do módulo:
 *
 *   export const limiteLogin = rateLimit({ ... });   // ❌ aqui
 *
 * Em produção dá no mesmo — existe um processo, um app, um contador. O problema
 * aparece quando existe mais de um app no mesmo processo: **o balde fica preso
 * ao módulo, não ao app.** Dois `criarApp()` passam a dividir a mesma contagem.
 *
 * Isso foi descoberto rodando, e não pensando: com os limitadores no topo do
 * módulo, o teste "navegar não consome a cota do login" recebia 429 porque o
 * caso ANTERIOR já tinha gasto as cinco tentativas — em outro app, criado do
 * zero, com outros repositórios. `resetKey()` até conserta, mas exige adivinhar
 * a chave interna (o IP na forma `::ffff:127.0.0.1`), e um teste que depende de
 * adivinhar um detalhe da lib quebra sozinho na próxima versão.
 *
 * A fábrica resolve na raiz: cada app tem os seus baldes, do mesmo jeito que já
 * tem os seus repositórios (módulo 12). O custo é uma linha a mais no `app.ts`
 * para passar os limites adiante — e é o mesmo custo que a injeção de
 * dependência cobra em qualquer lugar.
 *
 * Princípio: **estado global só parece simples enquanto existe uma instância
 * só.** Vale para contador de rate limit, cache em memória e conexão de banco.
 */
export function criarLimites() {
  return {
    /**
     * CREDENCIAL — o balde mais apertado.
     *
     * 5 por minuto é hostil para um robô e generoso para uma pessoa: quem erra a
     * senha cinco vezes em um minuto não vai acertar na sexta. Cobre
     * `/auth/login` e `/auth/registrar`, porque criar conta em massa é o outro
     * abuso da mesma porta — e as duas rotas custam um Argon2.
     *
     * O que ele NÃO resolve: ataque distribuído. Cada bot com um IP diferente
     * tem o próprio balde de 5. A defesa completa soma limite por CONTA (não só
     * por IP), atraso progressivo e alerta por e-mail — nada disso cabe numa
     * linha de config.
     */
    login: rateLimit({
      windowMs: 60_000,
      limit: 5,
      ...baseDeConfig('Muitas tentativas de autenticação.'),
    }),

    /**
     * TROCA DE SENHA — o quarto balde, que o enunciado não pediu.
     *
     * A tabela do exercício lista três limitadores porque são os três que os
     * critérios de aceite verificam. Este veio do módulo 11 e fica: juntá-lo ao
     * de login faria tentativas de login gastarem a cota de quem só quer trocar
     * a senha — um usuário legítimo bloqueado por causa de um ataque a OUTRA
     * rota.
     *
     * Vale como aviso geral: a lista de um enunciado (ou de um checklist de
     * segurança) é o mínimo verificável, não o desenho completo.
     */
    trocaSenha: rateLimit({
      windowMs: 60_000,
      limit: 5,
      ...baseDeConfig('Muitas tentativas de troca de senha.'),
    }),

    /** ESCRITA — POST, PUT, PATCH e DELETE. Muda dados, então custa mais. */
    escrita: rateLimit({
      windowMs: 60_000,
      limit: 30,
      ...baseDeConfig('Muitas operações de escrita.'),
    }),

    /** LEITURA — GET e HEAD. O limite existe contra abuso, não contra uso. */
    leitura: rateLimit({
      windowMs: 60_000,
      limit: 100,
      ...baseDeConfig('Muitas requisições.'),
    }),
  };
}

export type Limites = ReturnType<typeof criarLimites>;

/**
 * Despacha para o limitador certo conforme o MÉTODO.
 *
 * Sem isto, aplicar dois limitadores na mesma rota faria a requisição consumir
 * cota dos DOIS baldes — um GET gastaria uma leitura e uma escrita. Aqui só um
 * roda por requisição.
 *
 * `HEAD` conta como leitura porque é um GET sem corpo: o servidor faz o mesmo
 * trabalho e devolve só os headers.
 */
export function porMetodo(leitura: RequestHandler, escrita: RequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ehLeitura = req.method === 'GET' || req.method === 'HEAD';
    return ehLeitura ? leitura(req, res, next) : escrita(req, res, next);
  };
}

/**
 * O interruptor do teste — o mesmo padrão do módulo 12.
 *
 * `passar` é um middleware que só chama `next()`. Ele existe porque o Express
 * exige uma função: `app.use(undefined)` lança. Trocar o limitador por ele é o
 * que permite a suíte fazer 40 logins em três segundos.
 *
 * O que NÃO foi feito: subir o limite de 5 para 500 para o teste caber dentro
 * dele. Um limite calibrado pela suíte deixou de proteger a produção — e o
 * commit que fez isso pareceu inofensivo.
 */
export const passar: RequestHandler = (_req, _res, next) => next();

export function talvez(ligado: boolean, middleware: RequestHandler): RequestHandler {
  return ligado ? middleware : passar;
}
