/**
 * Desafio extra: o MESMO schema validando dados fora do Express.
 *
 * Rodar:  node exercicios/06-10/07-validacao/solucao/validar-seed.ts
 *
 * É esse reuso que justifica manter o schema livre de HTTP e de banco: ele serve
 * na rota, no seed (módulo 10), no worker de fila (17) e no teste (12) — sem
 * `req`, sem `res`, sem `next`.
 */
import { criarLivroSchema, type CriarLivroEntrada } from './schemas/index.ts';

// Repare no tipo: `CriarLivroEntrada` (z.input) e não `CriarLivro` (z.output).
// Aqui estamos ANTES da validação, então `generos` pode faltar.
const seed: CriarLivroEntrada[] = [
  { titulo: 'Neuromancer', autorId: 2, ano: 1984, generos: ['ficcao'] },
  { titulo: 'A Mão Esquerda da Escuridão', autorId: 2, ano: 1969 }, // sem generos
];

console.log('--- seed válido ---');
for (const bruto of seed) {
  // `parse` (não `safeParse`): num script, falhar alto é o comportamento certo.
  // Você quer que o seed pare, não que insira dado meio validado.
  const livro = criarLivroSchema.parse(bruto);
  console.log(`✓ ${livro.titulo} — generos: ${livro.generos.join(', ')}`);
}

console.log('\n--- seed inválido ---');
const ruim = { titulo: '', autorId: 0, ano: 3000, isbn: '123', extra: true };
const resultado = criarLivroSchema.safeParse(ruim);

if (!resultado.success) {
  for (const problema of resultado.error.issues) {
    console.log(`✗ ${problema.path.join('.') || '(raiz)'}: ${problema.message}`);
  }
}
