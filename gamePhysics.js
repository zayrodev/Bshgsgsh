// ==========================================
// 1. مدخلات اللاعب (Controls)
// ==========================================
document.addEventListener("keydown", (e) => {
    if(e.key == "Right" || e.key == "ArrowRight") { rightPressed = true; launchBall(); }
    else if(e.key == "Left" || e.key == "ArrowLeft") { leftPressed = true; launchBall(); }
});

document.addEventListener("keyup", (e) => {
    if(e.key == "Right" || e.key == "ArrowRight") rightPressed = false;
    else if(e.key == "Left" || e.key == "ArrowLeft") leftPressed = false;
});

let lastTapTimeLeft = 0;
let lastTapTimeRight = 0;
let isDragging = false; 

canvas.addEventListener("touchstart", (e) => { 
    let touchX = e.touches[0].clientX;
    lastTouchX = touchX; 
    isDragging = false; 
    
    // إطلاق الكرة في المستوى العادي
    if (!isChampionMode) {
        launchBall(); 
    }
    
    // السماح بتفعيل المهارة في طور الزعيم، أو في الطور العادي إذا انطلقت الكرة
    let canTriggerSkills = (isChampionMode && typeof champIsBallLaunched !== 'undefined' && champIsBallLaunched) || (!isChampionMode && isBallLaunched);
    
    if (canTriggerSkills && e.touches.length === 1) {
        let now = performance.now();
        let screenMiddle = window.innerWidth / 2;

        if (touchX < screenMiddle) {
            // الجانب الأيسر (المهارة الثانوية)
            if (now - lastTapTimeLeft < 300) {
                triggerPlayerSkill('secondary');
                lastTapTimeLeft = 0; // تصفير لمنع التفعيل المتكرر بنفس النقرات
            } else {
                lastTapTimeLeft = now;
            }
        } else {
            // الجانب الأيمن (المهارة الرئيسية)
            if (now - lastTapTimeRight < 300) {
                triggerPlayerSkill('primary');
                lastTapTimeRight = 0; 
            } else {
                lastTapTimeRight = now;
            }
        }
    }
}, {passive: false});


canvas.addEventListener("touchmove", (e) => {
    if((isPlaying || isChampionMode) && e.touches) {
        e.preventDefault();
        
        // إيقاف تحريك المضرب تماماً إذا كان الزمن متوقفاً (أثناء التصويب أو المشاهد السينمائية)
        if (typeof champCinematicPause !== 'undefined' && champCinematicPause) {
            lastTouchX = e.touches[0].clientX; 
            return; 
        }

        let currentX = e.touches[0].clientX;
        
        // إذا تحرك الإصبع بمسافة ملحوظة نعتبره سحباً للمضرب ونلغي المهارة
        if (lastTouchX !== null && Math.abs(currentX - lastTouchX) > 5) {
            isDragging = true;
            // تم حذف السطر المسبب للمشكلة من هنا
        }

        if(lastTouchX !== null) {
            paddleX += (currentX - lastTouchX) * sensitivityMultiplier; 
            if(paddleX < 0) paddleX = 0;
            if(paddleX > canvas.width - paddleWidth) paddleX = canvas.width - paddleWidth;
        }
        lastTouchX = currentX;
    }
}, {passive: false});
// ==========================================
// 2. الفيزياء والميكانيكا
// ==========================================
function updateBallSpeed() {
    let screenRatio = canvas.height / 1080;
    let speedMultiplier = Math.min(1 + (Math.floor(totalBricksBroken / 10) * 0.10), 2.0);
    currentLevelSpeed = (600 * speedMultiplier) * screenRatio;

    balls.forEach(ball => {
        let currentTotalSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        if (currentTotalSpeed > 0) {
            ball.dx = (ball.dx / currentTotalSpeed) * currentLevelSpeed;
            ball.dy = (ball.dy / currentTotalSpeed) * currentLevelSpeed;
        }
    });
}

