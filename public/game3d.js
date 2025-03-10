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

// Añadir variables para el control de la cámara
let cameraRotation = {
    x: 0,
    y: 0
};

// Constantes del juego con opciones de calidad
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
    NUM_TREES: 12,     // Reducido de 20
    NUM_ROCKS: 8,      // Reducido de 15
    // Nuevas constantes de calidad
    SHADOW_MAP_SIZE: 1024,  // Reducido de 2048
    MAX_BULLETS: 20,
    VIEW_DISTANCE: 45,      // Distancia de niebla reducida
    DRAW_DISTANCE: 60       // Distancia máxima de renderizado
};

// Variables para control de rendimiento
let lastFrameTime = 0;
let frameCount = 0;
let fps = 0;
let fpsUpdateTime = 0;
let qualityLevel = 'medium'; // 'low', 'medium', 'high'

function createTree(x, z) {
    const treeGroup = new THREE.Group();

    // Reducir la complejidad del árbol en calidad baja
    const segments = qualityLevel === 'low' ? 6 : 8;
    
    // Tronco
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, segments);
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4d2926,
        roughness: 0.9 
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.castShadow = qualityLevel !== 'low';
    trunk.receiveShadow = qualityLevel !== 'low';
    treeGroup.add(trunk);

    // Copa del árbol (varios niveles, menos en calidad baja)
    const levels = qualityLevel === 'low' ? 2 : 3;
    for (let i = 0; i < levels; i++) {
        const size = 2 - (i * 0.4);
        const height = 1 + (i * 1.5);
        const leavesGeometry = new THREE.ConeGeometry(size, 2, segments);
        const leavesMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0d5c0d,
            roughness: 0.8
        });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = height;
        leaves.castShadow = qualityLevel !== 'low';
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
    scene.background = new THREE.Color(0x88ccff);
    
    // Ajustar la niebla para mejorar rendimiento
    scene.fog = new THREE.Fog(0x88ccff, 10, GAME_CONSTANTS.VIEW_DISTANCE);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, GAME_CONSTANTS.DRAW_DISTANCE);
    
    // Detectar la capacidad del dispositivo
    detectDeviceCapabilities();
    
    // Configurar renderer con opciones optimizadas
    renderer = new THREE.WebGLRenderer({ 
        antialias: qualityLevel !== 'low',
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio > 1 ? (qualityLevel === 'high' ? window.devicePixelRatio : 1) : 1);
    
    // Configurar sombras según la calidad
    if (qualityLevel === 'low') {
        renderer.shadowMap.enabled = false;
    } else {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = qualityLevel === 'high' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    }
    
    // Limpiar el contenedor 3D si ya tiene contenido
    const container = document.getElementById('game3d');
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // Configurar el crosshair personalizado para modo 3D
    setupCrosshair();

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

    // Posicionar la cámara inicialmente (posición neutral hasta que el jugador se cree)
    camera.position.set(0, 1.6, 0); // Altura aproximada de los ojos
    camera.lookAt(0, 1.6, -1); // Mirar hacia adelante

    // Bloquear el puntero del ratón para el control de la cámara
    renderer.domElement.addEventListener('click', () => {
        renderer.domElement.requestPointerLock();
    });

    // Añadir monitor de FPS si estamos en modo desarrollador
    if (developerMode) {
        setupFPSMonitor();
    }

    // Iniciar el bucle de renderizado
    animate();
}

function setupCrosshair() {
    // Ocultar el crosshair 2D si existe
    const oldCrosshair = document.getElementById('crosshair');
    if (oldCrosshair) {
        oldCrosshair.style.display = 'none';
    }
    
    // Crear un nuevo crosshair para el modo 3D
    const crosshair = document.createElement('div');
    crosshair.id = 'crosshair3d';
    crosshair.style.position = 'fixed';
    crosshair.style.top = '50%';
    crosshair.style.left = '50%';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.width = '20px';
    crosshair.style.height = '20px';
    crosshair.style.pointerEvents = 'none';
    crosshair.style.zIndex = '1000';
    
    // Hacer un crosshair más moderno con CSS
    crosshair.innerHTML = `
        <div style="position:absolute; width:16px; height:2px; background:rgba(0,255,0,0.7); top:9px; left:2px;"></div>
        <div style="position:absolute; width:2px; height:16px; background:rgba(0,255,0,0.7); top:2px; left:9px;"></div>
        <div style="position:absolute; width:6px; height:6px; border:1px solid rgba(0,255,0,0.7); border-radius:50%; top:6px; left:6px;"></div>
    `;
    
    document.body.appendChild(crosshair);
}

