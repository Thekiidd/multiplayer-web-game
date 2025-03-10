            
            // Límites del mapa
            const limit = GAME_CONSTANTS.ARENA_SIZE / 2 - 2;
            player.position.x = Math.max(-limit, Math.min(limit, player.position.x));
            player.position.z = Math.max(-limit, Math.min(limit, player.position.z));
            
            // Seguir al jugador con la cámara
            camera.position.y = player.position.y + 1.6; // Altura de ojos
        }
        
        renderer.render(scene, camera);
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

// Modificar la función createTree para usar menos polígonos en calidades bajas
function createTree(x, z) {
    const treeGroup = new THREE.Group();
    const settings = qualityManager.settings[qualityManager.currentQuality];
    
    // Determinar nivel de detalle basado en calidad
    const segmentsBase = Math.max(4, Math.floor(8 * settings.objectDetail));
    const levelCount = qualityManager.currentQuality === 'low' ? 2 : 3;
    
    // Tronco simplificado
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, segmentsBase);
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4d2926,
        roughness: 0.9 
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.castShadow = settings.shadowMapEnabled;
    trunk.receiveShadow = settings.shadowMapEnabled;
    treeGroup.add(trunk);
    
    // Copa del árbol más simple
    for (let i = 0; i < levelCount; i++) {
        const size = 2 - (i * 0.4);
        const height = 1 + (i * 1.5);
        const leavesGeometry = new THREE.ConeGeometry(size, 2, segmentsBase);
        const leavesMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0d5c0d,
            roughness: 0.8
        });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = height;
        leaves.castShadow = settings.shadowMapEnabled;
        treeGroup.add(leaves);
    }
    
    treeGroup.position.set(x, 0, z);
    return treeGroup;
}

// Reemplazar geometrías complejas con versiones Low-Poly
function createOptimizedRock(x, z) {
    const settings = qualityManager.settings[qualityManager.currentQuality];
    const detail = qualityManager.currentQuality === 'low' ? 0 : 1;
    
    // Usar geometría más simple para rocas
    const rockGeometry = new THREE.IcosahedronGeometry(Math.random() * 0.5 + 0.5, detail);
    
    // Material simplificado
    const rockMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x666666,
    });
    
    // En calidad alta, usar material más complejo
    if (qualityManager.currentQuality === 'high') {
        rockMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x666666,
            roughness: 0.9,
            metalness: 0.1
        });
    }
    
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(x, 0.5, z);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    rock.castShadow = settings.shadowMapEnabled;
    rock.receiveShadow = settings.shadowMapEnabled;
    
    return rock;
}

