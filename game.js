const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 533,
  parent: 'game-viewport',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 600 },
      debug: false
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);
let audioContext = null;
let synthVolume = null;
let ambientMusicEvent = null;

function preload() {
  // Assets will be drawn programmatically.
}

function initAudio(scene) {
  if (audioContext) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContextClass();
  synthVolume = audioContext.createGain();
  synthVolume.gain.setValueAtTime(0.0, audioContext.currentTime); // start muted
  synthVolume.connect(audioContext.destination);
  
  // Start lo-fi background loop using Phaser's timed event system
  ambientMusicEvent = scene.time.addEvent({
    delay: 4000,
    callback: playAmbientChord,
    loop: true
  });
}

function playAmbientChord() {
  if (!audioContext || synthVolume.gain.value === 0) return;
  // Synthesize lo-fi C major triad
  [261.63, 329.63, 392.00].forEach(freq => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioContext.currentTime);
    gain.gain.setValueAtTime(0.02, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 2.0);
    osc.connect(gain);
    gain.connect(synthVolume);
    osc.start();
    osc.stop(audioContext.currentTime + 2.0);
  });
}

function playSound(type) {
  if (!audioContext) return;
  const osc = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  osc.connect(gainNode);
  gainNode.connect(synthVolume);

  if (type === 'jump') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(450, audioContext.currentTime + 0.12);
    gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + 0.12);
    osc.start();
    osc.stop(audioContext.currentTime + 0.12);
  } else if (type === 'pickup') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, audioContext.currentTime);
    osc.frequency.setValueAtTime(659, audioContext.currentTime + 0.08);
    gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + 0.2);
    osc.start();
    osc.stop(audioContext.currentTime + 0.2);
  } else if (type === 'milestone') {
    osc.type = 'sine';
    let now = audioContext.currentTime;
    [261, 329, 392, 523].forEach((f, idx) => {
      osc.frequency.setValueAtTime(f, now + (idx * 0.06));
    });
    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.linearRampToValueAtTime(0.0, now + 0.4);
    osc.start();
    osc.stop(now + 0.4);
  }
}

let player;
let cursors;
let wasd;
let moveKeys = { left: false, right: false, jump: false };
let playerLabel;
let platforms;
let bgGradient;
let progressBarGraphic;
let score = 0;
let tooltipGroup;
let activeTooltipTimer = null;
let chapterTextLabel;
let zoneBannersGroup;

function create() {
  const self = this;
  
  // Bind start button overlay click handler
  const startBtn = document.getElementById('start-game-btn');
  if (startBtn) {
    startBtn.onclick = () => {
      const overlay = document.getElementById('start-screen-overlay');
      if (overlay) overlay.style.display = 'none';
      initAudio(self);
      showZoneBanner(self, 'CHAPTER 1: ISEG LISBON', 'Lisbon, PT · 2016-2021');
    };
  }

  const triggerAudio = () => { initAudio(self); };
  this.input.once('pointerdown', triggerAudio);
  this.input.keyboard.once('keydown', triggerAudio);

  // Dynamic texture generation for spark particles
  let sparkG = this.make.graphics({ x: 0, y: 0, add: false });
  sparkG.fillStyle(0xf59e0b, 1.0);
  sparkG.fillCircle(4, 4, 4);
  sparkG.generateTexture('spark', 8, 8);

  // Bake full body player textures
  bakePlayerTextures(self);

  // Assemble player physics sprite (no stacked gravity, scaled up for better size)
  player = this.physics.add.sprite(100, 300, 'ravi_idle');
  player.setCollideWorldBounds(true);
  player.setScale(1.4);

  // Name Label floating 8px above the head (tuned for scale 1.4)
  playerLabel = this.add.text(100, 250, 'Ravi', {
    fontSize: '11px',
    fill: '#10b981',
    fontWeight: 'bold',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    padding: { x: 4, y: 2 }
  }).setOrigin(0.5, 1);

  // Create walk animations cycling walk1 and walk2 at 8fps
  this.anims.create({
    key: 'walk',
    frames: [
      { key: 'ravi_walk1' },
      { key: 'ravi_walk2' }
    ],
    frameRate: 8,
    repeat: -1
  });

  // Setup inputs
  cursors = this.input.keyboard.createCursorKeys();
  wasd = this.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    right: Phaser.Input.Keyboard.KeyCodes.D
  });

  // Mute toggle key [M]
  this.input.keyboard.on('keydown-M', () => {
    if (synthVolume) {
      let curVal = synthVolume.gain.value;
      synthVolume.gain.setValueAtTime(curVal === 0 ? 0.3 : 0.0, audioContext.currentTime);
    }
  });

  setupMobileControls();
  createWorld(this);
  createObstacles(this);
  createMilestones(this);
  createSkillPickups(this);

  // Setup HUD persistent chapter label at top-left of canvas (lowered to y=32 to avoid overlaps)
  chapterTextLabel = this.add.text(15, 32, 'Chapter 1: ISEG Lisbon', {
    fontSize: '12px',
    fill: '#10b981',
    fontWeight: 'bold',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: { x: 8, y: 4 }
  }).setScrollFactor(0).setDepth(200);

  zoneBannersGroup = this.add.group();
  
  // Draw parallax background silhouettes
  drawParallaxSilhouettes(this);
}

