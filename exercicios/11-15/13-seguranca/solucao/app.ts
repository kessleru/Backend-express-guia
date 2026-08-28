/**
 * `criarApp()` — agora com as defesas do módulo 13 montadas.
 *
 * O `diff` contra `exercicios/11-15/12-testes/solucao/app.ts` é curto e vale ler: a
 * segurança desta API não veio de reescrever regra de negócio, veio de quatro
 * linhas de montagem e de duas correções dentro dos services. É o normal — a
 * maior parte das falhas do OWASP Top 10 se fecha em lugares assim.
 *
 * A ORDEM dos `app.use` continua sendo o assunto (módulo 05), e aqui ela tem
 * consequência de segurança, não só de comportamento:
 *
 *   helmet → cors → body → limitadores → rotas → 404 → tratador
 *
 * `helmet` primeiro para que os headers de defesa valham inclusive nas respostas
 * de erro do próprio CORS. Limitador depois do body parser porque ele precisa do
 * método e da URL já resolvidos — e antes das rotas, que é o trabalho caro que
 * ele existe para proteger.
 */
import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import type { RepositorioAutores } from './dominio/autor.ts';
import type { RepositorioEmprestimos } from './dominio/emprestimo.ts';
import type { RepositorioLivros } from './dominio/livro.ts';
import type { RepositorioRefresh, RepositorioUsuarios } from './dominio/usuario.ts';
import { rotaNaoEncontrada, tratarErro } from './erros/tratador.ts';
import { criarLimites, porMetodo, talvez } from './middlewares/limites.ts';
import { identificar, registrar } from './middlewares/log.ts';
import { criarRotasArquivos } from './rotas/arquivos.ts';
import { criarRotasAutores } from './rotas/autores.ts';
import { criarRotasAuth } from './rotas/auth.ts';
import { criarRotasEmprestimos } from './rotas/emprestimos.ts';
import { criarRotasLivros } from './rotas/livros.ts';
import { criarServicoArquivos } from './servicos/arquivos.ts';
import { criarServicoAutenticacao } from './servicos/autenticacao.ts';
import { criarServicoAutores } from './servicos/autores.ts';
import { criarServicoEmprestimos } from './servicos/emprestimos.ts';
import { criarServicoLivros } from './servicos/livros.ts';

export type Dependencias = {
  repoLivros: RepositorioLivros;
  repoAutores: RepositorioAutores;
  repoUsuarios: RepositorioUsuarios;
  repoEmprestimos: RepositorioEmprestimos;
  repoRefresh: RepositorioRefresh;
};

export type OpcoesApp = {
  /** `false` desliga os limitadores nos testes. Padrão: ligados. */
  rateLimit?: boolean;
  /**
   * Origens que o navegador pode usar para chamar esta API.
   *
   * É um parâmetro e não uma constante porque muda por ambiente: em
   * desenvolvimento é `http://localhost:3000`, em produção é o domínio do front.
   * Deixá-lo no código faria a lista de produção viver num `if` — ou, pior,
   * empurraria alguém a usar `origin: true` para "funcionar em todo lugar".
   */
  origens?: string[];
};

export function criarApp(deps: Dependencias, opcoes: OpcoesApp = {}) {
  const { rateLimit = true, origens = ['http://localhost:3000'] } = opcoes;

  // --- Services ---
  const servicoLivros = criarServicoLivros(deps.repoLivros, deps.repoAutores);
  const servicoAutores = criarServicoAutores(deps.repoAutores, deps.repoLivros);
  const servicoAuth = criarServicoAutenticacao(deps.repoUsuarios, deps.repoRefresh);
  const servicoEmprestimos = criarServicoEmprestimos(
    deps.repoEmprestimos,
    deps.repoLivros,
  );
  const servicoArquivos = criarServicoArquivos();

  /**
   * Os baldes deste app — criados aqui, não importados prontos.
   *
   * É a mesma injeção dos repositórios (módulo 12) aplicada a estado que não
   * parece estado: um contador de rate limit é tão global quanto uma conexão de
   * banco. Ver o bloco em `middlewares/limites.ts` sobre o que quebrou quando
   * eles eram `export const`.
   */
  const limites = criarLimites();

  // --- App ---
  const app = express();

  /**
   * HELMET — 12 headers de defesa, e um a menos entregando a stack.
   *
   * O que ele faz não é mágico: define headers que instruem o NAVEGADOR a se
   * comportar de forma mais restritiva. Daí o limite honesto — nenhum deles
   * protege contra um cliente que não é navegador. `curl` ignora todos.
   *
   * O mais importante numa API JSON não é o CSP (que quase não tem o que
   * proteger sem HTML), é o `X-Content-Type-Options: nosniff`: sem ele, um
   * navegador antigo pode "adivinhar" que a resposta é HTML e executá-la.
   *
   * Ele também apaga o `X-Powered-By: Express`, que só serve para contar a um
   * scanner qual exploit tentar primeiro. Não é defesa de verdade (a stack se
   * descobre de outras formas), é não ajudar de graça.
   */
  app.use(helmet());

  app.use(identificar);
  if (process.env.NODE_ENV !== 'test') app.use(registrar);

  /**
   * CORS — protege o USUÁRIO no navegador, não o servidor.
   *
   * A confusão mais cara deste módulo: CORS não impede ninguém de chamar sua
   * API. Um `curl` ou um script de servidor ignoram a política inteira. O que
   * ele controla é se o JavaScript de OUTRO site pode LER a sua resposta usando
   * o cookie da vítima que já está logada.
   *
   * A lista é explícita porque `origin: '*'` é recusado pelo próprio navegador
   * quando há `credentials: true` — e este app manda o refresh token em cookie.
   * O navegador não avisa que a combinação é inválida: ele simplesmente não
   * entrega a resposta, e você passa a tarde procurando o bug no servidor.
   */
  app.use(cors({ origin: origens, credentials: true }));

  app.use(express.json());
  app.use(cookieParser());

  /**
   * O limitador de credencial mora dentro de `criarRotasAuth` — é lá que estão
   * as rotas que ele protege, e um limite declarado longe da rota é um limite
   * que ninguém encontra ao auditar.
   */
  app.use('/auth', criarRotasAuth(servicoAuth, limites, { rateLimit }));

  /**
   * Leitura e escrita dividem o prefixo `/api`, e o método decide o balde.
   *
   * `talvez` troca o limitador por um `next()` quando o teste pede — nunca
   * afrouxa o número (ver `middlewares/limites.ts`).
   */
  app.use(
    '/api',
    porMetodo(talvez(rateLimit, limites.leitura), talvez(rateLimit, limites.escrita)),
  );

  app.get('/api/v1', (_req, res) => {
    res.json({
      versao: 'v1',
      recursos: {
        livros: '/api/v1/livros',
        autores: '/api/v1/autores',
        emprestimos: '/api/v1/emprestimos',
        arquivos: '/api/v1/arquivos',
        auth: '/auth',
      },
    });
  });

  const v1 = Router();
  v1.use('/livros', criarRotasLivros(servicoLivros, servicoEmprestimos));
  v1.use('/autores', criarRotasAutores(servicoAutores, servicoLivros));
  v1.use('/emprestimos', criarRotasEmprestimos(servicoEmprestimos));
  v1.use('/arquivos', criarRotasArquivos(servicoArquivos));
  app.use('/api/v1', v1);

  app.use(rotaNaoEncontrada);
  app.use(tratarErro);

  return app;
}

export type App = ReturnType<typeof criarApp>;
