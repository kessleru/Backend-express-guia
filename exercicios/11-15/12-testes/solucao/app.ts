/**
 * `criarApp()` — a extração que o módulo 12 exige.
 *
 * Compare com `exercicios/11-15/11-auth/solucao/servidor.ts`: o conteúdo é o mesmo,
 * partido em dois. Tudo que MONTA o app veio para cá; só o `listen` e a escolha
 * das implementações concretas ficaram em `servidor.ts`.
 *
 * As dependências entram por parâmetro em vez de serem criadas aqui dentro. É a
 * mesma injeção do módulo 08, agora com um segundo beneficiário: o teste passa
 * repositórios em memória e ganha um app isolado por caso.
 *
 * Princípio: **separe a construção do objeto do seu ciclo de vida.** Testar fica
 * possível como consequência — não era o objetivo.
 */
import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import type { RepositorioAutores } from './dominio/autor.ts';
import type { RepositorioEmprestimos } from './dominio/emprestimo.ts';
import type { RepositorioLivros } from './dominio/livro.ts';
import type { RepositorioRefresh, RepositorioUsuarios } from './dominio/usuario.ts';
import { rotaNaoEncontrada, tratarErro } from './erros/tratador.ts';
import { limitar } from './middlewares/limitar.ts';
import { identificar, registrar } from './middlewares/log.ts';
import { criarRotasAutores } from './rotas/autores.ts';
import { criarRotasAuth } from './rotas/auth.ts';
import { criarRotasEmprestimos } from './rotas/emprestimos.ts';
import { criarRotasLivros } from './rotas/livros.ts';
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

/**
 * Opções que o TESTE precisa mudar e a produção não.
 *
 * O rate limit é o caso concreto: 20 logins por minuto é generoso para uma
 * pessoa e apertado para uma suíte que faz 40 logins em 3 segundos. Sem esta
 * saída, metade dos testes de auth receberia 429 — e o "conserto" tentador seria
 * afrouxar o limite em produção para o teste passar.
 *
 * Princípio: **quando o teste briga com a configuração, torne a configuração um
 * parâmetro; não relaxe a produção.**
 */
export type OpcoesApp = {
  /** `false` desliga o limitador nos testes. Padrão: ligado. */
  rateLimit?: boolean;
};

export function criarApp(deps: Dependencias, opcoes: OpcoesApp = {}) {
  const { rateLimit = true } = opcoes;

  // --- Services ---
  const servicoLivros = criarServicoLivros(deps.repoLivros, deps.repoAutores);
  const servicoAutores = criarServicoAutores(deps.repoAutores, deps.repoLivros);
  const servicoAuth = criarServicoAutenticacao(deps.repoUsuarios, deps.repoRefresh);
  const servicoEmprestimos = criarServicoEmprestimos(
    deps.repoEmprestimos,
    deps.repoLivros,
  );

  // --- App ---
  const app = express();

  app.use(identificar);
  // O log de requisição fica fora do teste: 200 linhas de `GET /livros 200 em
  // 1.2ms` afogam a saída e escondem a falha que importa.
  if (process.env.NODE_ENV !== 'test') app.use(registrar);
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  app.use('/auth', criarRotasAuth(servicoAuth, { rateLimit }));

  if (rateLimit) app.use('/api', limitar(200, 60_000));

  app.get('/api/v1', (_req, res) => {
    res.json({
      versao: 'v1',
      recursos: {
        livros: '/api/v1/livros',
        autores: '/api/v1/autores',
        emprestimos: '/api/v1/emprestimos',
        auth: '/auth',
      },
    });
  });

  const v1 = Router();
  v1.use('/livros', criarRotasLivros(servicoLivros, servicoEmprestimos));
  v1.use('/autores', criarRotasAutores(servicoAutores, servicoLivros));
  v1.use('/emprestimos', criarRotasEmprestimos(servicoEmprestimos));
  app.use('/api/v1', v1);

  app.use(rotaNaoEncontrada);
  app.use(tratarErro);

  return app;
}

export type App = ReturnType<typeof criarApp>;
