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

// Mejora de materiales y efectos visuales del entorno
let skybox;
let floorGrid;
let particles = [];
let time = 0;

// HUD y elementos de interfaz mejorados

function setupHUD() {
    // Contenedor principal del HUD
    const hudContainer = document.createElement('div');
    hudContainer.id = 'game3dHUD';
    hudContainer.style.position = 'absolute';
    hudContainer.style.width = '100%';
    hudContainer.style.height = '100%';
    hudContainer.style.pointerEvents = 'none';
    document.getElementById('game3d').appendChild(hudContainer);
    
    // Crear crosshair mejorado
    createCrosshair();
    
    // Barra de salud
    createHealthBar();
    
    // Indicador de arma
    createWeaponIndicator();
    
    // Indicador de munición
    createAmmoCounter();
    
    // Barra de stamina
    createStaminaBar();
    
    // Indicador de carga (para railgun)
    createChargeIndicator();
    
    // Indicador de daño
    createDamageIndicator();
    
    // Mini mapa
    if (qualityLevel !== 'low') {
        createMinimap();
    }
}

function createCrosshair() {
    const crosshair = document.createElement('div');
    crosshair.id = 'crosshair3d';
    crosshair.style.position = 'absolute';
    crosshair.style.top = '50%';
    crosshair.style.left = '50%';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.width = '20px';
    crosshair.style.height = '20px';
    crosshair.style.pointerEvents = 'none';
    
    // Crosshair moderno con HTML y CSS
    crosshair.innerHTML = `
        <div style="position:absolute; width:16px; height:2px; background:rgba(0,255,0,0.7); top:9px; left:2px;"></div>
        <div style="position:absolute; width:2px; height:16px; background:rgba(0,255,0,0.7); top:2px; left:9px;"></div>
        <div style="position:absolute; width:6px; height:6px; border:1px solid rgba(0,255,0,0.7); border-radius:50%; top:6px; left:6px;"></div>
    `;
    
    document.getElementById('game3dHUD').appendChild(crosshair);
}

function createHealthBar() {
    const healthContainer = document.createElement('div');
    healthContainer.id = 'healthContainer';
    healthContainer.style.position = 'absolute';
    healthContainer.style.bottom = '20px';
    healthContainer.style.left = '20px';
    healthContainer.style.width = '200px';
    healthContainer.style.height = '15px';
    healthContainer.style.background = 'rgba(0,0,0,0.5)';
    healthContainer.style.border = '1px solid rgba(255,255,255,0.3)';
    healthContainer.style.borderRadius = '3px';
    
    const healthFill = document.createElement('div');
    healthFill.id = 'healthFill';
    healthFill.style.width = '100%';
    healthFill.style.height = '100%';
    healthFill.style.background = 'linear-gradient(to right, #ff0000, #ff6600)';
    healthFill.style.borderRadius = '2px';
    healthFill.style.transition = 'width 0.3s ease';
    
    const healthText = document.createElement('div');
    healthText.id = 'healthText';
    healthText.style.position = 'absolute';
    healthText.style.top = '-20px';
    healthText.style.left = '0';
    healthText.style.color = '#ffffff';
    healthText.style.fontSize = '14px';
    healthText.style.fontFamily = 'Arial, sans-serif';
    healthText.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    healthText.innerText = 'SALUD: 100';
    
    healthContainer.appendChild(healthFill);
    healthContainer.appendChild(healthText);
    document.getElementById('game3dHUD').appendChild(healthContainer);
}

function createWeaponIndicator() {
    const weaponContainer = document.createElement('div');
    weaponContainer.id = 'weaponContainer';
    weaponContainer.style.position = 'absolute';
    weaponContainer.style.bottom = '20px';
    weaponContainer.style.right = '20px';
    weaponContainer.style.display = 'flex';
    weaponContainer.style.flexDirection = 'column';
    weaponContainer.style.alignItems = 'flex-end';
    
    // Nombre del arma
    const weaponName = document.createElement('div');
    weaponName.id = 'weaponName';
    weaponName.style.color = '#ffffff';
    weaponName.style.fontSize = '18px';
    weaponName.style.fontFamily = 'Arial, sans-serif';
    weaponName.style.marginBottom = '5px';
    weaponName.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    weaponName.innerText = weapons[currentWeapon].name.toUpperCase();
    
    // Selector de armas
    const weaponSelector = document.createElement('div');
    weaponSelector.id = 'weaponSelector';
    weaponSelector.style.display = 'flex';
    weaponSelector.style.gap = '5px';
    
    const weaponSlots = [
        { id: 'slot1', weapon: 'blaster', key: '1' },
        { id: 'slot2', weapon: 'shotgun', key: '2' },
        { id: 'slot3', weapon: 'railgun', key: '3' }
    ];
    
    for (const slot of weaponSlots) {
        const weaponSlot = document.createElement('div');
        weaponSlot.id = slot.id;
        weaponSlot.style.width = '40px';
        weaponSlot.style.height = '30px';
        weaponSlot.style.background = 'rgba(0,0,0,0.5)';
        weaponSlot.style.border = slot.weapon === currentWeapon ? 
            '2px solid rgba(0,255,0,0.8)' : '1px solid rgba(255,255,255,0.3)';
        weaponSlot.style.borderRadius = '3px';
        weaponSlot.style.display = 'flex';
        weaponSlot.style.justifyContent = 'center';
        weaponSlot.style.alignItems = 'center';
        weaponSlot.style.color = '#ffffff';
        weaponSlot.style.fontSize = '14px';
        weaponSlot.style.fontFamily = 'Arial, sans-serif';
        weaponSlot.innerText = slot.key;
        
        weaponSelector.appendChild(weaponSlot);
    }
    
    weaponContainer.appendChild(weaponName);
    weaponContainer.appendChild(weaponSelector);
    document.getElementById('game3dHUD').appendChild(weaponContainer);
}

function createAmmoCounter() {
    const ammoContainer = document.createElement('div');
    ammoContainer.id = 'ammoContainer';
    ammoContainer.style.position = 'absolute';
    ammoContainer.style.bottom = '60px';
    ammoContainer.style.right = '20px';
    ammoContainer.style.color = '#ffffff';
    ammoContainer.style.fontSize = '24px';
    ammoContainer.style.fontFamily = 'Arial, sans-serif';
    ammoContainer.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    
    // Mostrar munición infinita para blaster
    ammoContainer.innerText = currentAmmo[currentWeapon] < 0 ? '∞' : currentAmmo[currentWeapon];
    
    document.getElementById('game3dHUD').appendChild(ammoContainer);
}

