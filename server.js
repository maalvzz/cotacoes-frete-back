require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

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

console.log('✅ Supabase configurado:', supabaseUrl);

// ==========================================
// MIDDLEWARES
// ==========================================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Log de todas as requisições
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`);
    next();
});

// ===== MIDDLEWARE DE AUTENTICAÇÃO =====
app.use((req, res, next) => {
  // Permite acesso a arquivos estáticos (CSS, JS, imagens)
  if (req.path.startsWith('/css') || 
      req.path.startsWith('/js') || 
      req.path.startsWith('/images') || 
      req.path.startsWith('/favicon')) {
    return next();
  }
  
  // Verifica o token
  const token = req.headers['authorization'] || 
                req.query.token || 
                req.cookies?.token;
  
  if (token === process.env.SECRET_TOKEN) {
    next();
  } else {
    res.status(401).send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Acesso Negado</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: white;
            padding: 3rem 2rem;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 500px;
          }
          .lock-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          h1 {
            color: #333;
            margin-bottom: 1rem;
            font-size: 1.8rem;
          }
          p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 2rem;
          }
          .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
            font-weight: 600;
            transition: transform 0.2s;
          }
          .btn:hover {
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="lock-icon">🔒</div>
          <h1>Acesso Não Autorizado</h1>
          <p>Você precisa estar autenticado para acessar esta aplicação.<br>
          Por favor, faça login através do portal principal.</p>
          <a href="https://seu-portal-central.onrender.com" class="btn">Ir para o Portal</a>
        </div>
      </body>
      </html>
    `);
  }
});

// ==========================================
// ROTAS PÚBLICAS (depois da autenticação)
// ==========================================

// Rota raiz - Documentação da API
app.get('/', (req, res) => {
    res.json({
        message: '🚀 API de Cotações de Frete',
        version: '2.0.0',
        status: 'online',
        database: 'Supabase',
        cache: 'Desativado',
        authentication: 'Ativada',
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
            supabase_url: supabaseUrl,
            timestamp: new Date().toISOString()
        });
        
        if (error) {
            console.error('❌ Erro no health check Supabase:', error);
        }
    } catch (error) {
        console.error('❌ Erro no health check:', error);
        res.json({ 
            status: 'unhealthy',
            database: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// HEAD - Verificar status
app.head('/api/cotacoes', (req, res) => {
    res.status(200).end();
});

// ==========================================
// ROTAS DE COTAÇÕES
// ==========================================

// GET - Listar todas as cotações
app.get('/api/cotacoes', async (req, res) => {
    try {
        console.log('📋 Buscando todas as cotações...');
        
        const { data, error } = await supabase
            .from('cotacoes')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('❌ Erro ao buscar cotações:', error);
            throw error;
        }

        console.log(`✅ ${data?.length || 0} cotações encontradas`);
        res.json(data || []);
    } catch (error) {
        console.error('❌ Erro ao buscar cotações:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar cotações',
            details: error.message 
        });
    }
});

// GET - Buscar cotação específica
app.get('/api/cotacoes/:id', async (req, res) => {
    try {
        console.log(`🔍 Buscando cotação ID: ${req.params.id}`);
        
        const { data, error } = await supabase
            .from('cotacoes')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('⚠️ Cotação não encontrada');
                return res.status(404).json({ error: 'Cotação não encontrada' });
            }
            console.error('❌ Erro ao buscar cotação:', error);
            throw error;
        }

        console.log('✅ Cotação encontrada');
        res.json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar cotação:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar cotação',
            details: error.message 
        });
    }
});

// POST - Criar nova cotação
app.post('/api/cotacoes', async (req, res) => {
    try {
        console.log('📝 Criando nova cotação...');
        console.log('Dados recebidos:', req.body);
        
        const novaCotacao = {
            ...req.body,
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            negocioFechado: req.body.negocioFechado || false
        };

        console.log('Dados a serem inseridos:', novaCotacao);

        const { data, error } = await supabase
            .from('cotacoes')
            .insert([novaCotacao])
            .select()
            .single();

        if (error) {
            console.error('❌ Erro ao inserir:', error);
            throw error;
        }

        console.log('✅ Cotação criada com sucesso:', data);
        res.status(201).json(data);
    } catch (error) {
        console.error('❌ Erro ao criar cotação:', error);
        res.status(500).json({ 
            error: 'Erro ao criar cotação',
            details: error.message 
        });
    }
});

// PUT - Atualizar cotação
app.put('/api/cotacoes/:id', async (req, res) => {
    try {
        console.log(`✏️ Atualizando cotação ID: ${req.params.id}`);
        console.log('Dados recebidos:', req.body);
        
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
                console.log('⚠️ Cotação não encontrada para atualizar');
                return res.status(404).json({ error: 'Cotação não encontrada' });
            }
            console.error('❌ Erro ao atualizar:', error);
            throw error;
        }

        console.log('✅ Cotação atualizada com sucesso');
        res.json(data);
    } catch (error) {
        console.error('❌ Erro ao atualizar cotação:', error);
        res.status(500).json({ 
            error: 'Erro ao atualizar cotação',
            details: error.message 
        });
    }
});

// DELETE - Excluir cotação
app.delete('/api/cotacoes/:id', async (req, res) => {
    try {
        console.log(`🗑️ Deletando cotação ID: ${req.params.id}`);
        
        const { error } = await supabase
            .from('cotacoes')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            console.error('❌ Erro ao deletar:', error);
            throw error;
        }

        console.log('✅ Cotação deletada com sucesso');
        res.status(204).end();
    } catch (error) {
        console.error('❌ Erro ao excluir cotação:', error);
        res.status(500).json({ 
            error: 'Erro ao excluir cotação',
            details: error.message 
        });
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
    console.log('🚀 =================================');
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📊 Banco de dados: Supabase`);
    console.log(`🔗 URL: ${supabaseUrl}`);
    console.log(`🔐 Autenticação: ATIVADA`);
    console.log('🚀 =================================');
});
