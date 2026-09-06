// ==========================================
// 1. المتغيرات ومسابح الكائنات (Object Pools)
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let currentLevelData; 
let isWallActive = false;
let wallActivationTime = 0;
const wallDuration = 6000;
let isBallLaunched = false;
let currentLevelSpeed = 0;
let totalBricksBroken = 0;
let activeBricks = 0;
let cachedLevelCanvas = document.createElement('canvas');
let levelCtx = cachedLevelCanvas.getContext('2d');
let cachedBrickCanvas = document.createElement('canvas');

const MAX_STARS = 22; 
let fallingStarsPool = Array.from({ length: MAX_STARS }, () => ({ active: false, x: 0, y: 0, dy: 0, radius: 0 }));
let currentLevelStars = 0; 

let lives = 3; 
let ballRadius;
let balls = []; 
let paddleHeight, paddleWidth, paddleX;
let brickRowCount, brickColumnCount = 8;
let brickWidth, brickHeight, brickPadding, brickOffsetTop, brickOffsetLeft;
let bricks = [];
let rightPressed = false, leftPressed = false;
let lastTouchX = null;
let dynamicBrickOffsetY = 0;

const bombSound = new Audio('sound/wer.mp3');
let isBombActive = false;
let bombTimer = 0;
let bombTargetBall = null;
let lastFlashSecond = 0;

const MAX_POWERUPS = 15;
let powerUpsPool = Array.from({ length: MAX_POWERUPS }, () => ({ active: false, x: 0, y: 0, dy: 0, radius: 0, type: null }));
let fallingBricksPool = [];
let brickFallTimer = 0;
 let currentBrickFallInterval = 8; // يبدأ بـ 8 ثوانٍ وتقل كلما تقدمنا
let currentDownwardSpeed = 300; // يبدأ بـ 300 ثانية لقطع الشاشة وتقل كلما تقدمنا
let lastPushBackBricks = 0;
const MAX_EXPLOSIONS = 5;
let explosionsPool = Array.from({ length: MAX_EXPLOSIONS }, () => ({ active: false, x: 0, y: 0, radius: 0, maxRadius: 0, alpha: 0 }));
let isFlameActive = false;
let flameTimer = 0;
let flameParticles = [];
const FLAME_DURATION = 30; // 30 ثانية
const fireSound = new Audio('sound/fire.mp3');
fireSound.loop = true;
const hitSoundPool = Array.from({ length: 5 }, () => {
    let audio = new Audio('sound/hit.m4a');
    audio.volume = 1.0;
    return audio;
});
let currentHitSoundIndex = 0;

let primarySkillTimer = 0;
let secondarySkillTimer = 0;
const PRIMARY_SKILL_MAX = 30; // 30 ثانية للمهارة الأساسية
const SECONDARY_SKILL_MAX = 20; // 20 ثانية للمهارة الثانوية
let initialActiveBricks = 0;
let isSpacetimeTransition = false;

// تعريف صورة المضرب
const playerPaddleImg = new Image();
playerPaddleImg.src = 'images/player.png';

// تعريف صور الزعماء (الزعماء 7 مراحل)
const bossImages = {};
for (let i = 1; i <= 7; i++) {
    let img = new Image();
    img.src = `images/bos${i}.png`; // تأكد من أن الصور اسمها bos1.png إلى bos7.png
    bossImages[i] = img;
}

// إعداد موسيقى الخلفية
const bgMusic = new Audio('sound/back sound.mp3');
bgMusic.loop = true; // تكرار تلقائي

// استرجاع مستوى الصوت من التخزين المحلي (أو تعيينه لـ 50% كافتراضي)
let savedMusicVolume = localStorage.getItem('musicVolume');
if (savedMusicVolume !== null) {
    bgMusic.volume = parseFloat(savedMusicVolume) / 100;
} else {
    bgMusic.volume = 0.5; 
}

function playHitSound() {
    let sound = hitSoundPool[currentHitSoundIndex];
    sound.currentTime = 0; 
    sound.play().catch(err => console.log(err));
    currentHitSoundIndex = (currentHitSoundIndex + 1) % 5;
}

// ==========================================
// 2. دوال التوليد والتهيئة (Spawning & Init)
// ==========================================
function spawnStar(x, y, dy, radius) {
    let star = fallingStarsPool.find(s => !s.active);
    if (star) { star.active = true; star.x = x; star.y = y; star.dy = dy; star.radius = radius; }
}