// Función para crear texturas más pequeñas
function createOptimizedTexture(url) {
    const settings = qualityManager.settings[qualityManager.currentQuality];
    const texture = new THREE.TextureLoader().load(url);
    
    // Reducir resolución en calidades bajas
    if (settings.textureSizeMultiplier < 1.0) {
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
    }
    
    return texture;
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

// Modificar la función animate para incluir medición de FPS y control
function animate(time) {
    requestAnimationFrame(animate);
    
    // Calcular delta time y FPS
    const now = performance.now();
    const deltaTime = now - (lastFrameTime || now);
    lastFrameTime = now;
    
    const fps = 1000 / deltaTime;
    
    // Actualizar sistema de calidad
    qualityManager.updateFPS(fps);
    
    // Resto del código...
    
    // Renderizar escena
    render(deltaTime);
}

// Separar renderizado para mejor control
function render(deltaTime) {
    const settings = qualityManager.settings[qualityManager.currentQuality];
    
    // En calidades bajas, renderizar a resolución reducida
    if (qualityManager.currentQuality === 'low') {
        // Reducir resolución del viewport temporalmente (técnica de dynamic resolution)
        const pixelRatio = renderer.getPixelRatio();
        renderer.setPixelRatio(pixelRatio * 0.75);
        renderer.render(scene, camera);
        renderer.setPixelRatio(pixelRatio);
    } else {
        // Renderizado normal
        renderer.render(scene, camera);
    }
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

// Añadir al inicio del archivo
let qualityManager = {
    currentQuality: 'auto', // 'low', 'medium', 'high', 'auto'
    targetFPS: 45,
    fpsHistory: [],
    fpsUpdateInterval: 1000, // ms
    lastFpsUpdate: 0,
    autoAdjustInterval: 5000, // ms
    lastAutoAdjust: 0,
    
    // Configuraciones para cada nivel de calidad
    settings: {
        low: {
            shadowMapEnabled: false,
            shadowMapSize: 512,
            particlesEnabled: false,
            maxLights: 2,
            drawDistance: 30,
            textureSizeMultiplier: 0.25,
            objectDetail: 0.5,
            postProcessing: false,
            maxBullets: 10,
            trees: 5,
            rocks: 5,
            reflections: false
        },
        medium: {
            shadowMapEnabled: true,
            shadowMapSize: 1024,
            particlesEnabled: true,
            maxLights: 4,
            drawDistance: 50,
            textureSizeMultiplier: 0.5,
            objectDetail: 0.75,
            postProcessing: false,
            maxBullets: 15,
            trees: 10,
            rocks: 8,
            reflections: false
        },
        high: {
            shadowMapEnabled: true,
            shadowMapSize: 2048,
            particlesEnabled: true,
            maxLights: 8,
            drawDistance: 80,
            textureSizeMultiplier: 1.0,
            objectDetail: 1.0,
            postProcessing: true,
            maxBullets: 30,
            trees: 20,
            rocks: 15,
            reflections: true
        }
    },
    
    // Detectar capacidad del dispositivo
    detectCapability: function() {
        // Algunas detecciones básicas
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const hardwareConcurrency = navigator.hardwareConcurrency || 4;
        const isLowEndDevice = hardwareConcurrency <= 4 || isMobile;
        const isHighEndDevice = !isMobile && hardwareConcurrency >= 8;
        
        if (isLowEndDevice) return 'low';
        if (isHighEndDevice) return 'high';
        return 'medium';
    },
    
    // Inicializar
    init: function() {
        // Configurar calidad inicial basada en capacidad o preferencia
        const savedQuality = localStorage.getItem('gameQuality');
        
        if (savedQuality && ['low', 'medium', 'high', 'auto'].includes(savedQuality)) {
            this.currentQuality = savedQuality;
        } else {
            // Auto-detección por defecto
            this.currentQuality = 'auto';
        }
        
        // Si es auto, detectar ahora
        if (this.currentQuality === 'auto') {
            this.currentQuality = this.detectCapability();
        }
        
        this.applySettings();
        this.createQualityUI();
    },
    
    // Aplicar configuración basada en calidad actual
    applySettings: function() {
        const settings = this.settings[this.currentQuality];
        
        // Aplicar configuraciones globales
        GAME_CONSTANTS.NUM_TREES = settings.trees;
        GAME_CONSTANTS.NUM_ROCKS = settings.rocks;
        GAME_CONSTANTS.MAX_BULLETS = settings.maxBullets;
        GAME_CONSTANTS.DRAW_DISTANCE = settings.drawDistance;
        
        // Aplicar a renderer si ya existe
        if (renderer) {
            renderer.shadowMap.enabled = settings.shadowMapEnabled;
            if (settings.shadowMapEnabled) {
                renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            }
            
            // Ajustar pixel ratio para dispositivos de alta densidad
            const pixelRatio = settings.textureSizeMultiplier * (window.devicePixelRatio || 1);
            renderer.setPixelRatio(Math.min(pixelRatio, 1.5));
            
            // Ajustar niebla para limitar distancia de dibujado
            if (scene) {
                scene.fog = new THREE.FogExp2(0x0a1a2a, 1 / (settings.drawDistance * 0.75));
            }
        }
        
        console.log(`Calidad aplicada: ${this.currentQuality}`);
    },
    
    // Interfaz de usuario para ajustar calidad
    createQualityUI: function() {
        const container = document.createElement('div');
        container.id = 'qualityControl';
        container.style.position = 'absolute';
        container.style.top = '10px';
        container.style.left = '10px';
        container.style.background = 'rgba(0,0,0,0.5)';
        container.style.padding = '5px';
        container.style.borderRadius = '5px';
        container.style.color = 'white';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.fontSize = '12px';
        container.style.zIndex = '1000';
        
        // FPS counter
        const fpsDisplay = document.createElement('div');
        fpsDisplay.id = 'fpsCounter';
        fpsDisplay.innerHTML = 'FPS: --';
        
        // Calidad actual
        const qualityDisplay = document.createElement('div');
        qualityDisplay.id = 'qualityDisplay';
        qualityDisplay.innerHTML = `Calidad: ${this.currentQuality.toUpperCase()}`;
        
        // Botones de calidad
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.gap = '5px';
        buttonsContainer.style.marginTop = '5px';
        
        const qualities = ['low', 'medium', 'high', 'auto'];
        qualities.forEach(quality => {
            const button = document.createElement('button');
            button.innerHTML = quality.charAt(0).toUpperCase() + quality.slice(1);
            button.style.flex = '1';
            button.style.padding = '3px';
            button.style.background = this.currentQuality === quality ? '#4CAF50' : '#333';
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.borderRadius = '3px';
            button.style.cursor = 'pointer';
            
            button.addEventListener('click', () => {
                this.setQuality(quality);
                // Actualizar estilos de botones
                buttonsContainer.querySelectorAll('button').forEach(btn => {
                    btn.style.background = '#333';
                });
                button.style.background = '#4CAF50';
            });
            
            buttonsContainer.appendChild(button);
        });
        
        container.appendChild(fpsDisplay);
        container.appendChild(qualityDisplay);
        container.appendChild(buttonsContainer);
        
        document.getElementById('game3d').appendChild(container);
    },
    
    // Cambiar calidad
    setQuality: function(quality) {
        if (!['low', 'medium', 'high', 'auto'].includes(quality)) return;
        
        this.currentQuality = quality === 'auto' ? this.detectCapability() : quality;
        localStorage.setItem('gameQuality', quality); // Guardar preferencia
        
        const qualityDisplay = document.getElementById('qualityDisplay');
        if (qualityDisplay) {
            qualityDisplay.innerHTML = `Calidad: ${this.currentQuality.toUpperCase()}`;
        }
        
        this.applySettings();
        
        // Si es necesario, reiniciar partes del juego
        this.rebuildSceneElements();
    },
    
    // Actualizar FPS
    updateFPS: function(fps) {
        this.fpsHistory.push(fps);
        if (this.fpsHistory.length > 10) this.fpsHistory.shift();
        
        const now = Date.now();
        
        // Actualizar UI de FPS
        if (now - this.lastFpsUpdate > this.fpsUpdateInterval) {
            const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
            const fpsDisplay = document.getElementById('fpsCounter');
            if (fpsDisplay) {
                fpsDisplay.innerHTML = `FPS: ${Math.round(avgFPS)}`;
                fpsDisplay.style.color = avgFPS < 30 ? '#ff3333' : avgFPS < 45 ? '#ffcc00' : '#66ff66';
            }
            this.lastFpsUpdate = now;
        }
        
        // Auto-ajustar calidad si está en modo auto
        if (localStorage.getItem('gameQuality') === 'auto' && now - this.lastAutoAdjust > this.autoAdjustInterval) {
            const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
            
            // Si FPS es muy bajo, bajar calidad
            if (avgFPS < 25 && this.currentQuality !== 'low') {
                this.setQuality('low');
                console.log('Auto-bajando calidad a LOW debido a bajo rendimiento');
            }
    }
}

// Mostrar mensajes de error
function showErrorMessage(message) {
            // Si FPS es bajo pero aceptable, usar calidad media
            else if (avgFPS < this.targetFPS && this.currentQuality === 'high') {
                this.setQuality('medium');
                console.log('Auto-bajando calidad a MEDIUM debido a rendimiento medio');
            }
            // Si FPS es muy alto, subir calidad
            else if (avgFPS > this.targetFPS + 20 && this.currentQuality === 'low') {
                this.setQuality('medium');
                console.log('Auto-subiendo calidad a MEDIUM debido a buen rendimiento');
            }
            else if (avgFPS > this.targetFPS + 30 && this.currentQuality === 'medium') {
                this.setQuality('high');
                console.log('Auto-subiendo calidad a HIGH debido a excelente rendimiento');
            }
            
            this.lastAutoAdjust = now;
        }
    },
    
    // Reconstruir elementos de la escena
    rebuildSceneElements: function() {
        // Aquí podrías reimplementar partes específicas del juego
        // que necesitan ser actualizadas para la nueva calidad
        
        // Por ejemplo, volver a crear árboles y rocas con menos detalle
        // Esta es una función simplificada, una implementación real
        // debería eliminar los objetos antiguos primero
        const settings = this.settings[this.currentQuality];
        
        if (scene) {
            // Ejemplo: recrear árboles con menos detalle en calidad baja
            // (Implementación específica dependería de tu código)
        }
    }
}; 

// Usar instanciado para objetos repetitivos (árboles, rocas)
function createInstancedTrees(count) {
    // Esta técnica reduce drásticamente el uso de CPU y mejora rendimiento
    const settings = qualityManager.settings[qualityManager.currentQuality];
    
    // Geometrías base
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
    const leavesGeometry = new THREE.ConeGeometry(1.5, 2, 6);
    
    // Materiales
    const trunkMaterial = new THREE.MeshLambertMaterial({color: 0x4d2926});
    const leavesMaterial = new THREE.MeshLambertMaterial({color: 0x0d5c0d});
    
    // Crear instancias
    const trunkInstance = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
    const leavesInstance = new THREE.InstancedMesh(leavesGeometry, leavesMaterial, count);
    
    trunkInstance.castShadow = settings.shadowMapEnabled;
    leavesInstance.castShadow = settings.shadowMapEnabled;
    
    // Calcular posiciones para cada instancia
    const dummy = new THREE.Object3D();
    
    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 5);
        const z = (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 5);
        
        // Tronco
        dummy.position.set(x, 1, z);
        dummy.updateMatrix();
        trunkInstance.setMatrixAt(i, dummy.matrix);
        
        // Hojas
        dummy.position.set(x, 3, z);
        dummy.updateMatrix();
        leavesInstance.setMatrixAt(i, dummy.matrix);
    }
    
    scene.add(trunkInstance);
    scene.add(leavesInstance);
}

