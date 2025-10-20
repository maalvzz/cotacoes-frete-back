// middleware/auth.js
const jwt = require('jsonwebtoken');

// Mesma SECRET_KEY usada no sistema central
const SECRET_KEY = process.env.JWT_SECRET || process.env.API_TOKEN;

if (!SECRET_KEY) {
    console.error('⚠️ JWT_SECRET ou API_TOKEN não definido!');
}

function verificarAutenticacao(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ 
            error: 'Token não fornecido',
            message: 'Cabeçalho Authorization ausente' 
        });
    }

    // Extrair token do formato "Bearer TOKEN"
    const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

    if (!token) {
        return res.status(401).json({ 
            error: 'Token não fornecido',
            message: 'Token vazio' 
        });
    }

    try {
        // Primeiro tenta validar como JWT
        const decoded = jwt.verify(token, SECRET_KEY);
        
        // Adiciona informações do usuário à requisição
        req.user = {
            username: decoded.username,
            name: decoded.name,
            isAdmin: decoded.isAdmin
        };
        
        console.log(`✅ Autenticação bem-sucedida: ${decoded.name} (${decoded.username})`);
        next();
        
    } catch (jwtError) {
        // Se falhar como JWT, tenta validar como token fixo (fallback)
        if (token === process.env.API_TOKEN) {
            console.log('✅ Autenticação via API_TOKEN fixo');
            req.user = { username: 'api', name: 'API User', isAdmin: true };
            next();
        } else {
            console.error('❌ Token inválido:', jwtError.message);
            return res.status(403).json({ 
                error: 'Token inválido ou expirado',
                message: jwtError.message 
            });
        }
    }
}

module.exports = { verificarAutenticacao };
