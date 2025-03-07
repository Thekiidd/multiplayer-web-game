export class Settings extends Phaser.Scene {
    constructor() {
        super({ key: 'Settings' });
    }

    create() {
        this.createTitle();
        this.createSettings();
        this.createBackButton();
    }

    createTitle() {
        this.add.text(400, 100, 'CONFIGURACIÓN', {
            fontSize: '32px',
            fill: '#ffffff',
            fontFamily: 'Press Start 2P'
        }).setOrigin(0.5);
    }

    createSettings() {
        // Volumen de música
        this.createVolumeControl('Música', 300);
        // Volumen de efectos
        this.createVolumeControl('Efectos', 400);
    }

    createVolumeControl(label, y) {
        this.add.text(200, y, label, {
            fontSize: '24px',
            fill: '#ffffff'
        });

        // Slider de volumen (simplificado)
        const slider = this.add.rectangle(400, y, 200, 20, 0x666666);
        slider.setInteractive();
    }

    createBackButton() {
        const backButton = new Button(this, 400, 500, 'VOLVER');
        backButton.on('pointerdown', () => {
            this.scene.start('MainMenu');
        });
    }
}