function spawnPowerUp(x, y, dy, radius, type) {
    let p = powerUpsPool.find(p => !p.active);
    if (p) { p.active = true; p.x = x; p.y = y; p.dy = dy; p.radius = radius; p.type = type; }
}

function spawnExplosion(x, y, maxRadius) {
    let ex = explosionsPool.find(e => !e.active);
    if (ex) { ex.active = true; ex.x = x; ex.y = y; ex.radius = 0; ex.maxRadius = maxRadius; ex.alpha = 1.0; }
}

function cacheBrickShape() {
    if (!brickWidth || !brickHeight || !currentLevelData) return;
    cachedBrickCanvas.width = brickWidth;
    cachedBrickCanvas.height = brickHeight;
    let ctxOff = cachedBrickCanvas.getContext('2d');
    ctxOff.clearRect(0, 0, brickWidth, brickHeight);
    drawShape(ctxOff, 0, 0, brickWidth, brickHeight, level, currentLevelData.color);
}

function cacheFullLevel() {
    if (!brickWidth || !brickHeight || !currentLevelData) return;
    cachedLevelCanvas.width = canvas.width;
    cachedLevelCanvas.height = canvas.height;
    levelCtx.clearRect(0, 0, cachedLevelCanvas.width, cachedLevelCanvas.height);

    for(let c = 0; c < brickColumnCount; c++) {
        for(let r = 0; r < brickRowCount; r++) {
            if(bricks[c][r].status == 1) {
                let brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
                let brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
                bricks[c][r].x = brickX; 
                bricks[c][r].y = brickY;
                levelCtx.drawImage(cachedBrickCanvas, brickX, brickY, brickWidth, brickHeight);             
            }
        }
    }
}

function initLevel() {
    lives = 3;
    lastPushBackBricks = 0;
    
    // حساب مستوى الصعوبة بناءً على العالم الحالي (من 0 إلى 6)
    let worldIndex = Math.floor((level - 1) / 8); 
    
    // وتيرة سقوط الطوب: تبدأ بـ 8 ثوانٍ وتنخفض نصف ثانية لكل عالم (تصل لـ 5 ثوانٍ في العالم الأخير)
    currentBrickFallInterval = Math.max(5, 8 - (worldIndex * 0.5)); 
    
    // سرعة الانزياح للأسفل: تبدأ بـ 300 ثانية للشاشة وتنخفض 25 ثانية لكل عالم (تصل لـ 150 ثانية في العالم الأخير)
    currentDownwardSpeed = Math.max(150, 300 - (worldIndex * 25));
    bricks = [];
    dynamicBrickOffsetY = 0;
    primarySkillTimer = 0;
    secondarySkillTimer = 0;
    if (typeof resetPlayerSkills === 'function') resetPlayerSkills();
    
    powerUpsPool.forEach(p => p.active = false);
    activeBricks = 0;
    isFlameActive = false;
    flameTimer = 0;
    flameParticles = [];
    if (typeof fireSound !== 'undefined') {
        fireSound.pause();
        fireSound.currentTime = 0;
    }
    currentLevelData = getLevel(level);

    let currentShape = currentLevelData.data;
    brickRowCount = currentShape.length * 2; 
    brickColumnCount = currentShape[0].length * 2; 
    isWallActive = false; 

    for(let c = 0; c < brickColumnCount; c++) {
        bricks[c] = [];
        for(let r = 0; r < brickRowCount; r++) {
            let val = currentShape[Math.floor(r / 2)][Math.floor(c / 2)];
            let isBrick = val > 0 ? 1 : 0; 
            bricks[c][r] = { x: 0, y: 0, status: isBrick, type: val, powerUpType: null };
            if (val > 0) activeBricks++;
        }
    }

    let powerUpPool = ['multi','multi','multi','multi','multi','multi','multi', 'wall','wall','wall','wall','wall','wall', 'bomb','bomb','bomb','bomb'];
    if (level >= 2) {
        powerUpPool.push('flame', 'flame',);
    }
       let availableBricks = [];
    for(let c = 0; c < brickColumnCount; c++) {
        for(let r = 0; r < brickRowCount; r++) {
            if (bricks[c][r].status === 1 && bricks[c][r].type === 1) availableBricks.push(bricks[c][r]);
        }
    }
    
    availableBricks.sort(() => Math.random() - 0.5);
    for(let i = 0; i < powerUpPool.length && i < availableBricks.length; i++) {
        availableBricks[i].powerUpType = powerUpPool[i];
    }
    
    isBombActive = false;
    explosionsPool.forEach(ex => ex.active = false);
    fallingStarsPool.forEach(s => s.active = false);
    currentLevelStars = 0;

    let assignedStars = 0;
    while(assignedStars < 3 && assignedStars < activeBricks) {
        let randomC = Math.floor(Math.random() * brickColumnCount);
        let randomR = Math.floor(Math.random() * brickRowCount);
        if(bricks[randomC][randomR].status === 1 && !bricks[randomC][randomR].hasStar) {
            bricks[randomC][randomR].hasStar = true;
            assignedStars++;
        }
    }
    
    resizeGame();
    paddleX = (canvas.width - paddleWidth) / 2;
    totalBricksBroken = 0; 
    updateBallSpeed(); 
    isBallLaunched = false; 
    balls = [{ x: canvas.width / 2, y: canvas.height * 0.75, dx: 0, dy: 0 }];
    // حفظ العدد الإجمالي للطوب وحالة الانتقال
    initialActiveBricks = activeBricks;
    isSpacetimeTransition = false;
}

