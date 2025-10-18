/**
 * 🚀 Sistema de Cache com Redis (Upstash)
 * Acelera consultas em até 50x!
 */

const { Redis } = require('@upstash/redis');

// Configuração do Redis
let redis = null;

try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        console.log('✅ Redis conectado com sucesso!');
    } else {
        console.warn('⚠️  Redis não configurado (variáveis de ambiente ausentes)');
    }
} catch (error) {
    console.error('❌ Erro ao conectar Redis:', error.message);
    redis = null;
}

/**
 * Buscar dados do cache
 */
async function getCache(key) {
    if (!redis) return null;
    
    try {
        const data = await redis.get(key);
        if (data) {
            console.log(`🔵 Cache HIT: ${key}`);
            return data;
        }
        console.log(`⚪ Cache MISS: ${key}`);
        return null;
    } catch (error) {
        console.error('Erro ao buscar cache:', error.message);
        return null;
    }
}

/**
 * Salvar dados no cache
 * @param {string} key - Chave do cache
 * @param {any} data - Dados a serem salvos
 * @param {number} ttl - Tempo de vida em segundos (padrão: 5 minutos)
 */
async function setCache(key, data, ttl = 300) {
    if (!redis) return false;
    
    try {
        await redis.set(key, JSON.stringify(data), { ex: ttl });
        console.log(`💾 Cache SALVO: ${key} (expira em ${ttl}s)`);
        return true;
    } catch (error) {
        console.error('Erro ao salvar cache:', error.message);
        return false;
    }
}

/**
 * Limpar cache específico ou todos
 */
async function clearCache(pattern = null) {
    if (!redis) return false;
    
    try {
        if (pattern) {
            // Limpar chaves que correspondem ao padrão
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
                console.log(`🗑️  Cache LIMPO: ${keys.length} chaves (${pattern})`);
            }
        } else {
            // Limpar todo o cache
            await redis.flushdb();
            console.log('🗑️  TODO cache LIMPO');
        }
        return true;
    } catch (error) {
        console.error('Erro ao limpar cache:', error.message);
        return false;
    }
}

/**
 * Verificar se Redis está funcionando
 */
async function healthCheck() {
    if (!redis) return false;
    
    try {
        await redis.ping();
        return true;
    } catch (error) {
        console.error('Redis health check falhou:', error.message);
        return false;
    }
}

module.exports = {
    getCache,
    setCache,
    clearCache,
    healthCheck,
    isEnabled: () => redis !== null
};
