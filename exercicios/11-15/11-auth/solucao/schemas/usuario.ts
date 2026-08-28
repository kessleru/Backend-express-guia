/**
 * Schemas de entrada da autenticação.
 *
 * O que este arquivo NÃO tem: um schema de saída do usuário. A resposta é montada
 * por `paraPublico` no domínio, não validada na saída — validar a saída
 * esconderia o vazamento em vez de impedi-lo, e o tipo `UsuarioPublico` já faz o
 * TypeScript recusar `res.json(usuario)`.
 */
import { z } from 'zod';

/**
 * A senha: só COMPRIMENTO, sem regra de composição.
 *
 * Isso costuma surpreender, então vale o porquê. A exigência de "1 maiúscula, 1
 * número e 1 símbolo" é contraproducente por dois motivos medidos:
 *
 *   - Ela empurra todo mundo para o mesmo padrão previsível (`Senha1!`,
 *     `Brasil@2024`), que os dicionários de ataque já cobrem.
 *   - Ela atrapalha passphrase longa (`cavalo bateria grampo correto`), que tem
 *     muito mais entropia e é mais fácil de lembrar.
 *
 * O que de fato protege, na ordem: comprimento mínimo (8 é o piso do OWASP, 12+ é
 * o recomendado), máximo generoso — o `max(200)` existe só para não deixar
 * alguém mandar 10 MB e ocupar a CPU do Argon2 —, e checagem contra listas de
 * senhas vazadas (Have I Been Pwned), que é o item de maior efeito e não está
 * aqui porque exigiria chamada externa.
 *
 * Princípio: **a regra que atrapalha o usuário sem atrapalhar o atacante é uma
 * regra ruim.**
 */
const senha = z
  .string({ error: '`senha` deve ser um texto' })
  .min(8, '`senha` precisa de ao menos 8 caracteres')
  .max(200, '`senha` passa de 200 caracteres');

/**
 * `z.email()` — em Zod 4, `z.string().email()` está deprecado.
 *
 * `.toLowerCase()` normaliza na porta de entrada. Sem isso, `Ana@x.com` no
 * registro e `ana@x.com` no login seriam contas diferentes.
 */
const email = z.email('`email` inválido').toLowerCase();

export const registrarSchema = z.object({ email, senha }).strict();

/**
 * O login tem schema PRÓPRIO, ainda que hoje seja idêntico ao registro.
 *
 * Reusar o do registro acopla os dois: no dia em que o registro ganhar
 * `min(12)`, todo usuário antigo com senha de 8 caracteres passaria a receber
 * 400 no LOGIN — bloqueado por uma regra que nem existia quando ele se
 * cadastrou. Validação de entrada de login confere formato, não política.
 */
export const loginSchema = z.object({ email, senha }).strict();

/**
 * O refresh token pode vir do cookie (navegador) ou do corpo (app mobile,
 * script). O schema aceita o corpo vazio — daí o `.optional()`.
 */
export const refreshSchema = z.object({ refreshToken: z.string().optional() }).strict();

/** Desafio extra: trocar senha exige a atual, mesmo com o usuário autenticado. */
export const trocarSenhaSchema = z
  .object({ senhaAtual: z.string(), novaSenha: senha })
  .strict();

export type Registrar = z.infer<typeof registrarSchema>;
export type Login = z.infer<typeof loginSchema>;
export type TrocarSenha = z.infer<typeof trocarSenhaSchema>;