function launchBall() {
    if (!isBallLaunched && balls.length > 0) {
        isBallLaunched = true;
        balls[0].dx = 0; balls[0].dy = currentLevelSpeed; 
    }
}
// دالة مسؤولة عن إعطاء المكافآت عند تحطيم عدد معين من الطوب
function handleBrickMilestones() {
    // 1. زيادة سرعة الكرة
    if (totalBricksBroken % 10 === 0) {
        updateBallSpeed();
    }
    
    // 2. الارتداد العكسي (دفع الطوب للأعلى)
    if (totalBricksBroken - lastPushBackBricks >= 10) {
        lastPushBackBricks += 10;
        
        let pushBackAmount = canvas.height * 0.025; // دفع للأعلى بنسبة 2.5% من الشاشة
        dynamicBrickOffsetY = Math.max(0, dynamicBrickOffsetY - pushBackAmount);
        
        // تأثير بصري بسيط (قفزة خفيفة للشاشة) للإحساس بقوة الدفع
        ctx.canvas.style.transform = `translateY(5px)`;
        setTimeout(() => ctx.canvas.style.transform = 'none', 100);
    }
}

function collisionDetection() {
    if (!isBallLaunched) return; 
    let lowestBrickY = brickOffsetTop + (brickRowCount * (brickHeight + brickPadding));

    for(let i = 0; i < balls.length; i++) {
        let ball = balls[i];
        let effectiveBallY = ball.y - dynamicBrickOffsetY; // حساب موقع الكرة الفعلي بالنسبة للطوب المنزاح

        if (effectiveBallY - ballRadius > lowestBrickY) continue; 

        let startC = Math.max(0, Math.floor((ball.x - ballRadius - brickOffsetLeft) / (brickWidth + brickPadding)));
        let endC = Math.min(brickColumnCount - 1, Math.floor((ball.x + ballRadius - brickOffsetLeft) / (brickWidth + brickPadding)));
        let startR = Math.max(0, Math.floor((effectiveBallY - ballRadius - brickOffsetTop) / (brickHeight + brickPadding)));
        let endR = Math.min(brickRowCount - 1, Math.floor((effectiveBallY + ballRadius - brickOffsetTop) / (brickHeight + brickPadding)));

        for(let c = startC; c <= endC; c++) {
            let hitInThisFrame = false;
            for(let r = startR; r <= endR; r++) {
                let b = bricks[c][r];
                if(b && b.status == 1) {
                    let closestX = Math.max(b.x, Math.min(ball.x, b.x + brickWidth + brickPadding));
                    let closestY = Math.max(b.y, Math.min(effectiveBallY, b.y + brickHeight + brickPadding));
                    let dX = ball.x - closestX;
                    let dY = effectiveBallY - closestY;

                    if ((dX * dX) + (dY * dY) < (ballRadius * ballRadius)) {
                        Math.abs(dX) > Math.abs(dY) ? ball.dx = -ball.dx : ball.dy = -ball.dy;
                        b.status = 0;
levelCtx.clearRect(b.x - 1, b.y - 1, brickWidth + 2, brickHeight + 2);
score += 10; activeBricks--; totalBricksBroken++;
                        handleBrickMilestones();
                        // تعديل مواقع النزول للنجوم والقدرات لتتوافق مع الانزياح
                        if(b.hasStar) spawnStar(b.x + brickWidth/2, b.y + dynamicBrickOffsetY + brickHeight/2, canvas.height * 0.45, ballRadius * 1.5);
                        if(b.powerUpType) spawnPowerUp(b.x + brickWidth/2, b.y + dynamicBrickOffsetY + brickHeight/2, canvas.height * 0.25, ballRadius * 2, b.powerUpType);
                        
                        if (typeof isFlameActive !== 'undefined' && isFlameActive) {
                            let extraDestroyed = 0;
                            for(let cOffset = -1; cOffset <= 1; cOffset++) {
                                for(let rOffset = -1; rOffset <= 1; rOffset++) {
                                    if (cOffset === 0 && rOffset === 0) continue;
                                    let nc = c + cOffset, nr = r + rOffset;
                                    if (nc >= 0 && nc < brickColumnCount && nr >= 0 && nr < brickRowCount) {
                                        let nb = bricks[nc][nr];
                                        if (nb && nb.status === 1 && extraDestroyed < 2) {
                                            nb.status = 0;
levelCtx.clearRect(nb.x - 1, nb.y - 1, brickWidth + 2, brickHeight + 2);
score += 10; activeBricks--; totalBricksBroken++;
                                              extraDestroyed++;
                                            
                                            // تعديل مواقع النزول للطوب المحترق الإضافي
                                            if(nb.hasStar) spawnStar(nb.x + brickWidth/2, nb.y + dynamicBrickOffsetY + brickHeight/2, canvas.height * 0.45, ballRadius * 1.5);
                                            if(nb.powerUpType) spawnPowerUp(nb.x + brickWidth/2, nb.y + dynamicBrickOffsetY + brickHeight/2, canvas.height * 0.25, ballRadius * 2, nb.powerUpType);
                                        }
                                    }
                                }
                            }
                        }

                        if (activeBricks === 0) {
                            savedStars[level] = Math.max(savedStars[level] || 0, currentLevelStars);
                            localStorage.setItem('levelStars', JSON.stringify(savedStars));
                            maxUnlockedLevel = Math.max(maxUnlockedLevel, level + 1);
                            localStorage.setItem('maxUnlockedLevel', maxUnlockedLevel);
                            showResult(true); 
                            return; 
                        }
                        hitInThisFrame = true; break; 
                    }
                }
            }
            if(hitInThisFrame) break; 
        }
    }
}

