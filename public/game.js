// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const menuPlataforma = document.getElementById('menuPlataforma');
    const menuInicial = document.getElementById('menuInicial');
    const gameContainer = document.querySelector('.game-container');
    const nombreInput = document.getElementById('nombreJugador');
    const botonJugar = document.getElementById('botonJugar');
    const botonWeb = document.getElementById('botonWeb');
    const botonMovil = document.getElementById('botonMovil');
    const mobileControls = document.getElementById('mobileControls');
    const playerCountElement = document.getElementById('playerCount');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const scoreList = document.getElementById('scoreList');
    const botonRegresar = document.getElementById('botonRegresar');

    // Variables globales
    let socket;
    const players = new Map();
    let myId = null;
    let playerName = '';
    let isMobile = false; // Nueva variable para determinar la plataforma

    // Variables para el joystick
    let joystickActive = false;
    let joystickBase = document.querySelector('.joystick-base');
    let joystickStick = document.querySelector('.joystick-stick');
    let joystickData = { x: 0, y: 0 };

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

    // Agregar después de las variables globales existentes
    const camera = {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        mapWidth: 3000,  // Tamaño del mapa
        mapHeight: 2000
    };

    // Sistema de joysticks para móviles
    const moveJoystick = {
        active: false,
        base: document.querySelector('#moveJoystick .joystick-base'),
        stick: document.querySelector('#moveJoystick .joystick-stick'),
        data: { x: 0, y: 0 }
    };

    const aimJoystick = {
        active: false,
        base: document.querySelector('#aimJoystick .joystick-base'),
        stick: document.querySelector('#aimJoystick .joystick-stick'),
        data: { x: 0, y: 0 }
    };

    // Función para manejar los joysticks
    function handleJoystick(joystick, e) {
        const touch = e.touches[0];
        const rect = joystick.base.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let deltaX = touch.clientX - centerX;
        let deltaY = touch.clientY - centerY;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = rect.width / 2;
        
        if (distance > maxDistance) {
            const angle = Math.atan2(deltaY, deltaX);
            deltaX = Math.cos(angle) * maxDistance;
            deltaY = Math.sin(angle) * maxDistance;
        }
        
        joystick.stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        joystick.data.x = deltaX / maxDistance;
        joystick.data.y = deltaY / maxDistance;

        // Disparo automático con el joystick de apuntado
        if (joystick === aimJoystick && distance > maxDistance * 0.3) {
            if (myId && players.has(myId)) {
                const player = players.get(myId);
                if (!player.isDead) {
                    const angle = Math.atan2(deltaY, deltaX);
                    const targetX = player.x + Math.cos(angle) * 100;
                    const targetY = player.y + Math.sin(angle) * 100;
                    player.shoot(targetX, targetY);
                }
            }
        }
    }

    // Eventos para los joysticks
    moveJoystick.base.addEventListener('touchstart', (e) => {
        moveJoystick.active = true;
        handleJoystick(moveJoystick, e);
    });

    aimJoystick.base.addEventListener('touchstart', (e) => {
        aimJoystick.active = true;
        handleJoystick(aimJoystick, e);
    });

    document.addEventListener('touchmove', (e) => {
        if (moveJoystick.active) {
            handleJoystick(moveJoystick, e);
        }
        if (aimJoystick.active) {
            handleJoystick(aimJoystick, e);
        }
    });

    document.addEventListener('touchend', (e) => {
        if (moveJoystick.active) {
            moveJoystick.active = false;
            moveJoystick.stick.style.transform = 'translate(-50%, -50%)';
            moveJoystick.data = { x: 0, y: 0 };
        }
        if (aimJoystick.active) {
            aimJoystick.active = false;
            aimJoystick.stick.style.transform = 'translate(-50%, -50%)';
            aimJoystick.data = { x: 0, y: 0 };
        }
    });

    // Eventos para la selección de plataforma
    botonWeb.addEventListener('click', () => {
        isMobile = false;
        menuPlataforma.style.display = 'none';
        menuInicial.style.display = 'flex';
    });

    botonMovil.addEventListener('click', () => {
        isMobile = true;
        menuPlataforma.style.display = 'none';
        menuInicial.style.display = 'flex';
        mobileControls.style.display = 'block'; // Mostrar controles móviles
    });

    // Evento para el botón de regresar
    botonRegresar.addEventListener('click', () => {
        menuInicial.style.display = 'none';
        menuPlataforma.style.display = 'flex';
    });

    // Clase Bala
    class Bullet {
        constructor(x, y, angle) {
            this.x = x;
            this.y = y;
            this.speed = 15;
            this.size = 8;
            this.angle = angle;
            this.distance = 0;
            this.maxDistance = 800;
            this.trail = [];
        }

        draw(screenX, screenY) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.lineWidth = 2;
            this.trail.forEach((pos, i) => {
                const alpha = i / this.trail.length;
                ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
                const trailScreenX = pos.x - camera.x;
                const trailScreenY = pos.y - camera.y;
                if (i === 0) {
                    ctx.moveTo(trailScreenX, trailScreenY);
                } else {
                    ctx.lineTo(trailScreenX, trailScreenY);
                }
            });
            ctx.stroke();

            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(screenX, screenY, this.size + 2, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.stroke();
        }

        update() {
            this.trail.push({x: this.x, y: this.y});
            if (this.trail.length > 5) {
                this.trail.shift();
            }

            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;
            this.distance += this.speed;

            // Asegúrate de que las balas se mantengan dentro del mapa
            return this.distance < this.maxDistance &&
                   this.x > 0 && this.x < camera.mapWidth &&
                   this.y > 0 && this.y < camera.mapHeight;
        }
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
            this.bullets = [];
            this.isDead = false;
            this.respawnTime = 0;
            this.lastShot = 0;
            this.health = 100;
            this.lastDamageFrom = null;
            this.avatar = null;
            this.avatarLoaded = false;
        }

        draw() {
            const screenX = this.x - camera.x;
            const screenY = this.y - camera.y;

            if (this.isDead) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.beginPath();
                ctx.arc(screenX, screenY, this.size * (1 + Math.sin(Date.now() / 100)), 0, Math.PI * 2);
                ctx.fill();
                return;
            }

            // Dibujar jugador
            if (this.avatarLoaded && this.avatar) {
                // Dibujar la imagen del avatar
                ctx.save();
                ctx.beginPath();
                ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(this.avatar, screenX - this.size, screenY - this.size, this.size * 2, this.size * 2);
                ctx.restore();
            } else {
                // Dibujar círculo de color por defecto
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2);
                ctx.fill();
            }

            // Barra de vida
            const healthBarWidth = 50;
            const healthBarHeight = 5;
            ctx.fillStyle = 'red';
            ctx.fillRect(screenX - healthBarWidth/2, screenY - this.size - 15, healthBarWidth, healthBarHeight);
            ctx.fillStyle = 'green';
            ctx.fillRect(screenX - healthBarWidth/2, screenY - this.size - 15, healthBarWidth * (this.health/100), healthBarHeight);

            // Nombre y puntuación
            ctx.fillStyle = 'white';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.name} (${this.score})`, screenX, screenY - this.size - 20);

            // Dibujar balas
            this.bullets.forEach(bullet => {
                const bulletScreenX = bullet.x - camera.x;
                const bulletScreenY = bullet.y - camera.y;
                bullet.draw(bulletScreenX, bulletScreenY);
            });
        }

        shoot(targetX, targetY) {
            const now = Date.now();
            if (now - this.lastShot > 250) {
                const angle = Math.atan2(targetY - this.y, targetX - this.x);
                
                this.bullets.push(new Bullet(this.x, this.y, angle));
                this.lastShot = now;
                playSound('shoot');

                this.x -= Math.cos(angle) * 5;
                this.y -= Math.sin(angle) * 5;
            }
        }

        takeDamage(damage, attackerId) {
            this.health -= damage;
            this.lastDamageFrom = attackerId;
            
            if (this.health <= 0 && !this.isDead) {
                this.die();
            }
        }

        die() {
            this.isDead = true;
            this.health = 0;
            this.respawnTime = Date.now() + 3000;
            playSound('explosion');
            
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

            // Movimiento con joystick en móviles
            if (moveJoystick.active) {
                this.x += moveJoystick.data.x * this.speed;
                this.y += moveJoystick.data.y * this.speed;
            } else {
                // Movimiento con teclado en desktop
                if (keys.ArrowLeft || keys.a) this.x -= this.speed;
                if (keys.ArrowRight || keys.d) this.x += this.speed;
                if (keys.ArrowUp || keys.w) this.y -= this.speed;
                if (keys.ArrowDown || keys.s) this.y += this.speed;
            }

            // Limitar al jugador dentro del mapa
            this.x = Math.max(this.size, Math.min(camera.mapWidth - this.size, this.x));
            this.y = Math.max(this.size, Math.min(camera.mapHeight - this.size, this.y));

            this.bullets = this.bullets.filter(bullet => bullet.update());
        }

        setAvatar(imageUrl) {
            const img = new Image();
            img.onload = () => {
                this.avatar = img;
                this.avatarLoaded = true;
            };
            img.src = imageUrl;
        }
    }

    // Configuración del canvas
    function ajustarCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    ajustarCanvas();
    window.addEventListener('resize', ajustarCanvas);

    // Control de teclas
    const keys = {
        ArrowLeft: false,
        ArrowRight: false,
        ArrowUp: false,
        ArrowDown: false,
        a: false,
        d: false,
        w: false,
        s: false
    };

    window.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.key.toLowerCase())) {
            keys[e.key.toLowerCase()] = true;
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key.toLowerCase())) {
            keys[e.key.toLowerCase()] = false;
        }
    });

    // Manejo de disparos
    canvas.addEventListener('click', (e) => {
        if (myId && players.has(myId)) {
            const player = players.get(myId);
            if (!player.isDead) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left + camera.x;
                const y = e.clientY - rect.top + camera.y;
                player.shoot(x, y);

                socket.emit('playerShoot', { x, y });
            }
        }
    });

    // Añadir indicador visual de disparo
    canvas.addEventListener('mousemove', (e) => {
        if (myId && players.has(myId)) {
            const player = players.get(myId);
            if (!player.isDead) {
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // Dibujar línea de mira
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(player.x, player.y);
                ctx.lineTo(mouseX, mouseY);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    });

    // Funciones de actualización
    function updatePlayerCount() {
        playerCountElement.textContent = players.size;
        updateScoreboard();
    }

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
                        ctx.beginPath();
                        ctx.arc(bullet.x, bullet.y, 20, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                        ctx.fill();

                        player.takeDamage(25, otherPlayerId);
                        otherPlayer.bullets.splice(bulletIndex, 1);

                        if (player.isDead) {
                            otherPlayer.score += 1;
                            updateScoreboard();
                        }
                    }
                });
            });
        });
    }

    // Chat
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

    // Iniciar juego
    function startGame() {
        playerName = nombreInput.value.trim();
        const avatarUrl = document.getElementById('avatarPreview').src;
        
        menuInicial.style.display = 'none';
        gameContainer.style.display = 'block';
        
        socket = io();

        socket.on('connect', () => {
            console.log('¡Conectado al servidor!');
        });

        socket.on('init', (data) => {
            myId = data.id;
            const newPlayer = new Player(
                Math.random() * (canvas.width - 100) + 50,
                Math.random() * (canvas.height - 100) + 50,
                `hsl(${Math.random() * 360}, 70%, 50%)`,
                playerName
            );
            newPlayer.setAvatar(avatarUrl);
            players.set(myId, newPlayer);
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
                
                if (data.avatarUrl && !player.avatarLoaded) {
                    player.setAvatar(data.avatarUrl);
                }
                
                player.bullets = data.bullets.map(b => {
                    const bullet = new Bullet(b.x, b.y, 0);
                    bullet.x = b.x;
                    bullet.y = b.y;
                    return bullet;
                });
            } else {
                const newPlayer = new Player(
                    data.x,
                    data.y,
                    `hsl(${Math.random() * 360}, 70%, 50%)`,
                    data.name || 'Jugador'
                );
                if (data.avatarUrl) {
                    newPlayer.setAvatar(data.avatarUrl);
                }
                players.set(data.id, newPlayer);
                updatePlayerCount();
            }
        });

        socket.on('playerDied', (data) => {
            if (players.has(data.id)) {
                const player = players.get(data.id);
                player.isDead = true;
                player.health = 0;
                player.respawnTime = Date.now() + 3000;
                
                if (data.killerId === myId) {
                    const myPlayer = players.get(myId);
                    myPlayer.score += 1;
                    updateScoreboard();
                }
            }
        });

        socket.on('playerRespawn', (data) => {
            if (players.has(data.id)) {
                const player = players.get(data.id);
                player.isDead = false;
                player.health = 100;
                player.x = data.x;
                player.y = data.y;
                player.bullets = [];
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

        gameLoop();
    }

    // Game Loop
    function gameLoop() {
        // Actualizar posición de la cámara
        if (myId && players.has(myId)) {
            const player = players.get(myId);
            camera.x = player.x - canvas.width / 2;
            camera.y = player.y - canvas.height / 2;

            // Limitar la cámara a los bordes del mapa
            camera.x = Math.max(0, Math.min(camera.x, camera.mapWidth - canvas.width));
            camera.y = Math.max(0, Math.min(camera.y, camera.mapHeight - canvas.height));
        }

        // Limpiar canvas
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Dibujar cuadrícula del mapa
        drawMapGrid();

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
                    bullets: myPlayer.bullets.map(b => ({x: b.x, y: b.y})),
                    avatarUrl: document.getElementById('avatarPreview').src
                });
            }
        }

        checkBulletCollisions();
        players.forEach(player => player.draw());
        requestAnimationFrame(gameLoop);
    }

    // Función para dibujar la cuadrícula del mapa
    function drawMapGrid() {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        const gridSize = 100;
        const startX = -camera.x % gridSize;
        const startY = -camera.y % gridSize;

        for (let x = startX; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        for (let y = startY; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Dibujar bordes del mapa
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 5;
        ctx.strokeRect(-camera.x, -camera.y, camera.mapWidth, camera.mapHeight);
    }

    // Eventos del menú inicial
    nombreInput.addEventListener('input', () => {
        botonJugar.disabled = nombreInput.value.trim().length < 2;
    });
    botonJugar.disabled = true;

    botonJugar.addEventListener('click', startGame);
    nombreInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !botonJugar.disabled) {
            startGame();
        }
    });

    document.addEventListener('keydown', (event) => {
        switch(event.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                // Mover arriba
                player.moveUp();
                break;
            case 's':
            case 'arrowdown':
                // Mover abajo
                player.moveDown();
                break;
            case 'a':
            case 'arrowleft':
                // Mover izquierda
                player.moveLeft();
                break;
            case 'd':
            case 'arrowright':
                // Mover derecha
                player.moveRight();
                break;
        }
    });

    // Manejo de la previsualización del avatar
    document.getElementById('playerAvatar').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('avatarPreview').src = e.target.result;
                // Guardar la imagen para usarla en el juego
                playerAvatar = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Modificar la creación del jugador para usar el avatar personalizado
    function createPlayer(name) {
        const player = {
            name: name,
            avatar: playerAvatar || 'default-avatar.png',
            // ... resto de las propiedades del jugador ...
        };
        return player;
    }
}); 