function createStaminaBar() {
    const staminaContainer = document.createElement('div');
    staminaContainer.id = 'staminaContainer';
    staminaContainer.style.position = 'absolute';
    staminaContainer.style.bottom = '40px';
    staminaContainer.style.left = '20px';
    staminaContainer.style.width = '150px';
    staminaContainer.style.height = '8px';
    staminaContainer.style.background = 'rgba(0,0,0,0.5)';
    staminaContainer.style.border = '1px solid rgba(255,255,255,0.3)';
    staminaContainer.style.borderRadius = '3px';
    
    const staminaFill = document.createElement('div');
    staminaFill.id = 'staminaFill';
    staminaFill.style.width = '100%';
    staminaFill.style.height = '100%';
    staminaFill.style.background = 'linear-gradient(to right, #3366ff, #3399ff)';
    staminaFill.style.borderRadius = '2px';
    staminaFill.style.transition = 'width 0.3s ease';
    
    staminaContainer.appendChild(staminaFill);
    document.getElementById('game3dHUD').appendChild(staminaContainer);
}

function createChargeIndicator() {
    const chargeContainer = document.createElement('div');
    chargeContainer.id = 'chargeContainer';
    chargeContainer.style.position = 'absolute';
    chargeContainer.style.top = '50%';
    chargeContainer.style.left = '50%';
    chargeContainer.style.transform = 'translate(-50%, 30px)';
    chargeContainer.style.width = '100px';
    chargeContainer.style.height = '8px';
    chargeContainer.style.background = 'rgba(0,0,0,0.5)';
    chargeContainer.style.border = '1px solid rgba(255,255,255,0.3)';
    chargeContainer.style.borderRadius = '3px';
    chargeContainer.style.display = 'none'; // Oculto por defecto
    
    const chargeFill = document.createElement('div');
    chargeFill.id = 'chargeFill';
    chargeFill.style.width = '0%';
    chargeFill.style.height = '100%';
    chargeFill.style.background = 'linear-gradient(to right, #00ccff, #00ffff)';
    chargeFill.style.borderRadius = '2px';
    
    chargeContainer.appendChild(chargeFill);
    document.getElementById('game3dHUD').appendChild(chargeContainer);
}

function createDamageIndicator() {
    const damageOverlay = document.createElement('div');
    damageOverlay.id = 'damageOverlay';
    damageOverlay.style.position = 'absolute';
    damageOverlay.style.top = '0';
    damageOverlay.style.left = '0';
    damageOverlay.style.width = '100%';
    damageOverlay.style.height = '100%';
    damageOverlay.style.boxShadow = 'inset 0 0 50px rgba(255,0,0,0)';
    damageOverlay.style.pointerEvents = 'none';
    damageOverlay.style.transition = 'box-shadow 0.5s ease';
    
    document.getElementById('game3dHUD').appendChild(damageOverlay);
}

function createMinimap() {
    const minimapContainer = document.createElement('div');
    minimapContainer.id = 'minimapContainer';
    minimapContainer.style.position = 'absolute';
    minimapContainer.style.top = '20px';
    minimapContainer.style.right = '20px';
    minimapContainer.style.width = '150px';
    minimapContainer.style.height = '150px';
    minimapContainer.style.background = 'rgba(0,0,0,0.5)';
    minimapContainer.style.border = '1px solid rgba(255,255,255,0.3)';
    minimapContainer.style.borderRadius = '3px';
    
    // Canvas para dibujar el minimapa
    const minimapCanvas = document.createElement('canvas');
    minimapCanvas.id = 'minimapCanvas';
    minimapCanvas.width = 150;
    minimapCanvas.height = 150;
    minimapCanvas.style.width = '100%';
    minimapCanvas.style.height = '100%';
    
    minimapContainer.appendChild(minimapCanvas);
    document.getElementById('game3dHUD').appendChild(minimapContainer);
}

// Funciones para actualizar la interfaz
function updateHealthUI(health) {
    const healthFill = document.getElementById('healthFill');
    const healthText = document.getElementById('healthText');
    
    if (healthFill && healthText) {
        const healthPercent = Math.max(0, Math.min(100, health));
        healthFill.style.width = `${healthPercent}%`;
        healthText.innerText = `SALUD: ${Math.round(healthPercent)}`;
        
        // Cambiar color basado en la salud
        if (healthPercent > 60) {
            healthFill.style.background = 'linear-gradient(to right, #ff0000, #ff6600)';
        } else if (healthPercent > 30) {
            healthFill.style.background = 'linear-gradient(to right, #ff0000, #ff3300)';
        } else {
            healthFill.style.background = '#ff0000';
        }
    }
}

function updateStaminaUI(staminaPercent) {
    const staminaFill = document.getElementById('staminaFill');
    
    if (staminaFill) {
        staminaFill.style.width = `${staminaPercent * 100}%`;
        
        // Cambiar color basado en la stamina
        if (staminaPercent > 0.6) {
            staminaFill.style.background = 'linear-gradient(to right, #3366ff, #3399ff)';
        } else if (staminaPercent > 0.3) {
            staminaFill.style.background = 'linear-gradient(to right, #3366ff, #ff9900)';
        } else {
            staminaFill.style.background = 'linear-gradient(to right, #ff9900, #ff3300)';
        }
    }
}

function updateWeaponUI() {
    const weaponName = document.getElementById('weaponName');
    const ammoContainer = document.getElementById('ammoContainer');
    
    if (weaponName) {
        weaponName.innerText = weapons[currentWeapon].name.toUpperCase();
    }
    
    if (ammoContainer) {
        ammoContainer.innerText = currentAmmo[currentWeapon] < 0 ? '∞' : currentAmmo[currentWeapon];
    }
    
    // Actualizar selección de arma
    for (let i = 1; i <= 3; i++) {
        const slot = document.getElementById(`slot${i}`);
        if (slot) {
            if ((i === 1 && currentWeapon === 'blaster') ||
                (i === 2 && currentWeapon === 'shotgun') ||
                (i === 3 && currentWeapon === 'railgun')) {
                slot.style.border = '2px solid rgba(0,255,0,0.8)';
            } else {
                slot.style.border = '1px solid rgba(255,255,255,0.3)';
            }
        }
    }
}

