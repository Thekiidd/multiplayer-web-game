// Variables globales
let scene, camera, renderer;
let controls, player;

// Asegurarnos de que init esté disponible globalmente
window.init = function() {
    console.log('Iniciando modo 3D...');
    initScene();
    initLights();
    initObjects();
    setupEventListeners();
    animate();
};

function initScene() {
    // Configuración básica de la escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    // Configuración de la cámara
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    
    // Configuración del renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Añadir el renderer al contenedor
    const container = document.getElementById('game3d');
    if (container) {
        // Limpiar el contenedor primero
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);
    } else {
        console.error('No se encontró el contenedor game3d');
    }
}

function initLights() {
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Luz direccional
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);
}

function initObjects() {
    // Crear suelo
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    // Crear jugador (cubo)
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    player = new THREE.Mesh(geometry, material);
    player.position.y = 0.5;
    scene.add(player);
}

function setupEventListeners() {
    // Asegurarse de que la ventana esté cargada antes de añadir event listeners
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    if (player) {
        player.rotation.y += 0.01;
    }
    
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Verificar que Three.js esté cargado
document.addEventListener('DOMContentLoaded', () => {
    if (typeof THREE === 'undefined') {
        console.error('Error: Three.js no está cargado');
        return;
    }
    console.log('Three.js está cargado correctamente');
});