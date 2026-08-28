/**
 * Rotas de autenticação.
 *
 * O arquivo inteiro cabe numa tela, e é isso que se quer de um `rotas/`: dá para
 * auditar quem é público e quem é protegido de relance. Autorização escondida
 * três arquivos adiante é como se erra.
 */
import { Router, type RequestHandler } from 'express';
import { criarControllerAuth } from '../controllers/auth.ts';
import { autenticar, exigirPapel } from '../middlewares/autenticar.ts';
import { limitar } from '../middlewares/limitar.ts';
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
   * DOIS BALDES SEPARADOS, não um.
   *
   * `limitar()` guarda a contagem num Map do próprio closure, então cada chamada
   * cria um contador independente. Se `/login` e `/trocar-senha` dividissem o
   * mesmo, tentativas de login gastariam a cota de quem só quer trocar a senha —
   * um usuário legítimo bloqueado por causa do ataque a OUTRA rota.
   *
   * Princípio: **cada limite protege um recurso; recursos diferentes, contadores
   * diferentes.**
   *
   * O que estes limites NÃO fazem: ataque distribuído (cada bot com um IP)
   * passa. A defesa completa soma limite por CONTA além de por IP, atraso
   * progressivo, captcha depois de N falhas e alerta por e-mail. Módulo 13.
   */
  //
  // `rateLimit: false` troca cada limitador por um middleware que só chama
  // `next()`. Note o que NÃO foi feito: afrouxar o limite para a suíte caber
  // dentro dele. Um limite ajustado pelo teste deixa de proteger a produção.
  const passar: RequestHandler = (_req, _res, next) => next();
  const limiteLogin = rateLimit ? limitar(20, 60_000) : passar;
  const limiteTrocaSenha = rateLimit ? limitar(5, 60_000) : passar;

  // --- Públicas ---
  router.post('/registrar', limiteLogin, validar(registrarSchema), controller.registrar);
  router.post('/login', limiteLogin, validar(loginSchema), controller.login);

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
    limiteTrocaSenha,
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
