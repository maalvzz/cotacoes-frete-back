const jwt = require('jsonwebtoken');

function verificarAutenticacao(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET; // mesma chave usada no sistema central

    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded; // salva informações do usuário
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido ou expirado' });
    }
}

module.exports = { verificarAutenticacao };
