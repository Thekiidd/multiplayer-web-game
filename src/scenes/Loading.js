export class Loading extends Phaser.Scene {
    constructor() {
        super({ key: 'Loading' });
    }

    preload() {
        // Barra de progreso
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(240, 270, 320, 50);

        // Texto de carga
        const loadingText = this.add.text(400, 250, 'Cargando...', {
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // Eventos de carga
        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(250, 280, 300 * value, 30);
        });

        // Cargar recursos
        this.loadAssets();
    }

    loadAssets() {
        // Sonidos
        this.load.audio('collect', 'assets/sounds/collect.mp3');
        this.load.audio('hit', 'assets/sounds/hit.mp3');
        this.load.audio('powerup', 'assets/sounds/powerup.mp3');
        this.load.audio('gameover', 'assets/sounds/gameover.mp3');
        this.load.audio('bgMusic', 'assets/sounds/background.mp3');

        // Imágenes para power-ups
        this.load.image('shield', 'assets/images/shield.png');
        this.load.image('slowTime', 'assets/images/clock.png');
        this.load.image('extraLife', 'assets/images/heart.png');
    }

    create() {
        this.scene.start('MainMenu');
    }
}
