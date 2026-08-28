import express from 'express';

const app = express();

// Sem isto, `req.body` é `undefined` em requisições com JSON.
// Este middleware lê o corpo da requisição e transforma em objeto.
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    mensagem: 'Servidor no ar 🚀',
    proximosPassos: [
      'Leia o README.md para o índice do curso',
      'Comece por docs/01-05/01-fundamentos-http.md',
      'Escreva seu próprio código em src/playground/',
    ],
  });
});

// Health check: usado por Docker, load balancer e monitoramento
// para saber se o processo está vivo. Detalhes no módulo 14.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// `process.env` só devolve string ou undefined — daí o Number() e o padrão.
const PORT = Number(process.env.PORT) || 5050;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
