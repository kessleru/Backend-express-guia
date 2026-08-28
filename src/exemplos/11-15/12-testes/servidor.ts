/**
 * O ÚNICO arquivo que chama `listen`.
 *
 * Rodar:  node src/exemplos/11-15/12-testes/servidor.ts
 *
 * Ele é minúsculo de propósito: tudo que é lógica está em `app.ts`, que o teste
 * importa. O que sobra aqui — escolher o repositório concreto, ler a porta,
 * tratar sinal de desligamento — é justamente o que NÃO se testa com Supertest.
 */
import { criarApp } from './app.ts';
import { criarRepositorioMemoria } from './repositorios/memoria.ts';

const repo = criarRepositorioMemoria([
  { id: 1, titulo: 'O Hobbit', autorId: 1, ano: 1937, disponivel: true },
  { id: 2, titulo: 'Duna', autorId: 2, ano: 1965, disponivel: true },
]);

const app = criarApp(repo);

const PORT = 5060;
app.listen(PORT, () => {
  console.log(`Exemplo do módulo 12 em http://localhost:${PORT}/livros`);
  console.log('Os testes deste app rodam com:  npm test\n');
});