// Asegurarnos que todas las funciones necesarias estén definidas antes de usarlas

// Primero definimos todas las funciones básicas que se necesitan para la inicialización
function createEnvironment() {
    console.log('Creando ambiente básico...');
    
    // Crear suelo básico
    const floorGeometry = new THREE.PlaneGeometry(GAME_CONSTANTS.ARENA_SIZE, GAME_CONSTANTS.ARENA_SIZE);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x0a1a2a,
        roughness: 0.5
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Añadir paredes simples
    const wallMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0x88ffff,
        transparent: true,
        opacity: 0.3
    });
    
    // Crear paredes
    for (let i = 0; i < 4; i++) {
        const wallGeometry = new THREE.BoxGeometry(GAME_CONSTANTS.ARENA_SIZE, GAME_CONSTANTS.WALL_HEIGHT, 0.5);
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.y = GAME_CONSTANTS.WALL_HEIGHT / 2;
        
        if (i % 2 === 0) {
            wall.position.z = i === 0 ? -GAME_CONSTANTS.ARENA_SIZE / 2 : GAME_CONSTANTS.ARENA_SIZE / 2;
        } else {
            wall.rotation.y = Math.PI / 2;
            wall.position.x = i === 1 ? GAME_CONSTANTS.ARENA_SIZE / 2 : -GAME_CONSTANTS.ARENA_SIZE / 2;
        }
        
        scene.add(wall);
    }
}

