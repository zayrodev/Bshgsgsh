// =========================================================================
// 1. المتغيرات العامة لطور الزعيم
// =========================================================================
let champAnimationId;
let champIsPlaying = false;
let champLastTime = 0;
let champBalls = [];
let champPlasmaBalls = [];
let champPlasmaTimers = [
    { current: 0, interval: 5000 },
    { current: 0, interval: 8000 },
    { current: 0, interval: 15000 }
];
let champPlayerScore = 0;
let champEnemyScore = 0;
let champPlayerPlasmaCharges = 0; 
let champEnemyPlasmaCharges = 0;

let champEnemyPaddleX = 0;
let champEnemySpeed = 450;
let champCurrentChampionSpeed = 600;
let champDifficulty = 'normal';
let champIsBallLaunched = false;
let champIsFirstServe = true;

// متغيرات الذكاء الاصطناعي
let champEnemyDecisionMade = false;
let champIsEnemyMissing = false;
let champMistakeType = 'slow';
let champMistakeOffset = 0;
let champAiGuaranteedHits = 16; 
let champIsIncomingSkill = false; 
let champActiveSkillMissChance = 0;

// متغيرات حالة نظام البلازما للزعماء
let champHitsAfterFullPlasma = 0; 
let champHitsToActivateHidden = 0; 

// متغيرات التأثير السينمائي 
let champCinematicPause = false;
let champCinematicEndTime = 0;
let champCinematicText = "";
let champHiddenBlowCount = 0;
const champLiserSound = new Audio('sound/liser.mp3');
let champIsSuddenDeath = false;
// الكائن الذي سيحمل الزعيم الحالي أثناء اللعب
let champCurrentBoss = {};

const bossThemes = {
    8:  { name: 'Dames', color: '#00AEEF', diff: 'easy', speed1: 12, speed2: 18 },
    16: { name: 'North Star', color: '#9D50BB', diff: 'normal', speed1: 8, speed2: 14 },
    24: { name: 'Oxidon', color: '#2ECC71', diff: 'normal', speed1: 6, speed2: 12 },
    32: { name: 'The Facade', color: '#E74C3C', diff: 'hard', speed1: 4, speed2: 8 },
    40: { name: 'The Ray', color: '#F39C12', diff: 'hard', speed1: 2, speed2: 6 },
    48: { name: 'Head Y', color: '#BDC3C7', diff: 'hard', speed1: 1, speed2: 4 },
    56: { name: 'Black Hole', color: '#555555', diff: 'extreme', speed1: 0, speed2: 2 }
};

// =========================================================================

// =========================================================================

function startChampionMatch(levelIndex) {
    let bossData = bossThemes[levelIndex] || bossThemes[56];
    let registryData = BossRegistry[bossData.name] || BossRegistry['Default'];
    
    // دمج بيانات الزعيم الأساسية مع دوال السجل البرمجي الخاصة به
    champCurrentBoss = {
        ...bossData,
        state: registryData.createState(),
        onHit: registryData.onHit,
        onPlayerHit: registryData.onPlayerHit,
        update: registryData.update,
        drawEffects: registryData.drawEffects,
        overrideDrawBall: registryData.overrideDrawBall
    };
    
    champDifficulty = bossData.diff;
    
    // تصفير العدادات
    champPlayerScore = 0;
    champEnemyScore = 0;
    champPlayerPlasmaCharges = 0;
    champEnemyPlasmaCharges = 0;
    champPlasmaBalls = [];
    champBalls = [];
    champHitsAfterFullPlasma = 0;
    champCinematicPause = false;
    champHiddenBlowCount = 0;
    resetPlayerSkills();
    
    updateChampUI();

    document.getElementById('bossName').innerText = bossData.name;
    document.getElementById('bossAvatar').style.backgroundColor = bossData.color;
    
    const preMatchOverlay = document.getElementById('preMatchOverlay');
    preMatchOverlay.style.display = 'flex';
    
    resizeGame(); 
    champEnemyPaddleX = (canvas.width - paddleWidth) / 2;
    paddleX = (canvas.width - paddleWidth) / 2;

    setTimeout(() => {
        preMatchOverlay.style.display = 'none';
        document.getElementById('championUI').style.display = 'block'; 
        
        champIsPlaying = true;
        champLastTime = performance.now();
        resetChampionBall();
        
        champDraw(performance.now());
    }, 4000);
    champPlasmaTimers.forEach(t => t.current = 0);
}