function updateAmmoUI() {
    const ammoContainer = document.getElementById('ammoContainer');
    
    if (ammoContainer) {
        ammoContainer.innerText = currentAmmo[currentWeapon] < 0 ? '∞' : currentAmmo[currentWeapon];
        
        // Flash de color cuando queda poca munición
        if (currentAmmo[currentWeapon] > 0 && currentAmmo[currentWeapon] <= 5) {
            ammoContainer.style.color = '#ff3300';
            setTimeout(() => {
                if (ammoContainer) ammoContainer.style.color = '#ffffff';
            }, 300);
        }
    }
}

function updateChargeUI(chargePercent) {
    const chargeContainer = document.getElementById('chargeContainer');
    const chargeFill = document.getElementById('chargeFill');
    
    if (chargeContainer && chargeFill) {
        if (chargePercent > 0) {
            chargeContainer.style.display = 'block';
            chargeFill.style.width = `${chargePercent * 100}%`;
            
            // Cambiar color basado en la carga
            if (chargePercent >= 1.0) {
                chargeFill.style.background = 'linear-gradient(to right, #ff00ff, #00ffff)';
            } else if (chargePercent > 0.6) {
                chargeFill.style.background = 'linear-gradient(to right, #00ccff, #00ffff)';
            } else {
                chargeFill.style.background = 'linear-gradient(to right, #0066ff, #00ccff)';
            }
        } else {
            chargeContainer.style.display = 'none';
        }
    }
}

function showDamageEffect(intensity) {
    const damageOverlay = document.getElementById('damageOverlay');
    
    if (damageOverlay) {
        // Intensidad entre 0 y 1
        const damageOpacity = Math.min(0.8, intensity);
        damageOverlay.style.boxShadow = `inset 0 0 100px rgba(255,0,0,${damageOpacity})`;
        
        // Efecto de desvanecimiento
        setTimeout(() => {
            if (damageOverlay) {
                damageOverlay.style.boxShadow = 'inset 0 0 100px rgba(255,0,0,0)';
            }
        }, 500);
    }
}

function updateMinimap() {
    const canvas = document.getElementById('minimapCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Limpiar el canvas
    ctx.clearRect(0, 0, width, height);
    
    // Dibujar el fondo
    ctx.fillStyle = 'rgba(10, 20, 40, 0.8)';
    ctx.fillRect(0, 0, width, height);
    
    // Escala del minimapa
    const scale = width / GAME_CONSTANTS.ARENA_SIZE;
    
    // Dibujar el borde de la arena
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);
    
    // Dibujar grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.lineWidth = 0.5;
    
    const gridSize = 5;
    for (let i = 0; i <= GAME_CONSTANTS.ARENA_SIZE; i += gridSize) {
        const pos = i * scale;
        
        // Línea horizontal
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(width, pos);
        ctx.stroke();
        
        // Línea vertical
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, height);
        ctx.stroke();
    }
    
    // Dibujar jugadores
    for (const id in players) {
        const player = players[id].mesh;
        const x = (player.position.x + GAME_CONSTANTS.ARENA_SIZE/2) * scale;
        const y = (player.position.z + GAME_CONSTANTS.ARENA_SIZE/2) * scale;
        
        // Color diferente para el jugador local
        if (id === myId) {
            // Dibujar triángulo para mostrar dirección
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + dir.x * 8, y + dir.z * 8);
            ctx.lineTo(x + dir.z * 3, y - dir.x * 3);
            ctx.closePath();
            ctx.fill();
            
            // Circulo para el jugador
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Dibujar power-ups
    for (const powerUp of powerUps) {
        const x = (powerUp.position.x + GAME_CONSTANTS.ARENA_SIZE/2) * scale;
        const y = (powerUp.position.z + GAME_CONSTANTS.ARENA_SIZE/2) * scale;
        
        let color;
        switch(powerUp.type) {
            case 'health': color = 'rgba(0, 255, 0, 0.8)'; break;
            case 'speed': color = 'rgba(0, 0, 255, 0.8)'; break;
            default: color = 'rgba(255, 255, 0, 0.8)';
        }
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Sistema de movimiento avanzado
function setupControls() {
    controls = {
        moveForward: false,
        moveBackward: false,
        moveLeft: false,
        moveRight: false,
        run: false,
        jump: false,
        crouch: false,
        weaponSlot1: true,
        weaponSlot2: false,
        weaponSlot3: false
    };
    
    // Variables para el salto
    controls.isJumping = false;
    controls.isCrouching = false;
    controls.jumpHeight = 3;
    controls.jumpSpeed = 0.15;
    controls.crouchHeight = 0.5;
    controls.gravity = 0.01;
    controls.verticalVelocity = 0;
    controls.playerHeight = 1; // Altura base del jugador
    controls.playerStandingHeight = 1.6; // Altura de ojos en pie
    controls.playerCrouchingHeight = 0.8; // Altura de ojos agachado
    
    // Stamina para sprint
    controls.stamina = 100;
    controls.maxStamina = 100;
    controls.staminaRegenRate = 0.5;
    controls.sprintStaminaCost = 1;
}

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
    // Crear skybox (cielo)
    createSkybox();
    
    // Suelo futurista con cuadrícula
    createFuturisticFloor();
    
    // Añadir niebla atmosférica
    scene.fog = new THREE.FogExp2(0x0a1a2a, 0.015);
    
    // Crear paredes con efecto de cristal futurista
    const wallMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0x88ffff,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });

    // Añadir árboles futuristas
    createTrees(GAME_CONSTANTS.NUM_TREES);
    
    // Añadir rocas
    createRocks(GAME_CONSTANTS.NUM_ROCKS);
    
    // Añadir elementos decorativos
    createDecorations();
}

function createSkybox() {
    const skyboxGeometry = new THREE.BoxGeometry(500, 500, 500);
    const skyboxMaterials = [
        new THREE.MeshBasicMaterial({ 
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/cube/skybox/px.jpg'), 
            side: THREE.BackSide 
        }),
        new THREE.MeshBasicMaterial({ 
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/cube/skybox/nx.jpg'), 
            side: THREE.BackSide 
        }),
        new THREE.MeshBasicMaterial({ 
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/cube/skybox/py.jpg'), 
            side: THREE.BackSide 
        }),
        new THREE.MeshBasicMaterial({ 
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/cube/skybox/ny.jpg'), 
            side: THREE.BackSide 
        }),
        new THREE.MeshBasicMaterial({ 
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/cube/skybox/pz.jpg'), 
            side: THREE.BackSide 
        }),
        new THREE.MeshBasicMaterial({ 
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/cube/skybox/nz.jpg'), 
            side: THREE.BackSide 
        })
    ];
    skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
    scene.add(skybox);
}

