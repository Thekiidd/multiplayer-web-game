const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Configuración para memoria limitada
const MEMORY_LIMITS = {
    MAX_PLAYERS: 50,
    MAX_BULLETS: 10,
    CLEANUP_INTERVAL: 10000,
    INACTIVE_TIMEOUT: 60000
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

const players = new Map();
const playerLastActivity = new Map();

const GAME_CONSTANTS = {
    MAP_WIDTH: 3000,
    MAP_HEIGHT: 2000,
    UPDATE_RATE: 1000 / 30
};

function cleanupData() {
    const now = Date.now();
    playerLastActivity.forEach((lastActivity, playerId) => {
        if (now - lastActivity > MEMORY_LIMITS.INACTIVE_TIMEOUT) {
            players.delete(playerId);
            playerLastActivity.delete(playerId);
            io.emit('playerDisconnected', playerId);
        }
    });
    players.forEach(player => {
        if (player.bullets && player.bullets.length > MEMORY_LIMITS.MAX_BULLETS) {
            player.bullets = player.bullets.slice(-MEMORY_LIMITS.MAX_BULLETS);
        }
    });
}

setInterval(cleanupData, MEMORY_LIMITS.CLEANUP_INTERVAL);

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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

io.on('connection', (socket) => {
    if (players.size >= MEMORY_LIMITS.MAX_PLAYERS) {
        socket.emit('serverFull');
        socket.disconnect(true);
        return;
    }

    const playerId = socket.id;
    playerLastActivity.set(playerId, Date.now());

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
            player.score = data.score || player.score; // Mantener el puntaje actualizado
        }

        socket.broadcast.emit('playerMoved', createUpdateData(players.get(playerId), playerId));
    });

    socket.on('playerShoot', (data) => {
        playerLastActivity.set(playerId, Date.now());
        
        const player = players.get(playerId);
        if (player && !player.isDead) {
            socket.broadcast.emit('playerShoot', { id: playerId, x: data.x, y: data.y });
        }
    });

    socket.on('playerDied', (data) => {
        playerLastActivity.set(playerId, Date.now());
        
        const player = players.get(data.id);
        if (player) {
            player.isDead = true;
            player.health = 0;
            player.bullets = [];
            player.killStreak = 0;

            // Incrementar el puntaje del asesino si existe
            if (data.killerId && players.has(data.killerId)) {
                const killer = players.get(data.killerId);
                killer.score = (killer.score || 0) + 2; // Base score por muerte
                
                // Sistema de racha de muertes
                if (!killer.killStreak) killer.killStreak = 0;
                killer.killStreak++;
                
                // Bonus por racha
                if (killer.killStreak >= 3) {
                    killer.score++; // Punto extra por racha
                }

                // Emitir evento con información actualizada
                io.emit('playerDied', {
                    id: data.id,
                    killerId: data.killerId,
                    killerScore: killer.score,
                    killStreak: killer.killStreak
                });

                // Emitir actualización inmediata del asesino
                io.emit('playerMoved', {
                    id: data.killerId,
                    x: killer.x,
                    y: killer.y,
                    name: killer.name,
                    score: killer.score,
                    health: killer.health,
                    isDead: killer.isDead,
                    killStreak: killer.killStreak
                });
            }
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

process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesa rechazada no manejada:', reason);
});

setInterval(() => {
    global.gc && global.gc();
}, 30000);

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});