function setupMobileControls() {
  const bindBtn = (id, key) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      moveKeys[key] = true;
      initAudio(game.scene.scenes[0]);
    });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      moveKeys[key] = false;
    });
  };
  bindBtn('btn-left', 'left');
  bindBtn('btn-right', 'right');
  bindBtn('btn-jump', 'jump');
}

function update(time, delta) {
  if (player.body.enable === false) return;

  // Track name label position (adjusted for 1.4 scale)
  playerLabel.x = player.x;
  playerLabel.y = player.y - 50;

  // Horizontal Speed
  if (cursors.left.isDown || wasd.left.isDown || moveKeys.left) {
    player.setVelocityX(-200);
    player.setFlipX(true);
  } else if (cursors.right.isDown || wasd.right.isDown || moveKeys.right) {
    player.setVelocityX(200);
    player.setFlipX(false);
  } else {
    player.setVelocityX(0);
  }

  // Jumping (added spacebar support)
  if ((cursors.up.isDown || wasd.up.isDown || cursors.space.isDown || moveKeys.jump) && player.body.touching.down) {
    player.setVelocityY(-400); // Tuned for single gravity y:600
    playSound('jump');
  }

  // Animation texture state switches
  if (!player.body.touching.down) {
    player.setTexture('ravi_jump');
    player.anims.stop();
  } else if (Math.abs(player.body.velocity.x) > 0) {
    player.play('walk', true);
  } else {
    player.setTexture('ravi_idle');
    player.anims.stop();
  }

  updateProgressBar();

  // Sync physics bodies for floating skill pickups so the hitboxes bob with the tweens
  if (skillPickups) {
    skillPickups.children.iterate(child => {
      if (child && child.body) {
        child.body.updateFromGameObject();
      }
    });
  }

  // Zone checks for dynamic gradient shifting
  let currentZone = player.x < 1000 ? 0 : player.x < 2000 ? 1 : 2;
  if (window.lastZone !== currentZone) {
    window.lastZone = currentZone;
    drawBackgroundGradient(game.scene.scenes[0], currentZone);
    
    // Update HUD & trigger banner
    const zoneMetadata = [
      { hud: 'Chapter 1: ISEG Lisbon', title: 'CHAPTER 1: ISEG LISBON', sub: 'Lisbon, PT · 2016-2021' },
      { hud: 'Chapter 2: Deloitte', title: 'CHAPTER 2: DELOITTE CONSULTING', sub: 'Lisbon, PT · 2021-2024' },
      { hud: 'Chapter 3: DEME Group', title: 'CHAPTER 3: DEME GROUP', sub: 'Antwerp, BE · 2024-Present' }
    ];
    
    if (chapterTextLabel) {
      chapterTextLabel.setText(zoneMetadata[currentZone].hud);
    }
    showZoneBanner(game.scene.scenes[0], zoneMetadata[currentZone].title, zoneMetadata[currentZone].sub);

    // Update HTML Chapter HUD
    window.dispatchEvent(new CustomEvent('zone-changed', { detail: { name: zoneMetadata[currentZone].hud } }));
  }

  // Level completion trigger
  if (player.x >= 3100) {
    player.body.enable = false;
    player.setVelocity(0, 0);
    window.dispatchEvent(new CustomEvent('cv-complete', { detail: { score: score } }));
  }
}

