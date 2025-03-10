// Versión minimalista para depuración
let scene, camera, renderer, cube;

function init() {
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    
    // Crear cámara
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    
    // Crear renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Añadir al DOM
    const container = document.getElementById('game3d');
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);
    
    // Crear cubo básico
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    
    // Añadir luz
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 1, 1);
    scene.add(light);
    
    // Añadir mensaje de estado
    const status = document.createElement('div');
    status.style.position = 'absolute';
    status.style.top = '10px';
    status.style.left = '10px';
    status.style.color = 'white';
    status.style.background = 'rgba(0,0,0,0.5)';
    status.style.padding = '10px';
    status.innerText = 'Modo de prueba: Si ves un cubo verde rotando, WebGL está funcionando';
    container.appendChild(status);
    
    // Botón para cambiar a 2D
    const switchButton = document.createElement('button');
    switchButton.style.position = 'absolute';
    switchButton.style.bottom = '10px';
    switchButton.style.left = '10px';
    switchButton.style.padding = '10px';
    switchButton.innerText = 'Cambiar a modo 2D';
    switchButton.addEventListener('click', () => {
        document.getElementById('game3d').style.display = 'none';
        document.getElementById('game2d').style.display = 'block';
        startGame(); // Iniciar juego 2D
    });
    container.appendChild(switchButton);
    
    // Iniciar animación
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    
    if (cube) {
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
    }
    
    renderer.render(scene, camera);
}

window.addEventListener('load', init); 