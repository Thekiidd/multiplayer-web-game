const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Aumentar el límite de memoria de Node.js
const v8 = require('v8');
v8.setFlagsFromString('--max-old-space-size=4096');

// Configuración de seguridad básica
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Servir archivos estáticos
app.use(express.static('public'));

// Almacenar información de los jugadores con límite de balas
const players = new Map();
const MAX_BULLETS_PER_PLAYER = 20;

// Constantes del juego
const GAME_CONSTANTS = {
    MAP_WIDTH: 3000,
    MAP_HEIGHT: 2000,
    UPDATE_RATE: 1000 / 60, // 60 FPS
    CLEANUP_INTERVAL: 1000 * 60, // Limpieza cada minuto
};

// Función para limpiar datos antiguos
function cleanupOldData() {
    players.forEach((player, id) => {
        // Limitar el número de balas por jugador
        if (player.bullets && player.bullets.length > MAX_BULLETS_PER_PLAYER) {
            player.bullets = player.bullets.slice(-MAX_BULLETS_PER_PLAYER);
        }
    });
}

// Ejecutar limpieza periódicamente
setInterval(cleanupOldData, GAME_CONSTANTS.CLEANUP_INTERVAL);

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Manejo de conexiones de Socket.IO
io.on('connection', (socket) => {
    console.log('Un jugador se ha conectado');

    // Asignar ID único al jugador
    const playerId = socket.id;
    
    // Informar al jugador de su ID y enviar datos de otros jugadores
    socket.emit('init', { 
        id: playerId,
        players: Array.from(players.entries()).map(([id, data]) => ({
            id,
            x: data.x,
            y: data.y,
            name: data.name,
            score: data.score,
            health: data.health,
            isDead: data.isDead,
            avatarUrl: data.avatarUrl
        }))
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
        console.log('Un jugador se ha desconectado');
        players.delete(playerId);
        io.emit('playerDisconnected', playerId);
    });

    // Manejar muerte de jugador
    socket.on('playerDied', (data) => {
        if (players.has(data.id)) {
            const player = players.get(data.id);
            player.isDead = true;
            player.health = 0;
            player.bullets = []; // Limpiar balas al morir
        }
        io.emit('playerDied', {
            id: data.id,
            killerId: data.killerId
        });
    });

    // Manejar respawn de jugador
    socket.on('playerRespawn', (data) => {
        if (players.has(data.id)) {
            const player = players.get(data.id);
            player.isDead = false;
            player.health = 100;
            player.x = data.x;
            player.y = data.y;
            player.bullets = [];
        }
        io.emit('playerRespawn', data);
    });

    // Actualizar el evento playerMove con manejo de avatar
    socket.on('playerMove', (data) => {
        // Validar posición dentro del mapa
        const x = Math.max(0, Math.min(data.x, GAME_CONSTANTS.MAP_WIDTH));
        const y = Math.max(0, Math.min(data.y, GAME_CONSTANTS.MAP_HEIGHT));

        // Guardar solo los datos necesarios
        players.set(playerId, {
            x,
            y,
            name: data.name,
            score: data.score || 0,
            health: data.health,
            isDead: data.isDead,
            bullets: (data.bullets || []).slice(-MAX_BULLETS_PER_PLAYER),
            avatarUrl: data.avatarUrl
        });

        // Enviar solo los datos necesarios
        socket.broadcast.emit('playerMoved', {
            id: playerId,
            x,
            y,
            name: data.name,
            score: data.score || 0,
            health: data.health,
            isDead: data.isDead,
            bullets: (data.bullets || []).slice(-MAX_BULLETS_PER_PLAYER),
            avatarUrl: data.avatarUrl
        });
    });

    // Manejar mensajes de chat
    socket.on('chatMessage', (data) => {
        const sanitizedMessage = data.message
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        io.emit('chatMessage', {
            name: data.name,
            message: sanitizedMessage
        });
    });

    // Manejar disparos del jugador
    socket.on('playerShoot', (data) => {
        if (players.has(playerId)) {
            const player = players.get(playerId);
            if (!player.isDead) {
                socket.broadcast.emit('playerShoot', {
                    id: playerId,
                    x: data.x,
                    y: data.y
                });
            }
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

// Iniciar servidor
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
}); 