function createWorld(scene) {
  // Generate platform vector textures
  let platG = scene.make.graphics({ x: 0, y: 0, add: false });
  platG.fillStyle(0x334155);
  platG.fillRect(0, 0, 200, 20);
  platG.fillStyle(0x10b981);
  platG.fillRect(0, 0, 200, 4);
  platG.generateTexture('platform_vector', 200, 20);

  let groundG = scene.make.graphics({ x: 0, y: 0, add: false });
  groundG.fillStyle(0x1e293b);
  groundG.fillRect(0, 0, 3200, 40);
  groundG.fillStyle(0x10b981);
  groundG.fillRect(0, 0, 3200, 4);
  groundG.generateTexture('ground_vector', 3200, 40);

  // Background gradient creation
  bgGradient = scene.add.graphics().setScrollFactor(0).setDepth(-20);
  window.lastZone = 0;
  drawBackgroundGradient(scene, 0); // Start in Zone 1

  platforms = scene.physics.add.staticGroup();
  platforms.create(1600, 520, 'ground_vector');

  // Create 6 platforms per zone (Total 18)
  const platformCoords = [
    // Zone 1 (0 to 1000)
    {x: 250, y: 440}, {x: 450, y: 370}, {x: 650, y: 300}, {x: 850, y: 240}, {x: 500, y: 180}, {x: 950, y: 450},
    // Zone 2 (1000 to 2000)
    {x: 1150, y: 390}, {x: 1350, y: 320}, {x: 1550, y: 250}, {x: 1750, y: 180}, {x: 1600, y: 420}, {x: 1900, y: 350},
    // Zone 3 (2000 to 3000)
    {x: 2150, y: 430}, {x: 2350, y: 350}, {x: 2550, y: 270}, {x: 2750, y: 200}, {x: 2600, y: 410}, {x: 2950, y: 320}
  ];

  platformCoords.forEach(c => {
    platforms.create(c.x, c.y, 'platform_vector');
  });

  scene.physics.add.collider(player, platforms);

  // Camera settings
  scene.cameras.main.setBounds(0, 0, 3200, 533);
  scene.physics.world.setBounds(0, 0, 3200, 533);
  scene.cameras.main.startFollow(player, true, 0.1, 0.1);

  // Initialize progress bar graphics
  progressBarGraphic = scene.add.graphics().setScrollFactor(0);

  // Gotcha 4: Add progress bar zone labels
  scene.add.text(125, 12, 'ISEG LISBON', { fontSize: '8px', fill: '#cbd5e1', fontWeight: 'bold' }).setScrollFactor(0).setDepth(200).setOrigin(0.5, 0);
  scene.add.text(375, 12, 'DELOITTE', { fontSize: '8px', fill: '#cbd5e1', fontWeight: 'bold' }).setScrollFactor(0).setDepth(200).setOrigin(0.5, 0);
  scene.add.text(650, 12, 'DEME GROUP', { fontSize: '8px', fill: '#cbd5e1', fontWeight: 'bold' }).setScrollFactor(0).setDepth(200).setOrigin(0.5, 0);
}

function drawBackgroundGradient(scene, zoneIndex) {
  bgGradient.clear();
  let color1, color2;

  if (zoneIndex === 0) {
    // Zone 1: ISEG Lisbon (Pastel Sunset)
    color1 = 0x1e1b4b;
    color2 = 0xd97706;
  } else if (zoneIndex === 1) {
    // Zone 2: Deloitte Consulting (Tech Grid)
    color1 = 0x0f172a;
    color2 = 0x0284c7;
  } else {
    // Zone 3: DEME Group (Wind/AI Emeralds)
    color1 = 0x064e3b;
    color2 = 0x10b981;
  }

  bgGradient.fillGradientStyle(color1, color1, color2, color2, 1);
  bgGradient.fillRect(0, 0, 800, 533);
}

function updateProgressBar() {
  progressBarGraphic.clear();
  let percentage = Math.min(Math.max(player.x / 3100, 0), 1);
  
  // Background track
  progressBarGraphic.fillStyle(0x1e293b, 1);
  progressBarGraphic.fillRect(0, 0, 800, 6);
  
  // Fill track
  progressBarGraphic.fillStyle(0x10b981, 1);
  progressBarGraphic.fillRect(0, 0, 800 * percentage, 6);
}

let hurdles;

