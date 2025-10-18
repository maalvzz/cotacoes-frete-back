require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { verificarAutenticacao } = require('./middleware/auth');

const app = express();

// ==========================================
// MIDDLEWARES
// ==========================================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ==========================================
// CONEXÃO COM MONGODB
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ ERRO: MONGODB_URI não configurado no .env');
    process.exit(1);
}

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ Conectado ao MongoDB Atlas'))
.catch(err => {
    console.error('❌ Erro ao conectar MongoDB:', err);
    process.exit(1);
});

// ==========================================
// MODELO DE DADOS
// ==========================================
const cotacaoSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    responsavelCotacao: { type: String, required: true },
    transportadora: { type: String, required: true },
    destino: String,
    numeroCotacao: String,
    valorFrete: { type: Number, required: true },
    vendedor: String,
    numeroDocumento: String,
    previsaoEntrega: String,
    canalComunicacao: String,
    codigoColeta: String,
    responsavelTransportadora: String,
    dataCotacao: { type: String, required: true },
    observacoes: String,
    negocioFechado: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    updatedAt: Date
}, {
    timestamps: true
});

const Cotacao = mongoose.model('Cotacao', cotacaoSchema);

// ==========================================
// ROTAS PÚBLICAS
// ==========================================

// Rota raiz - Documentação da API
app.get('/', (req, res) => {
    res.json({
        message: '🚀 API de Cotações de Frete',
        version: '1.0.0',
        status: 'online',
        endpoints: {
            health: 'GET /health',
            cotacoes: {
                listar: 'GET /api/cotacoes',
                criar: 'POST /api/cotacoes',
                buscar: 'GET /api/cotacoes/:id',
                atualizar: 'PUT /api/cotacoes/:id',
                deletar: 'DELETE /api/cotacoes/:id'
            }
        },
        authentication: 'Bearer Token required for /api/* routes',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/health', (req, res) => {
    const status = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
    res.json({ 
        status,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// HEAD - Verificar status
app.head('/api/cotacoes', (req, res) => {
    res.status(200).end();
});

// ==========================================
// APLICAR AUTENTICAÇÃO NAS ROTAS /api/cotacoes
// ==========================================
app.use('/api/cotacoes', verificarAutenticacao);

// ==========================================
// ROTAS PROTEGIDAS (COM /api/)
// ==========================================

// GET - Listar todas as cotações
app.get('/api/cotacoes', async (req, res) => {
    try {
        const cotacoes = await Cotacao.find().sort({ timestamp: -1 });
        res.json(cotacoes);
    } catch (error) {
        console.error('Erro ao buscar cotações:', error);
        res.status(500).json({ error: 'Erro ao buscar cotações' });
    }
});

// GET - Buscar cotação específica
app.get('/api/cotacoes/:id', async (req, res) => {
    try {
        const cotacao = await Cotacao.findOne({ id: req.params.id });
        
        if (!cotacao) {
            return res.status(404).json({ error: 'Cotação não encontrada' });
        }
        
        res.json(cotacao);
    } catch (error) {
        console.error('Erro ao buscar cotação:', error);
        res.status(500).json({ error: 'Erro ao buscar cotação' });
    }
});

// POST - Criar nova cotação
app.post('/api/cotacoes', async (req, res) => {
    try {
        const novaCotacao = new Cotacao({
            ...req.body,
            id: Date.now().toString(),
            timestamp: new Date(),
            negocioFechado: req.body.negocioFechado || false
        });
        
        await novaCotacao.save();
        
        console.log(`✅ Nova cotação criada: ${novaCotacao.id}`);
        res.status(201).json(novaCotacao);
    } catch (error) {
        console.error('Erro ao criar cotação:', error);
        res.status(500).json({ error: 'Erro ao criar cotação' });
    }
});

// PUT - Atualizar cotação
app.put('/api/cotacoes/:id', async (req, res) => {
    try {
        const cotacaoAtualizada = await Cotacao.findOneAndUpdate(
            { id: req.params.id },
            { 
                ...req.body,
                updatedAt: new Date()
            },
            { 
                new: true,
                runValidators: true
            }
        );
        
        if (!cotacaoAtualizada) {
            return res.status(404).json({ error: 'Cotação não encontrada' });
        }
        
        console.log(`✅ Cotação atualizada: ${req.params.id}`);
        res.json(cotacaoAtualizada);
    } catch (error) {
        console.error('Erro ao atualizar cotação:', error);
        res.status(500).json({ error: 'Erro ao atualizar cotação' });
    }
});

// DELETE - Excluir cotação
app.delete('/api/cotacoes/:id', async (req, res) => {
    try {
        const cotacaoDeletada = await Cotacao.findOneAndDelete({ id: req.params.id });
        
        if (!cotacaoDeletada) {
            return res.status(404).json({ error: 'Cotação não encontrada' });
        }
        
        console.log(`✅ Cotação deletada: ${req.params.id}`);
        res.status(204).end();
    } catch (error) {
        console.error('Erro ao excluir cotação:', error);
        res.status(500).json({ error: 'Erro ao excluir cotação' });
    }
});

// ==========================================
// TRATAMENTO DE ROTAS NÃO ENCONTRADAS
// ==========================================
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Rota não encontrada',
        message: `A rota ${req.method} ${req.path} não existe`
    });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Conectado' : 'Aguardando conexão...'}`);
    console.log(`🔐 Autenticação: ${process.env.API_TOKEN ? 'Ativada' : '❌ TOKEN NÃO CONFIGURADO'}`);
});
