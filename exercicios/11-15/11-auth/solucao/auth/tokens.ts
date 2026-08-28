/**
 * JWT: emissão e verificação de access e refresh token.
 *
 * O princípio: HTTP é sem estado (módulo 01). O servidor não lembra de você
 * entre requisições, então TODA requisição precisa carregar a prova de quem
 * você é. As duas famílias de resposta para isso:
 *
 *   SESSÃO — o cliente carrega um id opaco; o estado fica no servidor.
 *            Revogar é apagar uma linha. Custa uma consulta por requisição.
 *   TOKEN  — o cliente carrega o dado assinado; o servidor não guarda nada.
 *            Verificar é só matemática. Revogar... não dá.
 *
 * JWT é a segunda. Ele não é "mais seguro" que sessão — é uma troca diferente:
 * você compra escala (nenhuma consulta, qualquer instância verifica) e paga em
 * revogação. Este arquivo existe para tornar essa conta explícita.
 */
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { AppError, naoAutenticado } from '../erros/AppError.ts';
import type { Papel } from '../dominio/usuario.ts';

// ---------------------------------------------------------------------
// O SEGREDO — e por que o processo morre sem ele
// ---------------------------------------------------------------------
// Este é um critério de aceite do exercício, e a razão é o modo como esse bug
// aparece: com `?? 'segredo-de-dev'`, tudo funciona em toda máquina, o deploy
// passa, os testes passam — e a falha só se manifesta quando alguém percebe que
// o segredo está no GitHub e forja um token de admin.
//
// Falhar ao subir transforma um problema silencioso de SEGURANÇA num problema
// barulhento de CONFIGURAÇÃO. O segundo você descobre em 10 segundos.
//
// O princípio: **fail fast na inicialização.** Configuração ausente derruba o
// processo antes de aceitar a primeira requisição, nunca no meio de uma.

const SEGREDO = process.env.JWT_SECRET;

if (!SEGREDO || SEGREDO.length < 32) {
  throw new Error(
    'JWT_SECRET ausente ou curto (mínimo 32 caracteres). Gere um com:\n' +
      "  node -e \"console.log(require('node:crypto').randomBytes(32).toString('hex'))\"",
  );
}

// O mínimo de 32 caracteres não é capricho: o HMAC-SHA256 usa uma chave de 256
// bits, e um segredo mais curto que isso reduz o espaço de busca de um ataque de
// força bruta offline sobre a assinatura. "senha123" como segredo de JWT é
// quebrável com dicionário — e a partir daí o atacante emite qualquer token.

/** `issuer`/`audience` valem para os dois tokens. Ver `OPCOES` abaixo. */
const EMISSOR = 'biblioteca-api';
const PUBLICO = 'biblioteca-web';

/**
 * `issuer` (quem emitiu) e `audience` (para quem vale).
 *
 * Protegem contra reuso entre sistemas que compartilham segredo: sem eles, um
 * token emitido pelo seu serviço de e-mail é aceito pela sua API, porque a
 * assinatura fecha. São dois campos, custam nada e resolvem uma classe inteira
 * de "confused deputy".
 */
const OPCOES = { issuer: EMISSOR, audience: PUBLICO } as const;

// ---------------------------------------------------------------------
// OS DOIS TOKENS
// ---------------------------------------------------------------------
// Como JWT não se revoga, a única defesa contra um token roubado é ele expirar
// rápido. Mas expirar rápido obrigaria o usuário a fazer login a cada 15
// minutos. Os dois papéis resolvem a tensão:
//
//   ACCESS  — 15 min. Vai em TODA requisição. Verificado sem tocar no banco.
//             Se vazar, a janela de estrago é curta.
//   REFRESH — 7 dias. Vai só para /auth/refresh. GUARDADO no servidor, por jti.
//             Se vazar, dá para revogar — e a rotação denuncia o roubo.
//
// Note que a segurança do conjunto vem da diferença de EXPOSIÇÃO: o token de
// vida longa quase não circula; o que circula sempre morre rápido.

const EXPIRA_ACESSO = '15m';
const EXPIRA_REFRESH = '7d';
/** Em segundos, para o cliente saber quando renovar antes de estourar. */
export const SEGUNDOS_ACESSO = 15 * 60;