// =========================================================================
// 4. تحديث واجهة المستخدم والبلازما
// =========================================================================

function updateChampUI() {
    document.getElementById('playerScoreUI').innerText = champPlayerScore;
    document.getElementById('enemyScoreUI').innerText = champEnemyScore;

    const playerSlots = document.querySelectorAll('.player-slot');
    for (let i = 0; i < playerSlots.length; i++) {
        playerSlots[i].style.backgroundColor = (i < champPlayerPlasmaCharges) ? '#00BFFF' : 'transparent';
    }

    const enemySlots = document.querySelectorAll('.enemy-slot');
    for (let i = 0; i < enemySlots.length; i++) {
        enemySlots[i].style.backgroundColor = (i < champEnemyPlasmaCharges) ? champCurrentBoss.color : 'transparent';
    }
}

function spawnPlasmaBall() {
    let offsetX = (Math.random() - 0.5) * (canvas.width * 0.4); 
    let offsetY = (Math.random() - 0.5) * (canvas.height * 0.3);
    
    champPlasmaBalls.push({
        x: (canvas.width / 2) + offsetX,
        y: (canvas.height / 2) + offsetY,
        radius: 0,
        maxRadius: Math.max(canvas.width * 0.035, 15),
        life: 6000, 
        age: 0
    });
}

function handlePlasmaBalls(dt) {
    for (let i = 0; i < champPlasmaTimers.length; i++) {
        champPlasmaTimers[i].current += dt * 1000;
        if (champPlasmaTimers[i].current >= champPlasmaTimers[i].interval) {
            spawnPlasmaBall(); 
            champPlasmaTimers[i].current -= champPlasmaTimers[i].interval; 
        }
    }

    for (let i = champPlasmaBalls.length - 1; i >= 0; i--) {
        let p = champPlasmaBalls[i];
        p.age += dt * 1000; 

        if (p.age < 1000) p.radius = (p.age / 1000) * p.maxRadius; 
        else if (p.age > p.life - 1000) p.radius = Math.max(0, ((p.life - p.age) / 1000) * p.maxRadius); 
        else p.radius = p.maxRadius + Math.sin(p.age / 150) * 3; 

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        
        let gradient = ctx.createRadialGradient(p.x, p.y, p.radius * 0.3, p.x, p.y, p.radius);
        gradient.addColorStop(0, "rgba(0, 191, 255, 0.8)"); 
        gradient.addColorStop(1, "rgba(0, 191, 255, 0)");   
        
        ctx.fillStyle = gradient; 
        ctx.fill();
        ctx.closePath();

        let isDestroyed = false;
        for (let b = 0; b < champBalls.length; b++) {
            let ball = champBalls[b];
            let distSq = (ball.x - p.x)**2 + (ball.y - p.y)**2;
            
            if (distSq < Math.pow(ballRadius + p.radius, 2)) {
                isDestroyed = true;
                if (ball.lastHitter === 'player' && champPlayerPlasmaCharges < 3) {
                    champPlayerPlasmaCharges++;
                    updateChampUI();
                } else if (ball.lastHitter === 'enemy' && champEnemyPlasmaCharges < 3) {
                    champEnemyPlasmaCharges++;
                    updateChampUI();
                    if (champEnemyPlasmaCharges === 3) {
                        champHitsAfterFullPlasma = 0;
                        champHitsToActivateHidden = Math.floor(Math.random() * 3) + 1; 
                    }
                }
                break; 
            }
        }
        
        if (isDestroyed || p.age >= p.life) {
            champPlasmaBalls.splice(i, 1);
        }
    }
}

