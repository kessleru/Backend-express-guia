/**
 * Rotas de autenticação.
 *
 * O arquivo inteiro cabe numa tela, e é isso que se quer de um `rotas/`: dá para
 * auditar quem é público e quem é protegido de relance. Autorização escondida
 * três arquivos adiante é como se erra.
 */
import { Router } from 'express';
import { criarControllerAuth } from '../controllers/auth.ts';
import { autenticar, exigirPapel } from '../middlewares/autenticar.ts';
import { talvez, type Limites } from '../middlewares/limites.ts';
import { validar } from '../middlewares/validar.ts';
import {
  loginSchema,
  refreshSchema,
  registrarSchema,
  trocarSenhaSchema,
} from '../schemas/usuario.ts';
import type { ServicoAutenticacao } from '../servicos/autenticacao.ts';

export function criarRotasAuth(
  servico: ServicoAutenticacao,
  // Os limitadores vêm de fora, criados pelo `app.ts`. Criá-los aqui dentro
  // esconderia os números numa camada em que ninguém procura por eles.
  limites: Limites,
  // `rateLimit: false` é usado só pelos testes — ver a explicação em `app.ts`.
  // A produção continua com o limitador ligado por padrão.
  { rateLimit = true }: { rateLimit?: boolean } = {},
): Router {
  const controller = criarControllerAuth(servico);
  const router = Router();

  /**
   * RATE LIMIT MAIS APERTADO NAS ROTAS DE CREDENCIAL.
   *
   * Login é o alvo natural de força bruta e de "credential stuffing" (testar em
   * massa listas de e-mail/senha vazadas de outros sites). O Argon2 já torna
   * cada tentativa cara — o que é bom contra quem quebra o hash offline e RUIM
   * aqui: 1000 tentativas por segundo derrubam a SUA CPU antes de derrubarem a
   * conta. Sem limite, o custo do hash lento vira o vetor de negação de serviço.
   *
   * O QUE MUDOU DO MÓDULO 12: os limitadores não são mais criados aqui com
   * `limitar(20, 60_000)`. Eles chegam prontos de `criarLimites()`, um por
   * finalidade, com os números do enunciado — e o de login apertou de 20 para 5.
   *
   * `registrar` entra no mesmo balde que `login` de propósito: criar conta em
   * massa é o outro abuso da mesma porta, e as duas rotas custam um Argon2.
   *
   * O que estes limites NÃO fazem: ataque distribuído (cada bot com um IP)
   * passa. A defesa completa soma limite por CONTA além de por IP, atraso
   * progressivo, captcha depois de N falhas e alerta por e-mail.
   */
  const login = talvez(rateLimit, limites.login);
  const trocaSenha = talvez(rateLimit, limites.trocaSenha);

  // --- Públicas ---
  router.post('/registrar', login, validar(registrarSchema), controller.registrar);
  router.post('/login', login, validar(loginSchema), controller.login);

  // `/refresh` e `/logout` não levam `autenticar`: o access token já expirou
  // (é justamente por isso que se está renovando). A credencial aqui é o refresh
  // token, verificado dentro do service.
  router.post('/refresh', validar(refreshSchema), controller.refresh);
  router.post('/logout', controller.logout);

  // --- Autenticadas (qualquer papel) ---
  router.get('/eu', autenticar, controller.eu);
  router.post(
    '/trocar-senha',
    autenticar,
    trocaSenha,
    validar(trocarSenhaSchema),
    controller.trocarSenha,
  );

  // --- Autorizadas (só admin) ---
  // Os DOIS middlewares, nesta ordem: primeiro "quem é você" (401), depois "você
  // pode" (403). Sem o `autenticar`, o `exigirPapel` não teria de onde ler o
  // papel — e responderia 401, que é o comportamento seguro por desenho.
  router.get('/usuarios', autenticar, exigirPapel('admin'), controller.listarUsuarios);

  return router;
}