/**
 * O PAYLOAD do access token.
 *
 * `sub` ("subject") é o nome padronizado pela RFC 7519 para "de quem é este
 * token". Usar o nome da RFC em vez de `usuarioId` é o que faz qualquer
 * biblioteca e qualquer gateway entenderem o token sem configuração.
 *
 * O QUE NÃO COLOCAR AQUI: **o payload de um JWT não é criptografado, é apenas
 * base64.** Qualquer um que tenha o token lê tudo — cole em jwt.io e veja. A
 * assinatura garante que o conteúdo não foi ALTERADO, não que seja secreto.
 * Então: nada de CPF, endereço, saldo, e-mail de terceiro.
 *
 * O que colocar: o id e o mínimo que a autorização precisa para não consultar o
 * banco a cada requisição — aqui, o papel.
 */
export type PayloadAcesso = {
  sub: string;
  papel: Papel;
};

/**
 * O payload do refresh.
 *
 * `jti` ("JWT ID") identifica ESTA emissão. É o que se guarda no servidor e o
 * que se apaga no logout — a alça pela qual um token sem estado vira revogável.
 */
export type PayloadRefresh = {
  sub: string;
  jti: string;
};

export function gerarAcesso(usuarioId: number, papel: Papel): string {
  return jwt.sign({ sub: String(usuarioId), papel } satisfies PayloadAcesso, SEGREDO!, {
    ...OPCOES,
    expiresIn: EXPIRA_ACESSO,
  });
}

/** O `jti` sai junto para o service poder gravá-lo no repositório. */
export function gerarRefresh(usuarioId: number): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign(
    { sub: String(usuarioId), jti } satisfies PayloadRefresh,
    SEGREDO!,
    { ...OPCOES, expiresIn: EXPIRA_REFRESH },
  );
  return { token, jti };
}

/**
 * `verify` faz três coisas: confere a ASSINATURA, confere a EXPIRAÇÃO e devolve
 * o payload. Qualquer uma que falhe, lança.
 *
 * `jwt.decode` NÃO verifica nada — é base64 reverso. Trocar `verify` por
 * `decode` é a falha mais grave que se comete com JWT: passa a aceitar qualquer
 * token que qualquer pessoa montou no navegador, inclusive `{"papel":"admin"}`.
 * Se você ver `decode` numa rota protegida, é vulnerabilidade, não estilo.
 */
export function verificarAcesso(token: string): PayloadAcesso {
  try {
    const payload = jwt.verify(token, SEGREDO!, OPCOES);

    // `verify` devolve `string | JwtPayload`. Estreitar não é burocracia do TS:
    // um token assinado com um payload de string (`jwt.sign('oi', ...)`) é
    // válido e chegaria aqui sem `papel`.
    if (typeof payload === 'string' || !('papel' in payload)) {
      throw naoAutenticado('Token com formato inesperado');
    }

    return { sub: String(payload.sub), papel: payload.papel as Papel };
  } catch (erro) {
    if (erro instanceof AppError) throw erro;

    // Distinguir EXPIRADO de INVÁLIDO é a única especificidade que vale a pena:
    // o cliente precisa saber se deve chamar /auth/refresh (expirou) ou mandar
    // o usuário logar de novo (inválido). É informação operacional, não pista
    // para atacante — um token expirado ele já sabia que tinha.
    if (erro instanceof jwt.TokenExpiredError) throw naoAutenticado('Token expirado');

    // Para o resto (assinatura errada, malformado, issuer trocado), mensagem
    // genérica: "assinatura inválida" ajudaria quem está tentando forjar a
    // separar "errei o formato" de "errei o segredo".
    throw naoAutenticado('Token inválido');
  }
}

export function verificarRefresh(token: string): PayloadRefresh {
  try {
    const payload = jwt.verify(token, SEGREDO!, OPCOES);
    if (typeof payload === 'string' || !('jti' in payload)) {
      throw naoAutenticado('Refresh token com formato inesperado');
    }
    return { sub: String(payload.sub), jti: String(payload.jti) };
  } catch (erro) {
    if (erro instanceof AppError) throw erro;
    throw naoAutenticado('Refresh token inválido ou expirado');
  }
}