// =========================================================================
// 5. الذكاء الاصطناعي للزعيم
// =========================================================================

function handleChampionAI(dt) {
    let eY = canvas.height * 0.05;

    // إضافة هذا السطر لحساب عرض مضرب الزعيم (يتجاهل تكبير مهارة الجدار)
    let eWidth = (typeof PlayerSkillRegistry !== 'undefined' && PlayerSkillRegistry['the_great_wall'] && PlayerSkillRegistry['the_great_wall'].state.isActive) ? PlayerSkillRegistry['the_great_wall'].state.baseWidth : paddleWidth;

    let bossIndex = level / 8;
    let currentBossImg = typeof bossImages !== 'undefined' ? bossImages[bossIndex] : null;

    let bVisualExtraW = 30;
    let bVisualExtraH = 25;

    if (bossIndex === 5) {
        bVisualExtraW = 30;
        bVisualExtraH = 30;
    }

    if (currentBossImg && currentBossImg.complete) {
        ctx.save();
        ctx.translate(champEnemyPaddleX + eWidth / 2, eY + paddleHeight / 2); // paddleWidth -> eWidth
        ctx.scale(1, -1);
        
        let finalWidth = eWidth + bVisualExtraW; // paddleWidth -> eWidth
        let finalHeight = paddleHeight + bVisualExtraH;
        
        ctx.drawImage(currentBossImg, -(finalWidth / 2), -(finalHeight / 2), finalWidth, finalHeight);
        ctx.restore(); 
    } else {
        ctx.beginPath();
        ctx.rect(champEnemyPaddleX, eY, eWidth, paddleHeight); // paddleWidth -> eWidth
        ctx.fillStyle = champCurrentBoss.color;
        ctx.fill();
        ctx.closePath();
    }

    if (champIsBallLaunched && champBalls.length > 0) {
        let ball = champBalls[0];
        let currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);

        if (ball.dy < 0 && !champEnemyDecisionMade) {
            champEnemyDecisionMade = true;
            let missChance = 0; // نسبة الخطأ الافتراضية للضربات العادية هي 0%

            // التحقق مما إذا كانت الكرة مدعومة بمهارة هجومية
            if (champIsIncomingSkill) {
                let bossIdx = level / 8; // تحديد رقم الزعيم من 1 إلى 7
                let baselineMiss = 0;

                // تحديد فرصة الاختراق الأساسية (احتمالية الخطأ بناءً على نسبة الصد)
                if (bossIdx === 1) baselineMiss = 33.33;      // يصد 2 من 3 (يخطئ 33.33%)
                else if (bossIdx === 2) baselineMiss = 25.0;  // يصد 3 من 4 (يخطئ 25%)
                else if (bossIdx === 3) baselineMiss = 20.0;  // يصد 4 من 5 (يخطئ 20%)
                else if (bossIdx === 4) baselineMiss = 16.67; // يصد 5 من 6 (يخطئ 16.67%)
                else baselineMiss = 14.28;                    // يصد 6 من 7 للزعماء 5 و 6 و 7

                // إذا كانت المهارة تفرض نسبة خطأ خاصة (مثل الارتداد المتسارع 75%)
                if (champActiveSkillMissChance > 0) {
                    let finalSkillChance = champActiveSkillMissChance;
                    
                    // تقليل تأثيرات المهارات الهجومية للزعيمين 6 و 7
                    if (bossIdx === 6) finalSkillChance *= 0.5; // النصف
                    else if (bossIdx === 7) finalSkillChance *= 0.3333; // الثلث
                    
                    // تطبيق النسبة الأعلى بين تأثير المهارة المُعدل والنسبة الأساسية للزعيم
                    missChance = Math.max(baselineMiss, finalSkillChance); 
                } else {
                    missChance = baselineMiss;
                }
            }

            if (champAiGuaranteedHits > 0) missChance = 0; // الحماية المضمونة إن وجدت
            
            // حساب النتيجة العشوائية بناءً على النسبة
            if (Math.random() * 100 < missChance) {
                champIsEnemyMissing = true;
                champMistakeType = Math.random() > 0.5 ? 'slow' : 'overshoot';
                champMistakeOffset = (Math.random() > 0.5 ? 1 : -1) * (eWidth * 1.2);
            } else {
                champIsEnemyMissing = false;
            }

            // تصفير مؤشرات المهارة استعداداً للضربة القادمة
            champIsIncomingSkill = false;
            champActiveSkillMissChance = 0;
        } else if (ball.dy > 0) {
            champEnemyDecisionMade = false;
            champIsEnemyMissing = false;
        }
        let targetX = champEnemyPaddleX; 
        let currentAISpeed = champEnemySpeed;

        if (ball.y < canvas.height / 2) {
            targetX = ball.x - eWidth / 2; // paddleWidth -> eWidth
            if (champIsEnemyMissing && champMistakeType === 'overshoot') targetX = ball.x + champMistakeOffset - eWidth / 2; // paddleWidth -> eWidth
            if (champIsEnemyMissing && champMistakeType === 'slow') {
                currentAISpeed = champEnemySpeed * 0.35; 
            } else {
                let distanceY = ball.y - (eY + paddleHeight);
                let timeToImpact = Math.abs(distanceY / ball.dy);
                if (timeToImpact > 0.01) { 
                    let distanceX = Math.abs(targetX - champEnemyPaddleX);
                    let requiredSpeed = distanceX / timeToImpact;
                    currentAISpeed = Math.max(champEnemySpeed, requiredSpeed);
                    currentAISpeed = Math.min(currentAISpeed, 3000); 
                }
            }
        }

        let moveStep = currentAISpeed * dt;
        if (Math.abs(targetX - champEnemyPaddleX) <= moveStep) champEnemyPaddleX = targetX;
        else if (champEnemyPaddleX < targetX) champEnemyPaddleX += moveStep;
        else if (champEnemyPaddleX > targetX) champEnemyPaddleX -= moveStep;

        if (champEnemyPaddleX < 0) champEnemyPaddleX = 0;
        if (champEnemyPaddleX > canvas.width - eWidth) champEnemyPaddleX = canvas.width - eWidth; // paddleWidth -> eWidth
    }
}