function updatePhysics(sub_dt) {
    collisionDetection();
    let pY = canvas.height - (canvas.height * 0.05) - paddleHeight;
    let wallHeight = 15;

    for (let i = balls.length - 1; i >= 0; i--) {
        let ball = balls[i];
        if (!isBallLaunched) continue;

        if (Math.abs(ball.dy) < currentLevelSpeed * 0.15) {
            ball.dy = ball.dy > 0 ? currentLevelSpeed * 0.15 : -currentLevelSpeed * 0.15;
        }

        let nextX = ball.x + (ball.dx * sub_dt);
        let nextY = ball.y + (ball.dy * sub_dt);

        if(nextX > canvas.width - ballRadius || nextX < ballRadius) ball.dx = -ball.dx;
        if(nextY < ballRadius) ball.dy = -ball.dy;

        if (isWallActive && ball.y + ballRadius >= canvas.height - wallHeight) {
            ball.dy = -Math.abs(ball.dy); ball.y = canvas.height - wallHeight - ballRadius;
        } else if (ball.y > canvas.height + ballRadius) {
            balls.splice(i, 1); continue;
        }

        let closestX = Math.max(paddleX, Math.min(ball.x, paddleX + paddleWidth));
        let closestY = Math.max(pY, Math.min(ball.y, pY + paddleHeight));
        if (((ball.x - closestX)**2 + (ball.y - closestY)**2) < ballRadius**2) {
            playHitSound();
            if (ball.dy > 0) {
                let hitPoint = (ball.x - (paddleX + paddleWidth / 2)) / (paddleWidth / 2);
                let bounceAngle = hitPoint * (Math.PI / 3);
                let currentTotalSpeed = Math.sqrt(ball.dx**2 + ball.dy**2);
                ball.dx = currentTotalSpeed * Math.sin(bounceAngle);
                ball.dy = -Math.abs(currentTotalSpeed * Math.cos(bounceAngle));
                ball.y = pY - ballRadius;
                ball.lastHitter = 'player';
            } else {
                ball.dx = -ball.dx;
                ball.x = ball.x < paddleX + paddleWidth / 2 ? paddleX - ballRadius : paddleX + paddleWidth + ballRadius;
            }
        }
        ball.x += ball.dx * sub_dt; ball.y += ball.dy * sub_dt;
    }
}