function createFuturisticFloor() {
    // Textura base
    const textureLoader = new THREE.TextureLoader();
    const gridTexture = textureLoader.load('https://threejs.org/examples/textures/grid.png');
    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.repeat.set(40, 40);
    
    // Material principal del suelo
    const floorGeometry = new THREE.PlaneGeometry(GAME_CONSTANTS.ARENA_SIZE, GAME_CONSTANTS.ARENA_SIZE, 50, 50);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        map: gridTexture,
        color: 0x0a1a2a,
        roughness: 0.3,
        metalness: 0.7,
        emissive: 0x0066aa,
        emissiveIntensity: 0.2
    });
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = qualityLevel !== 'low';
    scene.add(floor);
    
    // Añadir líneas de luz en el suelo (efecto neón)
    floorGrid = new THREE.Group();
    const lineSpacing = 5;
    const lineColor = 0x00ffff;
    
    for (let x = -GAME_CONSTANTS.ARENA_SIZE/2; x <= GAME_CONSTANTS.ARENA_SIZE/2; x += lineSpacing) {
        const lineGeometry = new THREE.BoxGeometry(0.1, 0.01, GAME_CONSTANTS.ARENA_SIZE);
        const lineMaterial = new THREE.MeshBasicMaterial({ 
            color: lineColor,
            transparent: true,
            opacity: 0.7
        });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(x, 0.01, 0);
        floorGrid.add(line);
    }
    
    for (let z = -GAME_CONSTANTS.ARENA_SIZE/2; z <= GAME_CONSTANTS.ARENA_SIZE/2; z += lineSpacing) {
        const lineGeometry = new THREE.BoxGeometry(GAME_CONSTANTS.ARENA_SIZE, 0.01, 0.1);
        const lineMaterial = new THREE.MeshBasicMaterial({ 
            color: lineColor,
            transparent: true,
            opacity: 0.7
        });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(0, 0.01, z);
        floorGrid.add(line);
    }
    
    scene.add(floorGrid);
    
    // Añadir puntos de energía en las intersecciones
    for (let x = -GAME_CONSTANTS.ARENA_SIZE/2; x <= GAME_CONSTANTS.ARENA_SIZE/2; x += lineSpacing) {
        for (let z = -GAME_CONSTANTS.ARENA_SIZE/2; z <= GAME_CONSTANTS.ARENA_SIZE/2; z += lineSpacing) {
            const pointGeometry = new THREE.SphereGeometry(0.15, 8, 8);
            const pointMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x00ffff,
                transparent: true,
                opacity: 0.9
            });
            const point = new THREE.Mesh(pointGeometry, pointMaterial);
            point.position.set(x, 0.05, z);
            floorGrid.add(point);
        }
    }
}

function createTrees(count) {
    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 5);
        const z = (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 5);
        
        // Crear árbol futurista
        const treeGroup = new THREE.Group();
        
        // Base del árbol
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.4,
            metalness: 0.8
        });
        const baseGeometry = new THREE.CylinderGeometry(0.5, 0.8, 0.4, 8);
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.2;
        treeGroup.add(base);
        
        // Tronco
        const trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.5,
            metalness: 0.7,
            emissive: 0x006600,
            emissiveIntensity: 0.2
        });
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.5, 3, 8);
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1.9;
        treeGroup.add(trunk);
        
        // Elementos luminosos
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff66,
            transparent: true,
            opacity: 0.8
        });
        
        for (let j = 0; j < 3; j++) {
            const height = 0.8 + j * 1.0;
            const radius = 0.8 - j * 0.15;
            
            // Anillos energéticos
            const ringGeometry = new THREE.TorusGeometry(radius, 0.05, 8, 16);
            const ring = new THREE.Mesh(ringGeometry, glowMaterial);
            ring.position.y = height;
            ring.rotation.x = Math.PI/2;
            treeGroup.add(ring);
            
            // Esferas flotantes
            for (let k = 0; k < 4; k++) {
                const angle = (k / 4) * Math.PI * 2;
                const orbGeometry = new THREE.SphereGeometry(0.1, 8, 8);
                const orb = new THREE.Mesh(orbGeometry, glowMaterial);
                orb.position.y = height;
                orb.position.x = Math.cos(angle) * radius;
                orb.position.z = Math.sin(angle) * radius;
                treeGroup.add(orb);
                
                // Guardar para animación
                orb.userData = {
                    baseHeight: height,
                    angle: angle,
                    radius: radius,
                    speed: 0.5 + Math.random()
                };
            }
        }
        
        // Luz interna
        const light = new THREE.PointLight(0x00ff66, 0.8, 5);
        light.position.y = 2;
        treeGroup.add(light);
        
        treeGroup.position.set(x, 0, z);
        scene.add(treeGroup);
    }
}

function createRocks(count) {
    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 3);
        const z = (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 3);
        
        // Geometría de cristal para las rocas
        const rockGeometry = new THREE.DodecahedronGeometry(Math.random() * 0.5 + 0.5, 0);
        
        const rockMaterial = new THREE.MeshPhysicalMaterial({ 
            color: 0x6688dd,
            roughness: 0.1,
            metalness: 0.2,
            transparent: true,
            opacity: 0.7,
            clearcoat: 1.0,
            clearcoatRoughness: 0.2
        });
        
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.set(x, 0.5, z);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        rock.castShadow = true;
        rock.receiveShadow = true;
        
        // Luz interior
        const light = new THREE.PointLight(0x6688dd, 0.5, 2);
        rock.add(light);
        
        scene.add(rock);
    }
}

function createDecorations() {
    // Pilares en las esquinas
    const cornerPositions = [
        {x: -GAME_CONSTANTS.ARENA_SIZE/2 + 2, z: -GAME_CONSTANTS.ARENA_SIZE/2 + 2},
        {x: -GAME_CONSTANTS.ARENA_SIZE/2 + 2, z: GAME_CONSTANTS.ARENA_SIZE/2 - 2},
        {x: GAME_CONSTANTS.ARENA_SIZE/2 - 2, z: -GAME_CONSTANTS.ARENA_SIZE/2 + 2},
        {x: GAME_CONSTANTS.ARENA_SIZE/2 - 2, z: GAME_CONSTANTS.ARENA_SIZE/2 - 2}
    ];
    
    for (const pos of cornerPositions) {
        createEnergyPillar(pos.x, pos.z);
    }
}

