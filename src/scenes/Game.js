export class Game extends Phaser.Scene {
    constructor() {
        super({ key: 'Game' });
    }

    create() {
        // Configuración inicial
        this.score = 0;
        this.gameSpeed = 1;
        this.lives = 3;
        this.isGameOver = false;
        this.lastLevel = 1;
        this.obstacleFrequency = 1000; // Frecuencia inicial de obstáculos

        // Fondo negro
        this.add.rectangle(400, 300, 800, 600, 0x000000);

        // Jugador (rectángulo verde)
        this.player = this.add.rectangle(400, 500, 50, 50, 0x00ff00);
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);
        
        // Mejorar las físicas del jugador
        this.player.body.setDamping(true);
        this.player.body.setDrag(0.95);
        this.player.body.setBounce(0.1);
        this.playerSpeed = 400; // Velocidad base del jugador
        this.dashSpeed = 800;   // Velocidad del dash
        this.canDash = true;    // Control del dash

        // UI
        this.createUI();

        // Grupo de obstáculos
        this.obstacles = this.physics.add.group();

        // Timer principal para obstáculos
        this.createObstacleTimer();

        // Colisiones
        this.physics.add.overlap(
            this.player,
            this.obstacles,
            this.hitObstacle,
            null,
            this
        );

        // Controles
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // Tecla para dash
        this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    createUI() {
        // Puntuación
        this.scoreText = this.add.text(16, 16, 'Puntos: 0', {
            fontSize: '32px',
            fill: '#fff'
        });

        // Vidas
        this.livesText = this.add.text(16, 56, 'Vidas: 3', {
            fontSize: '32px',
            fill: '#ff0000'
        });

        // Nivel
        this.levelText = this.add.text(16, 96, 'Nivel: 1', {
            fontSize: '32px',
            fill: '#ffff00'
        });
    }

    createObstacleTimer() {
        // Destruir timer existente si hay uno
        if (this.obstacleTimer) {
            this.obstacleTimer.destroy();
        }

        this.obstacleTimer = this.time.addEvent({
            delay: this.obstacleFrequency,
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: true
        });
    }

    update() {
        if (this.isGameOver) return;

        this.handlePlayerMovement();
        this.updateScore();
        this.updateDifficulty();
        this.cleanupObstacles();
    }

    handlePlayerMovement() {
        // Movimiento horizontal
        if (this.cursors.left.isDown) {
            this.player.body.setVelocityX(-this.playerSpeed);
        } else if (this.cursors.right.isDown) {
            this.player.body.setVelocityX(this.playerSpeed);
        }

        // Movimiento vertical (más limitado)
        if (this.cursors.up.isDown && this.player.y > 400) {
            this.player.body.setVelocityY(-this.playerSpeed * 0.7);
        } else if (this.cursors.down.isDown && this.player.y < 550) {
            this.player.body.setVelocityY(this.playerSpeed * 0.7);
        }

        // Dash (impulso rápido)
        if (this.spacebar.isDown && this.canDash) {
            this.performDash();
        }
    }

    performDash() {
        this.canDash = false;
        
        // Dirección del dash basada en las teclas presionadas
        let dashX = 0;
        let dashY = 0;
        
        if (this.cursors.left.isDown) dashX = -1;
        if (this.cursors.right.isDown) dashX = 1;
        if (this.cursors.up.isDown) dashY = -1;
        if (this.cursors.down.isDown) dashY = 1;

        // Si no hay dirección, dash hacia donde mira el jugador
        if (dashX === 0 && dashY === 0) {
            dashX = this.player.body.velocity.x > 0 ? 1 : -1;
        }

        // Aplicar el dash
        this.player.body.setVelocity(
            dashX * this.dashSpeed,
            dashY * this.dashSpeed
        );

        // Efecto visual del dash
        this.player.setAlpha(0.5);

        // Recuperación del dash
        this.time.delayedCall(200, () => {
            this.player.setAlpha(1);
            this.time.delayedCall(500, () => {
                this.canDash = true;
            });
        });
    }

    updateScore() {
        this.score += 1;
        this.scoreText.setText('Puntos: ' + this.score);
    }

    updateDifficulty() {
        // Subir de nivel cada 500 puntos
        const currentLevel = Math.floor(this.score / 500) + 1;
        
        if (currentLevel !== this.lastLevel) {
            this.levelUp(currentLevel);
        }

        this.lastLevel = currentLevel;
    }

    levelUp(newLevel) {
        // Actualizar UI
        this.levelText.setText('Nivel: ' + newLevel);

        // Aumentar velocidad de los obstáculos
        this.gameSpeed = 1 + (newLevel * 0.3);

        // Aumentar frecuencia de obstáculos
        this.obstacleFrequency = Math.max(300, 1000 - (newLevel * 100));
        this.createObstacleTimer();

        // Efecto visual de subida de nivel
        const levelUpText = this.add.text(400, 300, '¡NIVEL ' + newLevel + '!', {
            fontSize: '64px',
            fill: '#ffff00'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: levelUpText,
            scale: 1.5,
            alpha: 0,
            duration: 1000,
            onComplete: () => levelUpText.destroy()
        });
    }

    spawnObstacle() {
        if (this.isGameOver) return;

        const x = Phaser.Math.Between(50, 750);
        const obstacle = this.add.rectangle(x, -20, 30, 30, 0xff0000);
        this.obstacles.add(obstacle);
        
        // Velocidad base * nivel actual
        const speed = 200 * this.gameSpeed;
        obstacle.body.setVelocityY(speed);

        // Movimiento lateral aleatorio en niveles superiores
        if (this.lastLevel > 2) {
            const lateralSpeed = Phaser.Math.Between(-100, 100) * (this.lastLevel * 0.2);
            obstacle.body.setVelocityX(lateralSpeed);
        }
    }

    cleanupObstacles() {
        this.obstacles.getChildren().forEach(obstacle => {
            if (obstacle.y > 600 || obstacle.x < 0 || obstacle.x > 800) {
                obstacle.destroy();
            }
        });
    }

    hitObstacle(player, obstacle) {
        if (this.isGameOver) return;

        obstacle.destroy();
        this.lives--;
        this.livesText.setText('Vidas: ' + this.lives);

        // Efecto de parpadeo al ser golpeado
        this.tweens.add({
            targets: player,
            alpha: 0,
            duration: 100,
            ease: 'Linear',
            yoyo: true,
            repeat: 2
        });

        if (this.lives <= 0) {
            this.gameOver();
        }
    }

    gameOver() {
        this.isGameOver = true;
        this.physics.pause();

        // Texto de Game Over
        const gameOverText = this.add.text(400, 200, 'GAME OVER', {
            fontSize: '64px',
            fill: '#ff0000'
        }).setOrigin(0.5);

        // Puntuación final
        this.add.text(400, 300, `Puntuación Final: ${this.score}`, {
            fontSize: '32px',
            fill: '#fff'
        }).setOrigin(0.5);

        // Botón reiniciar
        const restartButton = this.add.text(400, 400, 'Reintentar', {
            fontSize: '32px',
            fill: '#fff',
            backgroundColor: '#333',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.scene.restart())
        .on('pointerover', () => restartButton.setStyle({ fill: '#ff0' }))
        .on('pointerout', () => restartButton.setStyle({ fill: '#fff' }));

        // Botón menú principal
        const menuButton = this.add.text(400, 470, 'Menú Principal', {
            fontSize: '32px',
            fill: '#fff',
            backgroundColor: '#333',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.scene.start('MainMenu'))
        .on('pointerover', () => menuButton.setStyle({ fill: '#ff0' }))
        .on('pointerout', () => menuButton.setStyle({ fill: '#fff' }));
    }
}