// ==========================================
// 3. القدرات الخاصة (Power-Ups) والنجوم
// ==========================================
const powerUpHandlers = {
    'multi': {
        draw: (ctx, x, y) => { ctx.fillStyle = "rgba(46, 204, 113, 0.6)"; ctx.fill(); ctx.strokeStyle = "#2ecc71"; ctx.stroke(); ctx.fillStyle = "white"; ctx.font = "bold 10px Arial"; ctx.fillText("x2", x, y + 3); },
        applyEffect: () => { let newBalls = balls.map(b => ({ x: b.x, y: b.y, dx: -b.dx, dy: b.dy })); balls = balls.concat(newBalls); }
    },
    'wall': {
        draw: (ctx, x, y) => { ctx.fillStyle = "rgba(255, 255, 255, 0.6)"; ctx.fill(); ctx.strokeStyle = "#FFFFFF"; ctx.stroke(); ctx.fillStyle = "#081A33"; ctx.font = "bold 12px Arial"; ctx.fillText("🛡️", x, y + 4); },
        applyEffect: () => { isWallActive = true; wallActivationTime = performance.now(); }
    },
    'bomb': {
        draw: (ctx, x, y) => { ctx.fillStyle = "rgba(231, 76, 60, 0.6)"; ctx.fill(); ctx.strokeStyle = "#e74c3c"; ctx.stroke(); ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 12px Arial"; ctx.fillText("💣", x, y + 4); },
        applyEffect: () => { isBombActive = true; bombTimer = 3.0; lastFlashSecond = 3; if (balls.length > 0) bombTargetBall = balls[0]; }
    },
    'flame': {
        draw: (ctx, x, y) => { 
            ctx.fillStyle = "rgba(255, 69, 0, 0.6)"; 
            ctx.fill(); 
            ctx.strokeStyle = "#FF4500"; 
            ctx.stroke(); 
            ctx.fillStyle = "#FFFFFF"; 
            ctx.font = "bold 12px Arial"; 
            ctx.fillText("🔥", x, y + 4); 
        },
        applyEffect: () => { 
            isFlameActive = true; 
            flameTimer = FLAME_DURATION;
            
            // تشغيل صوت النار بصوت منخفض في البداية
            if (typeof fireSound !== 'undefined') {
                fireSound.currentTime = 0;
                fireSound.volume = 0.1;
                fireSound.play().catch(e => console.log(e));
            }

            // زيادة سرعة الكرة...
            balls.forEach(ball => {
                let currentSpeed = Math.sqrt(ball.dx**2 + ball.dy**2);
                if(currentSpeed > 0) {
                    ball.dx = (ball.dx / currentSpeed) * (currentLevelSpeed * 1.25);
                    ball.dy = (ball.dy / currentSpeed) * (currentLevelSpeed * 1.25);
                }
            });
        }
    }

};

function handlePowerUps(dt) {
    let pY = canvas.height - (canvas.height * 0.05) - paddleHeight;
    powerUpsPool.forEach(p => {
        if (!p.active) return;
        p.y += p.dy * dt; 
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
        if (powerUpHandlers[p.type]) powerUpHandlers[p.type].draw(ctx, p.x, p.y);
        ctx.closePath();

        if (p.y + p.radius > pY && p.x > paddleX && p.x < paddleX + paddleWidth && p.y - p.radius < pY + paddleHeight) {
            if (powerUpHandlers[p.type]) powerUpHandlers[p.type].applyEffect();
            p.active = false; 
        } else if (p.y > canvas.height) p.active = false;
    });
}

function handleFallingStars(dt) {
    let pY = canvas.height - (canvas.height * 0.05) - paddleHeight;
    fallingStarsPool.forEach(star => {
        if (!star.active) return;
        star.y += star.dy * dt; 
        ctx.save(); ctx.translate(star.x, star.y);
        ctx.fillStyle = "#FFD700"; ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 10;
        ctx.font = Math.max(16, canvas.width * 0.03) + "px Arial";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⭐", 0, 0); ctx.restore();

        if (star.y + star.radius > pY && star.x > paddleX && star.x < paddleX + paddleWidth && star.y - star.radius < pY + paddleHeight) {
            currentLevelStars++; star.active = false; 
        } else if (star.y > canvas.height) star.active = false;
    });
}

function executeBombExplosion(ball) {
    let explosionRadius = paddleWidth * 1.5;
    spawnExplosion(ball.x, ball.y, explosionRadius);
    let effectiveBallY = ball.y - dynamicBrickOffsetY; // حساب موقع الكرة الفعلي للقنبلة

    for(let c = 0; c < brickColumnCount; c++) {
        for(let r = 0; r < brickRowCount; r++) {
            let b = bricks[c][r];
            if(b.status === 1) {
                let closestX = Math.max(b.x, Math.min(ball.x, b.x + brickWidth));
                let closestY = Math.max(b.y, Math.min(effectiveBallY, b.y + brickHeight));
                
                if (((ball.x - closestX)**2 + (effectiveBallY - closestY)**2) <= explosionRadius**2) {
                    b.status = 0; levelCtx.clearRect(b.x - 1, b.y - 1, brickWidth + 2, brickHeight + 2);
score += 10; activeBricks--; totalBricksBroken++;
                  handleBrickMilestones();
                    if(b.hasStar) spawnStar(b.x + brickWidth/2, b.y + dynamicBrickOffsetY + brickHeight/2, canvas.height * 0.45, ballRadius * 1.5);  
                    if(b.powerUpType) spawnPowerUp(b.x + brickWidth/2, b.y + dynamicBrickOffsetY + brickHeight/2, canvas.height * 0.25, ballRadius * 2, b.powerUpType);
                }
            }
        }
    }
    
    // ... بقية الكود الخاص بالدالة يبقى كما هو (خصم الفرص إذا تضرر اللاعب) ...
    
    let pY = canvas.height - (canvas.height * 0.05) - paddleHeight;
    let closestPX = Math.max(paddleX, Math.min(ball.x, paddleX + paddleWidth));
    let closestPY = Math.max(pY, Math.min(ball.y, pY + paddleHeight));
    if (((ball.x - closestPX)**2 + (ball.y - closestPY)**2) <= explosionRadius**2) lives--; 
    
    let ballIndex = balls.indexOf(ball);
    if (ballIndex !== -1) balls.splice(ballIndex, 1);
    
    if (activeBricks === 0) {
            savedStars[level] = Math.max(savedStars[level] || 0, currentLevelStars);
            localStorage.setItem('levelStars', JSON.stringify(savedStars));
            
            // فتح المستوى التالي وحفظه
            maxUnlockedLevel = Math.max(maxUnlockedLevel, level + 1);
            localStorage.setItem('maxUnlockedLevel', maxUnlockedLevel);
            
            // استدعاء شاشة النتيجة كفوز
            showResult(true); 
            return; 
        }
    if (lives <= 0) gameOver();
}

// دالة لاختيار طوبة عشوائية وإسقاطها
function triggerRandomBrickFall() {
    let availableBricks = [];
    for(let c = 0; c < brickColumnCount; c++) {
        for(let r = 0; r < brickRowCount; r++) {
            if (bricks[c][r].status === 1) {
                availableBricks.push(bricks[c][r]);
            }
        }
    }
    
    if (availableBricks.length > 0) {
        // اختيار طوبة عشوائية من الطوب المتبقي
        let randomIndex = Math.floor(Math.random() * availableBricks.length);
        let b = availableBricks[randomIndex];
        
        // تحويل الطوبة من ثابتة إلى متساقطة
        b.status = 0;
levelCtx.clearRect(b.x - 1, b.y - 1, brickWidth + 2, brickHeight + 2);
activeBricks--; // تقليل العدد حتى تنتهي المرحلة إذا سقطت آخر طوبة
        fallingBricksPool.push({
            x: b.x,
            y: b.y + dynamicBrickOffsetY, // <--- أضف مقدار الإزاحة هنا لتبدأ من مكانها الفعلي على الشاشة
            dy: canvas.height * 0.4, // سرعة السقوط نحو الأسفل
            width: brickWidth,
            height: brickHeight,
            color: currentLevelData.color
        });
        
        // إذا سقطت آخر طوبة ننهي المرحلة بالانتصار
        if (activeBricks === 0) {
            savedStars[level] = Math.max(savedStars[level] || 0, currentLevelStars);
            localStorage.setItem('levelStars', JSON.stringify(savedStars));
            maxUnlockedLevel = Math.max(maxUnlockedLevel, level + 1);
            localStorage.setItem('maxUnlockedLevel', maxUnlockedLevel);
            showResult(true); 
        }
    }
}
// دالة لمعالجة حركة الطوب المتساقط واصطدامه باللاعب
function handleFallingBricks(dt) {
    let pY = canvas.height - (canvas.height * 0.05) - paddleHeight;
    
    for (let i = fallingBricksPool.length - 1; i >= 0; i--) {
        let fb = fallingBricksPool[i];
        fb.y += fb.dy * dt;
        
        // رسم الطوبة المتساقطة
        ctx.save();
        ctx.fillStyle = fb.color;
        ctx.shadowColor = "#e74c3c";
        ctx.shadowBlur = 15;
        ctx.fillRect(fb.x, fb.y, fb.width, fb.height);
        
        // تأثير خطوط تحذيرية حمراء على الطوبة
        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
        ctx.lineWidth = 2;
        ctx.strokeRect(fb.x, fb.y, fb.width, fb.height);
        ctx.restore();
        
        // التحقق من اصطدامها بالمضرب
        if (fb.y + fb.height > pY && fb.x + fb.width > paddleX && fb.x < paddleX + paddleWidth && fb.y < pY + paddleHeight) {
            lives--; // خسارة قلب
            fallingBricksPool.splice(i, 1);
            
            if (typeof playHitSound === 'function') playHitSound();
            
            // اهتزاز الشاشة كتأثير بصري (اختياري)
            ctx.canvas.style.transform = `translate(${(Math.random() - 0.5) * 10}px, ${(Math.random() - 0.5) * 10}px)`;
            setTimeout(() => ctx.canvas.style.transform = 'none', 100);
            
            if (lives <= 0) {
                if (typeof fireSound !== 'undefined') fireSound.pause();
                gameOver();
            }
        } 
        // إذا خرجت من الشاشة دون أن تلمس اللاعب
        else if (fb.y > canvas.height) {
            fallingBricksPool.splice(i, 1);
        }
    }
}
// ==========================================
// 4. الحلقة الرئيسية للعبة (Game Loop)
// ==========================================
function draw(timestamp) {
    if(!isPlaying) return; 
    if (!timestamp) timestamp = performance.now();
    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (dt > 0.05 || dt === 0) dt = 0.016; 
    
    if (!isChampionMode && !isSpacetimeTransition) {
        let phaseLevel = level % 8;
        // التحقق من أننا في آخر 3 أدوار (5, 6, 7) قبل الزعيم (8)
        if (phaseLevel >= 5 && phaseLevel <= 7) {
            if (activeBricks <= initialActiveBricks * 0.15 && activeBricks > 0) {
                isSpacetimeTransition = true;
                triggerSpacetimeTransition();
                return; // إيقاف إكمال رسم المرحلة العادية
            }
        }
    }

   if (typeof isFlameActive !== 'undefined' && isFlameActive) {
        flameTimer -= dt;
        
        // زيادة ارتفاع الصوت تدريجياً مع مرور الوقت
        let intensity = 1 - (flameTimer / FLAME_DURATION);
        if (typeof fireSound !== 'undefined') {
            fireSound.volume = Math.min(Math.max(0.1 + (intensity * 0.9), 0), 1);
        }

        if (flameTimer <= 0) {
            if (typeof fireSound !== 'undefined') fireSound.pause(); // إيقاف الصوت
            lives = 0;
            gameOver();
            return;
        }
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPaddle(); drawBricks(); drawHUD(); drawLives();
    drawSkillBars();
    handlePowerUps(dt); handleFallingStars(dt);
    
    // تفعيل تساقط الطوب فقط في المراحل العادية (ليس عند الزعيم)
    // تفعيل تساقط الطوب فقط في المراحل العادية (ليس عند الزعيم)
    // تفعيل تساقط الطوب فقط في المراحل العادية (ليس عند الزعيم)
    if (typeof isChampionMode !== 'undefined' && !isChampionMode) {
        brickFallTimer += dt;
        if (brickFallTimer >= currentBrickFallInterval) { // استخدام المتغير الجديد
      triggerRandomBrickFall();
            brickFallTimer = 0; // إعادة ضبط المؤقت
        }
        handleFallingBricks(dt);
    }
    // --- نظام انزياح الطوب للأسفل والموت الفوري ---
    if (!isChampionMode && isBallLaunched) {
        // زيادة الانزياح تدريجياً (يقطع طول الشاشة في 240 ثانية = 4 دقائق)
// زيادة الانزياح تدريجياً بناءً على صعوبة العالم الحالي
        dynamicBrickOffsetY += (canvas.height / currentDownwardSpeed) * dt;
        let pY_crush = canvas.height - (canvas.height * 0.05) - paddleHeight;
        let isCrushed = false;
        
        for (let c = 0; c < brickColumnCount; c++) {
            for (let r = 0; r < brickRowCount; r++) {
                if (bricks[c][r] && bricks[c][r].status === 1) {
                    // إذا وصل أسفل أي طوبة نشطة إلى خط مضرب اللاعب
                    if (bricks[c][r].y + dynamicBrickOffsetY + brickHeight >= pY_crush) {
                        isCrushed = true;
                        break;
                    }
                }
            }
            if (isCrushed) break;
        }
        
        // الخسارة المباشرة إذا لامس الطوب المضرب
        if (isCrushed) {
            lives = 0;
            if (typeof fireSound !== 'undefined') fireSound.pause();
            gameOver();
            return;
        }
    }
    // ----------------------------------------------
    
    // تشغيل منطق ورسم المهارات في الطور العادي
    // تشغيل منطق ورسم المهارات في الطور العادي
    if (!isChampionMode) {
        
        // --- إضافة: تحديث عدادات المهارات مع مرور الوقت ---
        if (typeof equippedPrimary !== 'undefined' && equippedPrimary) {
            primarySkillTimer += dt;
        }
        if (typeof equippedSecondary !== 'undefined' && equippedSecondary) {
            secondarySkillTimer += dt;
        }
        // ---------------------------------------------------

        let pY_skill = canvas.height - (canvas.height * 0.05) - paddleHeight;
        let ctxData = { paddleX: paddleX, pY: pY_skill, paddleWidth: paddleWidth, paddleHeight: paddleHeight, ballRadius: ballRadius, canvas: canvas };
        updatePlayerSkills(dt, balls, ctxData);
        drawPlayerSkills(ctx);
    }

    if (isWallActive) {
        if (timestamp - wallActivationTime > wallDuration) isWallActive = false;
        else { ctx.fillStyle = "rgba(255, 255, 255, 0.85)"; ctx.fillRect(0, canvas.height - 15, canvas.width, 15); }
    }

   if (isBombActive && bombTargetBall && balls.includes(bombTargetBall)) {
        bombTimer -= dt;
        let currentSecond = Math.ceil(bombTimer);
        
        // 1. إزالة الصوت من شرط الوميض
        if (currentSecond < lastFlashSecond && currentSecond > 0) {
            lastFlashSecond = currentSecond; 
            bombTargetBall.isFlashing = 0.15; 
        }
        
        if (bombTargetBall.isFlashing > 0) {
            bombTargetBall.isFlashing -= dt;
        }
        
        // 2. إضافة الصوت هنا عند انتهاء المؤقت وحدوث الانفجار
        if (bombTimer <= 0) { 
            let soundClone = bombSound.cloneNode(); 
            soundClone.volume = 1.0; 
            soundClone.play().catch(e => console.log(e));
            
            executeBombExplosion(bombTargetBall); 
            isBombActive = false; 
        }
    }
    
    explosionsPool.forEach(ex => {
        if (!ex.active) return; 
        ex.radius += ex.maxRadius * 4 * dt; ex.alpha -= 1.5 * dt; 
        if (ex.alpha <= 0) ex.active = false; 
        else { ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 165, 0, ${ex.alpha})`; ctx.fill(); ctx.closePath(); }
    });

    let maxSpeed = balls.reduce((max, b) => Math.max(max, Math.sqrt(b.dx**2 + b.dy**2)), 0);
    let steps = Math.max(1, Math.min(5, Math.ceil((maxSpeed * dt) / ballRadius)));
    let sub_dt = dt / steps;
    for (let s = 0; s < steps; s++) updatePhysics(sub_dt);

   for (let i = balls.length - 1; i >= 0; i--) {
        ctx.beginPath(); ctx.arc(balls[i].x, balls[i].y, ballRadius, 0, Math.PI*2);
        
        if (typeof isFlameActive !== 'undefined' && isFlameActive) {
            ctx.fillStyle = (balls[i].isFlashing > 0) ? "#FFFFFF" : "#FF4500";
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#FF4500";
        } else {
            ctx.fillStyle = (balls[i].isFlashing > 0) ? "#FFFFFF" : "#e74c3c";
            ctx.shadowBlur = 0;
        }
        
        ctx.fill(); ctx.closePath();
        ctx.shadowBlur = 0; // إعادة ضبط الظل
    }

    if(balls.length === 0) {
        lives--; 
        if (lives > 0) {
            isBallLaunched = false; paddleX = (canvas.width - paddleWidth) / 2;
            balls = [{ x: canvas.width / 2, y: canvas.height * 0.75, dx: 0, dy: 0 }];
            totalBricksBroken = 0; updateBallSpeed();
            
            // --- الكود الجديد: مسح جميع الفقاعات والنجوم والطوب المتساقط ---
            powerUpsPool.forEach(p => p.active = false);
            fallingStarsPool.forEach(s => s.active = false);
            fallingBricksPool = [];
            // ----------------------------------------------------------------
            
            // إيقاف مهارة النار والصوت عند فقدان الكرة
            isFlameActive = false;
            flameTimer = 0;
            if (typeof fireSound !== 'undefined') {
                fireSound.pause();
                fireSound.currentTime = 0;
            }
        } else { 
            if (typeof fireSound !== 'undefined') fireSound.pause();
            gameOver(); 
            return; 
        }
    }
    let keyboardSpeed = (canvas.width * 1.5) * sensitivityMultiplier * dt;
    if(rightPressed && paddleX < canvas.width - paddleWidth) paddleX += keyboardSpeed;
    else if(leftPressed && paddleX > 0) paddleX -= keyboardSpeed;

    animationId = requestAnimationFrame(draw);
}

// ==========================================
// تأثير الانتقال الزمكاني (الموت المفاجئ)
// ==========================================
let spacetimeRadius = 0;

function animateSpacetime() {
    spacetimeRadius += 15; // سرعة اتساع الثقب الأسود
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, spacetimeRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#000000"; // ثقب أسود يبتلع الشاشة
    ctx.fill();
    
    // رسم هالة حول الثقب الزمكاني
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#9D50BB";
    ctx.shadowColor = "#00AEEF";
    ctx.shadowBlur = 30;
    ctx.stroke();
    ctx.restore();

    if (spacetimeRadius < Math.max(canvas.width, canvas.height)) {
        requestAnimationFrame(animateSpacetime);
    } else {
        // حساب رقم الزعيم للمرحلة الحالية (مضاعفات 8)
        let bossLevel = Math.ceil(level / 8) * 8;
        champIsSuddenDeath = true; // تفعيل شرط الموت المفاجئ
        isChampionMode = true;
        startChampionMatch(bossLevel); // بدء القتال
    }
}

function triggerSpacetimeTransition() {
    isPlaying = false; // إيقاف اللعبة العادية
    cancelAnimationFrame(animationId);
    
    // إيقاف أي أصوات مستمرة
    if (typeof fireSound !== 'undefined') fireSound.pause();
    
    spacetimeRadius = 0;
    animateSpacetime();
}