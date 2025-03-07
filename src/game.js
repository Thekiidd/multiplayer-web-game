import { gameConfig } from './config/gameConfig.js';
import { MainMenu } from './scenes/MainMenu.js';
import { Game } from './scenes/Game.js';

// Configuración del juego
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [MainMenu, Game]
};

// Inicializar el juego
new Phaser.Game(config); 