function setupLighting() {
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0x6688cc, 0.6); // Aumentada para reducir dependencia de sombras
    scene.add(ambientLight);

    // Luz direccional principal (sol)
    const sunLight = new THREE.DirectionalLight(0xffffbb, 1.2);
    sunLight.position.set(50, 50, 50);
    
    // Configurar sombras según nivel de calidad
    if (qualityLevel !== 'low') {
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = GAME_CONSTANTS.SHADOW_MAP_SIZE;
        sunLight.shadow.mapSize.height = GAME_CONSTANTS.SHADOW_MAP_SIZE;
        
        // Optimizar frustum de cámara de sombras
        const d = 30; // Reducido para optimizar
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 80;
    }
    
    scene.add(sunLight);

    // Luz de relleno suave (solo en calidad media y alta)
    if (qualityLevel !== 'low') {
        const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
        fillLight.position.set(-50, 30, -50);
        scene.add(fillLight);
    }
}

function createEnvironment() {
    // Crear suelo con textura de hierba
    const textureLoader = new THREE.TextureLoader();
    
    // Cargar textura de menor resolución en calidad baja
    const grassTexturePath = qualityLevel === 'low' ? 
        'https://threejs.org/examples/textures/terrain/grasslight-small.jpg' : 
        'https://threejs.org/examples/textures/terrain/grasslight-big.jpg';
    
    const grassTexture = textureLoader.load(grassTexturePath);
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
    floor.receiveShadow = qualityLevel !== 'low';
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

    // Reducir complejidad en modo de baja calidad
    const treeCount = qualityLevel === 'low' ? GAME_CONSTANTS.NUM_TREES / 2 : GAME_CONSTANTS.NUM_TREES;
    const rockCount = qualityLevel === 'low' ? GAME_CONSTANTS.NUM_ROCKS / 2 : GAME_CONSTANTS.NUM_ROCKS;
    
    // Añadir árboles aleatorios
    for (let i = 0; i < treeCount; i++) {
        const x = (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 5);
        const z = (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 5);
        const tree = createTree(x, z);
        scene.add(tree);
    }

    // Añadir rocas aleatorias
    for (let i = 0; i < rockCount; i++) {
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

    // Cuerpo (usando CylinderGeometry en lugar de CapsuleGeometry)
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: id === myId ? 0x00ff88 : 0xff4444,
        shininess: 70
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    
    // Si es el jugador local, hacemos el cuerpo invisible
    if (id === myId) {
        body.visible = false;
    }
    
    playerGroup.add(body);

    // Visor
    const visorGeometry = new THREE.BoxGeometry(0.7, 0.3, 0.3);
    const visorMaterial = new THREE.MeshPhongMaterial({
        color: 0x88ffff,
        shininess: 90,
        transparent: true,
        opacity: 0.8
    });
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.y = 0.5;
    visor.position.z = 0.3;
    
    // Si es el jugador local, hacemos el visor invisible
    if (id === myId) {
        visor.visible = false;
    }
    
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
    
    // Ajustar la cámara para el jugador local en primera persona
    if (id === myId) {
        // Posicionamos la cámara en la "cabeza" del jugador
        camera.position.copy(playerGroup.position);
        camera.position.y += 1.6; // Altura de los ojos
        
        // No añadimos la cámara al grupo del jugador para evitar que rote con el modelo,
        // ya que queremos controlar la rotación de la cámara de forma independiente
        
        // Actualizamos la posición de la cámara en el bucle animate()
    }

    return playerGroup;
}

function createBullet(position, direction) {
    const geometry = new THREE.SphereGeometry(GAME_CONSTANTS.BULLET_SIZE / 2);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xffff00,
        shininess: 100,
        emissive: 0xffff00
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
        // Calcular el cambio en la rotación basado en el movimiento del ratón
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        
        // Actualizar la rotación de la cámara
        cameraRotation.y -= movementX * 0.002;
        cameraRotation.x -= movementY * 0.002;
        
        // Limitar la rotación vertical para evitar dar la vuelta completa
        cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraRotation.x));
        
        // Aplicar la rotación a la cámara
        camera.rotation.order = 'YXZ';
        camera.rotation.x = cameraRotation.x;
        camera.rotation.y = cameraRotation.y;
        
        // Rotar el cuerpo del jugador solo en el eje Y
        players[myId].mesh.rotation.y = cameraRotation.y;
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
        case 'KeyW':
            controls.moveForward = true;
            break;
        case 'KeyS':
            controls.moveBackward = true;
            break;
        case 'KeyA':
            controls.moveLeft = true;
            break;
        case 'KeyD':
            controls.moveRight = true;
            break;
        case 'ShiftLeft':
            controls.run = true;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW':
            controls.moveForward = false;
            break;
        case 'KeyS':
            controls.moveBackward = false;
            break;
        case 'KeyA':
            controls.moveLeft = false;
            break;
        case 'KeyD':
            controls.moveRight = false;
            break;
        case 'ShiftLeft':
            controls.run = false;
            break;
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
    // Limitar el número máximo de balas para mejorar rendimiento
    if (bullets.length > GAME_CONSTANTS.MAX_BULLETS) {
        const excessBullets = bullets.length - GAME_CONSTANTS.MAX_BULLETS;
        for (let i = 0; i < excessBullets; i++) {
            scene.remove(bullets[i]);
        }
        bullets = bullets.slice(excessBullets);
    }
    
    for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];
        bullet.position.add(bullet.direction.clone().multiplyScalar(GAME_CONSTANTS.BULLET_SPEED));
        
        // Optimización: comprobar primero límites de la arena (es más barato)
        if (Math.abs(bullet.position.x) > GAME_CONSTANTS.ARENA_SIZE / 2 ||
            Math.abs(bullet.position.z) > GAME_CONSTANTS.ARENA_SIZE / 2) {
            scene.remove(bullet);
            bullets.splice(i, 1);
            i--;
            continue;
        }
        
        // Comprobar colisiones con jugadores
        for (let id in players) {
            if (id !== myId) {
                const player = players[id].mesh;
                const distance = bullet.position.distanceTo(player.position);
                
                if (distance < GAME_CONSTANTS.PLAYER_SIZE) {
                    scene.remove(bullet);
                    bullets.splice(i, 1);
                    i--;
                    socket.emit('bulletHit', { playerId: id });
                    break;
                }
            }
        }
    }
}

