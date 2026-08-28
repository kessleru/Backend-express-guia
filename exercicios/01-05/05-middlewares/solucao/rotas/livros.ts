/**
 * Router de livros. Caminhos RELATIVOS: quem define o prefixo é o servidor.
 */
import { Router } from 'express';
import { autores, livros, proximoIdLivro, type Livro } from '../dados.ts';

export const rotasLivros = Router();

const ANO_MIN = 1450;
const ANO_MAX = new Date().getFullYear();

/** Mesma validação do exercício 03, agora com `autorId`. */
function validar(
  corpo: unknown,
  parcial: boolean,
): { erro: string } | { dados: Partial<Omit<Livro, 'id' | 'disponivel'>> } {
  const { titulo, autorId, ano } = (corpo ?? {}) as Record<string, unknown>;
  const dados: Partial<Omit<Livro, 'id' | 'disponivel'>> = {};

  if (titulo !== undefined) {
    if (typeof titulo !== 'string' || titulo.trim() === '') {
      return { erro: '`titulo` deve ser um texto não vazio' };
    }
    dados.titulo = titulo.trim();
  } else if (!parcial) return { erro: '`titulo` é obrigatório' };

  if (autorId !== undefined) {
    // Validação de FORMATO e de EXISTÊNCIA são coisas diferentes: a primeira o
    // Zod vai fazer sozinho no módulo 07, a segunda sempre precisa consultar os
    // dados. As duas dão 400 aqui, mas por motivos distintos.
    if (!Number.isInteger(autorId)) return { erro: '`autorId` deve ser um inteiro' };
    if (!autores.some((a) => a.id === autorId)) {
      return { erro: `Autor ${String(autorId)} não existe` };
    }
    dados.autorId = autorId as number;
  } else if (!parcial) return { erro: '`autorId` é obrigatório' };

  if (ano !== undefined) {
    const n = ano as number;
    if (!Number.isInteger(ano) || n < ANO_MIN || n > ANO_MAX) {
      return { erro: `\`ano\` deve ser um inteiro entre ${ANO_MIN} e ${ANO_MAX}` };
    }
    dados.ano = n;
  } else if (!parcial) return { erro: '`ano` é obrigatório' };

  return { dados };
}

// ---------------------------------------------------------------------
// ORDEM: literal antes de parâmetro
// ---------------------------------------------------------------------
// Se este bloco estivesse depois do `/:id`, a requisição `/livros/disponiveis`
// cairia no handler de id, `Number('disponiveis')` daria NaN e o resultado seria
// um 404 numa rota que existe. Bug clássico, sintoma enganoso.

rotasLivros.get('/disponiveis', (_req, res) => {
  res.json(livros.filter((l) => l.disponivel));
});

rotasLivros.get('/', (req, res) => {
  let resultado = livros;

  const autorId = Number(req.query.autorId);
  if (Number.isInteger(autorId))
    resultado = resultado.filter((l) => l.autorId === autorId);

  // `?disponivel=false` chega como a string "false", que é truthy.
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

// ---------------------------------------------------------------------
// router.param: o 404 escrito UMA vez, valendo para 4 handlers abaixo
// ---------------------------------------------------------------------

rotasLivros.param('id', (req, res, next, valor) => {
  const id = Number(valor);
  const livro = Number.isInteger(id) ? livros.find((l) => l.id === id) : undefined;
  if (!livro) return res.status(404).json({ erro: `Livro ${valor} não encontrado` });

  res.locals.livro = livro;
  next(); // sem isto a requisição fica pendurada até o timeout do cliente
});

rotasLivros.get('/:id', (_req, res) => {
  res.json(res.locals.livro as Livro);
});

rotasLivros.post('/', (req, res) => {
  const validado = validar(req.body, false);
  if ('erro' in validado) return res.status(400).json({ erro: validado.erro });

  const livro: Livro = {
    id: proximoIdLivro(),
    titulo: validado.dados.titulo!,
    autorId: validado.dados.autorId!,
    ano: validado.dados.ano!,
    disponivel: true, // o cliente não escolhe isto
  };
  livros.push(livro);

  // O Location tem que ser a URL pública, com o prefixo. É um acoplamento
  // chato: o router "sabe" onde foi montado. `req.baseUrl` resolve — ele é o
  // prefixo real que o Express usou para chegar aqui.
  res.status(201).location(`${req.baseUrl}/${livro.id}`).json(livro);
});

rotasLivros.patch('/:id', (req, res) => {
  const livro = res.locals.livro as Livro;
  const validado = validar(req.body, true);
  if ('erro' in validado) return res.status(400).json({ erro: validado.erro });

  Object.assign(livro, validado.dados); // só as chaves presentes: é o PATCH
  res.json(livro);
});

rotasLivros.delete('/:id', (_req, res) => {
  const livro = res.locals.livro as Livro;
  livros.splice(livros.indexOf(livro), 1);
  res.status(204).send();
});

rotasLivros.post('/:id/emprestar', (_req, res) => {
  const livro = res.locals.livro as Livro;
  if (!livro.disponivel)
    return res.status(409).json({ erro: 'Livro já está emprestado' });
  livro.disponivel = false;
  res.json(livro);
});

rotasLivros.post('/:id/devolver', (_req, res) => {
  const livro = res.locals.livro as Livro;
  if (livro.disponivel)
    return res.status(409).json({ erro: 'Livro não está emprestado' });
  livro.disponivel = true;
  res.json(livro);
});
