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

    // Variables globales
    let socket;
    const players = new Map();
    let myId = null;
    let playerName = '';
    let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let lastEmitTime = 0; // Añadido para evitar error en gameLoop

    // Mostrar controles móviles si es un dispositivo móvil
    if (isMobile) {
        mobileControls.style.display = 'block';
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
        PLAYER_SPEED: 5,
        PLAYER_SIZE: 30,
        BULLET_SPEED: 25,
        BULLET_SIZE: 8,
        BULLET_DAMAGE: 35,
        PLAYER_MAX_HEALTH: 100,
        POWER_DURATION: 10000,
        POWER_SPAWN_INTERVAL: 15000,
        SYNC_RATE: 16,
        INTERPOLATION_DELAY: 100
    };

    // Sistema de poderes
    const POWERS = {
        SPEED: {
            name: 'Velocidad',
            color: '#00ff00',
            apply: (player) => {
                player.speed = GAME_CONSTANTS.PLAYER_SPEED * 1.5;
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
            },
            remove: (player) => {
                player.hasShield = false;
            }
        },
        DAMAGE: {
            name: 'Daño x2',
            color: '#ff0000',
            apply: (player) => {
                player.damageMultiplier = 2;
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
            this.speed = 20;
            this.size = 8;
            this.angle = angle;
            this.distance = 0;
            this.maxDistance = 1500;
            this.trail = [];
            this.damage = 25;
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
            
            return distance < player.size + this.size;
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
                ctx.save();
                ctx.beginPath();
                ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(this.avatar, screenX - this.size, screenY - this.size, this.size * 2, this.size * 2);
                ctx.restore();
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
            ctx.fillText(`${this.name} (${this.score})`, screenX, screenY - this.size - 20);

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

            let dx = 0;
            let dy = 0;

            if (moveJoystick.active) {
                dx = moveJoystick.data.x * this.speed;
                dy = moveJoystick.data.y * this.speed;
            } else {
                if (keys.ArrowLeft || keys.a) dx -= this.speed;
                if (keys.ArrowRight || keys.d) dx += this.speed;
                if (keys.ArrowUp || keys.w) dy -= this.speed;
                if (keys.ArrowDown || keys.s) dy += this.speed;
            }

            if (dx !== 0 && dy !== 0) {
                const factor = 1 / Math.sqrt(2);
                dx *= factor;
                dy *= factor;
            }

            this.x += dx;
            this.y += dy;

            this.x = Math.max(this.size, Math.min(camera.mapWidth - this.size, this.x));
            this.y = Math.max(this.size, Math.min(camera.mapHeight - this.size, this.y));

            this.bullets = this.bullets.filter(bullet => bullet.update());
        }

        setAvatar(imageUrl) {
            if (imageUrl === this.avatarUrl) return;
            this.avatarUrl = imageUrl;
            const img = new Image();
            img.onload = () => {
                this.avatar = img;
                this.avatarLoaded = true;
            };
            img.onerror = () => {
                console.error('Error al cargar el avatar');
                this.avatarLoaded = false;
                this.avatar = null;
            };
            img.src = imageUrl;
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

    canvas.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        handleShot(e);
    });

    canvas.addEventListener('mouseup', () => {
        isMouseDown = false;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isMouseDown) handleShot(e);
        if (myId && players.has(myId)) {
            const player = players.get(myId);
            if (!player.isDead) {
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
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
            if (!player.isDead && now - lastAutoShot >= AUTO_SHOT_DELAY) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left + camera.x;
                const y = e.clientY - rect.top + camera.y;
                player.shoot(x, y);
                socket.emit('playerShoot', { x, y });
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
            players.forEach((otherPlayer, otherPlayerId) => {
                if (playerId === otherPlayerId || otherPlayer.isDead) return;
                const bulletsToRemove = [];
                otherPlayer.bullets.forEach((bullet, bulletIndex) => {
                    const dx = player.x - bullet.x;
                    const dy = player.y - bullet.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < player.size + bullet.size) {
                        bulletsToRemove.push(bulletIndex);
                        ctx.beginPath();
                        ctx.arc(bullet.x - camera.x, bullet.y - camera.y, 25, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                        ctx.fill();
                        let finalDamage = GAME_CONSTANTS.BULLET_DAMAGE;
                        if (otherPlayer.damageMultiplier > 1) finalDamage *= otherPlayer.damageMultiplier;
                        player.takeDamage(finalDamage, otherPlayerId);
                        if (socket && socket.connected && otherPlayerId === myId) {
                            socket.emit('bulletHit', { targetId: playerId, damage: finalDamage, shooterId: myId });
                        }
                    }
                });
                bulletsToRemove.reverse().forEach(index => otherPlayer.bullets.splice(index, 1));
            });
        });
    }

    function startGame() {
        playerName = nombreInput.value.trim();
        const avatarUrl = document.getElementById('avatarPreview').src;
        
        menuInicial.style.display = 'none';
        gameContainer.style.display = 'block';
        
        if (socket) socket.disconnect();
        
        const isProduction = window.location.hostname !== 'localhost';
        const serverUrl = isProduction ? 'https://multiplayer-web-game-063s.onrender.com' : 'http://localhost:3000';
        
        socket = io(serverUrl, {
            transports: ['websocket'],
            upgrade: false,
            cors: { origin: "https://multiplayer-web-game.vercel.app", methods: ["GET", "POST"] }
        });

        socket.on('connect', () => console.log('¡Conectado al servidor!'));
        socket.on('serverFull', () => {
            alert('El servidor está lleno. Por favor, intenta más tarde.');
            menuInicial.style.display = 'flex';
            gameContainer.style.display = 'none';
            socket.disconnect();
        });

        socket.on('init', (data) => {
            myId = data.id;
            const newPlayer = new Player(
                Math.random() * (camera.mapWidth - 200) + 100,
                Math.random() * (camera.mapHeight - 200) + 100,
                `hsl(${Math.random() * 360}, 70%, 50%)`,
                playerName
            );
            newPlayer.setAvatar(avatarUrl);
            players.set(myId, newPlayer);

            if (data.players) {
                data.players.forEach(playerData => {
                    if (playerData.id !== myId) {
                        const player = new Player(playerData.x, playerData.y, `hsl(${Math.random() * 360}, 70%, 50%)`, playerData.name);
                        if (playerData.avatarUrl) player.setAvatar(playerData.avatarUrl);
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
                player.score = data.score || 0;
                player.health = data.health;
                player.isDead = data.isDead;
                if (data.powers) {
                    player.hasShield = data.powers.hasShield;
                    player.damageMultiplier = data.powers.damageMultiplier;
                    player.speed = data.powers.speed;
                }
                if (data.avatarUrl && !player.avatarLoaded) player.setAvatar(data.avatarUrl);
                player.bullets = data.bullets.map(b => {
                    const bullet = new Bullet(b.x, b.y, b.angle || 0);
                    bullet.x = b.x;
                    bullet.y = b.y;
                    return bullet;
                });
            } else {
                const newPlayer = new Player(data.x, data.y, `hsl(${Math.random() * 360}, 70%, 50%)`, data.name || 'Jugador');
                if (data.avatarUrl) newPlayer.setAvatar(data.avatarUrl);
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
                if (data.killerId && data.killerId === myId) {
                    const myPlayer = players.get(myId);
                    if (myPlayer && !myPlayer.isDead) {
                        myPlayer.score += 1;
                        updateScoreboard();
                    }
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
                score: player.score,
                health: player.health,
                isDead: player.isDead,
                bullets: player.bullets.map(b => ({ x: Math.round(b.x), y: Math.round(b.y), angle: b.angle })).slice(-5),
                powers: { hasShield: player.hasShield, damageMultiplier: player.damageMultiplier, speed: player.speed }
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

    botonJugar.addEventListener('click', startGame);
    nombreInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !botonJugar.disabled) startGame();
    });

    document.getElementById('playerAvatar').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('avatarPreview').src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
});