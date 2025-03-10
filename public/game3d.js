// Configuración inicial de Three.js
let scene, camera, renderer;
let players = {};
let bullets = [];
let obstacles = [];
let powerUps = [];
let myId = null;
let socket;
let controls;
let raycaster;
let mouse;
let shootCooldown = false;
let lastShootTime = 0;
const SHOOT_COOLDOWN = 250;

// Constantes del juego
const GAME_CONSTANTS = {
    PLAYER_SPEED: 0.15,
    PLAYER_SIZE: 1,
    BULLET_SPEED: 0.8,
    BULLET_SIZE: 0.2,
    BULLET_DAMAGE: 25,
    POWER_DURATION: 15000,
    POWER_SPAWN_INTERVAL: 10000,
    MAX_HEALTH: 100,
    ARENA_SIZE: 50,
    WALL_HEIGHT: 3
};

// Inicialización del juego
function init() {
    // Configuración básica de Three.js
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.querySelector('.game-container').appendChild(renderer.domElement);

    // Configuración de la iluminación
    setupLighting();

    // Configuración del suelo y paredes
    createEnvironment();

    // Configuración de controles
    setupControls();

    // Configuración del raycaster para detección de colisiones
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Eventos del navegador
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('click', onMouseClick, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);

    // Iniciar la conexión con el servidor
    connectToServer();

    // Iniciar el bucle de renderizado
    animate();
}

function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Configuración de sombras
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
}

function createEnvironment() {
    // Crear suelo
    const floorGeometry = new THREE.PlaneGeometry(GAME_CONSTANTS.ARENA_SIZE, GAME_CONSTANTS.ARENA_SIZE);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Crear paredes
    const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x666666,
        roughness: 0.7,
        metalness: 0.3
    });

    // Pared norte
    const wallNorth = createWall(wallMaterial);
    wallNorth.position.z = -GAME_CONSTANTS.ARENA_SIZE / 2;
    scene.add(wallNorth);

    // Pared sur
    const wallSouth = createWall(wallMaterial);
    wallSouth.position.z = GAME_CONSTANTS.ARENA_SIZE / 2;
    scene.add(wallSouth);

    // Pared este
    const wallEast = createWall(wallMaterial);
    wallEast.rotation.y = Math.PI / 2;
    wallEast.position.x = GAME_CONSTANTS.ARENA_SIZE / 2;
    scene.add(wallEast);

    // Pared oeste
    const wallWest = createWall(wallMaterial);
    wallWest.rotation.y = Math.PI / 2;
    wallWest.position.x = -GAME_CONSTANTS.ARENA_SIZE / 2;
    scene.add(wallWest);
}

function createWall(material) {
    const wallGeometry = new THREE.BoxGeometry(GAME_CONSTANTS.ARENA_SIZE, GAME_CONSTANTS.WALL_HEIGHT, 0.5);
    const wall = new THREE.Mesh(wallGeometry, material);
    wall.position.y = GAME_CONSTANTS.WALL_HEIGHT / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    return wall;
}

function setupControls() {
    controls = {
        moveForward: false,
        moveBackward: false,
        moveLeft: false,
        moveRight: false,
        run: false
    };
}

function createPlayer(id, position) {
    const geometry = new THREE.BoxGeometry(GAME_CONSTANTS.PLAYER_SIZE, GAME_CONSTANTS.PLAYER_SIZE * 2, GAME_CONSTANTS.PLAYER_SIZE);
    const material = new THREE.MeshStandardMaterial({ color: id === myId ? 0x00ff00 : 0xff0000 });
    const player = new THREE.Mesh(geometry, material);
    
    player.position.copy(position);
    player.castShadow = true;
    player.receiveShadow = true;
    
    scene.add(player);
    players[id] = {
        mesh: player,
        health: GAME_CONSTANTS.MAX_HEALTH,
        score: 0
    };
    
    if (id === myId) {
        camera.position.set(0, GAME_CONSTANTS.PLAYER_SIZE * 3, GAME_CONSTANTS.PLAYER_SIZE * 4);
        player.add(camera);
    }
}

function createBullet(position, direction) {
    const geometry = new THREE.SphereGeometry(GAME_CONSTANTS.BULLET_SIZE / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.5 });
    const bullet = new THREE.Mesh(geometry, material);
    
    bullet.position.copy(position);
    bullet.direction = direction;
    bullet.castShadow = true;
    
    scene.add(bullet);
    bullets.push(bullet);
    
    // Eliminar la bala después de 2 segundos
    setTimeout(() => {
        scene.remove(bullet);
        bullets = bullets.filter(b => b !== bullet);
    }, 2000);
}

function createPowerUp(position, type) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ 
        color: type === 'health' ? 0x00ff00 : type === 'speed' ? 0x0000ff : 0xff0000,
        emissive: type === 'health' ? 0x00ff00 : type === 'speed' ? 0x0000ff : 0xff0000,
        emissiveIntensity: 0.5
    });
    const powerUp = new THREE.Mesh(geometry, material);
    
    powerUp.position.copy(position);
    powerUp.type = type;
    powerUp.castShadow = true;
    
    scene.add(powerUp);
    powerUps.push(powerUp);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    if (players[myId]) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            players[myId].mesh.lookAt(point);
        }
    }
}

function onMouseClick(event) {
    if (players[myId] && !shootCooldown) {
        const now = Date.now();
        if (now - lastShootTime >= SHOOT_COOLDOWN) {
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            
            const position = players[myId].mesh.position.clone();
            position.y += GAME_CONSTANTS.PLAYER_SIZE;
            
            createBullet(position, direction);
            socket.emit('shoot', { position: position, direction: direction });
            
            lastShootTime = now;
            shootCooldown = true;
            setTimeout(() => { shootCooldown = false; }, SHOOT_COOLDOWN);
        }
    }
}

