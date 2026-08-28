/**
 * Hash de senha. Este arquivo é o único do projeto que conhece o Argon2.
 *
 * O princípio, antes da API: **a senha do usuário nunca é armazenada.** Nem
 * criptografada — criptografia é reversível, e uma chave que o servidor tem é
 * uma chave que o invasor do servidor também tem. O que se guarda é um HASH: um
 * resumo de via única, do qual não se volta.
 *
 * A consequência prática é que o servidor não sabe a sua senha. Ele só sabe
 * conferir se o que você digitou produz o mesmo resumo. É por isso que um site
 * sério não consegue "te lembrar" a senha, só trocá-la — e um que te envia a
 * senha antiga por e-mail está guardando texto puro.
 */
import argon2 from 'argon2';
import { createHash, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------
// POR QUE NÃO SHA-256 (nem MD5, nem SHA-512)
// ---------------------------------------------------------------------
// SHA-256 é um hash de PROPÓSITO GERAL, projetado para ser rápido — o que se
// quer ao verificar a integridade de um arquivo de 4 GB.
//
// Para senha, a velocidade é o defeito. Uma GPU comum calcula bilhões de
// SHA-256 por segundo; um vazamento de banco com senhas em SHA-256 é quebrado
// em horas, porque o atacante testa o dicionário inteiro contra todo mundo.
//
// Argon2 e bcrypt invertem a meta: são LENTOS de propósito, e o custo é
// configurável. Você calibra para o login demorar ~100–250ms — imperceptível
// para um usuário que faz isso uma vez por sessão, proibitivo para quem precisa
// testar 10 bilhões de candidatos.
//
// O princípio geral: **defesa por custo assimétrico.** Você paga uma vez, o
// atacante paga bilhões de vezes.

/**
 * Os três parâmetros de custo do Argon2, e o que cada um compra.
 *
 * `memoryCost` é o mais importante contra GPU: uma GPU tem milhares de núcleos
 * mas pouca memória por núcleo. Exigir 19 MiB por tentativa derruba o paralelismo
 * dela muito mais do que aumentar o número de passadas.
 *
 * Os valores abaixo são o piso recomendado pelo OWASP para argon2id. A regra de
 * calibração é empírica: aumente até o `hash` levar o tempo que a sua aplicação
 * tolera, e revise quando trocar de hardware.
 */
const CUSTO = {
  type: argon2.argon2id, // resiste a ataque de GPU (argon2d) e de canal lateral (argon2i)
  memoryCost: 19456, // 19 MiB por tentativa
  timeCost: 2, // passadas sobre a memória
  parallelism: 1, // threads
} as const;

/**
 * O SALT não aparece na assinatura porque o Argon2 gera um aleatório por senha e
 * o embute no resultado.
 *
 * Por que salt existe: sem ele, senhas iguais produzem hashes iguais. Um
 * atacante pré-calcula o hash das 10 milhões de senhas mais comuns uma vez
 * (rainbow table) e quebra TODOS os usuários do vazamento de uma passada. Com um
 * salt por usuário, ele precisa refazer o trabalho inteiro para cada linha da
 * tabela — o custo volta a ser assimétrico.
 *
 * O salt não é secreto. Ele fica em texto claro dentro do próprio hash:
 *
 *   $argon2id$v=19$m=19456,t=2,p=1$<salt base64>$<hash base64>
 *    algoritmo  versão   parâmetros      salt         resumo
 *
 * Tudo que a verificação precisa está aí — inclusive os parâmetros de custo, que
 * é o que permite aumentar o custo amanhã sem invalidar os hashes de hoje.
 */
export function hashSenha(senha: string): Promise<string> {
  return argon2.hash(senha, CUSTO);
}

/**
 * `verify` relê os parâmetros e o salt de dentro do hash, recalcula e compara em
 * tempo constante. Não existe "des-hashear".
 *
 * O `catch` não é preguiça: um hash malformado (banco corrompido, migração mal
 * feita, campo truncado) faz o argon2 LANÇAR. Deixar o erro subir viraria um 500
 * naquele login específico — e um 500 que só acontece com um e-mail é um oráculo:
 * revela que aquela conta existe. Devolver `false` mantém o login indistinguível
 * de "senha errada", que é o comportamento seguro.
 */
export async function conferirSenha(hash: string, senha: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, senha);
  } catch {
    return false;
  }
}

/**
 * Hash descartável, para gastar o mesmo tempo quando o e-mail NÃO existe.
 *
 * Sem isso, o login vaza informação pelo relógio: "usuário não existe" responde
 * em 1ms (nem chega a hashear) e "senha errada" em 200ms. Um atacante mede o
 * tempo e descobre quais e-mails estão cadastrados sem nunca acertar uma senha —
 * a mensagem genérica sozinha não fecha essa porta.
 *
 * É um exemplo do princípio mais geral: **um canal lateral vaza tanto quanto a
 * mensagem.** Tempo, tamanho da resposta e código de status contam história.
 */
export async function gastarTempoDeHash(): Promise<void> {
  await argon2.hash('senha-falsa-para-igualar-o-tempo', CUSTO);
}

/**
 * Comparação em tempo constante, para segredos que NÃO são senha (API key, token
 * de webhook, código de verificação).
 *
 * Nesses casos não se usa hash lento — o cliente manda o segredo inteiro a cada
 * requisição, e 200ms por chamada seria inaceitável. Mas comparar com `===` vaza:
 * o `===` para no primeiro byte diferente, então uma chave que acerta os 10
 * primeiros caracteres demora um pouquinho mais que uma que erra o primeiro. Com
 * medições suficientes, dá para descobrir o segredo caractere por caractere.
 *
 * `timingSafeEqual` compara todos os bytes sempre, mesmo depois de achar
 * diferença.
 */
export function compararSegredos(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // `timingSafeEqual` exige buffers do mesmo tamanho — e o próprio tamanho já é
  // uma informação que vaza. Hashear os dois normaliza: todo SHA-256 tem 32
  // bytes, então a comparação final é sempre sobre o mesmo comprimento.
  if (bufA.length !== bufB.length) {
    const hA = createHash('sha256').update(bufA).digest();
    const hB = createHash('sha256').update(bufB).digest();
    return timingSafeEqual(hA, hB); // sempre false, mas em tempo constante
  }

  return timingSafeEqual(bufA, bufB);
}
