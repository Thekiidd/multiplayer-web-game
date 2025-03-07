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

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Manejo de conexiones de Socket.IO
io.on('connection', (socket) => {
    console.log('Un jugador se ha conectado');

    // Asignar ID único al jugador
    const playerId = socket.id;
    
    // Informar al jugador de su ID
    socket.emit('init', { id: playerId });

    // Manejar desconexión
    socket.on('disconnect', () => {
        console.log('Un jugador se ha desconectado');
        players.delete(playerId);
        io.emit('playerDisconnected', playerId);
    });

    // Manejar movimiento del jugador
    socket.on('playerMove', (data) => {
        // Guardar información del jugador
        players.set(playerId, {
            x: data.x,
            y: data.y,
            name: data.name,
            score: data.score || 0
        });

        // Transmitir el movimiento a todos los demás jugadores
        socket.broadcast.emit('playerMoved', {
            id: playerId,
            x: data.x,
            y: data.y,
            name: data.name,
            score: data.score || 0
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
        socket.broadcast.emit('playerShoot', {
            id: playerId,
            x: data.x,
            y: data.y
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
}); 