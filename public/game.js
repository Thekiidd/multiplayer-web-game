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
        }

        draw() {
            // Dibujar círculo del jugador
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();

            // Dibujar nombre del jugador
            ctx.fillStyle = 'white';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.x, this.y - this.size - 5);
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
    }

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

    // Actualizar contador de jugadores
    function updatePlayerCount() {
        playerCountElement.textContent = players.size;
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
        // Limpiar canvas
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

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