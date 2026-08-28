/**
 * Hash de senha com Argon2.
 *
 * Rodar a demonstração:  node src/exemplos/11-15/11-auth/senhas.ts
 */
import argon2 from 'argon2';
import { createHash, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------
// POR QUE NÃO SHA-256
// ---------------------------------------------------------------------
// SHA-256 foi feito para ser RÁPIDO — é o que se quer de um hash de arquivo.
// Para senha, rapidez é o defeito: uma GPU calcula bilhões de SHA-256 por
// segundo, então testar todas as senhas de um vazamento é questão de horas.
//
// Argon2 e bcrypt foram feitos para ser LENTOS e consumir memória de propósito.
// O custo é configurável, e você o ajusta conforme o hardware do atacante melhora.

export async function medirDiferenca() {
  const senha = 'senha-do-usuario-123';

  const t1 = performance.now();
  createHash('sha256').update(senha).digest('hex');
  const msSha = performance.now() - t1;

  const t2 = performance.now();
  await argon2.hash(senha);
  const msArgon = performance.now() - t2;

  return { msSha, msArgon, vezesMaisLento: Math.round(msArgon / msSha) };
}

// ---------------------------------------------------------------------
// HASH
// ---------------------------------------------------------------------

/**
 * O SALT não precisa ser passado: o argon2 gera um aleatório por senha e o
 * embute no resultado. É por isso que dois usuários com a MESMA senha têm hashes
 * diferentes — e é o que impede uma rainbow table de servir para todos de uma vez.
 *
 * Formato do resultado:
 *   $argon2id$v=19$m=65536,t=3,p=4$<salt em base64>$<hash em base64>
 *    algoritmo    versão  parâmetros    salt          hash
 *
 * Tudo que a verificação precisa está aí — daí `verify` não pedir o salt.
 */
export function hashSenha(senha: string): Promise<string> {
  return argon2.hash(senha, {
    // argon2id é o recomendado (OWASP): resiste a ataque de GPU e de canal
    // lateral. As variantes são argon2i, argon2d e argon2id.
    type: argon2.argon2id,

    // Os três parâmetros de custo. Os padrões da lib já são razoáveis; explícitos
    // aqui para você ver o que existe:
    memoryCost: 19456, // 19 MiB — o principal: encarece GPU, que tem pouca RAM por core
    timeCost: 2, // número de passadas
    parallelism: 1, // threads
  });
}

/**
 * `verify` recalcula o hash com o salt e os parâmetros embutidos e compara em
 * tempo constante. Você nunca "des-hasheia" nada — hash é via única.
 */
export async function conferirSenha(hash: string, senha: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, senha);
  } catch {
    // Hash malformado (banco corrompido, migração mal feita) lança. Tratar como
    // senha errada é o comportamento seguro — nunca deixe virar 500 e revelar
    // que aquele usuário existe mas o registro está estranho.
    return false;
  }
}

// ---------------------------------------------------------------------
// COMPARAÇÃO EM TEMPO CONSTANTE
// ---------------------------------------------------------------------
// Para segredos que NÃO são senha (API key, token de webhook), não se usa hash
// lento — mas comparar com `===` vaza informação pelo TEMPO: o `===` para no
// primeiro byte diferente, então uma chave que acerta os 10 primeiros caracteres
// demora um pouquinho mais. Com medições suficientes, dá para descobrir a chave
// caractere por caractere.

export function compararSegredos(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // `timingSafeEqual` exige mesmo tamanho, e o próprio tamanho já vaza. Comparar
  // o hash de cada um resolve: hashes têm sempre o mesmo tamanho.
  if (bufA.length !== bufB.length) {
    const hA = createHash('sha256').update(bufA).digest();
    const hB = createHash('sha256').update(bufB).digest();
    return timingSafeEqual(hA, hB); // sempre false aqui, mas em tempo constante
  }

  return timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------
// Demonstração
// ---------------------------------------------------------------------

if (process.argv[1]?.endsWith('senhas.ts')) {
  const { msSha, msArgon, vezesMaisLento } = await medirDiferenca();
  console.log(`SHA-256: ${msSha.toFixed(3)}ms`);
  console.log(
    `Argon2:  ${msArgon.toFixed(1)}ms  (${vezesMaisLento}× mais lento — de propósito)`,
  );

  const h1 = await hashSenha('senha123');
  const h2 = await hashSenha('senha123'); // MESMA senha

  console.log(`\nhash 1: ${h1}`);
  console.log(`hash 2: ${h2}`);
  console.log(`iguais? ${h1 === h2} ← o salt aleatório é o que faz a diferença`);

  console.log(`\nverify(hash1, 'senha123'): ${await conferirSenha(h1, 'senha123')}`);
  console.log(`verify(hash1, 'senha124'): ${await conferirSenha(h1, 'senha124')}`);
  console.log(
    `verify(hash2, 'senha123'): ${await conferirSenha(h2, 'senha123')} ← outro salt, mesma senha`,
  );

  console.log(`\ncompararSegredos('abc','abc'): ${compararSegredos('abc', 'abc')}`);
  console.log(`compararSegredos('abc','abd'): ${compararSegredos('abc', 'abd')}`);
  console.log(`compararSegredos('abc','abcd'): ${compararSegredos('abc', 'abcd')}`);
}