function createObstacles(scene) {
  hurdles = scene.physics.add.group({ allowGravity: false });

  // Create 3 challenges along the path (aligned directly on platform surfaces: platform y - 25)
  let obs1 = hurdles.create(500, 155, null).setOrigin(0.5, 0.5);
  let obs2 = hurdles.create(1550, 225, null).setOrigin(0.5, 0.5);
  let obs3 = hurdles.create(2550, 245, null).setOrigin(0.5, 0.5);

  // Setup metadata
  obs1.setData({ label: 'Legacy DB', desc: 'Legacy DB → Automated! Scheduling time cut 15x', id: 'legacy' });
  obs2.setData({ label: 'Manual Task', desc: 'Manual Task → Replaced! Saved 3 hrs/project', id: 'manual' });
  obs3.setData({ label: 'Scope Creep', desc: 'Scope Creep → Controlled! Kept timeline on track', id: 'scope' });

  // Create Tooltip Overlay nodes
  tooltipGroup = scene.add.group();

  [obs1, obs2, obs3].forEach(o => {
    o.setBodySize(100, 30);
    
    // Draw capsule graphics dynamically
    let labelText = o.getData('label');
    let oG = scene.make.graphics({ x: 0, y: 0, add: false });
    oG.fillStyle(0xef4444, 0.25);
    oG.lineStyle(2, 0xef4444);
    oG.fillRoundedRect(2, 2, 96, 26, 6);
    oG.strokeRoundedRect(2, 2, 96, 26, 6);
    oG.generateTexture(labelText, 100, 30);
    o.setTexture(labelText);

    // Render text label inside game scene
    let txt = scene.add.text(o.x, o.y, labelText, {
      fontSize: '10px',
      fill: '#f87171',
      fontWeight: 'bold'
    }).setOrigin(0.5);
    
    // Gotcha 3: Save text label object reference to destroy it on collision
    o.setData('label_obj', txt);
  });

  scene.physics.add.overlap(player, hurdles, (p, h) => {
    let desc = h.getData('desc');
    let id = h.getData('id');
    let labelObj = h.getData('label_obj');

    // Gotcha 3: Destroy label object on collision so it doesn't float around
    if (labelObj) labelObj.destroy();

    // Disable physics immediately
    h.disableBody(true, false);

    playSound('pickup');
    score += 250;
    document.getElementById('hud-score').innerText = score;
    
    // Speed acceleration boost
    player.setVelocityX(350);

    // Play dissolve/crumble tween
    scene.tweens.add({
      targets: h,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        h.destroy();
      }
    });

    // Draw tooltip panel in Phaser canvas
    showCanvasTooltip(scene, desc);

    // Dispatch sidebar update
    window.dispatchEvent(new CustomEvent('cv-challenge', { detail: { id: id, desc: desc } }));
  });
}

function showCanvasTooltip(scene, text) {
  tooltipGroup.clear(true, true);
  
  // Draw tooltip background panel (280x45)
  let panel = scene.add.graphics().setScrollFactor(0);
  panel.fillStyle(0x0f172a, 0.9);
  panel.lineStyle(1.5, 0x10b981);
  panel.fillRoundedRect(260, 420, 280, 45, 6);
  panel.strokeRoundedRect(260, 420, 280, 45, 6);
  tooltipGroup.add(panel);

  // Text details
  let label = scene.add.text(400, 442, text, {
    fontSize: '11px',
    fill: '#f8fafc',
    fontWeight: 'bold',
    align: 'center',
    wordWrap: { width: 260 }
  }).setOrigin(0.5).setScrollFactor(0);
  tooltipGroup.add(label);

  // Auto fadeout after 3 seconds
  if (activeTooltipTimer) activeTooltipTimer.remove();
  activeTooltipTimer = scene.time.delayedCall(3000, () => {
    tooltipGroup.clear(true, true);
  });
}

let milestones;

