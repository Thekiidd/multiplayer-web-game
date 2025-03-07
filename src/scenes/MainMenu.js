export class MainMenu extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenu' });
    }

    create() {
        // Título del juego
        this.add.text(400, 100, 'DODGE GAME', {
            fontSize: '64px',
            fill: '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Crear botones del menú
        this.createMenuButtons();
    }

    createMenuButtons() {
        // Botón Jugar
        const playButton = this.add.text(400, 250, 'JUGAR', {
            fontSize: '32px',
            fill: '#fff',
            backgroundColor: '#333',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            console.log('Iniciando juego...'); // Para depuración
            this.scene.start('Game');
        })
        .on('pointerover', () => playButton.setStyle({ fill: '#ff0' }))
        .on('pointerout', () => playButton.setStyle({ fill: '#fff' }));

        // Botón Opciones
        const optionsButton = this.add.text(400, 350, 'OPCIONES', {
            fontSize: '32px',
            fill: '#fff',
            backgroundColor: '#333',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.scene.start('Settings'))
        .on('pointerover', () => optionsButton.setStyle({ fill: '#ff0' }))
        .on('pointerout', () => optionsButton.setStyle({ fill: '#fff' }));

        // Botón Créditos
        const creditsButton = this.add.text(400, 450, 'CRÉDITOS', {
            fontSize: '32px',
            fill: '#fff',
            backgroundColor: '#333',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.scene.start('Credits'))
        .on('pointerover', () => creditsButton.setStyle({ fill: '#ff0' }))
        .on('pointerout', () => creditsButton.setStyle({ fill: '#fff' }));
    }
}
