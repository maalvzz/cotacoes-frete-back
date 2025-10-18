require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { verificarAutenticacao } = require('./middleware/auth');

const app = express();

// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERRO: SUPABASE_URL ou SUPABASE_KEY não configurados no .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
// ROTAS PÚBLICAS
// ==========================================

// Rota raiz - Documentação da API
app.get('/', (req, res) => {
    res.json({
        message: '🚀 API de Cotações de Frete',
        version: '1.0.0',
        status: 'online',
        database: 'Supabase',
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
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/health', async (req, res) => {
    try {
        // Testa conexão com Supabase
        const { error } = await supabase.from('cotacoes').select('count', { count: 'exact', head: true });
        
        res.json({ 
            status: error ? 'unhealthy' : 'healthy',
            database: error ? 'disconnected' : 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({ 
            status: 'unhealthy',
            database: 'error',
            timestamp: new Date().toISOString()
        });
    }
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
        const { data, error } = await supabase
            .from('cotacoes')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        res.json(data || []);
    } catch (error) {
        console.error('Erro ao buscar cotações:', error);
        res.status(500).json({ error: 'Erro ao buscar cotações' });
    }
});

// GET - Buscar cotação específica
app.get('/api/cotacoes/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('cotacoes')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Cotação não encontrada' });
            }
            throw error;
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar cotação:', error);
        res.status(500).json({ error: 'Erro ao buscar cotação' });
    }
});

// POST - Criar nova cotação
app.post('/api/cotacoes', async (req, res) => {
    try {
        const novaCotacao = {
            ...req.body,
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            negocioFechado: req.body.negocioFechado || false
        };

        const { data, error } = await supabase
            .from('cotacoes')
            .insert([novaCotacao])
            .select()
            .single();

        if (error) throw error;

        console.log(`✅ Nova cotação criada: ${data.id}`);
        res.status(201).json(data);
    } catch (error) {
        console.error('Erro ao criar cotação:', error);
        res.status(500).json({ error: 'Erro ao criar cotação' });
    }
});

// PUT - Atualizar cotação
app.put('/api/cotacoes/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('cotacoes')
            .update({
                ...req.body,
                updatedAt: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Cotação não encontrada' });
            }
            throw error;
        }

        console.log(`✅ Cotação atualizada: ${req.params.id}`);
        res.json(data);
    } catch (error) {
        console.error('Erro ao atualizar cotação:', error);
        res.status(500).json({ error: 'Erro ao atualizar cotação' });
    }
});

// DELETE - Excluir cotação
app.delete('/api/cotacoes/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('cotacoes')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

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
    console.log(`📊 Banco de dados: Supabase`);
    console.log(`🔐 Autenticação: ${process.env.API_TOKEN ? 'Ativada' : '❌ TOKEN NÃO CONFIGURADO'}`);
});
