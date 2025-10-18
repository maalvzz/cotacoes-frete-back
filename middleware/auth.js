/**
 * Middleware de autenticação por token
 * Protege as rotas da API contra acessos não autorizados
 */

function verificarAutenticacao(req, res, next) {
    // Ignora verificação para rotas públicas
    if (req.path === '/health' || req.method === 'HEAD') {
        return next();
    }

    // Pega o token do header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ 
            error: 'Não autorizado',
            message: 'Token de autenticação não fornecido' 
        });
    }

    // Formato esperado: "Bearer SEU_TOKEN_SECRETO"
    const token = authHeader.replace('Bearer ', '');
    
    // Token secreto (deve estar no .env)
    const TOKEN_SECRETO = process.env.API_TOKEN;

    if (!TOKEN_SECRETO) {
        console.error('❌ ERRO: API_TOKEN não configurado no .env');
        return res.status(500).json({ 
            error: 'Erro de configuração do servidor' 
        });
    }

    if (token !== TOKEN_SECRETO) {
        return res.status(401).json({ 
            error: 'Não autorizado',
            message: 'Token inválido' 
        });
    }

    // Token válido, permite continuar
    next();
}

module.exports = { verificarAutenticacao };
