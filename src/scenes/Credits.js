export class Credits extends Phaser.Scene {
    constructor() {
        super({ key: 'Credits' });
    }

    create() {
        this.createTitle();
        this.createCredits();
        this.createBackButton();
    }

    createTitle() {
        this.add.text(400, 100, 'CRÉDITOS', {
            fontSize: '32px',
            fill: '#ffffff',
            fontFamily: 'Press Start 2P'
        }).setOrigin(0.5);
    }

    createCredits() {
        const credits = [
            'Desarrollado por: [Tu Nombre]',
            'Gráficos: [Artista]',
            'Música: [Compositor]',
            'Efectos de Sonido: [SFX Artist]'
        ];

        credits.forEach((text, index) => {
            this.add.text(400, 250 + (index * 50), text, {
                fontSize: '20px',
                fill: '#ffffff',
                fontFamily: 'Arial'
            }).setOrigin(0.5);
        });
    }

    createBackButton() {
        const backButton = new Button(this, 400, 500, 'VOLVER');
        backButton.on('pointerdown', () => {
            this.scene.start('MainMenu');
        });
    }
} 