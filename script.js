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
        velocity: { x: 0, y: 0 }
    }
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
    STAR_SPEEDS.forEach(speed => {
        for (let i = 0; i < 33; i++) {
            gameState.stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 1.5,
                speed: speed
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
    ctx.fillStyle = 'white';
    gameState.stars.forEach(star => {
        ctx.fillRect(star.x, star.y, star.size, star.size);
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
    ctx.fillStyle = 'red';
    gameState.lasers.forEach(laser => {
        ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
    });
}

function createAsteroid() {
    if (!gamePlaying) return;
    
    const size = Math.random() * 20 + 10;
    const asteroid = {
        x: Math.random() * (canvas.width - size),
        y: -size,
        size: size,
        color: ['yellow', 'pink', 'orange'][Math.floor(Math.random() * 3)],
        points: [10, 20, 30][Math.floor(Math.random() * 3)],
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 2
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
            gameOver();
            return;
        }
        
        if (asteroid.y - asteroid.size > canvas.height) {
            gameState.asteroids.splice(i, 1);
        }
    }
}

function drawAsteroids() {
    gameState.asteroids.forEach(asteroid => {
        ctx.save();
        ctx.translate(asteroid.x + asteroid.size / 2, asteroid.y + asteroid.size / 2);
        ctx.rotate(asteroid.rotation);
        ctx.fillStyle = asteroid.color;
        ctx.beginPath();
        ctx.arc(-asteroid.size / 2, -asteroid.size / 2, asteroid.size, 0, Math.PI * 2);
        ctx.fill();
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

function checkLaserAsteroidCollisions() {
    for (let i = gameState.lasers.length - 1; i >= 0; i--) {
        for (let j = gameState.asteroids.length - 1; j >= 0; j--) {
            const laser = gameState.lasers[i];
            const asteroid = gameState.asteroids[j];
            
            if (laser.x < asteroid.x + asteroid.size * 2 &&
                laser.x + laser.width > asteroid.x &&
                laser.y < asteroid.y + asteroid.size * 2 &&
                laser.y + laser.height > asteroid.y) {
                
                gameState.lasers.splice(i, 1);
                gameState.asteroids.splice(j, 1);
                score += asteroid.points;
                
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('highScore', highScore);
                }
                break;
            }
        }
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
}

function drawPlayer() {
    ctx.drawImage(spaceShipImg, gameState.player.x, gameState.player.y, gameState.player.width, gameState.player.height);
}

function drawUI() {
    // Draw logo
    if (logoImg.complete) {
        const maxLogoWidth = 100;
        const scaleFactor = Math.min(maxLogoWidth / logoImg.width, 1);
        const logoWidth = logoImg.width * scaleFactor;
        const logoHeight = logoImg.height * scaleFactor;
        ctx.drawImage(logoImg, canvas.width / 2.25 - logoWidth / 2, 10, logoWidth, logoHeight);
    }

    // Draw scores
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 10, 50);
    ctx.fillText('High Score: ' + highScore, canvas.width - 150, 50);
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
    checkLaserAsteroidCollisions();

    drawStars();
    drawLasers();
    drawAsteroids();
    drawPlayer();
    drawUI();

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
    gameState.player.x = canvas.width / 2 - 30;
    gameState.player.y = canvas.height - 100;
    gamePlaying = true;
    lastTime = 0;
    createAsteroid();
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gamePlaying = false;
}

function showMenu() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Space Shooter', canvas.width / 2, canvas.height / 2 - 80);
    ctx.fillText(gamePlaying ? 'Game Over' : 'Welcome', canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillText('Score: ' + score, canvas.width / 2, canvas.height / 2);
    
    ctx.font = '20px Arial';
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