// =========================================================================
// 6. المحرك الرئيسي والمصادمات لطور الزعيم
// =========================================================================

function champDraw(timestamp) {
    if (!champIsPlaying) return;
    
    let dt = 0;
    
    if (champCinematicPause) {
        dt = 0; 
        if (performance.now() > champCinematicEndTime) {
            champCinematicPause = false;
            champLastTime = performance.now(); 
        }
    } else {
        dt = (timestamp - champLastTime) / 1000;
        champLastTime = timestamp;
        if (dt > 0.05 || dt === 0) dt = 0.016; 
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    handlePlasmaBalls(dt);

    let pY = canvas.height - (canvas.height * 0.05) - paddleHeight;
    
    // رسم الصورة بدلاً من المستطيل الأبيض
    if (typeof playerPaddleImg !== 'undefined' && playerPaddleImg.complete) {
        let pVisualExtraW = 30; 
        let pVisualExtraH = 25; 
        
        ctx.drawImage(playerPaddleImg, paddleX - (pVisualExtraW / 2), pY - (pVisualExtraH / 2), paddleWidth + pVisualExtraW, paddleHeight + pVisualExtraH);
    } else {
        ctx.beginPath();
        ctx.rect(paddleX, pY, paddleWidth, paddleHeight);
        ctx.fillStyle = "#ecf0f1";
        ctx.fill();
        ctx.closePath();
    }

    handleChampionAI(dt);
    
    let pY_skill = canvas.height - (canvas.height * 0.05) - paddleHeight;
    let ctxData = { paddleX: paddleX, pY: pY_skill, paddleWidth: paddleWidth, paddleHeight: paddleHeight, ballRadius: ballRadius, canvas: canvas };
    updatePlayerSkills(dt, champBalls, ctxData);
    
    let eY = canvas.height * 0.05;

    // إضافة عرض الزعيم المستقل للتصادم
    let eWidth = (typeof PlayerSkillRegistry !== 'undefined' && PlayerSkillRegistry['the_great_wall'] && PlayerSkillRegistry['the_great_wall'].state.isActive) ? PlayerSkillRegistry['the_great_wall'].state.baseWidth : paddleWidth;

    for (let i = champBalls.length - 1; i >= 0; i--) {
        let ball = champBalls[i];
        
        if (champCurrentBoss.overrideDrawBall) {
            champCurrentBoss.overrideDrawBall(ball, ctx, ballRadius);
        }

        if (!champIsBallLaunched) continue;

        let nextX = ball.x + (ball.dx * dt);
        if(nextX > canvas.width - ballRadius || nextX < ballRadius) ball.dx = -ball.dx;

        // اصطدام بمضرب اللاعب
        let closestX = Math.max(paddleX, Math.min(ball.x, paddleX + paddleWidth));
        let closestY = Math.max(pY, Math.min(ball.y, pY + paddleHeight));
        if (((ball.x - closestX) ** 2) + ((ball.y - closestY) ** 2) < (ballRadius * ballRadius)) {
            if (typeof playHitSound === "function") playHitSound();
            if (ball.dy > 0) { 
                let hitPoint = (ball.x - (paddleX + paddleWidth / 2)) / (paddleWidth / 2);
                let bounceAngle = hitPoint * (Math.PI / 3);
                let currentTotalSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                
                ball.dx = currentTotalSpeed * Math.sin(bounceAngle);
                ball.dy = -Math.abs(currentTotalSpeed * Math.cos(bounceAngle)); 
                ball.y = pY - ballRadius; 
                ball.lastHitter = 'player'; 
                
                if (champCurrentBoss.onPlayerHit) {
                    champCurrentBoss.onPlayerHit();
                }
                
                increaseBallSpeed();
            }
        }

        // اصطدام بمضرب الزعيم (باستخدام eWidth)
        let closestEX = Math.max(champEnemyPaddleX, Math.min(ball.x, champEnemyPaddleX + eWidth));
        let closestEY = Math.max(eY, Math.min(ball.y, eY + paddleHeight));
        if (((ball.x - closestEX)**2 + (ball.y - closestEY)**2) < ballRadius**2) {
            if (typeof playHitSound === "function") playHitSound();
            if (ball.dy < 0) {
                let hitPoint = (ball.x - (champEnemyPaddleX + eWidth / 2)) / (eWidth / 2);
                let bounceAngle = hitPoint * (Math.PI / 3);
                let currentTotalSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);

                ball.dx = currentTotalSpeed * Math.sin(bounceAngle);
                ball.dy = Math.abs(currentTotalSpeed * Math.cos(bounceAngle)); 
                ball.y = eY + paddleHeight + ballRadius;
                ball.lastHitter = 'enemy'; 
                
                if (champCurrentBoss.onHit) {
                    champCurrentBoss.onHit(ball, {
                        canvas: canvas,
                        paddleHeight: paddleHeight,
                        eY: eY,
                        pY: pY,
                        gameState: {
                            enemyPlasma: champEnemyPlasmaCharges,
                            consumeEnemyPlasma: (amount) => { champEnemyPlasmaCharges -= amount; updateChampUI(); },
                            resetEnemyPlasma: () => { champEnemyPlasmaCharges = 0; updateChampUI(); },
                            hitsAfterFullPlasma: champHitsAfterFullPlasma,
                            incrementHitsAfterPlasma: () => { champHitsAfterFullPlasma++; },
                            hitsToActivate: champHitsToActivateHidden,
                            triggerCinematic: (duration, text) => { 
                                champCinematicPause = true; 
                                champCinematicEndTime = performance.now() + duration; 
                                champCinematicText = text;
                                champHiddenBlowCount++;
                                champLiserSound.currentTime = 0;
                                champLiserSound.play().catch(e => console.log(e));
                            }
                        }
                    });
                }

                if (champAiGuaranteedHits > 0) champAiGuaranteedHits--;
                increaseBallSpeed();
            }
        }

        ball.x += ball.dx * dt;
        ball.y += ball.dy * dt;
        
        if (champCurrentBoss.update) {
            champCurrentBoss.update(dt, ball, { canvas: canvas, ballRadius: ballRadius });
        }

        if (ball.y > canvas.height + ballRadius) {
            champEnemyScore++;
            champBalls.splice(i, 1);
            updateChampUI();
            checkMatchResult('enemy'); 
        } else if (ball.y < -ballRadius) {
            champPlayerScore++;
            updateChampUI();
            champBalls.splice(i, 1);
            checkMatchResult('player'); 
        }
    }

    let keyboardSpeed = (canvas.width * 1.5) * (typeof sensitivityMultiplier !== 'undefined' ? sensitivityMultiplier : 1.2) * dt;
    if(rightPressed && paddleX < canvas.width - paddleWidth) paddleX += keyboardSpeed;
    else if(leftPressed && paddleX > 0) paddleX -= keyboardSpeed;
    
    if (champCinematicPause) {
        let edgeThickness = Math.max(6, canvas.width * 0.015); 
        ctx.save(); 
        ctx.globalAlpha = 0.8; 
        ctx.lineWidth = edgeThickness;
        ctx.strokeStyle = champCurrentBoss.color; 
        ctx.shadowColor = champCurrentBoss.color;
        ctx.shadowBlur = 35; 
        ctx.strokeRect(edgeThickness / 2, edgeThickness / 2, canvas.width - edgeThickness, canvas.height - edgeThickness);
        ctx.shadowBlur = 10;
        ctx.strokeRect(edgeThickness / 2, edgeThickness / 2, canvas.width - edgeThickness, canvas.height - edgeThickness);
        ctx.restore(); 

        if (champHiddenBlowCount === 1) {
            ctx.fillStyle = "#FFFFFF";
            let fontSize = Math.max(35, canvas.width * 0.06);
            ctx.font = "italic bold " + fontSize + "px 'Segoe UI', Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = champCurrentBoss.color;
            ctx.shadowBlur = 25;
            ctx.fillText(champCinematicText, canvas.width / 2, canvas.height / 2);
            ctx.shadowBlur = 0; 
        }
    }
    
    if (champCurrentBoss.drawEffects) {
        champCurrentBoss.drawEffects(ctx, canvas, { balls: champBalls, ballRadius: ballRadius });
    }
    drawPlayerSkills(ctx);
    
    champAnimationId = requestAnimationFrame(champDraw);
}