function createMilestones(scene) {
  milestones = scene.physics.add.group({ allowGravity: false });

  // Flag pole graphics
  let flagG = scene.make.graphics({ x: 0, y: 0, add: false });
  flagG.fillStyle(0xf59e0b);
  flagG.beginPath();
  flagG.moveTo(10, 0);
  flagG.lineTo(30, 8);
  flagG.lineTo(10, 16);
  flagG.closePath();
  flagG.fill();
  flagG.fillStyle(0x64748b);
  flagG.fillRect(8, 0, 4, 32);
  flagG.generateTexture('flag_vector', 32, 32);

  // Aligned on top of platforms: flag size 32, platform surface at y - 10, origin 0.5 -> y - 26
  let flag1 = milestones.create(850, 214, 'flag_vector');
  let flag2 = milestones.create(1750, 154, 'flag_vector');
  let flag3 = milestones.create(2750, 174, 'flag_vector');

  [flag1, flag2, flag3].forEach((f, idx) => {
    f.setData('id', idx + 1);
  });

  scene.physics.add.overlap(player, milestones, (p, f) => {
    let id = f.getData('id');
    f.disableBody(true, true);
    player.body.enable = false;
    player.setVelocity(0, 0);
    playSound('milestone');

    // Sparkles particles generator
    let particles = scene.add.particles(f.x, f.y, 'spark', {
      speed: 100,
      scale: { start: 1, end: 0 },
      blendMode: 'ADD',
      lifespan: 600
    });
    scene.time.delayedCall(600, () => particles.destroy());

    // Trigger custom update event
    window.dispatchEvent(new CustomEvent('cv-milestone', { detail: { id: id } }));

    // Unfreeze
    scene.time.delayedCall(2000, () => {
      player.body.enable = true;
    });
  });
}

function bakePlayerTextures(scene) {
  const drawBaseBody = (g, legOffsetL, legOffsetR, armOffsetL, armOffsetR, isJump) => {
    g.clear();
    // Black outline (2px stroke width)
    g.lineStyle(2, 0x090d16);

    // Draw limbs first (so they sit behind body)
    // Left Leg (khaki)
    g.fillStyle(0xd97706);
    g.fillRoundedRect(10 + legOffsetL, 38 + (isJump ? -4 : 0), 8, 20, 2);
    g.strokeRoundedRect(10 + legOffsetL, 38 + (isJump ? -4 : 0), 8, 20, 2);
    
    // Right Leg
    g.fillStyle(0xd97706);
    g.fillRoundedRect(22 + legOffsetR, 38 + (isJump ? -4 : 0), 8, 20, 2);
    g.strokeRoundedRect(22 + legOffsetR, 38 + (isJump ? -4 : 0), 8, 20, 2);

    // Torso (navy shirt)
    g.fillStyle(0x1e3a8a);
    g.fillRoundedRect(8, 24, 24, 18, 3);
    g.strokeRoundedRect(8, 24, 24, 18, 3);

    // Tie (gold)
    g.fillStyle(0xf59e0b);
    g.beginPath();
    g.moveTo(20, 24);
    g.lineTo(23, 28);
    g.lineTo(20, 36);
    g.lineTo(17, 28);
    g.closePath();
    g.fill();

    // Left Arm
    g.fillStyle(0x1e3a8a);
    g.fillRoundedRect(2 + armOffsetL, 24 + (isJump ? -8 : 0), 6, 16, 2);
    g.strokeRoundedRect(2 + armOffsetL, 24 + (isJump ? -8 : 0), 6, 16, 2);

    // Right Arm
    g.fillStyle(0x1e3a8a);
    g.fillRoundedRect(32 + armOffsetR, 24 + (isJump ? -8 : 0), 6, 16, 2);
    g.strokeRoundedRect(32 + armOffsetR, 24 + (isJump ? -8 : 0), 6, 16, 2);

    // Head (light brown skin)
    g.fillStyle(0xb48356);
    g.fillCircle(20, 14, 11);
    g.strokeCircle(20, 14, 11);

    // Hair (black)
    g.fillStyle(0x18181b);
    g.fillRoundedRect(8, 0, 24, 9, 3);
    g.strokeRoundedRect(8, 0, 24, 9, 3);

    // Eyes (dark)
    g.fillStyle(0x18181b);
    g.fillCircle(16, 13, 1.5);
    g.fillCircle(24, 13, 1.5);

    // White Smile Arc
    g.lineStyle(1.5, 0xffffff);
    g.beginPath();
    g.arc(20, 17, 4, 0, Math.PI, false);
    g.stroke();
  };

  let g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Idle Frame
  drawBaseBody(g, 0, 0, 0, 0, false);
  g.generateTexture('ravi_idle', 40, 60);

  // Walk Frame 1
  drawBaseBody(g, -3, 3, -2, 2, false);
  g.generateTexture('ravi_walk1', 40, 60);

  // Walk Frame 2
  drawBaseBody(g, 3, -3, 2, -2, false);
  g.generateTexture('ravi_walk2', 40, 60);

  // Jump Frame
  drawBaseBody(g, 0, 0, 0, 0, true);
  g.generateTexture('ravi_jump', 40, 60);
}

let skillPickups;

