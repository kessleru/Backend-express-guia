/**
 * As fábricas que todos os testes usam.
 *
 * Investir aqui é o que faz cada `it` caber em 3 linhas e dizer só o que ele
 * afirma. Um teste ilegível não é conferido por ninguém — e teste que ninguém
 * confere vira "roda mas não sei o que garante".
 */
import request from 'supertest';
import { criarApp, type App } from '../app.ts';
import type { Autor } from '../dominio/autor.ts';
import type { Livro } from '../dominio/livro.ts';
import { criarRepositorioAutores } from '../repositorios/autores-memoria.ts';
import { criarRepositorioEmprestimos } from '../repositorios/emprestimos-memoria.ts';
import { criarRepositorioLivros } from '../repositorios/livros-memoria.ts';
import { criarRepositorioRefresh } from '../repositorios/refresh-memoria.ts';
import { criarRepositorioUsuarios } from '../repositorios/usuarios-memoria.ts';

/** FUNÇÕES, não constantes: objetos novos a cada teste (ver módulo 12). */
export function autoresDeTeste(): Autor[] {
  return [
    { id: 1, nome: 'J.R.R. Tolkien', nacionalidade: 'britânica' },
    { id: 2, nome: 'Frank Herbert', nacionalidade: 'estadunidense' },
  ];
}

export function livrosDeTeste(): Livro[] {
  return [
    {
      id: 1,
      titulo: 'O Hobbit',
      autorId: 1,
      ano: 1937,
      isbn: '9788595084742',
      generos: ['fantasia'],
      disponivel: true,
    },
    {
      id: 2,
      titulo: 'Duna',
      autorId: 2,
      ano: 1965,
      generos: ['ficcao'],
      disponivel: true,
    },
  ];
}

/** "Object mother": um livro válido com só o campo do teste sobrescrito. */
export function umLivro(sobrescrever: Partial<Livro> = {}): Livro {
  return {
    id: 1,
    titulo: 'Livro de Teste',
    autorId: 1,
    ano: 2000,
    generos: ['ficcao'],
    disponivel: true,
    ...sobrescrever,
  };
}

/** O corpo mínimo válido de `POST /livros`. */
export function novoLivro(sobrescrever: Record<string, unknown> = {}) {
  return {
    titulo: 'Solaris',
    autorId: 1,
    ano: 1961,
    generos: ['ficcao'],
    ...sobrescrever,
  };
}

/**
 * Monta um app novo, com "banco" novo.
 *
 * `rateLimit: false` porque a suíte faz dezenas de logins em segundos — ver a
 * explicação em `app.ts`. O limitador continua ligado em produção.
 */
export function montarApp(
  livros = livrosDeTeste(),
  autores = autoresDeTeste(),
): { app: App; repoLivros: ReturnType<typeof criarRepositorioLivros> } {
  const repoLivros = criarRepositorioLivros(livros);
  const app = criarApp(
    {
      repoLivros,
      repoAutores: criarRepositorioAutores(autores),
      repoUsuarios: criarRepositorioUsuarios(),
      repoEmprestimos: criarRepositorioEmprestimos(),
      repoRefresh: criarRepositorioRefresh(),
    },
    { rateLimit: false },
  );
  return { app, repoLivros };
}

export const SENHA = 'senha12345';

/** Registra e devolve o access token. O PRIMEIRO registrado vira admin. */
export async function registrarELogar(app: App, email: string): Promise<string> {
  await request(app).post('/auth/registrar').send({ email, senha: SENHA });
  const resposta = await request(app).post('/auth/login').send({ email, senha: SENHA });
  return resposta.body.accessToken as string;
}

/**
 * O cenário mais usado: um admin e dois leitores já logados.
 *
 * A ordem importa e está explícita — quem lê o teste não precisa lembrar da
 * regra "o primeiro vira admin" escondida no service.
 */
export async function comUsuarios(app: App) {
  const admin = await registrarELogar(app, 'admin@x.com'); // primeiro → admin
  const leitorA = await registrarELogar(app, 'a@x.com');
  const leitorB = await registrarELogar(app, 'b@x.com');
  return { admin, leitorA, leitorB };
}

/** Açúcar para não repetir `.set('Authorization', ...)` em toda chamada. */
export const comToken = (token: string) => ({ Authorization: `Bearer ${token}` });