function createPlayer(id, position) {
    console.log('Creando jugador básico...');
    
    // Grupo para el jugador
    const playerGroup = new THREE.Group();
    
    // Cuerpo simple
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: id === myId ? 0x00ff88 : 0xff4444
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    
    // Si es el jugador local, hacemos el cuerpo invisible
    if (id === myId) {
        body.visible = false;
    }
    
    playerGroup.add(body);
    
    // Añadir luz básica
    const playerLight = new THREE.PointLight(id === myId ? 0x00ff88 : 0xff4444, 1, 3);
    playerLight.position.y = 1;
    playerGroup.add(playerLight);
    
    playerGroup.position.copy(position);
    scene.add(playerGroup);
    
    // Guardar referencia del jugador
    if (!players) players = {};
    players[id] = {
        mesh: playerGroup,
        health: 100,
        score: 0
    };
    
    // Ajustar la cámara para el jugador local
    if (id === myId) {
        camera.position.set(0, 1.6, 0);
        playerGroup.add(camera);
    }
    
    return playerGroup;
}

function connectToServer() {
    console.log('Conectando al servidor (simulado)...');
    
    // Simulación de conexión
    myId = 'player1';
    
    // Crear jugador en posición aleatoria
    const startPosition = new THREE.Vector3(
        (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 10),
        1,
        (Math.random() - 0.5) * (GAME_CONSTANTS.ARENA_SIZE - 10)
    );
    
    createPlayer(myId, startPosition);
}