function connectToServer() {
    // Crear un ID temporal para pruebas
    myId = 'player1';
    
    // Crear jugador inicial en una posición aleatoria
    const startPosition = new THREE.Vector3(
        (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 10),
        1,
        (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 10)
    );
    
    createPlayer(myId, startPosition);
}

function animate(time) {
    requestAnimationFrame(animate);
    
    // Calcular FPS
    if (!lastFrameTime) {
        lastFrameTime = time;
        fpsUpdateTime = time;
    }
    
    const delta = time - lastFrameTime;
    lastFrameTime = time;
    
    frameCount++;
    
    // Actualizar contador FPS cada 500ms
    if (time - fpsUpdateTime > 500) {
        fps = Math.round((frameCount * 1000) / (time - fpsUpdateTime));
        
        const fpsCounter = document.getElementById('fpsCounter');
        if (fpsCounter) {
            fpsCounter.textContent = `FPS: ${fps} (${qualityLevel})`;
        }
        
        frameCount = 0;
        fpsUpdateTime = time;
        
        // Ajuste automático de calidad (opcional)
        if (fps < 30 && qualityLevel !== 'low') {
            console.log('Rendimiento bajo detectado, ajustando calidad...');
            // Aquí podrías reducir la calidad automáticamente
        }
    }
    
    if (players[myId]) {
        const player = players[myId].mesh;
        const moveSpeed = controls.run ? GAME_CONSTANTS.PLAYER_SPEED * 2 : GAME_CONSTANTS.PLAYER_SPEED;
        
        // Optimizar movimiento
        movePlayer(player, moveSpeed);
    }
    
    updateBullets();
    renderer.render(scene, camera);
}

// Función separada para movimiento (optimización)
function movePlayer(player, moveSpeed) {
    // Vector de movimiento basado en la dirección de la cámara
    const moveVector = new THREE.Vector3();
    
    if (controls.moveForward) moveVector.z -= 1;
    if (controls.moveBackward) moveVector.z += 1;
    if (controls.moveLeft) moveVector.x -= 1;
    if (controls.moveRight) moveVector.x += 1;
    
    // Evitar cálculos innecesarios si no hay movimiento
    if (moveVector.length() > 0) {
        moveVector.normalize();
        moveVector.multiplyScalar(moveSpeed);
        
        // Rotar el vector de movimiento según la rotación de la cámara
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(cameraRotation.y);
        moveVector.applyMatrix4(rotationMatrix);
        
        // Aplicar movimiento
        player.position.x += moveVector.x;
        player.position.z += moveVector.z;
        
        // Limitar posición dentro de la arena
        player.position.x = Math.max(-GAME_CONSTANTS.ARENA_SIZE/2 + 2, Math.min(GAME_CONSTANTS.ARENA_SIZE/2 - 2, player.position.x));
        player.position.z = Math.max(-GAME_CONSTANTS.ARENA_SIZE/2 + 2, Math.min(GAME_CONSTANTS.ARENA_SIZE/2 - 2, player.position.z));
    }
    
    // Actualizar posición de la cámara para seguir al jugador en primera persona
    camera.position.x = player.position.x;
    camera.position.z = player.position.z;
    camera.position.y = player.position.y + 1.6; // Altura de los ojos
}

