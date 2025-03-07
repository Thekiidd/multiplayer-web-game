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

    // Variables globales
    let socket;
    const players = new Map();
    let myId = null;
    let playerName = '';

    // Configuración del canvas para pantalla completa
    function ajustarCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // Ajustar canvas inicialmente y cuando cambie el tamaño de la ventana
    ajustarCanvas();
    window.addEventListener('resize', ajustarCanvas);

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
            this.bullets = [];         // Array para las balas
            this.isDead = false;       // Estado de muerte
            this.respawnTime = 0;      // Tiempo para reaparecer
            this.lastShot = 0;         // Control de cadencia de disparo
            this.health = 100;         // Salud del jugador
            this.lastDamageFrom = null; // Guardar quién hizo el último daño
        }

        draw() {
            if (this.isDead) {
                // Animación de muerte (explosión)
                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * (1 + Math.sin(Date.now() / 100)), 0, Math.PI * 2);
                ctx.fill();
                return;
            }

            // Dibujar círculo del jugador
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();

            // Barra de vida
            const healthBarWidth = 50;
            const healthBarHeight = 5;
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x - healthBarWidth/2, this.y - this.size - 15, healthBarWidth, healthBarHeight);
            ctx.fillStyle = 'green';
            ctx.fillRect(this.x - healthBarWidth/2, this.y - this.size - 15, healthBarWidth * (this.health/100), healthBarHeight);

            // Dibujar nombre y puntuación
            ctx.fillStyle = 'white';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.name} (${this.score})`, this.x, this.y - this.size - 20);

            // Dibujar balas
            this.bullets.forEach(bullet => bullet.draw());
        }

        shoot(targetX, targetY) {
            const now = Date.now();
            if (now - this.lastShot > 250) { // Cadencia de disparo: 250ms
                const angle = Math.atan2(targetY - this.y, targetX - this.x);
                this.bullets.push(new Bullet(this.x, this.y, angle));
                this.lastShot = now;

                // Efecto de sonido de disparo
                playSound('shoot');
            }
        }

        takeDamage(damage, attackerId) {
            this.health -= damage;
            this.lastDamageFrom = attackerId; // Guardar quién hizo el último daño
            
            if (this.health <= 0 && !this.isDead) {
                this.die();
            }
        }

        die() {
            this.isDead = true;
            this.health = 0;
            this.respawnTime = Date.now() + 3000;
            playSound('explosion');
            
            // Emitir evento de muerte al servidor
            if (socket && socket.connected) {
                socket.emit('playerDied', {
                    id: myId,
                    killerId: this.lastDamageFrom
                });
            }
        }

        respawn() {
            this.isDead = false;
            this.health = 100;
            this.x = Math.random() * (canvas.width - 100) + 50;
            this.y = Math.random() * (canvas.height - 100) + 50;
            this.bullets = [];
            this.lastDamageFrom = null;
            playSound('respawn');

            // Emitir evento de respawn
            if (socket && socket.connected) {
                socket.emit('playerRespawn', {
                    id: myId,
                    x: this.x,
                    y: this.y
                });
            }
        }

        update(keys) {
            if (this.isDead) {
                if (Date.now() > this.respawnTime) {
                    this.respawn();
                }
                return;
            }

            // Movimiento normal
            if (keys.ArrowLeft) this.x -= this.speed;
            if (keys.ArrowRight) this.x += this.speed;
            if (keys.ArrowUp) this.y -= this.speed;
            if (keys.ArrowDown) this.y += this.speed;

            // Mantener al jugador dentro del canvas
            this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
            this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));

            // Actualizar balas
            this.bullets = this.bullets.filter(bullet => bullet.update());
        }
    }

    // Nueva clase para las balas
    class Bullet {
        constructor(x, y, angle) {
            this.x = x;
            this.y = y;
            this.speed = 15;
            this.size = 5;
            this.angle = angle;
            this.distance = 0;
            this.maxDistance = 800; // Distancia máxima que recorre la bala
        }

        draw() {
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }

        update() {
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;
            this.distance += this.speed;

            // Verificar si la bala está fuera de los límites
            return this.distance < this.maxDistance &&
                   this.x > 0 && this.x < canvas.width &&
                   this.y > 0 && this.y < canvas.height;
        }
    }

    // Sistema de sonidos
    const sounds = {
        shoot: new Audio('https://assets.mixkit.co/active_storage/sfx/2771/2771-preview.mp3'),
        explosion: new Audio('https://assets.mixkit.co/active_storage/sfx/1234/1234-preview.mp3'),
        respawn: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3')
    };

    function playSound(soundName) {
        if (sounds[soundName]) {
            sounds[soundName].currentTime = 0;
            sounds[soundName].play().catch(e => console.log('Error playing sound:', e));
        }
    }

    // En el evento click del canvas para disparar
    canvas.addEventListener('click', (e) => {
        if (myId && players.has(myId)) {
            const player = players.get(myId);
            if (!player.isDead) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                player.shoot(x, y);

                // Emitir evento de disparo
                socket.emit('playerShoot', { x, y });
            }
        }
    });

    // En el gameLoop, añadir la detección de colisiones
    function checkBulletCollisions() {
        players.forEach((player, playerId) => {
            if (player.isDead) return;

            players.forEach((otherPlayer, otherPlayerId) => {
                if (playerId === otherPlayerId || otherPlayer.isDead) return;

                otherPlayer.bullets.forEach((bullet, bulletIndex) => {
                    const dx = player.x - bullet.x;
                    const dy = player.y - bullet.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < player.size + bullet.size) {
                        player.takeDamage(25, otherPlayerId);
                        otherPlayer.bullets.splice(bulletIndex, 1); // Eliminar la bala

                        if (player.isDead) {
                            otherPlayer.score += 1;
                            updateScoreboard();
                        }
                    }
                });
            });
        });
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
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = false;
        }
    });

    // Manejar entrada de chat
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim() && myId) {
            const message = chatInput.value.trim();
            const myPlayer = players.get(myId);
            
            socket.emit('chatMessage', {
                name: myPlayer.name,
                message: message
            });

            chatInput.value = '';
        }
    });

    // Función para actualizar contador de jugadores
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
        socket = io();

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
                player.score = data.score || 0;
                player.health = data.health;
                player.isDead = data.isDead;
                
                // Actualizar las balas
                player.bullets = data.bullets.map(b => {
                    const bullet = new Bullet(b.x, b.y, 0);
                    bullet.x = b.x;
                    bullet.y = b.y;
                    return bullet;
                });
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

        socket.on('chatMessage', (data) => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message';
            messageDiv.innerHTML = `<span class="player-name">${data.name}:</span> ${data.message}`;
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });

        socket.on('playerDied', (data) => {
            if (players.has(data.id)) {
                const player = players.get(data.id);
                player.isDead = true;
                player.health = 0;
                player.respawnTime = Date.now() + 3000;
        // Iniciar bucle del juego
        gameLoop();
    }

    // Habilitar/deshabilitar botón de jugar según el nombre
    nombreInput.addEventListener('input', () => {
        botonJugar.disabled = nombreInput.value.trim().length < 2;
    });
    botonJugar.disabled = true;

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

        // Actualizar y dibujar jugadores
        if (myId && players.has(myId)) {
            const myPlayer = players.get(myId);
            myPlayer.update(keys);
            
            if (socket && socket.connected) {
                socket.emit('playerMove', {
                    x: myPlayer.x,
                    y: myPlayer.y,
                    name: playerName,
                    score: myPlayer.score,
                    health: myPlayer.health,
                    isDead: myPlayer.isDead,
                    bullets: myPlayer.bullets.map(b => ({x: b.x, y: b.y}))
                });
            }
        }

        checkBulletCollisions();
        players.forEach(player => player.draw());
        requestAnimationFrame(gameLoop);
    }

    // Inicializar anuncios
    window.onload = function() {
        (adsbygoogle = window.adsbygoogle || []).push({});
        (adsbygoogle = window.adsbygoogle || []).push({});
    };
}); 