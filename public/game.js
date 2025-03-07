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
    const botonAmor = document.getElementById('botonAmor');
    const mensajeAmor = document.getElementById('mensajeAmor');
    const volverMenu = document.getElementById('volverMenu');
    const corazon3D = document.getElementById('corazon3D');

    // Variables globales
    let socket;
    const players = new Map();
    let myId = null;
    let playerName = '';

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

        draw() {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.lineWidth = 2;
            this.trail.forEach((pos, i) => {
                const alpha = i / this.trail.length;
                ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
                if (i === 0) {
                    ctx.moveTo(pos.x, pos.y);
                } else {
                    ctx.lineTo(pos.x, pos.y);
                }
            });
            ctx.stroke();

            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 2, 0, Math.PI * 2);
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
                   this.x > 0 && this.x < canvas.width &&
                   this.y > 0 && this.y < canvas.height;
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
        }

        draw() {
            if (this.isDead) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * (1 + Math.sin(Date.now() / 100)), 0, Math.PI * 2);
                ctx.fill();
                return;
            }

            // Dibujar jugador
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

            // Nombre y puntuación
            ctx.fillStyle = 'white';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.name} (${this.score})`, this.x, this.y - this.size - 20);

            // Dibujar balas
            this.bullets.forEach(bullet => bullet.draw());
        }

        shoot(targetX, targetY) {
            const now = Date.now();
            if (now - this.lastShot > 250) {
                const angle = Math.atan2(targetY - this.y, targetX - this.x);
                
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size + 10, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                ctx.fill();

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

            if (keys.ArrowLeft) this.x -= this.speed;
            if (keys.ArrowRight) this.x += this.speed;
            if (keys.ArrowUp) this.y -= this.speed;
            if (keys.ArrowDown) this.y += this.speed;

            this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
            this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));

            this.bullets = this.bullets.filter(bullet => bullet.update());
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
        ArrowDown: false
    };

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

    // Manejo de disparos
    canvas.addEventListener('click', (e) => {
        if (myId && players.has(myId)) {
            const player = players.get(myId);
            if (!player.isDead) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
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
        menuInicial.style.display = 'none';
        gameContainer.style.display = 'block';
        
        socket = io();

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
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    // Agregar Three.js para el corazón 3D
    function crearCorazon3D() {
        // Primero limpiamos cualquier corazón existente
        while (corazon3D.firstChild) {
            corazon3D.removeChild(corazon3D.firstChild);
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(200, 200);
        corazon3D.appendChild(renderer.domElement);

        // Crear forma de corazón
        const x = 0, y = 0;
        const heartShape = new THREE.Shape();
        heartShape.moveTo(x + 5, y + 5);
        heartShape.bezierCurveTo(x + 5, y + 5, x + 4, y, x, y);
        heartShape.bezierCurveTo(x - 6, y, x - 6, y + 7, x - 6, y + 7);
        heartShape.bezierCurveTo(x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19);
        heartShape.bezierCurveTo(x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7);
        heartShape.bezierCurveTo(x + 16, y + 7, x + 16, y, x + 10, y);
        heartShape.bezierCurveTo(x + 7, y, x + 5, y + 5, x + 5, y + 5);

        const geometry = new THREE.ExtrudeGeometry(heartShape, {
            depth: 2,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 2,
            bevelSize: 1,
            bevelThickness: 1
        });

        const material = new THREE.MeshPhongMaterial({ 
            color: 0xff4d6d,
            shininess: 100
        });

        const heart = new THREE.Mesh(geometry, material);
        scene.add(heart);

        // Ajustamos la posición y rotación del corazón
        heart.rotation.z = Math.PI;
        heart.position.y = 0; // Cambiamos de -10 a 0 para centrarlo verticalmente
        heart.position.x = 0; // Aseguramos que esté centrado horizontalmente
        heart.scale.set(0.7, 0.7, 0.7); // Hacemos el corazón un poco más pequeño

        // Ajustamos la luz para mejor visualización
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 0, 5);
        scene.add(light);

        // Agregamos luz ambiental para mejor iluminación
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        camera.position.z = 25; // Ajustamos la distancia de la cámara

        let animationFrameId; // Para poder cancelar la animación

        function animate() {
            animationFrameId = requestAnimationFrame(animate);
            heart.rotation.y += 0.01;
            renderer.render(scene, camera);
        }
        animate();

        // Guardamos la función para limpiar la animación
        corazon3D.cleanup = () => {
            cancelAnimationFrame(animationFrameId);
            renderer.dispose();
        };
    }

    // Eventos para los botones
    botonAmor.addEventListener('click', () => {
        menuInicial.style.display = 'none';
        mensajeAmor.style.display = 'flex';
        crearCorazon3D();
    });

    volverMenu.addEventListener('click', () => {
        // Limpiamos la animación antes de ocultar
        if (corazon3D.cleanup) {
            corazon3D.cleanup();
        }
        mensajeAmor.style.display = 'none';
        menuInicial.style.display = 'flex';
    });
}); 