// Añadir monitor de FPS para desarrolladores
function setupFPSMonitor() {
    const fpsCounter = document.createElement('div');
    fpsCounter.id = 'fpsCounter';
    fpsCounter.style.position = 'fixed';
    fpsCounter.style.top = '10px';
    fpsCounter.style.right = '10px';
    fpsCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    fpsCounter.style.color = '#00ff00';
    fpsCounter.style.padding = '5px 10px';
    fpsCounter.style.borderRadius = '5px';
    fpsCounter.style.fontFamily = 'monospace';
    fpsCounter.style.zIndex = '2000';
    fpsCounter.textContent = 'FPS: --';
    
    // Añadir botones para cambiar calidad
    const qualityControls = document.createElement('div');
    qualityControls.style.marginTop = '5px';
    qualityControls.innerHTML = `
        <button id="lowQuality" style="margin-right:5px;padding:2px 5px;background:${qualityLevel === 'low' ? '#00ff00' : '#444'};color:white;border:none;">Bajo</button>
        <button id="medQuality" style="margin-right:5px;padding:2px 5px;background:${qualityLevel === 'medium' ? '#00ff00' : '#444'};color:white;border:none;">Medio</button>
        <button id="highQuality" style="padding:2px 5px;background:${qualityLevel === 'high' ? '#00ff00' : '#444'};color:white;border:none;">Alto</button>
    `;
    
    fpsCounter.appendChild(qualityControls);
    document.body.appendChild(fpsCounter);
    
    // Eventos para cambiar calidad
    document.getElementById('lowQuality').addEventListener('click', () => {
        window.location.href = window.location.pathname + '?quality=low';
    });
    
    document.getElementById('medQuality').addEventListener('click', () => {
        window.location.href = window.location.pathname + '?quality=medium';
    });
    
    document.getElementById('highQuality').addEventListener('click', () => {
        window.location.href = window.location.pathname + '?quality=high';
    });
}

// Añadir función para limpiar cuando se cierra el juego 3D
function cleanupGame3D() {
    // Eliminar el crosshair 3D
    const crosshair3d = document.getElementById('crosshair3d');
    if (crosshair3d) {
        document.body.removeChild(crosshair3d);
    }
    
    // Restaurar el crosshair original
    const oldCrosshair = document.getElementById('crosshair');
    if (oldCrosshair) {
        oldCrosshair.style.display = '';
    }
    
    // Liberar recursos
    if (renderer) {
        renderer.dispose();
    }
    
    // Limpiar la escena
    if (scene) {
        scene.clear();
    }
    
    // Desregistrar eventos
    window.removeEventListener('resize', onWindowResize);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('click', onMouseClick);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
}

// Iniciar el juego cuando se cargue la página
window.addEventListener('load', init);

function detectDeviceCapabilities() {
    // Estimar la capacidad del dispositivo basado en cores de CPU y GPU
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    
    // Comprobación rápida de rendimiento WebGL
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
        // WebGL no soportado, usar calidad baja
        qualityLevel = 'low';
        return;
    }
    
    // Comprobar extensiones disponibles
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    let renderer = 'unknown';
    
    if (debugInfo) {
        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    }
    
    // Ajustar calidad según hardware detectado
    if (hardwareConcurrency <= 2 || 
        renderer.toLowerCase().includes('intel') ||
        renderer.toLowerCase().includes('mesa') ||
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        qualityLevel = 'low';
    } else if (hardwareConcurrency <= 4 || 
               !renderer.toLowerCase().includes('nvidia') && 
               !renderer.toLowerCase().includes('amd') && 
               !renderer.toLowerCase().includes('radeon')) {
        qualityLevel = 'medium';
    } else {
        qualityLevel = 'high';
    }
    
    // Permitir forzar calidad a través de URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('quality')) {
        const paramQuality = urlParams.get('quality');
        if (['low', 'medium', 'high'].includes(paramQuality)) {
            qualityLevel = paramQuality;
        }
    }
    
    console.log(`Calidad gráfica ajustada a: ${qualityLevel}`);
} 