/**
 * JWT: access token + refresh token.
 *
 * Rodar a demonstração:  node src/exemplos/11-15/11-auth/tokens.ts
 */
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { AppError, naoAutenticado } from '../../06-10/06-erros/erro-app.ts';

// Em produção isto vem de variável de ambiente, e o processo NÃO SOBE sem ela.
// Um fallback silencioso é pior que um crash: você faria deploy com o segredo
// de exemplo e descobriria quando alguém forjasse um token de admin.
const SEGREDO = process.env.JWT_SECRET ?? 'segredo-de-exemplo-nunca-em-producao';

export type Papel = 'leitor' | 'admin';

/**
 * O PAYLOAD.
 *
 * O que NÃO colocar aqui: senha (óbvio), mas também CPF, e-mail, endereço,
 * saldo — qualquer dado sensível. **O payload de um JWT não é criptografado, é
 * apenas base64.** Qualquer um com o token lê tudo (teste em jwt.io).
 *
 * A assinatura garante que o conteúdo não foi ALTERADO, não que ele seja secreto.
 *
 * O que colocar: id, papel, e o mínimo que a autorização precisa para não bater
 * no banco a cada requisição.
 */
export type PayloadAcesso = {
  sub: string; // "subject": o id do usuário. Nome padronizado pela RFC 7519.
  papel: Papel;
};

export type PayloadRefresh = {
  sub: string;
  jti: string; // "JWT ID": identifica ESTE token, para poder revogá-lo
};

// ---------------------------------------------------------------------
// Os dois tokens e por que são dois
// ---------------------------------------------------------------------
// JWT assinado não pode ser revogado: quem tem o token entra até ele expirar,
// mesmo que você apague o usuário do banco. A única defesa é EXPIRAR RÁPIDO.
//
// Mas expirar rápido obrigaria o usuário a fazer login a cada 15 minutos. Daí os
// dois papéis:
//
//   ACCESS  — 15 min, vai em toda requisição, verificado sem tocar no banco
//   REFRESH — 7 dias, usado só para pegar um access novo, GUARDADO no banco
//
// O refresh estar no banco é o que permite revogar: no logout você apaga a linha,
// e a partir dali aquele refresh não gera mais nada.

const EXPIRA_ACESSO = '15m';
const EXPIRA_REFRESH = '7d';

export function gerarAcesso(usuarioId: number, papel: Papel): string {
  return jwt.sign({ sub: String(usuarioId), papel } satisfies PayloadAcesso, SEGREDO, {
    expiresIn: EXPIRA_ACESSO,
    // `issuer` e `audience` protegem contra reuso de token entre sistemas que
    // compartilham segredo. Baratos de ligar, chatos de descobrir que faltavam.
    issuer: 'biblioteca-api',
    audience: 'biblioteca-web',
  });
}

/** O `jti` é devolvido para que o chamador possa gravá-lo no banco. */
export function gerarRefresh(usuarioId: number): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign(
    { sub: String(usuarioId), jti } satisfies PayloadRefresh,
    SEGREDO,
    {
      expiresIn: EXPIRA_REFRESH,
      issuer: 'biblioteca-api',
      audience: 'biblioteca-web',
    },
  );
  return { token, jti };
}

/**
 * `verify` faz três coisas: confere a assinatura, confere a expiração e devolve o
 * payload. Se qualquer uma falhar, lança.
 *
 * `decode` NÃO verifica nada — só faz base64 reverso. Usar `decode` no lugar de
 * `verify` é a falha de segurança mais grave que se comete com JWT: aceita
 * qualquer token que qualquer um montou.
 */
export function verificarAcesso(token: string): PayloadAcesso {
  try {
    const payload = jwt.verify(token, SEGREDO, {
      issuer: 'biblioteca-api',
      audience: 'biblioteca-web',
    });

    // `verify` devolve `string | JwtPayload`. Estreitar é obrigatório.
    if (typeof payload === 'string' || !('papel' in payload)) {
      throw naoAutenticado('Token com formato inesperado');
    }

    return { sub: String(payload.sub), papel: payload.papel as Papel };
  } catch (erro) {
    if (erro instanceof AppError) throw erro;

    // Mensagem específica só para expiração: o cliente precisa saber que deve
    // usar o refresh, em vez de mandar o usuário logar de novo.
    if (erro instanceof jwt.TokenExpiredError) throw naoAutenticado('Token expirado');

    // Para os outros casos (assinatura inválida, malformado), mensagem genérica.
    // Dizer "assinatura inválida" ajuda quem está tentando forjar.
    throw naoAutenticado('Token inválido');
  }
}

export function verificarRefresh(token: string): PayloadRefresh {
  try {
    const payload = jwt.verify(token, SEGREDO, {
      issuer: 'biblioteca-api',
      audience: 'biblioteca-web',
    });
    if (typeof payload === 'string' || !('jti' in payload)) {
      throw naoAutenticado('Refresh token com formato inesperado');
    }
    return { sub: String(payload.sub), jti: String(payload.jti) };
  } catch (erro) {
    if (erro instanceof AppError) throw erro;
    throw naoAutenticado('Refresh token inválido ou expirado');
  }
}

// ---------------------------------------------------------------------
// Demonstração
// ---------------------------------------------------------------------

if (process.argv[1]?.endsWith('tokens.ts')) {
  const acesso = gerarAcesso(42, 'admin');
  console.log('access token:\n', acesso);

  // Anatomia: três partes separadas por ponto.
  const [cabecalho, corpo, assinatura] = acesso.split('.');
  console.log('\nheader :', JSON.parse(Buffer.from(cabecalho!, 'base64url').toString()));
  console.log('payload:', JSON.parse(Buffer.from(corpo!, 'base64url').toString()));
  console.log(
    'signature:',
    `${assinatura!.slice(0, 20)}... (${assinatura!.length} chars)`,
  );
  console.log('\n↑ o payload foi lido SEM O SEGREDO. É base64, não criptografia.');

  console.log('\nverify ok:', verificarAcesso(acesso));

  // Payload alterado → assinatura não fecha mais.
  const forjado = `${cabecalho}.${Buffer.from(JSON.stringify({ sub: '1', papel: 'admin' })).toString('base64url')}.${assinatura}`;
  try {
    verificarAcesso(forjado);
  } catch (erro) {
    console.log('token forjado:', (erro as Error).message, '← a assinatura pegou');
  }

  // Token expirado.
  const expirado = jwt.sign({ sub: '1', papel: 'leitor' }, SEGREDO, {
    expiresIn: '-1s',
    issuer: 'biblioteca-api',
    audience: 'biblioteca-web',
  });
  try {
    verificarAcesso(expirado);
  } catch (erro) {
    console.log('token expirado:', (erro as Error).message);
  }

  // Outro segredo → assinatura inválida.
  const deOutroSistema = jwt.sign({ sub: '1', papel: 'admin' }, 'outro-segredo');
  try {
    verificarAcesso(deOutroSistema);
  } catch (erro) {
    console.log('outro segredo:', (erro as Error).message);
  }

  const { token: refresh, jti } = gerarRefresh(42);
  console.log(`\nrefresh jti: ${jti} ← grave isto no banco para poder revogar`);
  console.log('verify refresh:', verificarRefresh(refresh));
}