function createEnergyPillar(x, z) {
    const pillarGroup = new THREE.Group();
    
    // Base
    const baseGeometry = new THREE.CylinderGeometry(1, 1.2, 0.5, 8);
    const baseMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.3,
        metalness: 0.9
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.25;
    pillarGroup.add(base);
    
    // Columna central
    const pillarGeometry = new THREE.CylinderGeometry(0.5, 0.5, 8, 8);
    const pillarMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.5,
        metalness: 0.8
    });
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.y = 4.5;
    pillarGroup.add(pillar);
    
    // Núcleo de energía
    const coreGeometry = new THREE.CylinderGeometry(0.3, 0.3, 7, 8);
    const coreMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 4.5;
    pillarGroup.add(core);
    
    // Anillos decorativos
    for (let i = 0; i < 4; i++) {
        const ringGeometry = new THREE.TorusGeometry(0.8, 0.1, 8, 16);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            emissive: 0x00ffff,
            emissiveIntensity: 0.3,
            roughness: 0.3,
            metalness: 0.9
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.y = 2 + i * 2;
        ring.rotation.x = Math.PI/2;
        pillarGroup.add(ring);
    }
    
    // Luz
    const light = new THREE.PointLight(0x00ffff, 1, 10);
    light.position.y = 6;
    pillarGroup.add(light);
    
    // Partículas de energía
    const particleGroup = new THREE.Group();
    for (let i = 0; i < 20; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8
        });
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.3 + Math.random() * 0.3;
        const height = Math.random() * 7;
        
        particle.position.x = Math.cos(angle) * radius;
        particle.position.z = Math.sin(angle) * radius;
        particle.position.y = 1 + height;
        
        particle.userData = {
            baseHeight: 1 + height,
            angle: angle,
            radius: radius,
            speed: 0.2 + Math.random() * 0.5
        };
        
        particleGroup.add(particle);
        particles.push({
            mesh: particle,
            group: particleGroup
        });
    }
    
    pillarGroup.add(particleGroup);
    pillarGroup.position.set(x, 0, z);
    scene.add(pillarGroup);
}

// Actualizar animaciones del entorno
function updateEnvironment(deltaTime) {
    time += deltaTime * 0.001;
    
    // Animar partículas de energía
    for (const particle of particles) {
        const p = particle.mesh;
        const data = p.userData;
        
        // Mover partículas en espiral
        data.angle += data.speed * deltaTime * 0.01;
        p.position.x = Math.cos(data.angle) * data.radius;
        p.position.z = Math.sin(data.angle) * data.radius;
        
        // Fluctuación vertical
        p.position.y = data.baseHeight + Math.sin(time * data.speed) * 0.2;
    }
    
    // Animar intensidad de las líneas de la cuadrícula
    if (floorGrid) {
        for (let i = 0; i < floorGrid.children.length; i++) {
            const line = floorGrid.children[i];
            if (line.material) {
                // Efecto pulsante
                line.material.opacity = 0.5 + Math.sin(time * 2 + i * 0.1) * 0.3;
            }
        }
    }
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

function createBullet(position, direction, weapon) {
    const geometry = new THREE.SphereGeometry(GAME_CONSTANTS.BULLET_SIZE / 2, 8, 8);
    const material = new THREE.MeshPhongMaterial({ 
        color: weapon.color,
        shininess: 100,
        emissive: weapon.color,
        emissiveIntensity: 0.5
    });
    const bullet = new THREE.Mesh(geometry, material);
    
    // Añadir luz a la bala
    const bulletLight = new THREE.PointLight(weapon.color, 1, 3);
    bullet.add(bulletLight);
    
    bullet.position.copy(position);
    bullet.direction = direction.clone();
    bullet.speed = weapon.speed || GAME_CONSTANTS.BULLET_SPEED;
    bullet.damage = weapon.damage;
    bullet.castShadow = true;
    bullet.owner = myId;
    
    // Añadir estela
    const trailMaterial = new THREE.MeshBasicMaterial({
        color: weapon.color,
        transparent: true,
        opacity: 0.5
    });
    
    bullet.trail = [];
    bullet.lastTrailPosition = position.clone();
    
    scene.add(bullet);
    bullets.push(bullet);
    
    // Eliminar la bala después de 2 segundos
    setTimeout(() => {
        // Eliminar la estela
        for (const segment of bullet.trail) {
            scene.remove(segment);
        }
        
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
        const weapon = weapons[currentWeapon];
        
        // Comprobar munición
        if (currentAmmo[currentWeapon] === 0) {
            playSound('empty');
            return;
        }
        
        const now = Date.now();
        
        // Caso especial para railgun (carga)
        if (currentWeapon === 'railgun') {
            if (!isCharging) {
                isCharging = true;
                weaponCharge = 0;
                playSound('charging');
                
                // Iniciar animación de carga
                startChargeEffect();
            }
            return;
        }
        
        // Para otras armas, comprobación normal de cadencia
        if (now - lastShootTime >= weapon.fireRate) {
            fireWeapon();
        }
    }
}

function onMouseUp(event) {
    // Disparar railgun al soltar el botón
    if (isCharging && currentWeapon === 'railgun') {
        const chargePercent = Math.min(1.0, weaponCharge / weapons.railgun.chargeTime);
        
        if (chargePercent > 0.2) {
            fireWeapon(chargePercent);
        } else {
            cancelCharge();
        }
        
        isCharging = false;
        weaponCharge = 0;
    }
}

function startChargeEffect() {
    // Crear efecto visual de carga
    const playerPos = players[myId].mesh.position.clone();
    playerPos.y += 1.5;
    
    const chargeLight = new THREE.PointLight(0x00ffff, 0, 5);
    chargeLight.position.copy(playerPos);
    scene.add(chargeLight);
    
    // Animación de carga
    const chargeInterval = setInterval(() => {
        if (!isCharging) {
            clearInterval(chargeInterval);
            scene.remove(chargeLight);
            return;
        }
        
        weaponCharge += 16.67; // Incremento aproximado por frame
        const percent = Math.min(1.0, weaponCharge / weapons.railgun.chargeTime);
        
        // Aumentar intensidad de luz
        chargeLight.intensity = percent * 2;
        
        // Actualizar UI de carga
        updateChargeUI(percent);
        
        if (percent >= 1.0) {
            clearInterval(chargeInterval);
        }
    }, 16.67);
}

function cancelCharge() {
    isCharging = false;
    weaponCharge = 0;
    updateChargeUI(0);
    playSound('chargeCancel');
}

function fireWeapon(chargePercent = 1.0) {
    const weapon = weapons[currentWeapon];
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    const position = players[myId].mesh.position.clone();
    position.y += 1.5; // Altura de disparo ajustada
    
    // Descontar munición
    if (weapon.ammo > 0) {
        currentAmmo[currentWeapon]--;
        updateAmmoUI();
    }
    
    // Agregar efectos basados en el tipo de arma
    switch(currentWeapon) {
        case 'blaster':
            // Disparo básico
            createMuzzleFlash(position, direction, weapon.color);
            createBullet(position, direction, weapon);
            applyCameraRecoil(weapon.recoil);
            playSound(weapon.sound);
            break;
            
        case 'shotgun':
            // Múltiples proyectiles con dispersión
            createMuzzleFlash(position, direction, weapon.color, 1.5);
            
            for (let i = 0; i < weapon.pellets; i++) {
                const spread = weapon.spread;
                const randomDir = direction.clone();
                
                // Añadir dispersión aleatoria
                randomDir.x += (Math.random() - 0.5) * spread;
                randomDir.y += (Math.random() - 0.5) * spread;
                randomDir.z += (Math.random() - 0.5) * spread;
                randomDir.normalize();
                
                createBullet(position, randomDir, weapon);
            }
            
            applyCameraRecoil(weapon.recoil);
            playSound(weapon.sound);
            break;
            
        case 'railgun':
            // Rayo potente con carga
            createRailgunBeam(position, direction, chargePercent);
            applyCameraRecoil(weapon.recoil * chargePercent);
            playSound(weapon.sound);
            
            // Retroceso más fuerte
            const kickback = new THREE.Vector3()
                .copy(direction)
                .multiplyScalar(-0.2 * chargePercent);
            players[myId].mesh.position.add(kickback);
            break;
    }
    
    lastShootTime = Date.now();
    shootCooldown = true;
    setTimeout(() => { shootCooldown = false; }, weapon.fireRate);
    
    // Emitir evento al servidor
    socket.emit('shoot', { 
        position: position, 
        direction: direction,
        weapon: currentWeapon,
        power: chargePercent
    });
}

function createMuzzleFlash(position, direction, color, scale = 1.0) {
    // Crear luz temporal para el destello
    const flashLight = new THREE.PointLight(color, 3, 8);
    flashLight.position.copy(position);
    scene.add(flashLight);
    
    // Crear geometría del destello
    const flashGeometry = new THREE.SphereGeometry(0.1 * scale, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.8
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    flash.position.add(direction.clone().multiplyScalar(0.5)); // Posicionar frente al arma
    scene.add(flash);
    
    // Partículas de destello
    const particleCount = Math.floor(10 * scale);
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.03, 4, 4);
        const particleMaterial = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 0.8
        });
        
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        // Posición inicial
        particle.position.copy(position);
        particle.position.add(direction.clone().multiplyScalar(0.5));
        
        // Velocidad aleatoria
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1 * scale,
            (Math.random() - 0.5) * 0.1 * scale,
            (Math.random() - 0.5) * 0.1 * scale
        );
        particle.velocity.add(direction.clone().multiplyScalar(0.05 * scale));
        
        particles.add(particle);
    }
    
    scene.add(particles);
    
    // Animar destello y eliminarlo
    let lifetime = 10;
    const animate = () => {
        lifetime--;
        if (lifetime <= 0) {
            scene.remove(flash);
            scene.remove(flashLight);
            scene.remove(particles);
            return;
        }
        
        // Animar partículas
        for (let i = 0; i < particles.children.length; i++) {
            const particle = particles.children[i];
            particle.position.add(particle.velocity);
            particle.material.opacity -= 0.08;
            particle.scale.multiplyScalar(0.92);
        }
        
        flash.scale.multiplyScalar(0.8);
        flashLight.intensity *= 0.8;
        
        requestAnimationFrame(animate);
    };
    
    animate();
}

