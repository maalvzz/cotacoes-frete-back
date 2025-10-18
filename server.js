const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const DATA_FILE = path.join(__dirname, 'cotacoes.json');

// Middlewares
app.use(cors());
app.use(express.json());

// Função para ler dados do arquivo
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Se o arquivo não existir, cria um array vazio
            await writeData([]);
            return [];
        }
        throw error;
    }
}

// Função para escrever dados no arquivo
async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET - Listar todas as cotações
app.get('/cotacoes', async (req, res) => {
    try {
        const cotacoes = await readData();
        res.json(cotacoes);
    } catch (error) {
        console.error('Erro ao ler cotações:', error);
        res.status(500).json({ error: 'Erro ao ler cotações' });
    }
});

// HEAD - Verificar status do servidor
app.head('/cotacoes', (req, res) => {
    res.status(200).end();
});

// POST - Criar nova cotação
app.post('/cotacoes', async (req, res) => {
    try {
        const cotacoes = await readData();
        const novaCotacao = {
            ...req.body,
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            negocioFechado: req.body.negocioFechado || false
        };
        
        cotacoes.unshift(novaCotacao);
        await writeData(cotacoes);
        
        res.status(201).json(novaCotacao);
    } catch (error) {
        console.error('Erro ao criar cotação:', error);
        res.status(500).json({ error: 'Erro ao criar cotação' });
    }
});

// PUT - Atualizar cotação existente
app.put('/cotacoes/:id', async (req, res) => {
    try {
        const cotacoes = await readData();
        const index = cotacoes.findIndex(c => c.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Cotação não encontrada' });
        }
        
        cotacoes[index] = {
            ...req.body,
            id: req.params.id,
            timestamp: cotacoes[index].timestamp,
            updatedAt: new Date().toISOString()
        };
        
        await writeData(cotacoes);
        res.json(cotacoes[index]);
    } catch (error) {
        console.error('Erro ao atualizar cotação:', error);
        res.status(500).json({ error: 'Erro ao atualizar cotação' });
    }
});

// DELETE - Excluir cotação
app.delete('/cotacoes/:id', async (req, res) => {
    try {
        const cotacoes = await readData();
        const filteredCotacoes = cotacoes.filter(c => c.id !== req.params.id);
        
        if (cotacoes.length === filteredCotacoes.length) {
            return res.status(404).json({ error: 'Cotação não encontrada' });
        }
        
        await writeData(filteredCotacoes);
        res.status(204).end();
    } catch (error) {
        console.error('Erro ao excluir cotação:', error);
        res.status(500).json({ error: 'Erro ao excluir cotação' });
    }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

