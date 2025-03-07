// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const menuInicial = document.getElementById('menuInicial');
    const gameContainer = document.querySelector('.game-container');
    const nombreInput = document.getElementById('nombreJugador');
    const botonJugar = document.getElementById('botonJugar');
    const playerCountElement = document.getElementById('playerCount');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const scoreList = document.getElementById('scoreList');

    // Configuración del canvas para pantalla completa
    function ajustarCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // Ajustar canvas inicialmente y cuando cambie el tamaño de la ventana
    ajustarCanvas();
    window.addEventListener('resize', ajustarCanvas);

    // Habilitar/deshabilitar botón de jugar según el nombre
    nombreInput.addEventListener('input', () => {
        botonJugar.disabled = nombreInput.value.trim().length < 2;
    });
    botonJugar.disabled = true;

    // Estado del juego
    const players = new Map();
    let myId = null;
    let playerName = '';

    // Clase Jugador
    class Player {
        constructor(x, y, color, name) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.name = name;
            this.size = 30;
            this.speed = 7;
            this.score = 0;
            this.powerUp = null;
        }

        draw() {
            // Dibujar círculo del jugador
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();

            // Efecto de power-up
            if (this.powerUp) {
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            // Dibujar nombre y puntuación
            ctx.fillStyle = 'white';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.name} (${this.score})`, this.x, this.y - this.size - 5);
        }

        update(keys) {
            if (keys.ArrowLeft) this.x -= this.speed;
            if (keys.ArrowRight) this.x += this.speed;
            if (keys.ArrowUp) this.y -= this.speed;
            if (keys.ArrowDown) this.y += this.speed;

            // Mantener al jugador dentro del canvas
            this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
            this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));
        }

        // Método para detectar colisiones
        collidesWith(otherPlayer) {
            const dx = this.x - otherPlayer.x;
            const dy = this.y - otherPlayer.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < this.size + otherPlayer.size;
        }
    }

    // Clase para power-ups
    class PowerUp {
        constructor() {
            this.x = Math.random() * (canvas.width - 40) + 20;
            this.y = Math.random() * (canvas.height - 40) + 20;
            this.size = 15;
            this.type = Math.random() < 0.5 ? 'speed' : 'size';
        }

        draw() {
            ctx.fillStyle = this.type === 'speed' ? '#FFD700' : '#FF4500';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Variables globales para power-ups
    let powerUps = [];
    let lastPowerUpTime = 0;

    // Control de teclas
    const keys = {
        ArrowLeft: false,
        ArrowRight: false,
        ArrowUp: false,
        ArrowDown: false
    };

    // Eventos de teclado
    window.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = true;
            e.preventDefault(); // Prevenir scroll con las flechas
        }
    });

    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = false;
        }
    });

    // Función para actualizar el tablero de puntuaciones
    function updateScoreboard() {
        const scores = Array.from(players.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        scoreList.innerHTML = scores
            .map((player, index) => `
                <div class="score-item">
                    ${index + 1}. ${player.name}: ${player.score}
                </div>
            `)
            .join('');
    }

    // Manejar entrada de chat
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim() && myId) {
            const message = chatInput.value.trim();
            const myPlayer = players.get(myId);
            
            // Emitir mensaje al servidor
            socket.emit('chatMessage', {
                name: myPlayer.name,
                message: message
            });

            // Limpiar input
            chatInput.value = '';
        }
    });

    // En los eventos de Socket.IO, agregar:
    socket.on('chatMessage', (data) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.innerHTML = `<span class="player-name">${data.name}:</span> ${data.message}`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Modificar la función updatePlayerCount para incluir actualización del scoreboard
    function updatePlayerCount() {
        playerCountElement.textContent = players.size;
        updateScoreboard();
    }

    // Iniciar el juego
    function startGame() {
        playerName = nombreInput.value.trim();
        menuInicial.style.display = 'none';
        gameContainer.style.display = 'block';
        
        // Conectar con Socket.IO
        if (typeof io === 'undefined') {
            console.error('Socket.IO no está cargado. Asegúrate de estar usando el puerto 3000');
            alert('Error: Por favor, accede al juego a través de http://localhost:3000');
            return;
        }

        try {
            socket = io();
            console.log('Conectando al servidor...');
        } catch (error) {
            console.error('Error al conectar con Socket.IO:', error);
            alert('Error de conexión. Asegúrate de que el servidor esté corriendo.');
            return;
        }

        // Eventos de Socket.IO
        socket.on('connect', () => {
            console.log('¡Conectado al servidor!');
        });

        socket.on('init', (data) => {
            myId = data.id;
            players.set(myId, new Player(
                Math.random() * (canvas.width - 100) + 50,
                Math.random() * (canvas.height - 100) + 50,
                `hsl(${Math.random() * 360}, 70%, 50%)`,
                playerName
            ));
            updatePlayerCount();
        });

        socket.on('playerMoved', (data) => {
            if (players.has(data.id)) {
                const player = players.get(data.id);
                player.x = data.x;
                player.y = data.y;
            } else {
                players.set(data.id, new Player(
                    data.x,
                    data.y,
                    `hsl(${Math.random() * 360}, 70%, 50%)`,
                    data.name || 'Jugador'
                ));
                updatePlayerCount();
            }
        });

        socket.on('playerDisconnected', (id) => {
            players.delete(id);
            updatePlayerCount();
        });

        socket.on('connect_error', (error) => {
            console.error('Error de conexión:', error);
            alert('Error de conexión con el servidor.');
        });

        // Iniciar bucle del juego
        gameLoop();
    }

    // Evento del botón jugar
    botonJugar.addEventListener('click', startGame);
    nombreInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !botonJugar.disabled) {
            startGame();
        }
    });

    // Bucle principal del juego
    function gameLoop() {
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Generar power-ups cada 10 segundos
        const currentTime = Date.now();
        if (currentTime - lastPowerUpTime > 10000 && powerUps.length < 3) {
            powerUps.push(new PowerUp());
            lastPowerUpTime = currentTime;
        }

        // Dibujar power-ups
        powerUps.forEach((powerUp, index) => {
            powerUp.draw();
            
            // Verificar colisiones con jugadores
            players.forEach(player => {
                const dx = player.x - powerUp.x;
                const dy = player.y - powerUp.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < player.size + powerUp.size) {
                    // Aplicar efecto
                    if (powerUp.type === 'speed') {
                        player.speed = 12;
                    } else {
                        player.size = 45;
                    }
                    player.powerUp = powerUp.type;
                    
                    // Eliminar power-up
                    powerUps.splice(index, 1);
                    
                    // Programar fin del power-up
                    setTimeout(() => {
                        player.speed = 7;
                        player.size = 30;
                        player.powerUp = null;
                    }, 5000);
                }
            });
        });

        // Verificar colisiones entre jugadores
        if (myId && players.has(myId)) {
            const myPlayer = players.get(myId);
            players.forEach((otherPlayer, id) => {
                if (id !== myId && myPlayer.collidesWith(otherPlayer)) {
                    // El jugador más grande gana
                    if (myPlayer.size > otherPlayer.size) {
                        myPlayer.score += 1;
                        socket.emit('playerScored', {
                            id: myId,
                            score: myPlayer.score
                        });
                    }
                }
            });
        }

        // Actualizar mi jugador
        if (myId && players.has(myId)) {
            const myPlayer = players.get(myId);
            myPlayer.update(keys);
            
            // Enviar posición al servidor
            if (socket && socket.connected) {
                socket.emit('playerMove', {
                    x: myPlayer.x,
                    y: myPlayer.y,
                    name: playerName
                });
            }
        }

        // Dibujar todos los jugadores
        players.forEach(player => player.draw());

        // Siguiente frame
        requestAnimationFrame(gameLoop);
    }

    // Inicializar anuncios
    window.onload = function() {
        (adsbygoogle = window.adsbygoogle || []).push({});
        (adsbygoogle = window.adsbygoogle || []).push({});
    };
}); 