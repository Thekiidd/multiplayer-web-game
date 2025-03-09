const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Configuración para memoria limitada
const MEMORY_LIMITS = {
    MAX_PLAYERS: 50,            // Máximo número de jugadores simultáneos
    MAX_BULLETS: 10,            // Máximo número de balas por jugador
    CLEANUP_INTERVAL: 10000,    // Limpieza cada 10 segundos
    INACTIVE_TIMEOUT: 60000     // Desconectar jugadores inactivos después de 1 minuto
};

// Configuración de seguridad básica
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Servir archivos estáticos
app.use(express.static('public'));

// Estructura de datos optimizada para jugadores
const players = new Map();
const playerLastActivity = new Map();

// Constantes del juego
const GAME_CONSTANTS = {
    MAP_WIDTH: 3000,
    MAP_HEIGHT: 2000,
    UPDATE_RATE: 1000 / 30  // Reducido a 30 FPS para ahorrar recursos
};

// Función para limpiar datos y jugadores inactivos
function cleanupData() {
    const now = Date.now();
    
    // Limpiar jugadores inactivos
    playerLastActivity.forEach((lastActivity, playerId) => {
        if (now - lastActivity > MEMORY_LIMITS.INACTIVE_TIMEOUT) {
            players.delete(playerId);
            playerLastActivity.delete(playerId);
            io.emit('playerDisconnected', playerId);
        }
    });

    // Limpiar balas excesivas
    players.forEach(player => {
        if (player.bullets && player.bullets.length > MEMORY_LIMITS.MAX_BULLETS) {
            player.bullets = player.bullets.slice(-MEMORY_LIMITS.MAX_BULLETS);
        }
    });
}

// Ejecutar limpieza periódicamente
setInterval(cleanupData, MEMORY_LIMITS.CLEANUP_INTERVAL);

// Función para crear objeto de jugador optimizado
function createPlayerData(data, x, y) {
    return {
        x: x,
        y: y,
        name: data.name,
        score: data.score || 0,
        health: data.health || 100,
        isDead: false,
        bullets: [],
        avatarUrl: data.avatarUrl
    };
}

// Función para crear objeto de actualización optimizado
function createUpdateData(player, id) {
    return {
        id: id,
        x: player.x,
        y: player.y,
        name: player.name,
        score: player.score,
        health: player.health,
        isDead: player.isDead,
        bullets: player.bullets,
        avatarUrl: player.avatarUrl
    };
}

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Manejo de conexiones de Socket.IO
io.on('connection', (socket) => {
    // Verificar límite de jugadores
    if (players.size >= MEMORY_LIMITS.MAX_PLAYERS) {
        socket.emit('serverFull');
        socket.disconnect(true);
        return;
    }

    const playerId = socket.id;
    playerLastActivity.set(playerId, Date.now());

    // Enviar solo datos necesarios al inicializar
    socket.emit('init', {
        id: playerId,
        players: Array.from(players.entries()).map(([id, data]) => createUpdateData(data, id))
    });

    socket.on('disconnect', () => {
        players.delete(playerId);
        playerLastActivity.delete(playerId);
        io.emit('playerDisconnected', playerId);
    });

    socket.on('playerMove', (data) => {
        playerLastActivity.set(playerId, Date.now());
        
        const x = Math.max(0, Math.min(data.x, GAME_CONSTANTS.MAP_WIDTH));
        const y = Math.max(0, Math.min(data.y, GAME_CONSTANTS.MAP_HEIGHT));

        if (!players.has(playerId)) {
            players.set(playerId, createPlayerData(data, x, y));
        } else {
            const player = players.get(playerId);
            player.x = x;
            player.y = y;
            player.health = data.health;
            player.isDead = data.isDead;
            player.bullets = (data.bullets || []).slice(-MEMORY_LIMITS.MAX_BULLETS);
        }

        socket.broadcast.emit('playerMoved', createUpdateData(players.get(playerId), playerId));
    });

    socket.on('playerShoot', (data) => {
        playerLastActivity.set(playerId, Date.now());
        
        const player = players.get(playerId);
        if (player && !player.isDead) {
            socket.broadcast.emit('playerShoot', {
                id: playerId,
                x: data.x,
                y: data.y
            });
        }
    });

    socket.on('playerDied', (data) => {
        playerLastActivity.set(playerId, Date.now());
        
        const player = players.get(data.id);
        if (player) {
            player.isDead = true;
            player.health = 0;
            player.bullets = [];
            io.emit('playerDied', { id: data.id, killerId: data.killerId });
        }
    });

    socket.on('playerRespawn', (data) => {
        playerLastActivity.set(playerId, Date.now());
        
        const player = players.get(data.id);
        if (player) {
            player.isDead = false;
            player.health = 100;
            player.x = data.x;
            player.y = data.y;
            player.bullets = [];
            io.emit('playerRespawn', data);
        }
    });
});

// Manejo de errores
process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesa rechazada no manejada:', reason);
});

// Limpieza de memoria periódica
setInterval(() => {
    global.gc && global.gc();
}, 30000);

// Iniciar servidor
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
}); 