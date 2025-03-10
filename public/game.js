// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const menuInicial = document.getElementById('menuInicial');
    const gameContainer = document.querySelector('.game-container');
    const nombreInput = document.getElementById('nombreJugador');
    const botonJugar = document.getElementById('botonJugar');
    const mobileControls = document.getElementById('mobileControls');
    const playerCountElement = document.getElementById('playerCount');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreList = document.getElementById('scoreList');

    // Variables para el control del juego
    let isWindowActive = true;
    let pressedKeys = new Set();

    // Manejar cambio de foco de ventana
    window.addEventListener('blur', () => {
        isWindowActive = false;
        // Limpiar teclas presionadas cuando se pierde el foco
        pressedKeys.clear();
    });

    window.addEventListener('focus', () => {
        isWindowActive = true;
    });

    // Nuevo sistema de manejo de teclas
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (keysToPrevent.includes(key) && gameContainer.style.display !== 'none') {
            e.preventDefault();
            pressedKeys.add(key);
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        pressedKeys.delete(key);
    });

    // Función para verificar si una tecla está presionada
    function isKeyPressed(key) {
        return isWindowActive && pressedKeys.has(key.toLowerCase());
    }

    // Prevenir comportamientos por defecto del navegador
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Prevenir scroll y otros comportamientos al presionar teclas
    const keysToPrevent = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd'];

    // Mantener el foco en el juego
    gameContainer.addEventListener('click', () => {
        gameContainer.focus();
    });

    // Prevenir arrastre de imágenes
    document.addEventListener('dragstart', (e) => {
        if (gameContainer.style.display !== 'none') {
            e.preventDefault();
        }
    });

    // Prevenir selección de texto
    document.addEventListener('selectstart', (e) => {
        if (gameContainer.style.display !== 'none') {
            e.preventDefault();
        }
    });

    // Variables globales
    let socket;
    const players = new Map();
    let myId = null;
    let playerName = '';
    let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let lastEmitTime = 0; // Añadido para evitar error en gameLoop

    // Variables para control de latencia
    let lastServerTime = 0;
    let serverTimeOffset = 0;
    let clientPredictions = new Map();

    // Mostrar controles móviles si es un dispositivo móvil
    if (isMobile) {
        mobileControls.style.display = 'block';
    }

    // Sistema de sonidos
    const sounds = {
        shoot: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
        explosion: new Audio('https://assets.mixkit.co/active_storage/sfx/1997/1997-preview.mp3'),
        respawn: new Audio('https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3'),
        powerUp: new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'),
        killStreak: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
        backgroundMusic: new Audio('https://assets.mixkit.co/active_storage/sfx/2666/2666-preview.mp3')
    };

    // Configurar volúmenes de sonido
    sounds.backgroundMusic.loop = true;
    sounds.backgroundMusic.volume = 0.2;
    sounds.shoot.volume = 0.3;
    sounds.explosion.volume = 0.4;
    sounds.respawn.volume = 0.4;
    sounds.powerUp.volume = 0.4;
    sounds.killStreak.volume = 0.5;

    function playSound(soundName) {
        if (sounds[soundName]) {
            if (soundName === 'backgroundMusic') {
                sounds[soundName].play().catch(e => console.log('Error playing background music:', e));
            } else {
                sounds[soundName].currentTime = 0;
                sounds[soundName].play().catch(e => console.log('Error playing sound:', e));
            }
        }
    }

    // Función para detener la música de fondo
    function stopBackgroundMusic() {
        if (sounds.backgroundMusic) {
            sounds.backgroundMusic.pause();
            sounds.backgroundMusic.currentTime = 0;
        }
    }

    // Iniciar música de fondo cuando comienza el juego
    function startBackgroundMusic() {
        playSound('backgroundMusic');
    }

    const camera = {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        mapWidth: 3000,
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
    if (isMobile) {
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

        document.addEventListener('touchend', () => {
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
    }

    // Constantes del juego
    const GAME_CONSTANTS = {
        PLAYER_SPEED: 6,
        PLAYER_SIZE: 35,
        BULLET_SPEED: 25,
        BULLET_SIZE: 10,
        BULLET_DAMAGE: 25,
        PLAYER_MAX_HEALTH: 100,
        POWER_DURATION: 15000,
        POWER_SPAWN_INTERVAL: 10000,
        SYNC_RATE: 16,
        INTERPOLATION_DELAY: 50,
        SHOT_COOLDOWN: 300,
        MAX_LATENCY_COMPENSATION: 100
    };

    // Sistema de poderes
    const POWERS = {
        SPEED: {
            name: 'Velocidad',
            color: '#00ff00',
            apply: (player) => {
                player.speed = GAME_CONSTANTS.PLAYER_SPEED * 1.7;
            },
            remove: (player) => {
                player.speed = GAME_CONSTANTS.PLAYER_SPEED;
            }
        },
        SHIELD: {
            name: 'Escudo',
            color: '#0000ff',
            apply: (player) => {
                player.hasShield = true;
                player.health = Math.min(player.health + 25, GAME_CONSTANTS.PLAYER_MAX_HEALTH);
            },
            remove: (player) => {
                player.hasShield = false;
            }
        },
        DAMAGE: {
            name: 'Daño x2',
            color: '#ff0000',
            apply: (player) => {
                player.damageMultiplier = 1.75;
            },
            remove: (player) => {
                player.damageMultiplier = 1;
            }
        }
    };

    // Clase Bala
    class Bullet {
        constructor(x, y, angle) {
            this.x = x;
            this.y = y;
            this.speed = GAME_CONSTANTS.BULLET_SPEED;
            this.size = GAME_CONSTANTS.BULLET_SIZE;
            this.angle = angle;
            this.distance = 0;
            this.maxDistance = 1500;
            this.trail = [];
            this.damage = GAME_CONSTANTS.BULLET_DAMAGE;
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

        update(deltaTime = 16.67) {
            this.trail.push({x: this.x, y: this.y});
            if (this.trail.length > 5) {
                this.trail.shift();
            }

            // Normalizar la velocidad de la bala basada en deltaTime
            const normalizedSpeed = (this.speed * deltaTime) / 16.67;
            this.x += Math.cos(this.angle) * normalizedSpeed;
            this.y += Math.sin(this.angle) * normalizedSpeed;
            this.distance += normalizedSpeed;

            return this.distance < this.maxDistance &&
                   this.x > 0 && this.x < camera.mapWidth &&
                   this.y > 0 && this.y < camera.mapHeight;
        }
    }

    // Clase Power Up
    class PowerUp {
        constructor(x, y, type) {
            this.x = x;
            this.y = y;
            this.type = type;
            this.size = 20;
            this.collected = false;
        }

        draw() {
            if (this.collected) return;
            
            const screenX = this.x - camera.x;
            const screenY = this.y - camera.y;

            ctx.beginPath();
            ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.type.color;
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.type.name, screenX, screenY - this.size - 5);
        }

        checkCollision(player) {
            if (this.collected) return false;
            
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < player.size + this.size) {
                playSound('powerUp');
                return true;
            }
            return false;
        }
    }

    const activePowerUps = [];
    function spawnPowerUp() {
        const types = Object.values(POWERS);
        const randomType = types[Math.floor(Math.random() * types.length)];
        const x = Math.random() * (camera.mapWidth - 100) + 50;
        const y = Math.random() * (camera.mapHeight - 100) + 50;
        
        activePowerUps.push(new PowerUp(x, y, randomType));
    }
    setInterval(spawnPowerUp, GAME_CONSTANTS.POWER_SPAWN_INTERVAL);

    // Clase Obstacle
    class Obstacle {
        constructor(x, y, width, height, type = 'box') {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.type = type;
            this.color = '#555555';
            this.health = 100;
            this.maxHealth = 100;
            this.isDestructible = false;
        }

        draw() {
            const screenX = this.x - camera.x;
            const screenY = this.y - camera.y;

            ctx.fillStyle = this.color;
            if (this.type === 'box') {
                ctx.fillRect(screenX, screenY, this.width, this.height);
                
                // Efecto de sombreado
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.fillRect(screenX + 5, screenY + 5, this.width, this.height);
                
                // Borde
                ctx.strokeStyle = '#666666';
                ctx.lineWidth = 2;
                ctx.strokeRect(screenX, screenY, this.width, this.height);
            } else if (this.type === 'circle') {
                ctx.beginPath();
                ctx.arc(screenX + this.width/2, screenY + this.height/2, this.width/2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            // Dibujar barra de vida si es destructible
            if (this.isDestructible && this.health < this.maxHealth) {
                const healthBarWidth = this.width;
                const healthBarHeight = 5;
                ctx.fillStyle = 'red';
                ctx.fillRect(screenX, screenY - 10, healthBarWidth, healthBarHeight);
                ctx.fillStyle = 'green';
                ctx.fillRect(screenX, screenY - 10, healthBarWidth * (this.health/this.maxHealth), healthBarHeight);
            }
        }

        checkCollision(x, y, radius) {
            if (this.type === 'box') {
                // Encontrar el punto más cercano del rectángulo al círculo
                const closestX = Math.max(this.x, Math.min(x, this.x + this.width));
                const closestY = Math.max(this.y, Math.min(y, this.y + this.height));
                
                // Calcular la distancia entre el círculo y el punto más cercano
                const distanceX = x - closestX;
                const distanceY = y - closestY;
                
                return (distanceX * distanceX + distanceY * distanceY) < (radius * radius);
            } else if (this.type === 'circle') {
                const centerX = this.x + this.width/2;
                const centerY = this.y + this.height/2;
                const dx = x - centerX;
                const dy = y - centerY;
                return (dx * dx + dy * dy) < Math.pow(this.width/2 + radius, 2);
            }
            return false;
        }

        takeDamage(damage) {
            if (this.isDestructible) {
                this.health = Math.max(0, this.health - damage);
                return this.health <= 0;
            }
            return false;
        }
    }

    // Lista de obstáculos
    const obstacles = [];

    // Función para generar obstáculos
    function generateObstacles() {
        // Limpiar obstáculos existentes
        obstacles.length = 0;
        
        // Generar obstáculos fijos (cajas grandes indestructibles)
        const fixedObstacles = [
            { x: 500, y: 500, w: 200, h: 50 },
            { x: 2000, y: 1000, w: 200, h: 50 },
            { x: 1000, y: 1500, w: 50, h: 200 },
            { x: 1500, y: 800, w: 50, h: 200 }
        ];

        fixedObstacles.forEach(obs => {
            const obstacle = new Obstacle(obs.x, obs.y, obs.w, obs.h, 'box');
            obstacle.color = '#444444';
            obstacles.push(obstacle);
        });

        // Generar obstáculos destructibles aleatorios
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * (camera.mapWidth - 100) + 50;
            const y = Math.random() * (camera.mapHeight - 100) + 50;
            const size = Math.random() * 30 + 30;
            
            const obstacle = new Obstacle(x, y, size, size, 
                Math.random() > 0.5 ? 'box' : 'circle');
            obstacle.isDestructible = true;
            obstacle.color = '#666666';
            obstacles.push(obstacle);
        }
    }

    // Clase Jugador
    class Player {
        constructor(x, y, color, name) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.name = name;
            this.size = GAME_CONSTANTS.PLAYER_SIZE;
            this.speed = GAME_CONSTANTS.PLAYER_SPEED;
            this.score = 0;
            this.bullets = [];
            this.isDead = false;
            this.respawnTime = 0;
            this.lastShot = 0;
            this.health = GAME_CONSTANTS.PLAYER_MAX_HEALTH;
            this.lastDamageFrom = null;
            this.avatar = null;
            this.avatarLoaded = false;
            this.avatarUrl = null;
            this._lastSentAvatarUrl = null;
            this.activePowers = new Map();
            this.hasShield = false;
            this.damageMultiplier = 1;
            this.baseSpeed = GAME_CONSTANTS.PLAYER_SPEED;
            this.killStreak = 0;
            this.lastUpdate = null;
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

            if (this.avatarLoaded && this.avatar) {
                try {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(this.avatar, screenX - this.size, screenY - this.size, this.size * 2, this.size * 2);
                    ctx.restore();
                } catch (error) {
                    console.error('Error al dibujar avatar:', error);
                }
            } else {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2);
                ctx.fill();
            }

            const healthBarWidth = 50;
            const healthBarHeight = 5;
            ctx.fillStyle = 'red';
            ctx.fillRect(screenX - healthBarWidth/2, screenY - this.size - 15, healthBarWidth, healthBarHeight);
            ctx.fillStyle = 'green';
            ctx.fillRect(screenX - healthBarWidth/2, screenY - this.size - 15, healthBarWidth * (this.health/100), healthBarHeight);

            ctx.fillStyle = 'white';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            let scoreText = `${this.name} (${this.score})`;
            if (this.killStreak >= 3) {
                scoreText += ` 🔥${this.killStreak}`;
            }
            ctx.fillText(scoreText, screenX, screenY - this.size - 20);

            this.bullets.forEach(bullet => {
                const bulletScreenX = bullet.x - camera.x;
                const bulletScreenY = bullet.y - camera.y;
                bullet.draw(bulletScreenX, bulletScreenY);
            });

            if (this.hasShield) {
                ctx.beginPath();
                ctx.arc(screenX, screenY, this.size + 5, 0, Math.PI * 2);
                ctx.strokeStyle = POWERS.SHIELD.color;
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            if (this.damageMultiplier > 1) {
                ctx.beginPath();
                ctx.arc(screenX, screenY, this.size + 2, 0, Math.PI * 2);
                ctx.strokeStyle = POWERS.DAMAGE.color;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            if (this.speed > this.baseSpeed) {
                ctx.beginPath();
                ctx.arc(screenX, screenY, this.size + 8, 0, Math.PI * 2);
                ctx.strokeStyle = POWERS.SPEED.color;
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.setLineDash([]);
            }
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
            if (this.isDead) return;
            if (this.hasShield) damage *= 0.5;
            this.health = Math.max(0, this.health - damage);
            this.lastDamageFrom = attackerId;
            if (this.health <= 0) this.die();
        }

        die() {
            if (this.isDead) return;
            this.isDead = true;
            this.health = 0;
            this.respawnTime = Date.now() + 3000;
            this.bullets = [];
            playSound('explosion');
            if (socket && socket.connected && myId === this.id) {
                socket.emit('playerDied', { id: myId, killerId: this.lastDamageFrom });
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
                socket.emit('playerRespawn', { id: myId, x: this.x, y: this.y });
            }
        }

        update(keys) {
            if (this.isDead) {
                if (Date.now() > this.respawnTime) this.respawn();
                return;
            }

            const now = Date.now();
            const deltaTime = Math.min(16.67, now - (this.lastUpdate || now));
            this.lastUpdate = now;

            let dx = 0;
            let dy = 0;

            if (moveJoystick.active) {
                dx = moveJoystick.data.x * this.speed;
                dy = moveJoystick.data.y * this.speed;
            } else {
                if (isKeyPressed('ArrowLeft') || isKeyPressed('a')) dx -= this.speed;
                if (isKeyPressed('ArrowRight') || isKeyPressed('d')) dx += this.speed;
                if (isKeyPressed('ArrowUp') || isKeyPressed('w')) dy -= this.speed;
                if (isKeyPressed('ArrowDown') || isKeyPressed('s')) dy += this.speed;
            }

            if (dx !== 0 && dy !== 0) {
                const factor = 1 / Math.sqrt(2);
                dx *= factor;
                dy *= factor;
            }

            const moveSpeed = (this.speed * deltaTime) / 16.67;
            dx = dx * moveSpeed / this.speed;
            dy = dy * moveSpeed / this.speed;

            // Comprobar colisiones con obstáculos antes de mover
            const newX = this.x + dx;
            const newY = this.y + dy;
            
            let canMoveX = true;
            let canMoveY = true;

            obstacles.forEach(obstacle => {
                if (obstacle.checkCollision(newX, this.y, this.size)) {
                    canMoveX = false;
                }
                if (obstacle.checkCollision(this.x, newY, this.size)) {
                    canMoveY = false;
                }
            });

            if (canMoveX) this.x = newX;
            if (canMoveY) this.y = newY;

            // Mantener dentro de los límites del mapa
            this.x = Math.max(this.size, Math.min(camera.mapWidth - this.size, this.x));
            this.y = Math.max(this.size, Math.min(camera.mapHeight - this.size, this.y));

            // Actualizar balas
            this.bullets = this.bullets.filter(bullet => bullet.update(deltaTime));
        }

        setAvatar(imageUrl) {
            if (!imageUrl || imageUrl === this.avatarUrl) return;
            
            this.avatarUrl = imageUrl;
            this.avatarLoaded = false; // Reset loaded state
            
            const img = new Image();
            
            img.onload = () => {
                console.log('Avatar cargado correctamente');
                this.avatar = img;
                this.avatarLoaded = true;
            };
            
            img.onerror = (error) => {
                console.error('Error al cargar el avatar:', error);
                this.avatarLoaded = false;
                this.avatar = null;
            };
            
            // Asegurarse de que la URL sea válida
            try {
                const url = new URL(imageUrl);
                img.src = url.toString();
            } catch (e) {
                console.error('URL de avatar inválida:', e);
                img.src = imageUrl; // Intentar cargar de todos modos si es una URL relativa
            }
        }

        applyPower(powerType) {
            if (this.activePowers.has(powerType)) clearTimeout(this.activePowers.get(powerType));
            powerType.apply(this);
            const timeoutId = setTimeout(() => {
                powerType.remove(this);
                this.activePowers.delete(powerType);
            }, GAME_CONSTANTS.POWER_DURATION);
            this.activePowers.set(powerType, timeoutId);
        }
    }

    function ajustarCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    ajustarCanvas();
    window.addEventListener('resize', ajustarCanvas);

    const keys = {
        ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false,
        a: false, d: false, w: false, s: false
    };

    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key) && document.activeElement.tagName !== 'INPUT') {
            keys[key] = true;
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) keys[key] = false;
    });

    let isMouseDown = false;
    let lastAutoShot = 0;
    const AUTO_SHOT_DELAY = 250;
    let mouseX = 0;
    let mouseY = 0;

    canvas.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        handleShot(e);
    });

    canvas.addEventListener('mouseup', () => {
        isMouseDown = false;
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        if (isMouseDown) handleShot(e);
        if (myId && players.has(myId)) {
            const player = players.get(myId);
            if (!player.isDead) {
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(player.x - camera.x, player.y - camera.y);
                ctx.lineTo(mouseX, mouseY);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    });

    function handleShot(e) {
        if (myId && players.has(myId)) {
            const player = players.get(myId);
            const now = Date.now();
            const serverTime = now + serverTimeOffset;

            if (!player.isDead && now - lastAutoShot >= GAME_CONSTANTS.SHOT_COOLDOWN) {
                const x = mouseX + camera.x;
                const y = mouseY + camera.y;
                
                // Predicción del cliente
                player.shoot(x, y);
                
                // Guardar la predicción
                const shotId = now.toString();
                clientPredictions.set(shotId, {
                    time: now,
                    x: x,
                    y: y
                });

                // Enviar al servidor con timestamp
                socket.emit('playerShoot', {
                    x: x,
                    y: y,
                    timestamp: serverTime,
                    shotId: shotId
                });

                lastAutoShot = now;
            }
        }
    }

    function updatePlayerCount() {
        playerCountElement.textContent = players.size;
        updateScoreboard();
    }

    function updateScoreboard() {
        const scores = Array.from(players.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
        scoreList.innerHTML = scores
            .map((player, index) => `<div class="score-item">${index + 1}. ${player.name}: ${player.score}</div>`)
            .join('');
    }

    function checkBulletCollisions() {
        players.forEach((player, playerId) => {
            if (player.isDead) return;
            
            // Revisar colisiones con obstáculos
            obstacles.forEach((obstacle, obstacleIndex) => {
                player.bullets.forEach((bullet, bulletIndex) => {
                    if (obstacle.checkCollision(bullet.x, bullet.y, bullet.size)) {
                        player.bullets.splice(bulletIndex, 1);
                        
                        if (obstacle.isDestructible) {
                            const destroyed = obstacle.takeDamage(bullet.damage);
                            if (destroyed) {
                                obstacles.splice(obstacleIndex, 1);
                                // Efecto de explosión
                                createExplosion(obstacle.x + obstacle.width/2, obstacle.y + obstacle.height/2);
                            }
                        }
                    }
                });
            });

            // Revisar colisiones con otros jugadores
            players.forEach((otherPlayer, otherPlayerId) => {
                if (playerId === otherPlayerId || otherPlayer.isDead) return;
                
                const bulletsToRemove = [];
                player.bullets.forEach((bullet, bulletIndex) => {
                    const dx = otherPlayer.x - bullet.x;
                    const dy = otherPlayer.y - bullet.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < otherPlayer.size + bullet.size) {
                        bulletsToRemove.push(bulletIndex);
                        let finalDamage = GAME_CONSTANTS.BULLET_DAMAGE;
                        if (player.damageMultiplier > 1) finalDamage *= player.damageMultiplier;
                        otherPlayer.takeDamage(finalDamage, playerId);
                        
                        if (socket && socket.connected && playerId === myId) {
                            socket.emit('bulletHit', {
                                targetId: otherPlayerId,
                                damage: finalDamage,
                                shooterId: myId,
                                targetHealth: otherPlayer.health
                            });
                        }
                    }
                });
                
                bulletsToRemove.reverse().forEach(index => player.bullets.splice(index, 1));
            });
        });
    }

    function createExplosion(x, y) {
        ctx.beginPath();
        ctx.arc(x - camera.x, y - camera.y, 30, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 100, 0, 0.6)';
        ctx.fill();
    }

    function startGame() {
        playerName = nombreInput.value.trim();
        const avatarUrl = document.getElementById('avatarPreview').src;
        
        menuInicial.style.display = 'none';
        gameContainer.style.display = 'block';
        startBackgroundMusic();
        
        if (socket) socket.disconnect();
        
        const isProduction = window.location.hostname !== 'localhost';
        const serverUrl = isProduction ? 'https://multiplayer-web-game-063s.onrender.com' : 'http://localhost:3000';
        
        socket = io(serverUrl, {
            transports: ['websocket'],
            upgrade: false,
            cors: { origin: "https://multiplayer-web-game.vercel.app", methods: ["GET", "POST"] }
        });

        socket.on('connect', () => {
            console.log('¡Conectado al servidor!');
            // Inicializar jugador después de la conexión
            if (myId && players.has(myId)) {
                const player = players.get(myId);
                if (avatarUrl) {
                    player.setAvatar(avatarUrl);
                }
            }
        });

        socket.on('init', (data) => {
            myId = data.id;
            const newPlayer = new Player(
                Math.random() * (camera.mapWidth - 200) + 100,
                Math.random() * (camera.mapHeight - 200) + 100,
                `hsl(${Math.random() * 360}, 70%, 50%)`,
                playerName
            );
            
            // Asegurarse de que el avatar se cargue
            if (avatarUrl) {
                newPlayer.setAvatar(avatarUrl);
            }
            
            players.set(myId, newPlayer);
    
            if (data.players) {
                data.players.forEach(playerData => {
                    if (playerData.id !== myId) {
                        const player = new Player(
                            playerData.x, 
                            playerData.y, 
                            `hsl(${Math.random() * 360}, 70%, 50%)`, 
                            playerData.name
                        );
                        if (playerData.avatarUrl) {
                            player.setAvatar(playerData.avatarUrl);
                        }
                        player.score = playerData.score || 0;
                        player.health = playerData.health;
                        player.isDead = playerData.isDead;
                        players.set(playerData.id, player);
                    }
                });
            }
            updatePlayerCount();
        });
    
        socket.on('playerMoved', (data) => {
            if (players.has(data.id)) {
                const player = players.get(data.id);
                interpolatePosition(player, data);
                player.score = data.score || player.score || 0;
                player.health = data.health;
                player.isDead = data.isDead;
                player.killStreak = data.killStreak || 0;
                
                if (data.powers) {
                    player.hasShield = data.powers.hasShield;
                    player.damageMultiplier = data.powers.damageMultiplier;
                    player.speed = data.powers.speed;
                }
                
                if (data.avatarUrl && !player.avatarLoaded) {
                    player.setAvatar(data.avatarUrl);
                }
                
                // Actualizar las balas con interpolación
                if (data.bullets && data.bullets.length > 0) {
                    player.bullets = data.bullets.map(b => {
                        const bullet = new Bullet(b.x, b.y, b.angle || 0);
                        bullet.x = b.x;
                        bullet.y = b.y;
                        return bullet;
                    });
                }
                
                updateScoreboard();
            } else {
                const newPlayer = new Player(data.x, data.y, `hsl(${Math.random() * 360}, 70%, 50%)`, data.name || 'Jugador');
                if (data.avatarUrl) newPlayer.setAvatar(data.avatarUrl);
                newPlayer.score = data.score || 0;
                newPlayer.health = data.health;
                newPlayer.isDead = data.isDead;
                newPlayer.killStreak = data.killStreak || 0;
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
                player.bullets = [];
                player.killStreak = 0; // Resetear racha al morir
                
                // Actualizar el puntaje y racha del asesino desde el servidor
                if (data.killerId && players.has(data.killerId)) {
                    const killer = players.get(data.killerId);
                    killer.score = data.killerScore || killer.score + 2; // Asegurar que se actualice el puntaje
                    killer.killStreak = data.killStreak || 1;
                    
                    // Mostrar mensaje de racha si es 3 o más
                    if (killer.killStreak >= 3) {
                        const killMessage = document.createElement('div');
                        killMessage.className = 'kill-streak-message';
                        killMessage.textContent = `¡${killer.name} está en racha! (${killer.killStreak} muertes)`;
                        document.body.appendChild(killMessage);
                        setTimeout(() => killMessage.remove(), 3000);
                        playSound('killStreak');
                    }
                    
                    updateScoreboard(); // Actualizar el marcador inmediatamente
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
    
        socket.on('bulletHit', (data) => {
            if (players.has(data.targetId)) {
                const player = players.get(data.targetId);
                player.health = data.targetHealth;
                if (player.health <= 0 && !player.isDead) {
                    player.die();
                }
            }
        });
    
        socket.on('serverTime', (data) => {
            const now = Date.now();
            serverTimeOffset = data.serverTime - now;
            lastServerTime = data.serverTime;
        });

        socket.on('shotValidation', (data) => {
            if (clientPredictions.has(data.shotId)) {
                const prediction = clientPredictions.get(data.shotId);
                const latency = Date.now() - prediction.time;
                
                // Ajustar la compensación de latencia si es necesario
                if (latency > GAME_CONSTANTS.MAX_LATENCY_COMPENSATION) {
                    console.log('Alta latencia detectada:', latency, 'ms');
                }
                
                clientPredictions.delete(data.shotId);
            }
        });

        generateObstacles();
        gameLoop();
    }

    function emitPlayerData(player) {
        if (socket && socket.connected) {
            const now = Date.now();
            const minimalData = {
                timestamp: now,
                x: Math.round(player.x),
                y: Math.round(player.y),
                name: player.name,
                score: player.score || 0,
                health: player.health,
                isDead: player.isDead,
                bullets: player.bullets.map(b => ({
                    x: Math.round(b.x),
                    y: Math.round(b.y),
                    angle: b.angle,
                    damage: b.damage
                })).slice(-5),
                powers: {
                    hasShield: player.hasShield,
                    damageMultiplier: player.damageMultiplier,
                    speed: player.speed
                },
                killStreak: player.killStreak || 0
            };
            
            if (player.avatarUrl !== player._lastSentAvatarUrl) {
                minimalData.avatarUrl = player.avatarUrl;
                player._lastSentAvatarUrl = player.avatarUrl;
            }
            
            socket.emit('playerMove', minimalData);
        }
    }

    function interpolatePosition(player, newData) {
        const timestamp = Date.now();
        player.targetX = newData.x;
        player.targetY = newData.y;
        player.startX = player.x;
        player.startY = player.y;
        player.interpolationStart = timestamp;
        player.interpolationEnd = timestamp + GAME_CONSTANTS.INTERPOLATION_DELAY;
    }

    function updatePlayerPositions() {
        const now = Date.now();
        players.forEach(player => {
            if (player.interpolationStart && player.interpolationEnd) {
                const progress = (now - player.interpolationStart) / (player.interpolationEnd - player.interpolationStart);
                if (progress <= 1) {
                    player.x = player.startX + (player.targetX - player.startX) * progress;
                    player.y = player.startY + (player.targetY - player.startY) * progress;
                }
            }
        });
    }

    function gameLoop() {
        if (myId && players.has(myId)) {
            const myPlayer = players.get(myId);
            myPlayer.update(keys);
            
            // Añadir disparo automático mientras se mantiene presionado el mouse
            if (isMouseDown) {
                handleShot({ clientX: mouseX, clientY: mouseY });
            }
            
            activePowerUps.forEach((powerUp, index) => {
                if (!powerUp.collected && powerUp.checkCollision(myPlayer)) {
                    powerUp.collected = true;
                    myPlayer.applyPower(powerUp.type);
                    activePowerUps.splice(index, 1);
                    if (socket && socket.connected) {
                        socket.emit('powerUpCollected', { id: myId, powerType: powerUp.type.name });
                    }
                }
            });
            
            const now = Date.now();
            if (now - lastEmitTime >= GAME_CONSTANTS.SYNC_RATE) {
                emitPlayerData(myPlayer);
                lastEmitTime = now;
            }
            
            camera.x = myPlayer.x - canvas.width / 2;
            camera.y = myPlayer.y - canvas.height / 2;
            camera.x = Math.max(0, Math.min(camera.x, camera.mapWidth - canvas.width));
            camera.y = Math.max(0, Math.min(camera.y, camera.mapHeight - canvas.height));
        }

        updatePlayerPositions();

        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawMapGrid();
        
        // Dibujar obstáculos
        obstacles.forEach(obstacle => obstacle.draw());
        
        checkBulletCollisions();
        players.forEach(player => player.draw());
        activePowerUps.forEach(powerUp => powerUp.draw());
        
        requestAnimationFrame(gameLoop);
    }

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

        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 5;
        ctx.strokeRect(-camera.x, -camera.y, camera.mapWidth, camera.mapHeight);
    }

    // Eventos del menú inicial
    nombreInput.addEventListener('input', () => {
        botonJugar.disabled = nombreInput.value.trim().length < 2;
    });
    botonJugar.disabled = true;

    document.addEventListener('DOMContentLoaded', () => {
        const botonJugar = document.getElementById('botonJugar');
        if (botonJugar) {
            botonJugar.addEventListener('click', () => {
                const menuInicial = document.getElementById('menuInicial');
                if (menuInicial) menuInicial.style.display = 'none';

                if (selectedVersion === '3d') {
                    const game3dContainer = document.getElementById('game3d');
                    const game2dContainer = document.getElementById('game2d');
                    if (game3dContainer) game3dContainer.style.display = 'block';
                    if (game2dContainer) game2dContainer.style.display = 'none';
                    if (typeof init === 'function') init(); // Función de inicio del juego 3D
                } else {
                    const game2dContainer = document.getElementById('game2d');
                    const game3dContainer = document.getElementById('game3d');
                    if (game2dContainer) game2dContainer.style.display = 'block';
                    if (game3dContainer) game3dContainer.style.display = 'none';
                    if (typeof startGame === 'function') startGame(); // Función de inicio del juego 2D
                }
            });
        } else {
            console.warn("Elemento 'botonJugar' no encontrado en el DOM");
        }
    });

    document.getElementById('playerAvatar').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Verificar el tipo de archivo
            if (!file.type.startsWith('image/')) {
                alert('Por favor, selecciona solo archivos de imagen.');
                return;
            }

            // Verificar el tamaño (máximo 15MB)
            const MAX_SIZE_MB = 15;
            if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                alert(`La imagen es demasiado grande. El tamaño máximo es ${MAX_SIZE_MB}MB.`);
                return;
            }

            // Advertencia para archivos grandes
            if (file.size > 5 * 1024 * 1024) {
                if (!confirm('Has seleccionado una imagen grande que podría afectar el rendimiento del juego. ¿Deseas continuar?')) {
                    return;
                }
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                // Si es un GIF, verificar dimensiones antes de usar
                if (file.type === 'image/gif') {
                    const img = new Image();
                    img.onload = function() {
                        // Si el GIF es muy grande, redimensionar el elemento que lo muestra
                        const MAX_DISPLAY_SIZE = 100;
                        document.getElementById('avatarPreview').style.width = MAX_DISPLAY_SIZE + 'px';
                        document.getElementById('avatarPreview').style.height = MAX_DISPLAY_SIZE + 'px';
                        document.getElementById('avatarPreview').src = e.target.result;
                    };
                    img.src = e.target.result;
                    return;
                }

                // Para otros tipos de imagen, optimizar
                const img = new Image();
                img.onload = function() {
                    // Crear un canvas para redimensionar
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Establecer dimensiones máximas
                    const MAX_SIZE = 100;
                    let width = img.width;
                    let height = img.height;
                    
                    // Calcular nuevas dimensiones manteniendo proporción
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    
                    // Configurar canvas y dibujar imagen redimensionada
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convertir a JPEG con calidad reducida
                    const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    document.getElementById('avatarPreview').src = optimizedDataUrl;
                    document.getElementById('avatarPreview').style.width = width + 'px';
                    document.getElementById('avatarPreview').style.height = height + 'px';
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Limpiar predicciones antiguas periódicamente
    setInterval(() => {
        const now = Date.now();
        for (const [shotId, prediction] of clientPredictions.entries()) {
            if (now - prediction.time > 1000) { // Eliminar predicciones más antiguas de 1 segundo
                clientPredictions.delete(shotId);
            }
        }
    }, 1000);
});