function increaseBallSpeed() {
    let increment = 50;  
    let maxSpeed = 1500; 
    champCurrentChampionSpeed = Math.min(champCurrentChampionSpeed + increment, maxSpeed);
    
    if (champBalls.length === 0) return;
    let screenRatio = canvas.height / 1080;
    let dynamicSpeed = champCurrentChampionSpeed * screenRatio;
    
    let ball = champBalls[0];
    let currentTotalSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    if (currentTotalSpeed > 0) {
        ball.dx = (ball.dx / currentTotalSpeed) * dynamicSpeed;
        ball.dy = (ball.dy / currentTotalSpeed) * dynamicSpeed;
    }
}

function checkMatchResult(scorer) {
    // التحقق مما إذا كانت مباراة انتقال زمكاني (الهدف الذهبي)
    if (champIsSuddenDeath) {
        endSuddenDeathMatch(scorer);
    } 
    // المباراة العادية للزعيم (3 أهداف)
    else {
        if (champPlayerScore >= 3) {
            endChampionMatch('player');
        } else if (champEnemyScore >= 3) {
            endChampionMatch('enemy');
        } else {
            resetChampionBall(scorer);
        }
    }
}

function resetChampionBall(scorer = null) {
    champIsBallLaunched = false;
    champEnemyDecisionMade = false;
    champIsEnemyMissing = false;
    champCurrentChampionSpeed = 600; 
    champCinematicPause = false;

    // استدعاء دالة الضربة للاعب لتصفير المهارات النشطة مثل إخفاء الكرة
    if (champCurrentBoss.onPlayerHit) {
        champCurrentBoss.onPlayerHit();
    }
    // إيقاف مهارة النور قسرياً عند الهدف
    if (champCurrentBoss.state && champCurrentBoss.state.hasOwnProperty('isLightBallActive')) {
        champCurrentBoss.state.isLightBallActive = false;
    }

    // --------- إضافة تصفير مهارات اللاعب فور تسجيل هدف ---------
    if (typeof resetPlayerSkills === 'function') {
        resetPlayerSkills();
    }
    // ---------------------------------------------------------
paddleX = (canvas.width - paddleWidth) / 2;
    champEnemyPaddleX = (canvas.width - paddleWidth) / 2;
    champBalls = [{ 
        x: canvas.width / 2, 
        y: canvas.height / 2, 
        dx: 0, 
        dy: 0, 
        lastHitter: null 
    }];
    
    let screenRatio = canvas.height / 1080;
    let initialSpeed = champCurrentChampionSpeed * screenRatio;

    setTimeout(() => {
        if(!champIsPlaying) return; 
        champIsBallLaunched = true;
        champIsFirstServe = false;
        champBalls[0].dx = 0; 
        champBalls[0].dy = (scorer === 'player' || champIsFirstServe) ? initialSpeed : -initialSpeed;
    }, 1000); 
}