// Ahora definimos la inicialización principal
function init() {
    console.log('Iniciando juego 3D...');
    
    // Asegurarnos de que las funciones necesarias estén definidas
    if (typeof createEnvironment !== 'function') {
        console.error('Función createEnvironment no encontrada');
    }
    
    if (typeof createPlayer !== 'function') {
        console.error('Función createPlayer no encontrada');
    }
    
    if (typeof connectToServer !== 'function') {
        console.error('Función connectToServer no encontrada');
    }
    
    // Configuración básica de Three.js
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x88ccff);
    
    // Añadir niebla simple
    scene.fog = new THREE.Fog(0x88ccff, 20, 60);
    
    // Crear cámara
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Crear renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    // Limpiar el contenedor 3D
    const container = document.getElementById('game3d');
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);
    
    // Configuración básica
    setupLighting();
    setupControls();
    
    // Eventos del navegador
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('click', onMouseClick, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
    
    // Cargar componentes gradualmente
    setTimeout(loadGameComponents, 500);
    
    // Iniciar animación básica
    animate();
}

function setupLighting() {
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0x6688cc, 0.5);
    scene.add(ambientLight);
    
    // Luz direccional
    const sunLight = new THREE.DirectionalLight(0xffffbb, 1.2);
    sunLight.position.set(50, 50, 50);
    sunLight.castShadow = true;
    scene.add(sunLight);
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

function loadGameComponents() {
    try {
        // 1. Crear ambiente
        createEnvironment();
        console.log('Ambiente creado correctamente');
        
        // 2. Conectar al servidor
        connectToServer();
        console.log('Conexión al servidor establecida');
        
        // 3. Configurar el HUD
        createBasicHUD();
        console.log('HUD creado correctamente');
    } catch (e) {
        console.error('Error al cargar componentes:', e);
        showErrorMessage('Error al cargar componentes: ' + e.message);
    }
}