function createRailgunBeam(position, direction, power) {
    // Crear geometría del rayo
    const beamLength = GAME_CONSTANTS.ARENA_SIZE * 2;
    const beamGeometry = new THREE.CylinderGeometry(0.05 * power, 0.05 * power, beamLength, 8);
    beamGeometry.rotateX(Math.PI / 2);
    
    const beamMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8
    });
    
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    
    // Posicionar el rayo frente al jugador
    beam.position.copy(position);
    beam.position.add(direction.clone().multiplyScalar(beamLength / 2));
    
    // Orientar el rayo en la dirección del disparo
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    
    scene.add(beam);
    
    // Añadir luz al rayo
    const beamLight = new THREE.PointLight(0x00ffff, 2 * power, 15);
    beamLight.position.copy(position);
    beamLight.position.add(direction.clone().multiplyScalar(2));
    scene.add(beamLight);
    
    // Efecto de impacto (raycast para encontrar el punto de impacto)
    const raycaster = new THREE.Raycaster(position, direction);
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    if (intersects.length > 0) {
        const impact = intersects[0].point;
        createImpactEffect(impact, direction, power, 0x00ffff);
    }
    
    // Animar y eliminar el rayo
    let lifetime = 15;
    const animate = () => {
        lifetime--;
        if (lifetime <= 0) {
            scene.remove(beam);
            scene.remove(beamLight);
            return;
        }
        
        // Animación de desvanecimiento
        beam.material.opacity = beam.material.opacity * 0.85;
        beamLight.intensity = beamLight.intensity * 0.85;
        
        requestAnimationFrame(animate);
    };
    
    animate();
}

