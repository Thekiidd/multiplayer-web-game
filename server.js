const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Configuración de seguridad básica
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Servir archivos estáticos
app.use(express.static('public'));

// Almacenar información de los jugadores
const players = new Map();

// Constantes del juego
const GAME_CONSTANTS = {
    MAP_WIDTH: 3000,
    MAP_HEIGHT: 2000,
    UPDATE_RATE: 1000 / 60, // 60 FPS
};

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
            ...data
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
        }
        io.emit('playerRespawn', {
            id: data.id,
            x: data.x,
            y: data.y
        });
    });

    // Actualizar el evento playerMove con manejo de avatar
    socket.on('playerMove', (data) => {
        // Validar posición dentro del mapa
        const x = Math.max(0, Math.min(data.x, GAME_CONSTANTS.MAP_WIDTH));
        const y = Math.max(0, Math.min(data.y, GAME_CONSTANTS.MAP_HEIGHT));

        // Guardar información del jugador
        players.set(playerId, {
            x,
            y,
            name: data.name,
            score: data.score,
            health: data.health,
            isDead: data.isDead,
            bullets: data.bullets,
            avatarUrl: data.avatarUrl // Guardar URL del avatar
        });

        // Transmitir el movimiento a todos los demás jugadores
        socket.broadcast.emit('playerMoved', {
            id: playerId,
            x,
            y,
            name: data.name,
            score: data.score,
            health: data.health,
            isDead: data.isDead,
            bullets: data.bullets,
            avatarUrl: data.avatarUrl // Incluir URL del avatar en la transmisión
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

// Iniciar servidor
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
}); 