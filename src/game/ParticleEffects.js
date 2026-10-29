export class ParticleEffects {
  constructor(scene) {
    this.scene = scene;
  }

  // Floating score text on collection
  spawnScoreFloater(x, y, text = '+150', color = '#00f5ff') {
    const floater = this.scene.add.text(x, y - 10, text, {
      fontFamily: 'Orbitron, monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: color
    }).setOrigin(0.5).setDepth(15);

    this.scene.tweens.add({
      targets: floater,
      y: y - 32,
      alpha: 0,
      scale: 1.2,
      duration: 600,
      ease: 'Power1',
      onComplete: () => floater.destroy()
    });
  }

  // Fragment pickup ring & particle burst
  emitFragmentCollect(x, y) {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 / 6) * i;
      const speed = 25 + Math.random() * 20;
      const p = this.scene.add.circle(x, y, 2.5, 0x00f5ff, 1).setDepth(12);

      this.scene.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.1,
        duration: 350,
        ease: 'Power2',
        onComplete: () => p.destroy()
      });
    }
  }

  // Powerup collection burst (larger multi-colored flare)
  emitPowerupCollect(x, y, colorHex = 0x39ff88) {
    const ring = this.scene.add.circle(x, y, 8, colorHex, 0.8).setDepth(12);
    ring.setStrokeStyle(2, 0xffffff);

    this.scene.tweens.add({
      targets: ring,
      scale: 3.5,
      alpha: 0,
      duration: 450,
      ease: 'Power2',
      onComplete: () => ring.destroy()
    });

    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 / 10) * i;
      const speed = 35 + Math.random() * 25;
      const spark = this.scene.add.circle(x, y, 3, colorHex, 1).setDepth(12);

      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.2,
        duration: 400,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy()
      });
    }
  }

  // Damage glitch shockwave + camera shake
  emitDamageGlitch(x, y) {
    this.scene.cameras.main.shake(200, 0.015);

    const flash = this.scene.add.rectangle(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0xff3355,
      0.25
    ).setDepth(30);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 220,
      onComplete: () => flash.destroy()
    });
  }
}