function createSkillPickups(scene) {
  skillPickups = scene.physics.add.group({ allowGravity: false });

  const skills = [
    { name: 'Python', x: 450, y: 300, id: 'python' },
    { name: 'SQL', x: 650, y: 220, id: 'sql' },
    { name: 'TOGAF', x: 1350, y: 240, id: 'togaf' },
    { name: 'Scrum', x: 1600, y: 340, id: 'scrum' },
    { name: 'AWS', x: 2350, y: 270, id: 'aws' },
    { name: 'Power Platform', x: 2600, y: 330, id: 'power' }
  ];

  skills.forEach(s => {
    // Draw glowing circular graphic
    let sG = scene.make.graphics({ x: 0, y: 0, add: false });
    sG.fillStyle(0x10b981, 0.15);
    sG.lineStyle(2, 0x10b981);
    sG.fillCircle(20, 20, 18);
    sG.strokeCircle(20, 20, 18);
    sG.generateTexture(`collect_${s.id}`, 40, 40);

    let item = skillPickups.create(s.x, s.y, `collect_${s.id}`).setOrigin(0.5, 0.5);
    item.setData('id', s.id);
    item.setData('name', s.name);

    // Add label text inside item
    let txt = scene.add.text(s.x, s.y, s.name, {
      fontSize: '9px',
      fill: '#10b981',
      fontWeight: 'bold'
    }).setOrigin(0.5);
    item.setData('label_obj', txt);

    // Hover tween animation
    scene.tweens.add({
      targets: [item, txt],
      y: s.y - 12,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  });

  scene.physics.add.overlap(player, skillPickups, (p, item) => {
    let id = item.getData('id');
    let labelObj = item.getData('label_obj');
    
    item.disableBody(true, true);
    if (labelObj) labelObj.destroy();
    playSound('pickup');

    score += 100;
    document.getElementById('hud-score').innerText = score;

    // Event dispatch
    window.dispatchEvent(new CustomEvent('skill-collected', { detail: { id: id } }));

    // Floating text pop
    let floatText = scene.add.text(item.x, item.y, '+100 Skill!', {
      fontSize: '12px',
      fill: '#10b981',
      fontWeight: 'bold'
    }).setOrigin(0.5);
    scene.tweens.add({
      targets: floatText,
      y: floatText.y - 45,
      opacity: 0,
      duration: 1000,
      onComplete: () => floatText.destroy()
    });
  });
}

function drawParallaxSilhouettes(scene) {
  let decorG = scene.add.graphics().setScrollFactor(0.3).setDepth(-10);
  decorG.fillStyle(0xffffff, 0.10);

  // Zone 1: ISEG Lisbon (classic towers/domes)
  decorG.fillRect(100, 300, 60, 200);
  decorG.fillTriangle(130, 250, 100, 300, 160, 300);
  decorG.fillRect(300, 260, 80, 240);
  decorG.fillCircle(340, 260, 40);

  // Zone 2: Deloitte Consulting (corporate bars)
  decorG.fillRect(1200, 240, 50, 260);
  decorG.fillRect(1300, 180, 60, 320);
  decorG.fillRect(1500, 280, 50, 220);

  // Zone 3: DEME Group (wind turbines & cranes)
  decorG.fillRect(2200, 250, 8, 250);
  decorG.fillCircle(2204, 250, 12);
  decorG.fillRect(2500, 200, 8, 300);
  decorG.fillCircle(2504, 200, 12);
}

function showZoneBanner(scene, chapterTitle, eraSubtitle) {
  zoneBannersGroup.clear(true, true);

  // Dark banner background
  let bg = scene.add.graphics().setScrollFactor(0).setDepth(150);
  bg.fillStyle(0x0f172a, 0.85);
  bg.fillRect(0, 180, 800, 100);
  zoneBannersGroup.add(bg);

  // Texts
  let title = scene.add.text(400, 215, chapterTitle, {
    fontSize: '22px',
    fill: '#f8fafc',
    fontWeight: 'bold'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
  
  let sub = scene.add.text(400, 250, eraSubtitle, {
    fontSize: '12px',
    fill: '#10b981',
    fontWeight: '500'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(151);

  zoneBannersGroup.add(title);
  zoneBannersGroup.add(sub);

  // Slide out / fade out after 3 seconds
  scene.tweens.add({
    targets: [bg, title, sub],
    alpha: 0,
    delay: 2500,
    duration: 500,
    onComplete: () => {
      zoneBannersGroup.clear(true, true);
    }
  });
}