function createImpactEffect(position, direction, power, color) {
    // Luz de impacto
    const impactLight = new THREE.PointLight(color, 3 * power, 8);
    impactLight.position.copy(position);
    scene.add(impactLight);
    
    // Geometría de explosión
    const explosionGeometry = new THREE.SphereGeometry(0.5 * power, 8, 8);
    const explosionMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8
    });
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(position);
    scene.add(explosion);
    
    // Partículas de impacto
    const particleCount = Math.floor(20 * power);
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const particleGeometry = new THREE.SphereGeometry(0.1, 4, 4);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8
        });
        
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);
        
        // Dirección de rebote (semiesfera opuesta a la dirección de impacto)
        const reboundDir = direction.clone().negate();
        reboundDir.x += (Math.random() - 0.5) * 1.5;
        reboundDir.y += (Math.random() - 0.5) * 1.5;
        reboundDir.z += (Math.random() - 0.5) * 1.5;
        reboundDir.normalize();
        
        particle.velocity = reboundDir.clone().multiplyScalar(0.2 * power * (0.5 + Math.random()));
        particle.gravity = 0.01;
        particle.life = 20 + Math.floor(Math.random() * 20);
        
        scene.add(particle);
        particles.push(particle);
    }
    
    // Animación de impacto
    let frame = 0;
    const animateImpact = () => {
        frame++;
        
        // Actualizar explosión
        if (frame < 20) {
            explosion.scale.multiplyScalar(1.1);
            explosion.material.opacity *= 0.9;
            impactLight.intensity *= 0.9;
            
            requestAnimationFrame(animateImpact);
        } else {
            scene.remove(explosion);
            scene.remove(impactLight);
        }
        
        // Actualizar partículas
        for (let i = particles.length - 1; i >= 0; i--) {
            const particle = particles[i];
            
            particle.position.add(particle.velocity);
            particle.velocity.y -= particle.gravity;
            particle.material.opacity *= 0.95;
            particle.life--;
            
            if (particle.life <= 0) {
                scene.remove(particle);
                particles.splice(i, 1);
            }
        }
        
        if (particles.length > 0) {
            requestAnimationFrame(animateImpact);
        }
    };
    
    animateImpact();
    playSound('impact');
}