// Añade esta función para mostrar el estado del juego en pantalla
function addStatusDisplay() {
    const statusDisplay = document.createElement('div');
    const errorMessage = document.createElement('div');
    errorMessage.style.position = 'absolute';
    errorMessage.style.top = '50%';
    errorMessage.style.left = '50%';
    errorMessage.style.transform = 'translate(-50%, -50%)';
    errorMessage.style.background = 'rgba(0, 0, 0, 0.8)';
    errorMessage.style.color = 'white';
    errorMessage.style.padding = '20px';
    errorMessage.style.borderRadius = '10px';
    errorMessage.style.textAlign = 'center';
    errorMessage.innerHTML = `
        <h3 style="color:#ff5555">Error en el juego 3D</h3>
        <p>${message}</p>
        <div>Puedes intentar:</div>
        <ul style="text-align:left">
            <li>Actualizar tu navegador</li>
            <li>Activar aceleración por hardware en la configuración del navegador</li>
            <li>Usar otro navegador como Chrome o Firefox</li>
            <li>Probar en un dispositivo con mejor rendimiento gráfico</li>
        </ul>
        <button id="try2DMode" style="padding:10px 20px;background:#4CAF50;color:white;border:none;border-radius:5px;margin-top:15px;cursor:pointer">
            Probar modo 2D
        </button>
    `;
    
    document.getElementById('game3d').appendChild(errorMessage);
    
    document.getElementById('try2DMode').addEventListener('click', () => {
        document.getElementById('game3d').style.display = 'none';
        document.getElementById('game2d').style.display = 'block';
        startGame(); // Iniciar juego 2D
    });
}

// Iniciar cuando se carga la página
window.addEventListener('load', init);

// Añade esta función para mejorar el ambiente 3D
    statusDisplay.id = 'gameStatus3D';
