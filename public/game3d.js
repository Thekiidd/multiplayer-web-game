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
    WALL_HEIGHT: 5,
    NUM_TREES: 20,
    NUM_ROCKS: 15
};

function createTree(x, z) {
    const treeGroup = new THREE.Group();

    // Tronco
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4d2926,
        roughness: 0.9 
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);

    // Copa del árbol (varios niveles)
    const levels = 3;
    for (let i = 0; i < levels; i++) {
        const size = 2 - (i * 0.4);
        const height = 1 + (i * 1.5);
        const leavesGeometry = new THREE.ConeGeometry(size, 2, 8);
        const leavesMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0d5c0d,
            roughness: 0.8
        });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = height;
        leaves.castShadow = true;
        treeGroup.add(leaves);
    }

    treeGroup.position.set(x, 0, z);
    return treeGroup;
}

function createRock(x, z) {
    const rockGeometry = new THREE.DodecahedronGeometry(Math.random() * 0.5 + 0.5);
    const rockMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x666666,
        roughness: 0.9,
        metalness: 0.1
    });
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(x, 0.5, z);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.castShadow = true;
    rock.receiveShadow = true;
    return rock;
}

// Inicialización del juego
function init() {
    // Configuración básica de Three.js
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x88ccff); // Cielo azul claro
    scene.fog = new THREE.Fog(0x88ccff, 20, 60); // Niebla para ambiente

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Limpiar el contenedor 3D si ya tiene contenido
    const container = document.getElementById('game3d');
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // Configuración de la iluminación
    setupLighting();

    // Configuración del ambiente
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

    // Posicionar la cámara inicialmente
    camera.position.set(0, 10, 20);
    camera.lookAt(0, 0, 0);

    // Iniciar el bucle de renderizado
    animate();
}

function setupLighting() {
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0x6688cc, 0.5);
    scene.add(ambientLight);

    // Luz direccional principal (sol)
    const sunLight = new THREE.DirectionalLight(0xffffbb, 1.2);
    sunLight.position.set(50, 50, 50);
    sunLight.castShadow = true;
    
    // Configuración de sombras de alta calidad
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    
    scene.add(sunLight);

    // Luz de relleno suave
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-50, 30, -50);
    scene.add(fillLight);
}

function createEnvironment() {
    // Crear suelo con textura de hierba
    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(8, 8);

    const floorGeometry = new THREE.PlaneGeometry(GAME_CONSTANTS.ARENA_SIZE, GAME_CONSTANTS.ARENA_SIZE);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        map: grassTexture,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Crear paredes con efecto de cristal futurista
    const wallMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0x88ffff,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });

    // Paredes
    const walls = [];
    for (let i = 0; i < 4; i++) {
        const wall = createWall(wallMaterial);
        if (i % 2 === 0) {
            wall.position.z = i === 0 ? -GAME_CONSTANTS.ARENA_SIZE / 2 : GAME_CONSTANTS.ARENA_SIZE / 2;
        } else {
            wall.rotation.y = Math.PI / 2;
            wall.position.x = i === 1 ? GAME_CONSTANTS.ARENA_SIZE / 2 : -GAME_CONSTANTS.ARENA_SIZE / 2;
        }
        walls.push(wall);
        scene.add(wall);
    }

    // Añadir árboles aleatorios
    for (let i = 0; i < GAME_CONSTANTS.NUM_TREES; i++) {
        const x = (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 5);
        const z = (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 5);
        const tree = createTree(x, z);
        scene.add(tree);
    }

    // Añadir rocas aleatorias
    for (let i = 0; i < GAME_CONSTANTS.NUM_ROCKS; i++) {
        const x = (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 3);
        const z = (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 3);
        const rock = createRock(x, z);
        scene.add(rock);
    }

    // Añadir efecto de neón en las esquinas
    const neonGeometry = new THREE.BoxGeometry(GAME_CONSTANTS.ARENA_SIZE, 0.1, 0.1);
    const neonMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 1
    });
    
    const neonLines = [];
    for (let i = 0; i < 4; i++) {
        const neon = new THREE.Mesh(neonGeometry, neonMaterial);
        neon.position.y = GAME_CONSTANTS.WALL_HEIGHT;
        neon.rotation.y = (Math.PI / 2) * i;
        if (i % 2 === 0) {
            neon.position.z = i === 0 ? -GAME_CONSTANTS.ARENA_SIZE / 2 : GAME_CONSTANTS.ARENA_SIZE / 2;
        } else {
            neon.position.x = i === 1 ? GAME_CONSTANTS.ARENA_SIZE / 2 : -GAME_CONSTANTS.ARENA_SIZE / 2;
        }
        scene.add(neon);
        neonLines.push(neon);
    }
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
    // Grupo para el jugador
    const playerGroup = new THREE.Group();

    // Cuerpo
    const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: id === myId ? 0x00ff88 : 0xff4444,
        metalness: 0.7,
        roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    playerGroup.add(body);

    // Visor
    const visorGeometry = new THREE.BoxGeometry(0.7, 0.3, 0.3);
    const visorMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x88ffff,
        metalness: 1,
        roughness: 0,
        transparent: true,
        opacity: 0.8
    });
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.y = 0.5;
    visor.position.z = 0.3;
    playerGroup.add(visor);

    // Luz del jugador
    const playerLight = new THREE.PointLight(id === myId ? 0x00ff88 : 0xff4444, 1, 3);
    playerLight.position.y = 1;
    playerGroup.add(playerLight);

    playerGroup.position.copy(position);
    scene.add(playerGroup);
    
    players[id] = {
        mesh: playerGroup,
        health: GAME_CONSTANTS.MAX_HEALTH,
        score: 0
    };
    
    if (id === myId) {
        // Cámara en tercera persona
        camera.position.set(0, 3, 6);
        playerGroup.add(camera);
    }

    return playerGroup;
}

function createBullet(position, direction) {
    const geometry = new THREE.SphereGeometry(GAME_CONSTANTS.BULLET_SIZE / 2);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xffff00, 
        emissive: 0xffff00, 
        emissiveIntensity: 1
    });
    const bullet = new THREE.Mesh(geometry, material);
    
    // Añadir luz a la bala
    const bulletLight = new THREE.PointLight(0xffff00, 1, 2);
    bullet.add(bulletLight);
    
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