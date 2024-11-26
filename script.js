const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 480;
canvas.height = 640;

let gamePlaying = false;
let lastTime = 0;
let deltaTime = 0;
const FPS = 60;
const frameTime = 1000 / FPS;

let keys = {
    left: false,
    right: false,
    up: false,
    down: false
};

let score = 0;
let highScore = localStorage.getItem('highScore') || 0;

// Game constants
const PLAYER_SPEED = 300; // pixels per second
const LASER_SPEED = 400;
const ASTEROID_SPEED = 150;
const STAR_SPEEDS = [50, 100, 150]; // Different star speeds for parallax effect

// Asset loading
const spaceShipImg = new Image();
spaceShipImg.onload = initGame;
spaceShipImg.src = 'assets/Obehilator.png';

const logoImg = new Image();
logoImg.src = 'assets/Logo.png';

// Game state
const gameState = {
    stars: [],
    lasers: [],
    asteroids: [],
    player: {
        x: canvas.width / 2 - 30,
        y: canvas.height - 100,
        width: 60,
        height: 60,
        velocity: { x: 0, y: 0 },
        health: 100,
        maxHealth: 100,
        shield: 0,
        invulnerable: false
    },
    explosions: [],
    powerUps: [],
    playerPowerUps: {
        shield: false,
        rapidFire: false,
        multiShot: false
    },
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    aliens: [],
    alienLasers: [],
    bossSpawned: false
};

// Initialize audio context
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let laserSound;

// Load and decode audio
fetch('assets/sounds/blast.mp3')
    .then(response => response.arrayBuffer())
    .then(buffer => audioCtx.decodeAudioData(buffer))
    .then(decodedData => {
        laserSound = decodedData;
    });

function playLaserSound() {
    if (!laserSound) return;
    const source = audioCtx.createBufferSource();
    source.buffer = laserSound;
    source.connect(audioCtx.destination);
    source.start(0);
}

function createStars() {
    gameState.stars = [];
    const starColors = ['#ffffff', '#ffe4e1', '#87ceeb', '#dda0dd'];
    STAR_SPEEDS.forEach(speed => {
        for (let i = 0; i < 33; i++) {
            gameState.stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2.5 + 0.5,
                speed: speed,
                color: starColors[Math.floor(Math.random() * starColors.length)]
            });
        }
    });
}

