export class Button extends Phaser.GameObjects.Container {
    constructor(scene, x, y, text, config = {}) {
        super(scene, x, y);

        const defaultConfig = {
            width: 200,
            height: 50,
            backgroundColor: 0x000000,
            hoverColor: 0x333333,
            textColor: '#ffffff',
            fontSize: '24px',
            fontFamily: 'Press Start 2P'
        };

        this.config = { ...defaultConfig, ...config };
        this.createButton(text);
        scene.add.existing(this);
    }

    createButton(text) {
        // Fondo del botón
        this.background = this.scene.add.rectangle(
            0, 0,
            this.config.width,
            this.config.height,
            this.config.backgroundColor
        ).setStrokeStyle(2, 0xffffff);

        // Texto del botón
        this.text = this.scene.add.text(0, 0, text, {
            fontSize: this.config.fontSize,
            fill: this.config.textColor,
            fontFamily: this.config.fontFamily
        }).setOrigin(0.5);

        this.add([this.background, this.text]);
        this.setSize(this.config.width, this.config.height);
        this.setInteractive();

        // Eventos
        this.on('pointerover', this.onHover, this);
        this.on('pointerout', this.onOut, this);
    }

    onHover() {
        this.background.setFillStyle(this.config.hoverColor);
        this.scene.sound.play('hover');
    }

    onOut() {
        this.background.setFillStyle(this.config.backgroundColor);
    }
}