function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW': controls.moveForward = true; break;
        case 'KeyS': controls.moveBackward = true; break;
        case 'KeyA': controls.moveLeft = true; break;
        case 'KeyD': controls.moveRight = true; break;
        case 'ShiftLeft': controls.run = true; break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': controls.moveForward = false; break;
        case 'KeyS': controls.moveBackward = false; break;
        case 'KeyA': controls.moveLeft = false; break;
        case 'KeyD': controls.moveRight = false; break;
        case 'ShiftLeft': controls.run = false; break;
    }
}

function updatePlayerPosition() {
    if (players[myId]) {
        const player = players[myId].mesh;
        const moveSpeed = controls.run ? GAME_CONSTANTS.PLAYER_SPEED * 1.5 : GAME_CONSTANTS.PLAYER_SPEED;
        
        const direction = new THREE.Vector3();
        const rotation = player.rotation.y;
        
        if (controls.moveForward) {
            direction.z = -Math.cos(rotation) * moveSpeed;
            direction.x = -Math.sin(rotation) * moveSpeed;
        }
        if (controls.moveBackward) {
            direction.z = Math.cos(rotation) * moveSpeed;
            direction.x = Math.sin(rotation) * moveSpeed;
        }
        if (controls.moveLeft) {
            direction.x = -Math.cos(rotation) * moveSpeed;
            direction.z = Math.sin(rotation) * moveSpeed;
        }
        if (controls.moveRight) {
            direction.x = Math.cos(rotation) * moveSpeed;
            direction.z = -Math.sin(rotation) * moveSpeed;
        }
        
        // Comprobar colisiones con los límites de la arena
        const nextPosition = player.position.clone().add(direction);
        if (Math.abs(nextPosition.x) < GAME_CONSTANTS.ARENA_SIZE / 2 - GAME_CONSTANTS.PLAYER_SIZE &&
            Math.abs(nextPosition.z) < GAME_CONSTANTS.ARENA_SIZE / 2 - GAME_CONSTANTS.PLAYER_SIZE) {
            player.position.add(direction);
            socket.emit('playerMove', { position: player.position, rotation: player.rotation });
        }
    }
}

function updateBullets() {
    for (let bullet of bullets) {
        bullet.position.add(bullet.direction.multiplyScalar(GAME_CONSTANTS.BULLET_SPEED));
        
        // Comprobar colisiones con jugadores
        for (let id in players) {
            if (id !== myId) {
                const player = players[id].mesh;
                const distance = bullet.position.distanceTo(player.position);
                
                if (distance < GAME_CONSTANTS.PLAYER_SIZE) {
                    scene.remove(bullet);
                    bullets = bullets.filter(b => b !== bullet);
                    socket.emit('bulletHit', { playerId: id });
                    break;
                }
            }
        }
        
        // Comprobar colisiones con los límites de la arena
        if (Math.abs(bullet.position.x) > GAME_CONSTANTS.ARENA_SIZE / 2 ||
            Math.abs(bullet.position.z) > GAME_CONSTANTS.ARENA_SIZE / 2) {
            scene.remove(bullet);
            bullets = bullets.filter(b => b !== bullet);
        }
    }
}

function connectToServer() {
    socket = io();
    
    socket.on('connect', () => {
        myId = socket.id;
        console.log('Conectado al servidor con ID:', myId);
    });
    
    socket.on('playerJoined', (data) => {
        createPlayer(data.id, new THREE.Vector3(data.position.x, data.position.y, data.position.z));
    });
    
    socket.on('playerLeft', (id) => {
        if (players[id]) {
            scene.remove(players[id].mesh);
            delete players[id];
        }
    });
    
    socket.on('playerMoved', (data) => {
        if (players[data.id] && data.id !== myId) {
            const player = players[data.id].mesh;
            player.position.set(data.position.x, data.position.y, data.position.z);
            player.rotation.set(data.rotation._x, data.rotation._y, data.rotation._z);
        }
    });
    
    socket.on('bulletFired', (data) => {
        if (data.playerId !== myId) {
            createBullet(
                new THREE.Vector3(data.position.x, data.position.y, data.position.z),
                new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z)
            );
        }
    });
    
    socket.on('playerHit', (data) => {
        if (players[data.playerId]) {
            players[data.playerId].health -= GAME_CONSTANTS.BULLET_DAMAGE;
            if (players[data.playerId].health <= 0) {
                scene.remove(players[data.playerId].mesh);
                delete players[data.playerId];
                if (data.playerId === myId) {
                    setTimeout(() => {
                        createPlayer(myId, new THREE.Vector3(
                            (Math.random() - 0.5) * GAME_CONSTANTS.ARENA_SIZE,
                            GAME_CONSTANTS.PLAYER_SIZE,
                            (Math.random() - 0.5) * GAME_CONSTANTS.ARENA_SIZE
                        ));
                    }, 3000);
                }
            }
        }
    });
    
    socket.on('powerUpSpawned', (data) => {
        createPowerUp(
            new THREE.Vector3(data.position.x, data.position.y, data.position.z),
            data.type
        );
    });
    
    socket.on('powerUpCollected', (data) => {
        const powerUp = powerUps.find(p => 
            p.position.x === data.position.x &&
            p.position.y === data.position.y &&
            p.position.z === data.position.z
        );
        
        if (powerUp) {
            scene.remove(powerUp);
            powerUps = powerUps.filter(p => p !== powerUp);
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    updatePlayerPosition();
    updateBullets();
    
    renderer.render(scene, camera);
}

// Iniciar el juego cuando se cargue la página
window.addEventListener('load', init); 