function resizeGame() {
    let oldWidth = canvas.width;
    let dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    let phaseLevel = ((level - 1) % 8) + 1; 
    paddleWidth = Math.max(canvas.width * (0.22- (phaseLevel * 0.01)), canvas.width * 0.10);
    paddleHeight = 18;
    if(oldWidth) paddleX = (paddleX / oldWidth) * canvas.width;

    ballRadius = Math.max(canvas.width * 0.015, 6);
    brickOffsetTop = canvas.height * 0.12; 
    brickPadding = 1; 
    
    let widthBasedSize = ((canvas.width * 0.9) - (brickPadding * (brickColumnCount - 1))) / brickColumnCount;
    let heightBasedSize = ((canvas.height * 0.5) - (brickPadding * (brickRowCount - 1))) / brickRowCount;
    brickWidth = Math.min(widthBasedSize, heightBasedSize);
    brickHeight = brickWidth; 
    
    brickOffsetLeft = (canvas.width - ((brickWidth * brickColumnCount) + (brickPadding * (brickColumnCount - 1)))) / 2;
    
    if(isPlaying) updateBallSpeed();
    cacheBrickShape();
    cacheFullLevel();
}
window.addEventListener('resize', resizeGame);

// ==========================================
// 3. دوال الرسم (Drawing Functions)
// ==========================================
function drawShape(ctx, shapeX, shapeY, w, h, levelIndex, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(shapeX, shapeY, w, h); 
    ctx.fill();
    ctx.closePath();
}