// دالة checkMatchResult تبقى كما هي دون تغيير

function endSuddenDeathMatch(winner) {
    champIsPlaying = false;
    cancelAnimationFrame(champAnimationId);
    document.getElementById('championUI').style.display = 'none';
    champIsSuddenDeath = false; // إعادة تعيين الحالة
    
    // تصفير المهارات عند انتهاء المباراة بالهدف الذهبي
    if (typeof resetPlayerSkills === 'function') {
        resetPlayerSkills();
    }
    
    if (winner === 'player') {
        savedStars[level] = Math.max(savedStars[level] || 0, currentLevelStars);
        localStorage.setItem('levelStars', JSON.stringify(savedStars));
        
        maxUnlockedLevel = Math.max(maxUnlockedLevel, level + 1);
        localStorage.setItem('maxUnlockedLevel', maxUnlockedLevel);
        
        showResult(true); 
    } else {
        showResult(false);
    }
}

function endChampionMatch(winner) {
    champIsPlaying = false;
    cancelAnimationFrame(champAnimationId);
    document.getElementById('championUI').style.display = 'none';
    
    // تصفير المهارات عند انتهاء المباراة العادية للزعيم
    if (typeof resetPlayerSkills === 'function') {
        resetPlayerSkills();
    }
    
    if (winner === 'player') {
        let currentBossLevel = level;
        if (typeof savedStars !== 'undefined') {
            savedStars[currentBossLevel] = 3;
            localStorage.setItem('levelStars', JSON.stringify(savedStars));
        }

        let phaseStartLevel = currentBossLevel - 7;
        let totalPhaseStars = 0;
        
        for (let i = phaseStartLevel; i <= currentBossLevel; i++) {
            totalPhaseStars += (savedStars[i] || 0); 
        }

        let requiredStars = 16; 
        
        if (currentBossLevel === 16) {
            requiredStars = 18; 
        } else if (currentBossLevel >= 24) {
            requiredStars = 20; 
        }

        if (totalPhaseStars >= requiredStars) {
            level++;
            if (typeof maxUnlockedLevel !== 'undefined') {
                maxUnlockedLevel = Math.max(maxUnlockedLevel, level);
                localStorage.setItem('maxUnlockedLevel', maxUnlockedLevel);
            }
        }
        if (typeof showLevelSelect === 'function') {
            showLevelSelect();
        }
    } else {
        if (typeof gameOver === 'function') {
            gameOver(); 
        }
    }
}