function enhanceEnvironment() {
    console.log('Mejorando el ambiente 3D...');
    
    // Añadir algunas cajas para referencia visual
    statusDisplay.style.position = 'absolute';
    statusDisplay.style.top = '10px';
    statusDisplay.style.right = '10px';
    for (let i = 0; i < 10; i++) {
        const boxSize = Math.random() * 2 + 0.5;
    statusDisplay.style.background = 'rgba(0,0,0,0.7)';
        const boxGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    statusDisplay.style.color = 'white';
        const boxMaterial = new THREE.MeshStandardMaterial({
    statusDisplay.style.padding = '10px';
    statusDisplay.style.borderRadius = '5px';
            color: 0x00aaff,
            metalness: 0.5,
            roughness: 0.5
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
    statusDisplay.style.fontFamily = 'Arial, sans-serif';
        
        // Posición aleatoria
    statusDisplay.style.fontSize = '14px';
        box.position.x = (Math.random() - 0.5) * 40;
    statusDisplay.style.minWidth = '200px';
    
    statusDisplay.innerHTML = `
        box.position.y = boxSize / 2;
        box.position.z = (Math.random() - 0.5) * 40;
        <div>Estado: <span id="gameState3D">Activo</span></div>
        <div>Controles:</div>
        <div>- WASD: Moverse</div>
        
        // Rotación aleatoria
        <div>- Shift: Correr</div>
        box.rotation.y = Math.random() * Math.PI * 2;
        
        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);
    }
    
    // Añadir mejoras al jugador
    if (players && players[myId]) {
        // Luz que sigue al jugador
        const playerPointLight = new THREE.PointLight(0x00ff00, 1, 10);
        <div>- Mouse: Mirar</div>
        <div>- Click: Disparar</div>
        playerPointLight.position.y = 2;
        players[myId].mesh.add(playerPointLight);
        <div id="playerPos3D"></div>
        <button id="switch2D" style="margin-top:10px;padding:5px;background:#4CAF50;color:white;border:none;border-radius:3px;cursor:pointer">
            Cambiar a 2D
        </button>
    `;
    
    document.getElementById('game3d').appendChild(statusDisplay);
    
    // Actualizar posición del jugador
    }
    
    // Mejorar la luz ambiental
    scene.remove(...scene.children.filter(child => child instanceof THREE.AmbientLight));
    setInterval(() => {
        if (players && players[myId]) {
            const pos = players[myId].mesh.position;
            document.getElementById('playerPos3D').innerText = 
    const betterAmbientLight = new THREE.AmbientLight(0x6688cc, 0.7);
                `Posición: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`;
    scene.add(betterAmbientLight);
    
    // Añadir niebla para dar sensación de profundidad
        }
    }, 100);
    
    // Añadir botón para cambiar a 2D
    scene.fog = new THREE.FogExp2(0x88ccff, 0.015);
    document.getElementById('switch2D').addEventListener('click', () => {
}
        document.getElementById('game3d').style.display = 'none';
        document.getElementById('game2d').style.display = 'block';
        if (typeof startGame === 'function') startGame();
    });
}

// Llamar a esta función al final de createBasicHUD
function createBasicHUD() {
    // Crosshair simple
    const crosshair = document.createElement('div');
    crosshair.id = 'crosshair3d';
    crosshair.style.position = 'absolute';
    crosshair.style.top = '50%';
    crosshair.style.left = '50%';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.width = '20px';
    crosshair.style.height = '20px';
    crosshair.style.color = 'rgba(0,255,0,0.7)';
    crosshair.style.fontSize = '24px';
    crosshair.style.fontWeight = 'bold';
    crosshair.style.pointerEvents = 'none';
    crosshair.innerHTML = '+';
    
    document.getElementById('game3d').appendChild(crosshair);
    
    // Añadir panel de estado
    addStatusDisplay();
}

// Funciones de evento básicas
function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function onMouseMove(event) {
    // Implementación simplificada
}

function onMouseClick(event) {
    // Implementación simplificada
}

function onKeyDown(event) {
    if (controls) {
        switch (event.code) {
            case 'KeyW': controls.moveForward = true; break;
            case 'KeyS': controls.moveBackward = true; break;
            case 'KeyA': controls.moveLeft = true; break;
            case 'KeyD': controls.moveRight = true; break;
            case 'ShiftLeft': controls.run = true; break;
        }
    }
}

function onKeyUp(event) {
    if (controls) {
        switch (event.code) {
            case 'KeyW': controls.moveForward = false; break;
            case 'KeyS': controls.moveBackward = false; break;
            case 'KeyA': controls.moveLeft = false; break;
            case 'KeyD': controls.moveRight = false; break;
            case 'ShiftLeft': controls.run = false; break;
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    if (scene && camera && renderer) {
        // Actualizar posición jugador si existe
        if (players && players[myId]) {
            // Implementación simplificada del movimiento
        }
        
        renderer.render(scene, camera);
    }
}

// Mostrar mensajes de error
function showErrorMessage(message) {
    const errorMessage = document.createElement('div');
    errorMessage.style.position = 'absolute';
    errorMessage.style.top = '50%';
    errorMessage.style.left = '50%';
    errorMessage.style.transform = 'translate(-50%, -50%)';
    errorMessage.style.background = 'rgba(0, 0, 0, 0.8)';
    errorMessage.style.color = 'white';
    errorMessage.style.padding = '20px';
    errorMessage.style.borderRadius = '10px';
    errorMessage.style.textAlign = 'center';
    errorMessage.innerHTML = `
        <h3 style="color:#ff5555">Error en el juego 3D</h3>
        <p>${message}</p>
        <div>Puedes intentar:</div>
        <ul style="text-align:left">
            <li>Actualizar tu navegador</li>
            <li>Activar aceleración por hardware en la configuración del navegador</li>
            <li>Usar otro navegador como Chrome o Firefox</li>
            <li>Probar en un dispositivo con mejor rendimiento gráfico</li>
        </ul>
        <button id="try2DMode" style="padding:10px 20px;background:#4CAF50;color:white;border:none;border-radius:5px;margin-top:15px;cursor:pointer">
            Probar modo 2D
        </button>
    `;
    
    document.getElementById('game3d').appendChild(errorMessage);
    
    document.getElementById('try2DMode').addEventListener('click', () => {
        document.getElementById('game3d').style.display = 'none';
        document.getElementById('game2d').style.display = 'block';
        startGame(); // Iniciar juego 2D
    });
}

// Iniciar cuando se carga la página
window.addEventListener('load', init);