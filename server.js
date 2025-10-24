require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
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
// SISTEMA DE TOKENS TEMPORÁRIOS
// ==========================================
const tempTokens = new Map();

// Limpa tokens expirados a cada minuto
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tempTokens.entries()) {
    if (now - data.createdAt > 30000) { // 30 segundos
      tempTokens.delete(token);
    }
  }
}, 60000);

// ==========================================
// MIDDLEWARES
// ==========================================
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Sessão (mantém usuário logado)
app.use(session({
  secret: process.env.SESSION_SECRET || 'seu-secret-super-seguro-aqui',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
    httpOnly: true,
    secure: false // mude para true se usar HTTPS
  }
}));

// Log de todas as requisições
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`);
    next();
});

// ==========================================
// ROTA PARA GERAR TOKEN TEMPORÁRIO
// ==========================================
app.post('/api/auth/generate-token', (req, res) => {
  const { secret } = req.body;
  
  if (secret === process.env.SECRET_TOKEN) {
    const tempToken = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    tempTokens.set(tempToken, {
      createdAt: Date.now(),
      used: false
    });
    
    console.log('✅ Token temporário gerado:', tempToken.substring(0, 20) + '...');
    
    res.json({ 
      success: true, 
      token: tempToken,
      expiresIn: 30
    });
  } else {
    console.log('❌ Tentativa de gerar token com secret inválido');
    res.status(401).json({ success: false, error: 'Não autorizado' });
  }
});

// ==========================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ==========================================
app.use((req, res, next) => {
  // Permite rotas públicas
  if (req.path.startsWith('/css') || 
      req.path.startsWith('/js') || 
      req.path.startsWith('/images') || 
      req.path.startsWith('/favicon') ||
      req.path === '/api/auth/generate-token' ||
      req.path === '/health') {
    return next();
  }
  
  // Verifica se JÁ TEM SESSÃO ATIVA
  if (req.session && req.session.authenticated) {
    console.log('✅ Usuário com sessão ativa');
    return next();
  }
  
  // Verifica token temporário na primeira entrada
  const token = req.query.token || req.headers['authorization'];
  
  if (token && tempTokens.has(token)) {
    // Token válido! Cria sessão permanente
    const tokenData = tempTokens.get(token);
    if (!tokenData.used) {
      req.session.authenticated = true;
      req.session.loginTime = new Date().toISOString();
      tokenData.used = true;
      
      console.log('✅ Token temporário validado, sessão criada');
      
      // Remove token da URL e redireciona
      const urlSemToken = req.originalUrl.split('?')[0];
      return res.redirect(urlSemToken || '/');
    }
  }
  
  // Sem sessão e sem token válido = BLOQUEADO
  console.log('❌ Acesso bloqueado - sem autenticação');
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
        .lock-icon { font-size: 4rem; margin-bottom: 1rem; }
        h1 { color: #333; margin-bottom: 1rem; font-size: 1.8rem; }
        p { color: #666; line-height: 1.6; margin-bottom: 1rem; }
        .info { 
          background: #f0f9ff; 
          border-left: 4px solid #3b82f6;
          padding: 1rem;
          border-radius: 8px;
          text-align: left;
          margin-top: 1.5rem;
          font-size: 0.9rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="lock-icon">🔒</div>
        <h1>Acesso Não Autorizado</h1>
        <p>Você precisa estar autenticado para acessar esta aplicação.</p>
        <p>Por favor, faça login através do portal principal.</p>
        <div class="info">
          <strong>ℹ️ Motivo possível:</strong><br>
          • Seu link de acesso expirou (válido por 30s)<br>
          • Sua sessão expirou após 8 horas de inatividade<br>
          • Você tentou acessar diretamente sem fazer login
        </div>
      </div>
    </body>
    </html>
  `);
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
        authentication: 'Token Temporário + Sessão',
        sessionActive: req.session?.authenticated || false,
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
    console.log(`🔐 Autenticação: Token Temporário + Sessão`);
    console.log('⏱️  Token expira em: 30 segundos');
    console.log('🕐 Sessão dura: 8 horas');
    console.log('🚀 =================================');
});
