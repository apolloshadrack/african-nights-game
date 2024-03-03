const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 480;
canvas.height = 640;

let gamePlaying = false;
let leftPressed = false;
let rightPressed = false;
let upPressed = false;
let downPressed = false;
let score = 0;
let highScore = localStorage.getItem('highScore') || 0;

const spaceShipImg = new Image();
spaceShipImg.onload = startGame;
spaceShipImg.src = 'assets/Obehilator.png';
const logoImg = new Image();
logoImg.src = 'assets/Logo.png'; // Path to the logo image


const stars = [];
const numberOfStars = 100;

const lasers = [];
const laserSpeed = 5;

const asteroids = [];
const asteroidSpeed = 2;

// Preload the laser sound
let laserSound = new Audio('assets/sounds/blast.mp3');

function playLaserSound() {
    var sound = laserSound.cloneNode();
    sound.play();
}

function createStars() {
    for (let i = 0; i < numberOfStars; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 1.5;
        const speed = Math.random() * 0.5 + 0.5;
        stars.push({ x, y, size, speed });
    }
}

function handleStars() {
    for (const star of stars) {
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
        ctx.fillStyle = 'white';
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }
}

function shootLaser() {
    const newLaser = {
        x: spaceShip.x + spaceShip.width / 2 - 2.5,
        y: spaceShip.y,
        width: 5,
        height: 10
    };
    lasers.push(newLaser);
    playLaserSound(); // Play sound on shooting a laser
}

function handleLasers() {
    for (let i = lasers.length - 1; i >= 0; i--) {
        lasers[i].y -= laserSpeed;
        ctx.fillStyle = 'red';
        ctx.fillRect(lasers[i].x, lasers[i].y, lasers[i].width, lasers[i].height);
        if (lasers[i].y + lasers[i].height < 0) {
            lasers.splice(i, 1);
        }
    }
}

function createAsteroid() {
    const size = Math.random() * 20 + 10; // Random size between 10 and 30
    const x = Math.random() * (canvas.width - size);
    const y = -size; // Start just above the canvas
    const colors = ['yellow', 'pink', 'orange']; // Example colors
    const points = [10, 20, 30]; // Points associated with each color
    const colorIndex = Math.floor(Math.random() * colors.length); // Random index for color and points
    const asteroid = {
        x, 
        y, 
        size, 
        color: colors[colorIndex],
        points: points[colorIndex]
    };
    asteroids.push(asteroid);
    setTimeout(createAsteroid, Math.random() * 2000 + 500); // Create a new asteroid every 0.5 to 2.5 seconds
}

function handleAsteroids() {
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];
        asteroid.y += asteroidSpeed;
        ctx.fillStyle = asteroid.color;
        ctx.beginPath();
        ctx.arc(asteroid.x, asteroid.y, asteroid.size, 0, Math.PI * 2);
        ctx.fill();
        if (asteroid.y - asteroid.size > canvas.height) {
            asteroids.splice(i, 1);
        }
    }
}


function checkLaserAsteroidCollision() {
    for (let i = lasers.length - 1; i >= 0; i--) {
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const laser = lasers[i];
            const asteroid = asteroids[j];
            if (laser.x < asteroid.x + asteroid.size &&
                laser.x + laser.width > asteroid.x &&
                laser.y < asteroid.y + asteroid.size &&
                laser.y + laser.height > asteroid.y) {
                lasers.splice(i, 1);
                score += asteroid.points; // Increase score by asteroid's point value
                asteroids.splice(j, 1);
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('highScore', highScore);
                }
                break;
            }
        }
    }
}

const spaceShip = {
    x: canvas.width / 2 - 30,
    y: canvas.height / 2 - 30,
    width: 60,
    height: 60,
    draw() {
        ctx.drawImage(spaceShipImg, this.x, this.y, this.width, this.height);
    }
};

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the logo if it's loaded
    if (logoImg.complete) {
        // Calculate scale factor to not exceed max width of 150px
        const maxLogoWidth = 100;
        const scaleFactor = Math.min(maxLogoWidth / logoImg.width, 1); // Ensures the logo does not scale up if smaller than 150px
        const logoWidth = logoImg.width * scaleFactor;
        const logoHeight = logoImg.height * scaleFactor;
        
        // Calculate the logo's position to center it at the top
        const logoX = canvas.width / 2.25 - logoWidth / 2;
        const logoY = 10; // Adjust this value as needed to change the vertical position
        
        ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
    }
    
    handleStars();
    handleAsteroids();
    handleLasers();
    checkLaserAsteroidCollision();
    if (leftPressed) spaceShip.x -= 2;
    if (rightPressed) spaceShip.x += 2;
    if (upPressed) spaceShip.y -= 2;
    if (downPressed) spaceShip.y += 2;
    spaceShip.draw();
    if (gamePlaying) {
        requestAnimationFrame(draw);
    }

    // Display scores adjusted for logo space
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText('Score: ' + score, 10, 50); // Adjust Y position based on logo height
    ctx.fillText('High Score: ' + highScore, canvas.width - 150, 50); // Adjust Y position based on logo height
}



function keyDownHandler(e) {
    if (e.key === 'Left' || e.key === 'ArrowLeft') leftPressed = true;
    if (e.key === 'Right' || e.key === 'ArrowRight') rightPressed = true;
    if (e.key === 'Up' || e.key === 'ArrowUp') upPressed = true;
    if (e.key === 'Down' || e.key === 'ArrowDown') downPressed = true;
}

function keyUpHandler(e) {
    if (e.key === 'Left' || e.key === 'ArrowLeft') leftPressed = false;
    if (e.key === 'Right' || e.key === 'ArrowRight') rightPressed = false;
    if (e.key === 'Up' || e.key === 'ArrowUp') upPressed = false;
    if (e.key === 'Down' || e.key === 'ArrowDown') downPressed = false;
}

document.addEventListener('keydown', keyDownHandler);
document.addEventListener('keyup', keyUpHandler);
document.addEventListener('click', shootLaser);
document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') shootLaser();
});

function startGame() {
    createStars();
    createAsteroid();
    score = 0; // Reset score when game starts
    gamePlaying = true;
    draw();
}