function updateStars(deltaTime) {
    gameState.stars.forEach(star => {
        star.y += (star.speed * deltaTime);
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
}

function drawStars() {
    gameState.stars.forEach(star => {
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function shootLaser() {
    gameState.lasers.push({
        x: gameState.player.x + gameState.player.width / 2 - 2.5,
        y: gameState.player.y,
        width: 5,
        height: 15
    });
    playLaserSound();
}

function updateLasers(deltaTime) {
    for (let i = gameState.lasers.length - 1; i >= 0; i--) {
        gameState.lasers[i].y -= LASER_SPEED * deltaTime;
        if (gameState.lasers[i].y + gameState.lasers[i].height < 0) {
            gameState.lasers.splice(i, 1);
        }
    }
}

function drawLasers() {
    gameState.lasers.forEach(laser => {
        // Outer glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff0000';
        
        // Laser trail effect
        const gradient = ctx.createLinearGradient(
            laser.x, laser.y + laser.height,
            laser.x, laser.y
        );
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
        gradient.addColorStop(0.5, 'rgba(255, 0, 0, 0.5)');
        gradient.addColorStop(1, '#ff0000');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(laser.x - 2, laser.y, laser.width + 4, laser.height + 8);
        
        // Core
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
        
        ctx.shadowBlur = 0;
    });
}

const ASTEROID_TYPES = {
    NORMAL: {
        color: ['yellow', 'pink', 'orange'],
        points: 10,
        health: 1,
        speedMultiplier: 1
    },
    ARMORED: {
        color: ['#a0a0a0', '#808080'],
        points: 25,
        health: 2,
        speedMultiplier: 0.8
    },
    EXPLOSIVE: {
        color: ['#ff4444', '#ff0000'],
        points: 15,
        health: 1,
        speedMultiplier: 1.2,
        explodes: true
    }
};

function createAsteroid() {
    if (!gamePlaying) return;
    
    const types = Object.values(ASTEROID_TYPES);
    const asteroidType = types[Math.floor(Math.random() * types.length)];
    const size = Math.random() * 20 + 10;
    
    const asteroid = {
        x: Math.random() * (canvas.width - size),
        y: -size,
        size: size,
        type: asteroidType,
        color: asteroidType.color[Math.floor(Math.random() * asteroidType.color.length)],
        points: asteroidType.points,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 2,
        speed: ASTEROID_SPEED * asteroidType.speedMultiplier
    };
    
    gameState.asteroids.push(asteroid);
    setTimeout(createAsteroid, Math.random() * 2000 + 500);
}

function updateAsteroids(deltaTime) {
    for (let i = gameState.asteroids.length - 1; i >= 0; i--) {
        const asteroid = gameState.asteroids[i];
        asteroid.y += ASTEROID_SPEED * deltaTime;
        asteroid.rotation += asteroid.rotationSpeed * deltaTime;
        
        // Check collision with player
        if (checkCollision(gameState.player, asteroid)) {
            takeDamage(25);
            gameState.asteroids.splice(i, 1);
            continue;
        }
        
        if (asteroid.y - asteroid.size > canvas.height) {
            gameState.asteroids.splice(i, 1);
        }
    }
}

function drawAsteroids() {
    gameState.asteroids.forEach(asteroid => {
        ctx.save();
        ctx.translate(asteroid.x + asteroid.size, asteroid.y + asteroid.size);
        ctx.rotate(asteroid.rotation);
        
        // Create detailed asteroid
        ctx.beginPath();
        const segments = 12;
        const roughness = 0.2;
        
        for (let i = 0; i < segments; i++) {
            const angle = (Math.PI * 2 / segments) * i;
            const radius = asteroid.size * (1 + Math.sin(i * 5) * roughness);
            
            if (i === 0) {
                ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            } else {
                ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
        }
        ctx.closePath();
        
        // Add gradient and texture
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, asteroid.size);
        gradient.addColorStop(0, asteroid.color);
        gradient.addColorStop(1, shadeColor(asteroid.color, -30));
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Add crater details
        for (let i = 0; i < 3; i++) {
            const craterAngle = Math.random() * Math.PI * 2;
            const craterDist = Math.random() * asteroid.size * 0.7;
            const craterSize = asteroid.size * 0.2;
            
            ctx.beginPath();
            ctx.arc(
                Math.cos(craterAngle) * craterDist,
                Math.sin(craterAngle) * craterDist,
                craterSize,
                0, Math.PI * 2
            );
            ctx.fillStyle = shadeColor(asteroid.color, -50);
            ctx.fill();
        }
        
        ctx.restore();
    });
}

function checkCollision(rect, circle) {
    const distX = Math.abs(circle.x + circle.size - (rect.x + rect.width/2));
    const distY = Math.abs(circle.y + circle.size - (rect.y + rect.height/2));

    if (distX > (rect.width/2 + circle.size)) return false;
    if (distY > (rect.height/2 + circle.size)) return false;

    if (distX <= (rect.width/2)) return true;
    if (distY <= (rect.height/2)) return true;

    const dx = distX - rect.width/2;
    const dy = distY - rect.height/2;
    return (dx * dx + dy * dy <= (circle.size * circle.size));
}

function checkLaserCollisions() {
    for (let i = gameState.lasers.length - 1; i >= 0; i--) {
        const laser = gameState.lasers[i];
        let laserHit = false;
        
        // Check asteroids with simpler collision detection
        for (let j = gameState.asteroids.length - 1; j >= 0; j--) {
            const asteroid = gameState.asteroids[j];
            
            // Simple rectangular collision check for asteroids
            if (laser.x < asteroid.x + asteroid.size * 2 &&
                laser.x + laser.width > asteroid.x &&
                laser.y < asteroid.y + asteroid.size * 2 &&
                laser.y + laser.height > asteroid.y) {
                
                // Create hit effect
                createExplosion(laser.x, laser.y, 10, asteroid.color);
                
                // Remove laser
                gameState.lasers.splice(i, 1);
                laserHit = true;
                
                // Add score and create explosion
                score += asteroid.points;
                createExplosion(
                    asteroid.x + asteroid.size,
                    asteroid.y + asteroid.size,
                    20,
                    asteroid.color
                );
                
                // Remove asteroid
                gameState.asteroids.splice(j, 1);
                increaseCombo();
                break;
            }
        }
        
        // Skip alien check if laser already hit something
        if (laserHit) continue;
        
        // Rest of the alien collision code...
    }
}

function updatePlayer(deltaTime) {
    // Update player position based on velocity
    if (keys.left) gameState.player.velocity.x = -PLAYER_SPEED;
    else if (keys.right) gameState.player.velocity.x = PLAYER_SPEED;
    else gameState.player.velocity.x *= 0.9; // Deceleration

    if (keys.up) gameState.player.velocity.y = -PLAYER_SPEED;
    else if (keys.down) gameState.player.velocity.y = PLAYER_SPEED;
    else gameState.player.velocity.y *= 0.9;

    gameState.player.x += gameState.player.velocity.x * deltaTime;
    gameState.player.y += gameState.player.velocity.y * deltaTime;

    // Keep player within bounds
    gameState.player.x = Math.max(0, Math.min(canvas.width - gameState.player.width, gameState.player.x));
    gameState.player.y = Math.max(0, Math.min(canvas.height - gameState.player.height, gameState.player.y));

    // Health regeneration
    if (gameState.player.health < gameState.player.maxHealth) {
        gameState.player.health += deltaTime * 5; // Regenerate 5 health per second
        if (gameState.player.health > gameState.player.maxHealth) {
            gameState.player.health = gameState.player.maxHealth;
        }
    }
}

function drawPlayer() {
    ctx.drawImage(spaceShipImg, gameState.player.x, gameState.player.y, gameState.player.width, gameState.player.height);
}

function drawUI() {
    // Draw logo
    if (logoImg.complete) {
        const maxLogoWidth = 80;
        const scaleFactor = Math.min(maxLogoWidth / logoImg.width, 1);
        const logoWidth = logoImg.width * scaleFactor;
        const logoHeight = logoImg.height * scaleFactor;
        ctx.drawImage(logoImg, canvas.width / 2.25 - logoWidth / 2, 10, logoWidth, logoHeight);
    }

    // Draw top status bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, 60);

    // Draw health bar at the top
    const barWidth = 150;
    const barHeight = 15;
    const barX = 10;
    const barY = 10;
    
    // Health bar background
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Health bar
    const healthPercent = gameState.player.health / gameState.player.maxHealth;
    const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
    gradient.addColorStop(0, `rgb(${255 * (1 - healthPercent)}, ${255 * healthPercent}, 0)`);
    gradient.addColorStop(1, `rgb(${200 * (1 - healthPercent)}, ${200 * healthPercent}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    
    // Shield indicator
    if (gameState.playerPowerUps.shield) {
        ctx.fillStyle = 'rgba(66, 135, 245, 0.5)';
        ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
    }

    // Draw scores
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, barX, barY + 35);
    ctx.textAlign = 'right';
    ctx.fillText('High Score: ' + highScore, canvas.width - 10, barY + 35);

    // Draw active power-ups
    const activePowerUps = Object.entries(gameState.playerPowerUps)
        .filter(([_, active]) => active)
        .map(([type, _]) => POWER_UP_TYPES[type.toUpperCase()]?.symbol || '');
    
    if (activePowerUps.length > 0) {
        ctx.textAlign = 'right';
        ctx.font = '20px Arial';
        activePowerUps.forEach((symbol, index) => {
            ctx.fillText(symbol, canvas.width - 10 - (index * 30), barY + 18);
        });
    }

    // Show warning when aliens are about to appear
    if (score >= 450 && score < 500) {
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#ff0000';
        ctx.textAlign = 'center';
        ctx.fillText('WARNING: Alien forces approaching!', canvas.width / 2, 100);
    }
    
    // Show announcement when aliens appear
    if (score === 500) {
        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = '#ff0000';
        ctx.textAlign = 'center';
        ctx.fillText('ALIENS HAVE ARRIVED!', canvas.width / 2, canvas.height / 2);
    }
}

function gameLoop(currentTime) {
    if (!lastTime) lastTime = currentTime;
    deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateStars(deltaTime);
    updatePlayer(deltaTime);
    updateLasers(deltaTime);
    updateAsteroids(deltaTime);
    updateExplosions(deltaTime);
    updateAliens(deltaTime);
    checkLaserCollisions();
    updateCombo(deltaTime);
    updatePowerUps(deltaTime);

    drawStars();
    drawLasers();
    drawAsteroids();
    drawExplosions();
    drawPlayer();
    drawUI();
    drawCombo();
    drawPowerUps();
    drawAliens();

    if (gamePlaying) {
        requestAnimationFrame(gameLoop);
    } else {
        showMenu();
    }
}

function initGame() {
    createStars();
    gamePlaying = false;
    showMenu();
}

function startGame() {
    score = 0;
    gameState.lasers = [];
    gameState.asteroids = [];
    gameState.aliens = [];
    gameState.alienLasers = [];
    gameState.bossSpawned = false;
    gameState.player.health = gameState.player.maxHealth;
    gameState.player.x = canvas.width / 2 - 30;
    gameState.player.y = canvas.height - 100;
    gamePlaying = true;
    lastTime = 0;
    
    // Start asteroid spawning
    createAsteroid();
    
    // Start alien spawning check
    const checkAlienSpawning = () => {
        if (score >= 500 && gamePlaying) {
            spawnAliens();
        } else {
            setTimeout(checkAlienSpawning, 1000); // Check every second
        }
    };
    checkAlienSpawning();
    
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gamePlaying = false;
}

function showMenu() {
    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title with shadow
    ctx.shadowColor = '#4287f5';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Space Shooter', canvas.width / 2, canvas.height / 2 - 80);
    
    // Status text
    ctx.shadowBlur = 0;
    ctx.font = '30px Arial';
    ctx.fillStyle = '#4287f5';
    ctx.fillText(gamePlaying ? 'Game Over' : 'Welcome', canvas.width / 2, canvas.height / 2 - 40);
    
    // Score
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Score: ' + score, canvas.width / 2, canvas.height / 2);
    
    // Instructions
    ctx.font = '20px Arial';
    ctx.fillStyle = '#a0a0a0';
    ctx.fillText('Press R to ' + (gamePlaying ? 'Restart' : 'Start'), canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText('Press C to Change Ship', canvas.width / 2, canvas.height / 2 + 80);
}

// Event Listeners
document.addEventListener('keydown', (e) => {
    if (e.key === 'Left' || e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'Right' || e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'Up' || e.key === 'ArrowUp') keys.up = true;
    if (e.key === 'Down' || e.key === 'ArrowDown') keys.down = true;
    if (e.key === ' ' || e.code === 'Space') shootLaser();
    if (e.key.toLowerCase() === 'r') startGame();
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Left' || e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'Right' || e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'Up' || e.key === 'ArrowUp') keys.up = false;
    if (e.key === 'Down' || e.key === 'ArrowDown') keys.down = false;
});

// Ship changing functionality
const planeImages = [
    'assets/Obehilator.png',
    'assets/OLIVIALATOR.png',
    'assets/ARWANILATOR.png'
];
let currentPlaneIndex = 0;

function changePlane() {
    currentPlaneIndex = (currentPlaneIndex + 1) % planeImages.length;
    spaceShipImg.src = planeImages[currentPlaneIndex];
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
        changePlane();
    }
});

// Initialize the game
initGame();

// Add these new functions for explosions
function createExplosion(x, y, size = 15, color = '#FFA500') {
    const particles = [];
    const particleCount = size * 2;
    
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 / particleCount) * i;
        const speed = Math.random() * 3 + 1;
        const life = Math.random() * 0.3 + 0.2;
        const scale = Math.random() * 0.5 + 0.5;
        
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: life,
            maxLife: life,
            color: color,
            size: scale * (size / 5)
        });
    }
    
    gameState.explosions.push({ 
        particles,
        age: 0,
        x: x,
        y: y,
        initialSize: size
    });
    
    screenShake();
}

function updateExplosions(deltaTime) {
    for (let i = gameState.explosions.length - 1; i >= 0; i--) {
        const explosion = gameState.explosions[i];
        explosion.age += deltaTime;
        
        explosion.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= deltaTime * 2;
        });
        
        if (explosion.age > 0.5 || explosion.particles.every(p => p.life <= 0)) {
            gameState.explosions.splice(i, 1);
            continue;
        }
    }
}

function drawExplosions() {
    gameState.explosions.forEach(explosion => {
        const shockwaveProgress = explosion.age * 4;
        if (shockwaveProgress < 1) {
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, 
                explosion.initialSize * shockwaveProgress * 2,
                0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${1 - shockwaveProgress})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        explosion.particles.forEach(particle => {
            if (particle.life > 0) {
                const alpha = particle.life / particle.maxLife;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = particle.color;
                
                ctx.shadowBlur = 10;
                ctx.shadowColor = particle.color;
                
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.shadowBlur = 0;
            }
        });
    });
    ctx.globalAlpha = 1;
}

// Add power-up types
const POWER_UP_TYPES = {
    SHIELD: {
        color: '#4287f5',
        symbol: '🛡️',
        effect: 'shield',
        duration: 10000
    },
    RAPID_FIRE: {
        color: '#ff4444',
        symbol: '⚡',
        effect: 'rapidFire',
        duration: 8000
    },
    MULTI_SHOT: {
        color: '#ffaa00',
        symbol: '✨',
        effect: 'multiShot',
        duration: 12000
    }
};

function createPowerUp() {
    if (!gamePlaying) return;
    
    const types = Object.values(POWER_UP_TYPES);
    const powerUpType = types[Math.floor(Math.random() * types.length)];
    
    gameState.powerUps.push({
        x: Math.random() * (canvas.width - 20),
        y: -20,
        width: 20,
        height: 20,
        type: powerUpType,
        speed: 100
    });
    
    setTimeout(createPowerUp, Math.random() * 15000 + 10000);
}

function updateCombo(deltaTime) {
    if (gameState.combo > 0) {
        gameState.comboTimer += deltaTime;
        if (gameState.comboTimer > 2) { // Reset combo after 2 seconds
            gameState.combo = 0;
            gameState.comboTimer = 0;
        }
    }
}

function increaseCombo() {
    gameState.combo++;
    gameState.comboTimer = 0;
    if (gameState.combo > gameState.maxCombo) {
        gameState.maxCombo = gameState.combo;
    }
}

function drawCombo() {
    if (gameState.combo > 1) {
        ctx.font = '24px Arial';
        ctx.fillStyle = `rgba(255, 255, 255, ${1 - gameState.comboTimer/2})`;
        ctx.textAlign = 'center';
        ctx.fillText(`${gameState.combo}x Combo!`, canvas.width/2, 100);
    }
}

function updatePowerUps(deltaTime) {
    for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
        const powerUp = gameState.powerUps[i];
        powerUp.y += powerUp.speed * deltaTime;
        
        // Check collision with player
        if (checkCollision(gameState.player, powerUp)) {
            activatePowerUp(powerUp.type);
            gameState.powerUps.splice(i, 1);
        }
        
        // Remove if off screen
        if (powerUp.y > canvas.height) {
            gameState.powerUps.splice(i, 1);
        }
    }
}

function activatePowerUp(powerUpType) {
    gameState.playerPowerUps[powerUpType.effect] = true;
    
    setTimeout(() => {
        gameState.playerPowerUps[powerUpType.effect] = false;
    }, powerUpType.duration);
}

function drawPowerUps() {
    gameState.powerUps.forEach(powerUp => {
        ctx.fillStyle = powerUp.type.color;
        ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
        ctx.font = '16px Arial';
        ctx.fillText(powerUp.type.symbol, 
            powerUp.x + powerUp.width/2, 
            powerUp.y + powerUp.height/2);
    });
}

// Add screen shake effect
function screenShake() {
    const intensity = 5;
    canvas.style.transform = `translate(${Math.random() * intensity - intensity/2}px, ${Math.random() * intensity - intensity/2}px)`;
    setTimeout(() => {
        canvas.style.transform = 'translate(0, 0)';
    }, 50);
}

// Add visual feedback when taking damage
function takeDamage(amount) {
    if (gameState.playerPowerUps.shield) {
        createExplosion(
            gameState.player.x + gameState.player.width/2,
            gameState.player.y + gameState.player.height/2,
            10,
            '#4287f5'
        );
        return;
    }
    
    gameState.player.health -= amount;
    if (gameState.player.health <= 0) {
        gameOver();
        return;
    }
    
    // Visual feedback
    createExplosion(
        gameState.player.x + gameState.player.width/2,
        gameState.player.y + gameState.player.height/2,
        20,
        '#ff0000'
    );
    screenShake();
}

// Update ALIEN_TYPES with adjusted speeds and patterns
const ALIEN_TYPES = {
    SCOUT: {
        color: '#50C878',
        size: 30,
        health: 50,
        points: 50,
        speed: 40,  // Further reduced speed
        pattern: 'sine',
        shootInterval: 2000,
        laserColor: '#50C878',
        design: 'scout',
        amplitude: 100,  // Horizontal movement range
        frequency: 0.8   // How fast it completes a sine wave
    },
    WARRIOR: {
        color: '#FF4500',
        size: 40,
        health: 100,
        points: 100,
        speed: 25,  // Slower speed
        pattern: 'patrol',
        shootInterval: 1500,
        laserColor: '#FF4500',
        design: 'warrior',
        patrolWidth: 150  // Patrol movement range
    },
    BOSS: {
        color: '#9370DB',
        size: 60,
        health: 300,
        points: 500,
        speed: 15,  // Even slower, more menacing
        pattern: 'hover',
        shootInterval: 1000,
        laserColor: '#9370DB',
        design: 'boss',
        hoverRange: 80    // Hover movement range
    }
};

// Update createAlien to ensure proper health initialization
function createAlien(type = 'SCOUT') {
    const alienConfig = ALIEN_TYPES[type];
    const alien = {
        x: Math.random() * (canvas.width - alienConfig.size),
        y: -alienConfig.size,
        size: alienConfig.size,
        health: alienConfig.health,
        maxHealth: alienConfig.health,
        type: type,
        config: alienConfig,
        pattern: {
            type: alienConfig.pattern,
            offset: 0,
            centerX: 0,
            angle: 0,
            initialX: 0,
            targetY: 0
        },
        lastShot: 0
    };

    // Set initial pattern positions
    switch (alien.pattern.type) {
        case 'sine':
            alien.pattern.centerX = alien.x;
            break;
        case 'patrol':
            alien.pattern.initialX = canvas.width / 2;
            alien.pattern.direction = 1;
            alien.x = alien.pattern.initialX;
            break;
        case 'hover':
            alien.pattern.targetY = canvas.height * 0.2;
            alien.pattern.initialX = canvas.width / 2;
            alien.x = alien.pattern.initialX;
            break;
    }

    gameState.aliens.push(alien);
}

// Update updateAliens with smoother movement patterns
function updateAliens(deltaTime) {
    const currentTime = Date.now();
    
    gameState.aliens.forEach((alien, index) => {
        // Movement patterns
        switch (alien.pattern.type) {
            case 'sine':
                // Smoother sine wave movement
                alien.pattern.offset += deltaTime * alien.config.frequency;
                alien.x = alien.pattern.centerX + Math.sin(alien.pattern.offset) * alien.config.amplitude;
                
                // Gradual descent
                if (alien.y < canvas.height * 0.3) {
                    alien.y += alien.config.speed * deltaTime;
                }
                break;
                
            case 'patrol':
                // Smooth patrol movement
                if (alien.y < canvas.height * 0.2) {
                    alien.y += alien.config.speed * deltaTime;
                } else {
                    const targetX = alien.pattern.initialX + 
                        (alien.pattern.direction * alien.config.patrolWidth / 2);
                    
                    // Smooth movement towards target
                    const dx = targetX - alien.x;
                    alien.x += dx * deltaTime * 2;
                    
                    // Change direction when reaching patrol bounds
                    if (Math.abs(dx) < 1) {
                        alien.pattern.direction *= -1;
                    }
                }
                break;
                
            case 'hover':
                // Smooth hover movement
                const dy = alien.pattern.targetY - alien.y;
                alien.y += dy * deltaTime * 2;
                
                // Gentle horizontal movement
                alien.pattern.angle += deltaTime * 0.5;
                const targetX = alien.pattern.initialX + 
                    Math.cos(alien.pattern.angle) * alien.config.hoverRange;
                
                // Smooth horizontal movement
                alien.x += (targetX - alien.x) * deltaTime * 2;
                break;
        }

        // Shooting logic
        if (currentTime - alien.lastShot > alien.config.shootInterval) {
            alienShoot(alien);
            alien.lastShot = currentTime;
        }

        // Remove if off screen
        if (alien.y > canvas.height + alien.size) {
            gameState.aliens.splice(index, 1);
        }
    });

    updateAlienLasers(deltaTime);
}

// Update spawnAliens with better timing
function spawnAliens() {
    if (!gamePlaying || score < 500) return;  // Don't spawn aliens until score >= 500
    
    if (score >= 1000 && !gameState.bossSpawned) {
        createAlien('BOSS');
        gameState.bossSpawned = true;
        setTimeout(spawnAliens, 5000); // Longer delay after boss spawn
    } else if (score >= 750) {
        createAlien('WARRIOR');
        setTimeout(spawnAliens, Math.random() * 4000 + 3000); // 3-7 seconds
    } else {
        createAlien('SCOUT');
        setTimeout(spawnAliens, Math.random() * 3000 + 2000); // 2-5 seconds
    }
}

// Alien shooting function
function alienShoot(alien) {
    const angle = Math.atan2(
        gameState.player.y - alien.y,
        gameState.player.x - alien.x
    );

    gameState.alienLasers.push({
        x: alien.x + alien.size/2,
        y: alien.y + alien.size/2,
        width: 4,
        height: 12,
        speed: 200,
        color: alien.config.laserColor,
        dx: Math.cos(angle) * 200,
        dy: Math.sin(angle) * 200
    });
}

// Update alien lasers
function updateAlienLasers(deltaTime) {
    for (let i = gameState.alienLasers.length - 1; i >= 0; i--) {
        const laser = gameState.alienLasers[i];
        laser.x += laser.dx * deltaTime;
        laser.y += laser.dy * deltaTime;

        // Check collision with player
        if (checkCollision(gameState.player, laser)) {
            takeDamage(10);
            gameState.alienLasers.splice(i, 1);
            continue;
        }

        // Remove if off screen
        if (laser.y > canvas.height || laser.y < 0 || 
            laser.x > canvas.width || laser.x < 0) {
            gameState.alienLasers.splice(i, 1);
        }
    }
}

// Draw aliens and their health bars
function drawAliens() {
    gameState.aliens.forEach(alien => {
        ctx.save();
        ctx.translate(alien.x + alien.size/2, alien.y + alien.size/2);
        
        // Draw alien based on design type
        switch (alien.config.design) {
            case 'scout':
                drawScoutAlien(alien);
                break;
            case 'warrior':
                drawWarriorAlien(alien);
                break;
            case 'boss':
                drawBossAlien(alien);
                break;
        }
        
        ctx.restore();

        // Draw health bar
        const healthBarWidth = alien.size;
        const healthBarHeight = 5;
        const healthPercent = alien.health / alien.maxHealth;
        
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(alien.x, alien.y - 10, healthBarWidth, healthBarHeight);
        
        ctx.fillStyle = `rgb(${255 * (1 - healthPercent)}, ${255 * healthPercent}, 0)`;
        ctx.fillRect(alien.x, alien.y - 10, healthBarWidth * healthPercent, healthBarHeight);
    });

    // Draw alien lasers with glow effect
    gameState.alienLasers.forEach(laser => {
        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = laser.color;
        ctx.fillStyle = laser.color;
        ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
        ctx.shadowBlur = 0;
    });
}

// Individual alien design functions
function drawScoutAlien(alien) {
    const size = alien.size;
    
    // Main body
    ctx.fillStyle = alien.config.color;
    ctx.beginPath();
    ctx.moveTo(-size/2, -size/2);
    ctx.lineTo(0, -size/3);
    ctx.lineTo(size/2, -size/2);
    ctx.lineTo(size/3, size/3);
    ctx.lineTo(-size/3, size/3);
    ctx.closePath();
    ctx.fill();
    
    // Engine glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = alien.config.color;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, size/4, size/6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawWarriorAlien(alien) {
    const size = alien.size;
    
    // Main body
    ctx.fillStyle = alien.config.color;
    ctx.beginPath();
    ctx.moveTo(-size/2, -size/2);
    ctx.lineTo(size/2, -size/2);
    ctx.lineTo(size/3, size/3);
    ctx.lineTo(0, size/2);
    ctx.lineTo(-size/3, size/3);
    ctx.closePath();
    ctx.fill();
    
    // Armor plates
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-size/3, -size/4);
    ctx.lineTo(size/3, -size/4);
    ctx.stroke();
    
    // Energy core
    ctx.shadowBlur = 15;
    ctx.shadowColor = alien.config.color;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, size/5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function drawBossAlien(alien) {
    const size = alien.size;
    
    // Main body
    ctx.fillStyle = alien.config.color;
    ctx.beginPath();
    ctx.moveTo(-size/2, -size/2);
    ctx.lineTo(size/2, -size/2);
    ctx.lineTo(size/2, size/2);
    ctx.lineTo(-size/2, size/2);
    ctx.closePath();
    ctx.fill();
    
    // Energy shield effect
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 200) * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, size/1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    // Core
    ctx.shadowBlur = 20;
    ctx.shadowColor = alien.config.color;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, size/4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Additional details
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-size/3, -size/3);
    ctx.lineTo(size/3, -size/3);
    ctx.moveTo(-size/3, size/3);
    ctx.lineTo(size/3, size/3);
    ctx.stroke();
}

// Helper function to shade colors
function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (
        0x1000000 +
        (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
}

// Add visual feedback for alien hits
function createAlienHitEffect(alien) {
    // Flash effect
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(alien.x, alien.y, alien.size, alien.size);
    ctx.restore();
    
    // Particle effect
    for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        createExplosion(
            alien.x + alien.size/2,
            alien.y + alien.size/2,
            5,
            alien.config.color
        );
    }
}