export const gameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false
        }
    },
    scene: [], // Las escenas se agregarán dinámicamente
    backgroundColor: '#000000',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    pixelArt: true
};

export const gameSettings = {
    playerSpeed: 200,
    playerJump: -400,
    musicVolume: 0.5,
    sfxVolume: 1.0
};
