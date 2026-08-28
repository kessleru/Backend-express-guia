/**
 * Router de livros — agora sem UM ÚNICO `res.status(4xx)`.
 *
 * Compare com `exercicios/01-05/05-middlewares/solucao/rotas/livros.ts`: a validação
 * encurtou porque cada checagem virou um `throw` de uma linha, e a função parou
 * de precisar devolver `{ erro } | { dados }` para todo chamador conferir.
 */
import { Router } from 'express';
import { autores, livros, proximoIdLivro, type Livro } from '../dados.ts';
import {
  AppError,
  conflito,
  naoEncontrado,
  requisicaoInvalida,
} from '../erros/AppError.ts';

export const rotasLivros = Router();

const ANO_MIN = 1450;
const ANO_MAX = new Date().getFullYear();

/**
 * Validação que LANÇA em vez de devolver erro.
 *
 * A diferença entre "código de erro" e "exceção": antes, cada chamador tinha que
 * checar `if ('erro' in validado)`. Agora só existe o caminho de sucesso, e o
 * desvio é problema do tratador. É por isso que os handlers abaixo ficaram
 * pequenos.
 */
function validar(
  corpo: unknown,
  parcial: boolean,
): Partial<Omit<Livro, 'id' | 'disponivel'>> {
  const { titulo, autorId, ano } = (corpo ?? {}) as Record<string, unknown>;
  const dados: Partial<Omit<Livro, 'id' | 'disponivel'>> = {};

  if (titulo !== undefined) {
    if (typeof titulo !== 'string' || titulo.trim() === '') {
      throw requisicaoInvalida('`titulo` deve ser um texto não vazio', {
        campo: 'titulo',
      });
    }
    dados.titulo = titulo.trim();
  } else if (!parcial) {
    throw requisicaoInvalida('`titulo` é obrigatório', { campo: 'titulo' });
  }

  if (autorId !== undefined) {
    if (!Number.isInteger(autorId)) {
      throw requisicaoInvalida('`autorId` deve ser um inteiro', { campo: 'autorId' });
    }
    // Existência é diferente de formato: precisa consultar os dados.
    if (!autores.some((a) => a.id === autorId)) {
      throw requisicaoInvalida(`Autor ${String(autorId)} não existe`, {
        campo: 'autorId',
      });
    }
    dados.autorId = autorId as number;
  } else if (!parcial) {
    throw requisicaoInvalida('`autorId` é obrigatório', { campo: 'autorId' });
  }

  if (ano !== undefined) {
    const n = ano as number;
    if (!Number.isInteger(ano) || n < ANO_MIN || n > ANO_MAX) {
      throw requisicaoInvalida(
        `\`ano\` deve ser um inteiro entre ${ANO_MIN} e ${ANO_MAX}`,
        {
          campo: 'ano',
        },
      );
    }
    dados.ano = n;
  } else if (!parcial) {
    throw requisicaoInvalida('`ano` é obrigatório', { campo: 'ano' });
  }

  return dados;
}

// Literal antes de parâmetro — a regra do módulo 04 continua valendo.
rotasLivros.get('/disponiveis', (_req, res) => {
  res.json(livros.filter((l) => l.disponivel));
});

rotasLivros.get('/', (req, res) => {
  let resultado = livros;

  const autorId = Number(req.query.autorId);
  if (Number.isInteger(autorId))
    resultado = resultado.filter((l) => l.autorId === autorId);

  if (req.query.disponivel === 'true') resultado = resultado.filter((l) => l.disponivel);
  else if (req.query.disponivel === 'false')
    resultado = resultado.filter((l) => !l.disponivel);

  if (req.query.ordenar === 'ano')
    resultado = [...resultado].sort((a, b) => a.ano - b.ano);
  else if (req.query.ordenar === 'titulo') {
    resultado = [...resultado].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  }

  res.json(resultado);
});

// O `param` também lança. Ele não conhece mais o formato da resposta de erro —
// isso passou a ser problema exclusivo do tratador.
rotasLivros.param('id', (_req, res, next, valor) => {
  const id = Number(valor);
  const livro = Number.isInteger(id) ? livros.find((l) => l.id === id) : undefined;
  if (!livro) throw naoEncontrado('Livro', valor);

  res.locals.livro = livro;
  next();
});

rotasLivros.get('/:id', (_req, res) => {
  res.json(res.locals.livro as Livro);
});

/**
 * Rota ASYNC que falha.
 *
 * No Express 4 este `throw` viraria `unhandledRejection` e derrubaria o processo
 * — a API caía inteira porque um serviço de terceiro estava fora. No Express 5 o
 * router dá `await` no handler e o erro chega no tratador normalmente.
 *
 * 503 e não 500: o problema é uma dependência externa, não um bug seu. A
 * distinção importa para quem monitora (módulo 14) e para o cliente, que sabe
 * que vale tentar de novo depois.
 */
rotasLivros.get('/:id/capa', async (_req, _res) => {
  await new Promise((r) => setTimeout(r, 20)); // simula chamada externa
  throw new AppError('Serviço de capas indisponível', 503);
});

rotasLivros.post('/', (req, res) => {
  const dados = validar(req.body, false);

  const livro: Livro = {
    id: proximoIdLivro(),
    titulo: dados.titulo!,
    autorId: dados.autorId!,
    ano: dados.ano!,
    disponivel: true,
  };
  livros.push(livro);

  res.status(201).location(`${req.baseUrl}/${livro.id}`).json(livro);
});

rotasLivros.patch('/:id', (req, res) => {
  const livro = res.locals.livro as Livro;
  Object.assign(livro, validar(req.body, true));
  res.json(livro);
});

rotasLivros.delete('/:id', (_req, res) => {
  const livro = res.locals.livro as Livro;
  livros.splice(livros.indexOf(livro), 1);
  res.status(204).send();
});

rotasLivros.post('/:id/emprestar', (_req, res) => {
  const livro = res.locals.livro as Livro;
  if (!livro.disponivel) throw conflito('Livro já está emprestado');
  livro.disponivel = false;
  res.json(livro);
});

rotasLivros.post('/:id/devolver', (_req, res) => {
  const livro = res.locals.livro as Livro;
  if (livro.disponivel) throw conflito('Livro não está emprestado');
  livro.disponivel = true;
  res.json(livro);
});