function drawBricks() { 
    ctx.drawImage(cachedLevelCanvas, 0, dynamicBrickOffsetY); 
}
function drawPaddle() {
    let pY = canvas.height - (canvas.height * 0.05) - paddleHeight;
    
    // رسم صورة المضرب إذا تم تحميلها، وإلا رسم المستطيل الاحتياطي
    if (playerPaddleImg.complete) {
        let padding = 10; 
        let renderHeight = paddleHeight + padding; 
        let renderY = pY - (padding / 2);
    
        // تم تصحيح الإزاحة لتصبح 15 (نصف الـ 30) لضمان تمركز المضرب بشكل مثالي
        ctx.drawImage(playerPaddleImg, paddleX - 15, pY - 5, paddleWidth + 35, paddleHeight + 25);
    }

    // تأثير الجزيئات (Particles) للنار الحقيقية يبقى كما هو
    if (typeof isFlameActive !== 'undefined' && isFlameActive) {
        let intensity = 1 - (flameTimer / FLAME_DURATION); // من 0 إلى 1

        let numParticles = Math.floor(1 + intensity * 5); 
        for (let i = 0; i < numParticles; i++) {
            flameParticles.push({
                x: paddleX + Math.random() * paddleWidth,
                y: pY,
                vx: (Math.random() - 0.5) * 2.5,
                vy: -(Math.random() * 2 + 1 + intensity * 4), 
                life: 1.0, 
                decay: Math.random() * 0.05 + 0.02, 
                size: Math.random() * 6 + 4 + intensity * 8 
            });
        }

        ctx.globalCompositeOperation = 'lighter'; 
        for (let i = flameParticles.length - 1; i >= 0; i--) {
            let p = flameParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;

            if (p.life <= 0) {
                flameParticles.splice(i, 1);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                let r = 255;
                let g = Math.floor(255 * p.life);
                let b = 0;
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.life})`;
                ctx.fill();
                ctx.closePath();
            }
        }
        ctx.globalCompositeOperation = 'source-over'; 
    } else {
        flameParticles = []; 
    }
}

function drawHUD() {
    let fontSize = Math.max(canvas.width * 0.04, 14);
    ctx.font = `bold ${fontSize}px 'Segoe UI'`;
    ctx.fillStyle = "#00AEEF"; 
    ctx.textAlign = "left";
    ctx.fillText("Score: " + score, 15, canvas.height * 0.07);
    
    ctx.fillStyle = "#C0C7D1"; 
    ctx.textAlign = "right";
    ctx.fillText("Level: " + level, canvas.width - 15, canvas.height * 0.07);
    
    ctx.textAlign = "center";
    // عرض المؤقت بدلاً من الكرات إذا كانت النار نشطة
    if (typeof isFlameActive !== 'undefined' && isFlameActive) {
        let timeRemaining = Math.ceil(flameTimer);
        ctx.fillStyle = "#FF4500"; 
        ctx.fillText("Flame: " + timeRemaining + "s", canvas.width / 2, canvas.height * 0.07);
    } else {
        ctx.fillStyle = "#FFFFFF"; 
        ctx.fillText("Balls: " + balls.length, canvas.width / 2, canvas.height * 0.07);
    }
}

function drawSkillBars() {
    if (isChampionMode) return; // لا نرسم الأشرطة في طور الزعيم
    
    // جعل الأشرطة أقصر وأفقية
    let barWidth = Math.max(100, canvas.width * 0.25); // العرض الأفقي
    let barHeight = Math.max(8, canvas.height * 0.012); // الارتفاع (السُمك)
    let startX = 20;
    let startY = canvas.height - 25; // نبدأ من الأسفل

    // رسم المهارة الأساسية أولاً (في الأسفل)
    if (typeof equippedPrimary !== 'undefined' && equippedPrimary) {
        let fillRatio = Math.min(primarySkillTimer / PRIMARY_SKILL_MAX, 1.0);
        
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; // خلفية الشريط
        ctx.fillRect(startX, startY, barWidth, barHeight);
        
        ctx.fillStyle = fillRatio >= 1 ? "#2ECC71" : "#E74C3C"; // التعبئة (أحمر ثم أخضر)
        ctx.fillRect(startX, startY, barWidth * fillRatio, barHeight);
        
        ctx.strokeStyle = fillRatio >= 1 ? "#2ECC71" : "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, barWidth, barHeight);
        
        startY -= (barHeight + 10); // نرفع الإحداثي Y لنرسم الشريط الثانوي فوقه
    }

    // رسم المهارة الثانوية (فوق الأساسية)
    if (typeof equippedSecondary !== 'undefined' && equippedSecondary) {
        let fillRatio = Math.min(secondarySkillTimer / SECONDARY_SKILL_MAX, 1.0);
        
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; 
        ctx.fillRect(startX, startY, barWidth, barHeight);
        
        ctx.fillStyle = fillRatio >= 1 ? "#2ECC71" : "#00AEEF"; // التعبئة (أزرق ثم أخضر)
        ctx.fillRect(startX, startY, barWidth * fillRatio, barHeight);
        
        ctx.strokeStyle = fillRatio >= 1 ? "#2ECC71" : "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, barWidth, barHeight);
    }
}

function drawLives() {
    let pixelSize = Math.max(canvas.width * 0.003, 2);
    let heartWidth = pixelHeart[0].length * pixelSize;
    let padding = 10;
    let startX = canvas.width - (heartWidth * 3) - (padding * 3);
    let startY = canvas.height - (pixelHeart.length * pixelSize) - 15;

    for (let i = 0; i < lives; i++) {
        let xOffset = startX + (i * (heartWidth + padding));
        ctx.fillStyle = "#e74c3c"; 
        for (let r = 0; r < pixelHeart.length; r++) {
            for (let c = 0; c < pixelHeart[0].length; c++) {
                if (pixelHeart[r][c] === 1) {
                    ctx.fillRect(xOffset + (c * pixelSize), startY + (r * pixelSize), pixelSize, pixelSize);
                }
            }
        }
    }
}