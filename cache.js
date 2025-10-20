const { Redis } = require('@upstash/redis');

let redis = null;

// Inicializar Redis apenas se as credenciais existirem
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        console.log('✅ Redis (Upstash) configurado');
    } catch (error) {
        console.warn('⚠️ Redis não disponível:', error.message);
    }
} else {
    console.warn('⚠️ Redis não configurado (variáveis de ambiente ausentes) - cache desabilitado');
}

async function getCache(key) {
    if (!redis) return null;
    
    try {
        const data = await redis.get(key);
        return data;
    } catch (error) {
        console.warn('⚠️ Erro ao buscar cache:', error.message);
        return null;
    }
}

async function setCache(key, value, expirationSeconds = 300) {
    if (!redis) return false;
    
    try {
        await redis.set(key, value, { ex: expirationSeconds });
        console.log(`💾 Cache salvo: ${key} (expira em ${expirationSeconds}s)`);
        return true;
    } catch (error) {
        console.warn('⚠️ Erro ao salvar cache:', error.message);
        return false;
    }
}

async function clearCache(pattern) {
    if (!redis) return false;
    
    try {
        // Upstash Redis não suporta KEYS ou SCAN diretamente via REST
        // Então vamos apenas deletar o cache principal
        await redis.del('cotacoes:all');
        console.log('🗑️ Cache principal limpo');
        return true;
    } catch (error) {
        console.warn('⚠️ Erro ao limpar cache:', error.message);
        return false;
    }
}

async function healthCheck() {
    if (!redis) return false;
    
    try {
        await redis.ping();
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {
    getCache,
    setCache,
    clearCache,
    healthCheck
};