function applyCameraRecoil(recoilAmount) {
    // Simular retroceso moviendo ligeramente la cámara
    const originalRotationX = camera.rotation.x;
    camera.rotation.x -= recoilAmount; // Patada hacia arriba
    
    // Animar retorno suave
    let step = 0;
    const steps = 8;
    const recoverRecoil = () => {
        step++;
        if (step >= steps) {
            camera.rotation.x = originalRotationX;
            return;
        }
        
        camera.rotation.x += recoilAmount / steps;
        requestAnimationFrame(recoverRecoil);
    };
    
    requestAnimationFrame(recoverRecoil);
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
        case 'Space':
            if (!controls.isJumping && !controls.isCrouching) {
                controls.isJumping = true;
                controls.verticalVelocity = controls.jumpSpeed;
                playSound('jump');
            }
            break;
        case 'ControlLeft':
            if (!controls.isJumping) {
                controls.isCrouching = true;
            }
            break;
        case 'Digit1':
            currentWeapon = 'blaster';
            controls.weaponSlot1 = true;
            controls.weaponSlot2 = false;
            controls.weaponSlot3 = false;
            updateWeaponUI();
            playSound('weaponSwitch');
            break;
        case 'Digit2':
            currentWeapon = 'shotgun';
            controls.weaponSlot1 = false;
            controls.weaponSlot2 = true;
            controls.weaponSlot3 = false;
            updateWeaponUI();
            playSound('weaponSwitch');
            break;
        case 'Digit3':
            currentWeapon = 'railgun';
            controls.weaponSlot1 = false;
            controls.weaponSlot2 = false;
            controls.weaponSlot3 = true;
            updateWeaponUI();
            playSound('weaponSwitch');
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
        case 'ControlLeft':
            controls.isCrouching = false;
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
            // Eliminar estelas
            for (const segment of bullets[i].trail || []) {
                scene.remove(segment);
            }
            scene.remove(bullets[i]);
        }
        bullets = bullets.slice(excessBullets);
    }
    
    for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];
        const moveAmount = bullet.direction.clone().multiplyScalar(bullet.speed);
        bullet.position.add(moveAmount);
        
        // Crear segmento de estela si nos hemos movido lo suficiente
        const distanceSinceLastTrail = bullet.position.distanceTo(bullet.lastTrailPosition);
        if (distanceSinceLastTrail > 0.5) {
            // Crear geometría de estela
            const trailGeometry = new THREE.CylinderGeometry(0.05, 0.05, distanceSinceLastTrail, 8);
            const trailMaterial = new THREE.MeshBasicMaterial({
                color: bullet.material.emissive,
                transparent: true,
                opacity: 0.3
            });
            
            const trail = new THREE.Mesh(trailGeometry, trailMaterial);
            
            // Posicionar entre la posición actual y la anterior
            const midPoint = new THREE.Vector3().addVectors(
                bullet.position,
                bullet.lastTrailPosition
            ).multiplyScalar(0.5);
            
            trail.position.copy(midPoint);
            
            // Orientar la estela
            trail.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3().subVectors(bullet.position, bullet.lastTrailPosition).normalize()
            );
            
            scene.add(trail);
            bullet.trail.push(trail);
            bullet.lastTrailPosition = bullet.position.clone();
            
            // Desvanecer y eliminar segmentos viejos de la estela
            setTimeout(() => {
                scene.remove(trail);
                if (bullet.trail) {
                    bullet.trail = bullet.trail.filter(t => t !== trail);
                }
            }, 500);
        }
        
        // Comprobar primero límites de la arena
        if (Math.abs(bullet.position.x) > GAME_CONSTANTS.ARENA_SIZE / 2 ||
            Math.abs(bullet.position.z) > GAME_CONSTANTS.ARENA_SIZE / 2 ||
            bullet.position.y < 0 || bullet.position.y > 10) {
            // Crear efecto de impacto en la pared
            createImpactEffect(bullet.position, bullet.direction, 0.3, bullet.material.emissive);
            
            // Eliminar estela
            for (const segment of bullet.trail) {
                scene.remove(segment);
            }
            
            scene.remove(bullet);
            bullets.splice(i, 1);
            i--;
            continue;
        }
        
        // Comprobar colisiones con jugadores
        for (let id in players) {
            if (id !== bullet.owner) {
                const player = players[id].mesh;
                const distance = bullet.position.distanceTo(player.position);
                
                if (distance < GAME_CONSTANTS.PLAYER_SIZE) {
                    // Crear efecto de impacto
                    createImpactEffect(bullet.position, bullet.direction, 0.5, 0xff0000);
                    
                    // Eliminar estela
                    for (const segment of bullet.trail) {
                        scene.remove(segment);
                    }
                    
                    scene.remove(bullet);
                    bullets.splice(i, 1);
                    i--;
                    
                    // Emitir evento de daño al servidor
                    socket.emit('bulletHit', { 
                        playerId: id,
                        damage: bullet.damage
                    });
                    
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
        movePlayer(player, moveSpeed, delta);
    }
    
    updateBullets();
    renderer.render(scene, camera);
}

// Función separada para movimiento (optimización)
function movePlayer(player, moveSpeed, deltaTime) {
    // Vector de movimiento basado en la dirección de la cámara
    const moveVector = new THREE.Vector3();
    
    if (controls.moveForward) moveVector.z -= 1;
    if (controls.moveBackward) moveVector.z += 1;
    if (controls.moveLeft) moveVector.x -= 1;
    if (controls.moveRight) moveVector.x += 1;
    
    // Normalizar el vector si hay movimiento diagonal
    if (moveVector.length() > 0) {
        moveVector.normalize();
        
        // Sprint con gestión de stamina
        let actualSpeed = moveSpeed;
        if (controls.run && controls.stamina > 0 && !controls.isCrouching) {
            actualSpeed *= 1.6;
            controls.stamina -= controls.sprintStaminaCost * deltaTime * 0.05;
            
            // Efecto de respiración cuando se corre
            if (controls.stamina < 30) {
                camera.position.y += Math.sin(time * 10) * 0.005 * (1 - controls.stamina/30);
            }
        } else {
            // Regenerar stamina
            controls.stamina = Math.min(controls.maxStamina, controls.stamina + controls.staminaRegenRate * deltaTime * 0.05);
        }
        
        // Reducir velocidad al agacharse
        if (controls.isCrouching) {
            actualSpeed *= 0.5;
        }
        
        moveVector.multiplyScalar(actualSpeed);
        
        // Rotar el vector de movimiento según la rotación de la cámara
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(cameraRotation.y);
        moveVector.applyMatrix4(rotationMatrix);
        
        // Almacenar posición anterior para detección de colisiones
        const previousPosition = player.position.clone();
        
        // Aplicar movimiento
        player.position.x += moveVector.x;
        player.position.z += moveVector.z;
        
        // Limitar posición dentro de la arena
        player.position.x = Math.max(-GAME_CONSTANTS.ARENA_SIZE/2 + 2, Math.min(GAME_CONSTANTS.ARENA_SIZE/2 - 2, player.position.x));
        player.position.z = Math.max(-GAME_CONSTANTS.ARENA_SIZE/2 + 2, Math.min(GAME_CONSTANTS.ARENA_SIZE/2 - 2, player.position.z));
        
        // Comprobar colisiones con obstáculos (simplificado)
        detectCollisions(player, previousPosition);
        
        // Sonido de pasos
        if (time % 0.5 < 0.05) {
            playSound(controls.run ? 'footstepRun' : 'footstep');
        }
        
        // Efecto de balanceo al caminar
        if (!controls.isJumping) {
            camera.position.y += Math.sin(time * 5) * 0.01;
        }
    }
    
    // Gestionar salto y gravedad
    if (controls.isJumping) {
        player.position.y += controls.verticalVelocity;
        controls.verticalVelocity -= controls.gravity;
        
        // Detectar cuando el jugador toca el suelo
        if (player.position.y <= controls.playerHeight) {
            player.position.y = controls.playerHeight;
            controls.isJumping = false;
            controls.verticalVelocity = 0;
            playSound('land');
        }
    }
    
    // Gestionar agacharse
    const targetHeight = controls.isCrouching ? controls.playerCrouchingHeight : controls.playerStandingHeight;
    const currentEyeHeight = camera.position.y - player.position.y;
    const newEyeHeight = currentEyeHeight + (targetHeight - currentEyeHeight) * 0.2;
    
    // Actualizar posición de la cámara para seguir al jugador en primera persona
    camera.position.x = player.position.x;
    camera.position.z = player.position.z;
    camera.position.y = player.position.y + newEyeHeight;
    
    // Actualizar HUD con información de stamina
    updateStaminaUI(controls.stamina / controls.maxStamina);
}

function detectCollisions(player, previousPosition) {
    // Simulación básica de colisiones con objetos
    // En una implementación real, usarías un sistema de física
    
    // Ejemplo: colisión con obstáculos
    for (const obstacle of obstacles) {
        const distance = player.position.distanceTo(obstacle.position);
        if (distance < 1.5) { // Radio de colisión
            // Retroceder a posición anterior
            player.position.copy(previousPosition);
            break;
        }
    }
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

// Sistema de audio posicional

let audioListener;
let sounds = {};
let soundsLoaded = false;
let audioEnabled = true;

function setupAudio() {
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
    
    // Cargar sonidos
    const soundFiles = {
        // Armas
        'blaster': { url: 'sounds/blaster.mp3', volume: 0.6 },
        'shotgun': { url: 'sounds/shotgun.mp3', volume: 0.7 },
        'railgun': { url: 'sounds/railgun.mp3', volume: 0.7 },
        'charging': { url: 'sounds/charging.mp3', volume: 0.5 },
        'chargeCancel': { url: 'sounds/chargeCancel.mp3', volume: 0.4 },
        'empty': { url: 'sounds/empty.mp3', volume: 0.3 },
        'weaponSwitch': { url: 'sounds/weaponSwitch.mp3', volume: 0.4 },
        
        // Jugador
        'footstep': { url: 'sounds/footstep.mp3', volume: 0.2 },
        'footstepRun': { url: 'sounds/footstepRun.mp3', volume: 0.3 },
        'jump': { url: 'sounds/jump.mp3', volume: 0.4 },
        'land': { url: 'sounds/land.mp3', volume: 0.4 },
        'hurt': { url: 'sounds/hurt.mp3', volume: 0.5 },
        'death': { url: 'sounds/death.mp3', volume: 0.7 },
        'respawn': { url: 'sounds/respawn.mp3', volume: 0.6 },
        
        // Efectos
        'impact': { url: 'sounds/impact.mp3', volume: 0.5 },
        'explosion': { url: 'sounds/explosion.mp3', volume: 0.7 },
        'powerUp': { url: 'sounds/powerUp.mp3', volume: 0.6 },
        
        // Ambiente
        'ambient': { url: 'sounds/ambient.mp3', volume: 0.2, loop: true }
    };
    
    // Función de carga
    const audioLoader = new THREE.AudioLoader();
    let soundsToLoad = Object.keys(soundFiles).length;
    
    for (const [name, config] of Object.entries(soundFiles)) {
        // Fallback a URL de sonido públicos si no tenemos nuestros propios sonidos
        const url = config.url;
        if (!sounds[name]) {
            sounds[name] = new THREE.Audio(audioListener);
            audioLoader.load(url, (buffer) => {
                sounds[name].setBuffer(buffer);
                sounds[name].setVolume(config.volume);
                sounds[name].setLoop(config.loop);
                soundsLoaded = true;
            });
        }
    }
} 