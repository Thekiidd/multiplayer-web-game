export class Score extends Phaser.GameObjects.Text {
    constructor(scene, x, y, score = 0) {
        super(scene, x, y, `Puntos: ${score}`, {
            fontSize: '32px',
            fill: '#ffffff',
            fontFamily: 'Press Start 2P'
        });
        scene.add.existing(this);
        this.score = score;
    }

    updateScore(points) {
        this.score += points;
        this.setText(`Puntos: ${this.score}`);
    }
}

export class HealthBar extends Phaser.GameObjects.Container {
    constructor(scene, x, y, health = 100) {
        super(scene, x, y);
        scene.add.existing(this);
        
        this.bar = scene.add.graphics();
        this.x = x;
        this.y = y;
        this.health = health;
        this.draw();
    }

    draw() {
        this.bar.clear();
        // Fondo
        this.bar.fillStyle(0x000000);
        this.bar.fillRect(0, 0, 100, 20);
        // Barra de vida
        this.bar.fillStyle(0xff0000);
        this.bar.fillRect(0, 0, this.health, 20);
    }

    updateHealth(health) {
        this.health = health;
        this.draw();
    }
} 