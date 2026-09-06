// =========================================================================
// نظام مهارات اللاعب (Player Skills Registry)
// =========================================================================
// جلب العملة من التخزين المحلي، وإذا لم تكن موجودة (أول مرة) تبدأ بـ 0
let playerCurrency = parseInt(localStorage.getItem('playerCurrency')) || 0;
let purchasedSkills = JSON.parse(localStorage.getItem('purchasedSkills')) || [];
let equippedPrimary = localStorage.getItem('equippedPrimary') || null;
let equippedSecondary = localStorage.getItem('equippedSecondary') || null;

const PlayerSkillRegistry = {
    // -----------------------------------------------------
    // المهارة الأولى: الظل المساند
    // -----------------------------------------------------
    'shadow_support': {
           id: 'shadow_support',
    name: 'Shadow Support',
    type: 'secondary',
    price: 140,
    icon: 'images/sk1.jpg',
        description: '[Secondary Skill] Summons a stationary phantom at your current position that blocks balls for 6 seconds. You can pass through it freely. (Consumes 1 Plasma Charge).',
     plasmaCost: 1,

        state: {
            activeShadows: []
        },

        // عند تفعيل المهارة
        activate: function(ctxData) {
            this.state.activeShadows.push({
                x: ctxData.paddleX,
                y: ctxData.pY,
                width: ctxData.paddleWidth,
                height: ctxData.paddleHeight,
                endTime: performance.now() + 6000 // 6 ثواني
            });
        },

        // تحديث منطق الاصطدام والوقت
        update: function(dt, balls, ctxData) {
            let now = performance.now();
            // مسح الظلال التي انتهى وقتها
            this.state.activeShadows = this.state.activeShadows.filter(s => now < s.endTime);

            // فحص الاصطدام مع الكرات
            this.state.activeShadows.forEach(shadow => {
                balls.forEach(ball => {
                    let closestX = Math.max(shadow.x, Math.min(ball.x, shadow.x + shadow.width));
                    let closestY = Math.max(shadow.y, Math.min(ball.y, shadow.y + shadow.height));
                    
                    if (((ball.x - closestX)**2 + (ball.y - closestY)**2) < (ctxData.ballRadius**2)) {
                        // ارتداد الكرة عند الاصطدام بالظل
                        if (ball.dy > 0 && ball.y < shadow.y) {
                            ball.dy = -Math.abs(ball.dy);
                            ball.y = shadow.y - ctxData.ballRadius;
                        } else if (ball.dy < 0 && ball.y > shadow.y + shadow.height) {
                            ball.dy = Math.abs(ball.dy);
                            ball.y = shadow.y + shadow.height + ctxData.ballRadius;
                        } else {
                            ball.dx = -ball.dx;
                        }
                        ball.lastHitter = 'player';
                        if (typeof playHitSound === "function") playHitSound();
                    }
                });
            });
        },

        // رسم الظل على الشاشة
        drawEffects: function(ctx) {
            let now = performance.now();
            this.state.activeShadows.forEach(shadow => {
                let timeLeft = shadow.endTime - now;
                // وميض سريع في آخر ثانية للتنبيه أنه سيختفي
                if (timeLeft < 1000 && Math.floor(now / 100) % 2 === 0) return;

                ctx.save();
                ctx.fillStyle = "rgba(0, 191, 255, 0.4)"; // أزرق شفاف
                ctx.shadowColor = "#00BFFF";
                ctx.shadowBlur = 15;
                ctx.fillRect(shadow.x, shadow.y, shadow.width, shadow.height);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"; // إطار مضيء
                ctx.lineWidth = 2;
                ctx.strokeRect(shadow.x, shadow.y, shadow.width, shadow.height);
                ctx.restore();
            });
        },

        reset: function() {
            this.state.activeShadows = [];
        }
    },
    
    
                // -----------------------------------------------------
    // المهارة الرئيسية: تحديد المسار (Determining the direction)
    // -----------------------------------------------------
    // المهارة الرئيسية: تحديد المسار (Determining the direction)
    // -----------------------------------------------------
    'direction_determine': {
        id: 'direction_determine',
        name: 'Trajectory Master',
        type: 'primary',
        price: 220,
        icon: 'images/sk2.jpg',
        description: '[Primary Skill] Queues a freeze effect. When the ball hits your paddle, time freezes for 4 seconds to draw a curved trajectory. (Consumes 3 Plasma).',
        plasmaCost: 3, // تعديل الاستهلاك ليأخذ الخزان بالكامل

        state: {
            isActive: false,
            isPending: false, 
            isAiming: false,
            ballRef: null,
            startX: 0, startY: 0,
            endX: 0, endY: 0,
            cpX: 0, cpY: 0,
            dragTarget: null, 
            ax: 0, 
            rolledMiss: false,
            eventListenersAdded: false,
            aimEndTime: 0, 
            boundDown: null,
            boundMove: null,
            boundUp: null
        },

        activate: function(ctxData) {
            this.state.isPending = true;
            this.state.isActive = true;
            this.state.isAiming = false;
        },

        onDown: function(e) {
            if (!this.state.isAiming) return;
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            let rect = canvas.getBoundingClientRect();
            let x = (clientX - rect.left) * (canvas.width / rect.width);
            let y = (clientY - rect.top) * (canvas.height / rect.height);

            let distEnd = Math.hypot(x - this.state.endX, y - this.state.endY);
            let distCp = Math.hypot(x - this.state.cpX, y - this.state.cpY);

            if (distEnd < 50) this.state.dragTarget = 'end';
            else if (distCp < 50) this.state.dragTarget = 'cp';
            else this.state.dragTarget = null;
        },

        onMove: function(e) {
            if (!this.state.isAiming || !this.state.dragTarget) return;
            e.preventDefault(); 
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            
            let rect = canvas.getBoundingClientRect();
            let x = (clientX - rect.left) * (canvas.width / rect.width);

            if (this.state.dragTarget === 'end') {
                let oldEndX = this.state.endX;
                this.state.endX = Math.max(20, Math.min(canvas.width - 20, x));
                
                // التعديل الجديد: تحريك نقطة المنتصف برفق لتتبع الهدف الجديد
                let shiftX = this.state.endX - oldEndX;
                this.state.cpX += shiftX / 2;
                
            } else if (this.state.dragTarget === 'cp') {
                let baseCpX = (this.state.startX + this.state.endX) / 2;
                let maxOffset = canvas.width * 0.25; 
                this.state.cpX = Math.max(baseCpX - maxOffset, Math.min(baseCpX + maxOffset, x));
            }
        },

        onUp: function(e) {
            if (!this.state.isAiming) return;
            this.state.dragTarget = null;
        },

        launchBall: function() {
            this.state.isAiming = false;
            
            if (typeof champCinematicPause !== 'undefined') champCinematicPause = false;

            this.removeListeners();

            let ball = this.state.ballRef;
            if (!ball) return;
            
            let screenRatio = canvas.height / 1080;
            let maxSpeed = 1500 * screenRatio;

            let distanceY = Math.abs(this.state.endY - this.state.startY);
            let timeToTarget = distanceY / maxSpeed;

            ball.dy = -maxSpeed; 

            let initVx = (2 * (this.state.cpX - this.state.startX)) / timeToTarget;
            this.state.ax = (2 * (this.state.endX - 2 * this.state.cpX + this.state.startX)) / (timeToTarget * timeToTarget);

            ball.dx = initVx;
            ball.lastHitter = 'player';
            
            if (typeof champIsIncomingSkill !== 'undefined' && !this.state.rolledMiss) {
                champAiGuaranteedHits = 0; 
                champIsIncomingSkill = true;
                champActiveSkillMissChance = 30; // تمرير نسبة 30% لمعالجتها في نظام الزعيم
                this.state.rolledMiss = true;
            }
        },

        removeListeners: function() {
            if (this.state.eventListenersAdded) {
                canvas.removeEventListener('mousedown', this.state.boundDown);
                canvas.removeEventListener('mousemove', this.state.boundMove);
                window.removeEventListener('mouseup', this.state.boundUp);
                canvas.removeEventListener('touchstart', this.state.boundDown);
                canvas.removeEventListener('touchmove', this.state.boundMove);
                window.removeEventListener('touchend', this.state.boundUp);
                this.state.eventListenersAdded = false;
            }
        },

        update: function(dt, balls, ctxData) {
            let ballList = (typeof champBalls !== 'undefined' && champBalls.length > 0) ? champBalls : balls;
            if (ballList.length === 0) return;
            let ball = ballList[0];

            if (this.state.isPending) {
                if (ball.lastHitter === 'player' && ball.dy < 0 && ball.y > canvas.height / 2) {
                    this.state.isPending = false;
                    this.state.isAiming = true;
                    this.state.ballRef = ball;
                    this.state.rolledMiss = false;
                    
                    this.state.aimEndTime = performance.now() + 4000;

                    this.state.startX = ball.x;
                    this.state.startY = ball.y;
                    this.state.endX = ball.x;
                    this.state.endY = canvas.height * 0.1;
                    this.state.cpX = ball.x;
                    this.state.cpY = (ball.y + this.state.endY) / 2;

                    if (typeof champCinematicPause !== 'undefined') {
                        champCinematicPause = true;
                        champCinematicEndTime = this.state.aimEndTime; 
                    }

                    this.state.boundDown = this.onDown.bind(this);
                    this.state.boundMove = this.onMove.bind(this);
                    this.state.boundUp = this.onUp.bind(this);

                    canvas.addEventListener('mousedown', this.state.boundDown);
                    canvas.addEventListener('mousemove', this.state.boundMove);
                    window.addEventListener('mouseup', this.state.boundUp);
                    canvas.addEventListener('touchstart', this.state.boundDown, {passive: false});
                    canvas.addEventListener('touchmove', this.state.boundMove, {passive: false});
                    window.addEventListener('touchend', this.state.boundUp);
                    this.state.eventListenersAdded = true;
                }
            }

            if (this.state.isAiming) {
                if (this.state.ballRef) {
                    this.state.ballRef.dx = 0;
                    this.state.ballRef.dy = 0;
                    this.state.ballRef.x = this.state.startX; 
                    this.state.ballRef.y = this.state.startY;
                }

                if (performance.now() >= this.state.aimEndTime) {
                    this.launchBall();
                }
                return;
            }

            if (this.state.isActive && !this.state.isAiming && !this.state.isPending && this.state.ballRef) {
                let activeBall = this.state.ballRef;
                
                if (activeBall.dy < 0 && activeBall.lastHitter === 'player') {
                    activeBall.dx += this.state.ax * dt; 
                } else if (activeBall.dy > 0 || activeBall.lastHitter === 'enemy') {
                    this.state.isActive = false;
                    
                    if (typeof executeBombExplosion === 'function' && typeof isChampionMode !== 'undefined' && !isChampionMode) {
                        executeBombExplosion(activeBall); 
                    }
                }
            }
        },

        drawEffects: function(ctx) {
            if (this.state.isPending) {
                let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
                let pX = typeof paddleX !== 'undefined' ? paddleX : 0;
                let pY = canvas.height - (canvas.height * 0.05) - (typeof paddleHeight !== 'undefined' ? paddleHeight : 18);
                
                ctx.save();
                ctx.fillStyle = "rgba(0, 174, 239, 0.7)";
                ctx.shadowColor = "#00AEEF";
                ctx.shadowBlur = 15;
                ctx.fillRect(pX, pY, pWidth, 5); 
                ctx.restore();
            }
            else if (this.state.isAiming && this.state.ballRef) {
                ctx.save();
                
                ctx.beginPath();
                ctx.moveTo(this.state.startX, this.state.startY);
                ctx.quadraticCurveTo(this.state.cpX, this.state.cpY, this.state.endX, this.state.endY);
                ctx.strokeStyle = "#00AEEF";
                ctx.lineWidth = 4;
                ctx.setLineDash([15, 10]);
                ctx.stroke();

                ctx.setLineDash([]);
                
                ctx.beginPath();
                ctx.arc(this.state.cpX, this.state.cpY, 15, 0, Math.PI*2);
                ctx.fillStyle = "#F39C12"; 
                ctx.fill();
                ctx.strokeStyle = "#FFFFFF";
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(this.state.endX, this.state.endY, 15, 0, Math.PI*2);
                ctx.fillStyle = "#E74C3C";
                ctx.fill();
                ctx.stroke();

                let timeLeft = Math.max(0, (this.state.aimEndTime - performance.now()) / 1000).toFixed(1);
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "bold 40px 'Segoe UI'";
                ctx.textAlign = "center";
                ctx.shadowColor = "#E74C3C";
                ctx.shadowBlur = 15;
                ctx.fillText(timeLeft + "s", canvas.width / 2, canvas.height / 2);
                
                ctx.font = "bold 14px 'Segoe UI'";
                ctx.shadowBlur = 4;
                ctx.shadowColor = "#000";
                ctx.fillText("Target", this.state.endX, this.state.endY - 25);
                ctx.fillText("Curve", this.state.cpX, this.state.cpY - 25);
                
                ctx.restore();
            } else if (this.state.isActive && !this.state.isPending && this.state.ballRef && this.state.ballRef.dy < 0) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(this.state.ballRef.x, this.state.ballRef.y, (typeof ballRadius !== 'undefined' ? ballRadius : 6) * 1.8, 0, Math.PI*2);
                ctx.fillStyle = "rgba(0, 174, 239, 0.6)";
                ctx.shadowColor = "#00AEEF";
                ctx.shadowBlur = 25;
                ctx.fill();
                ctx.restore();
            }
        },

        reset: function() {
            this.removeListeners();
            this.state.isActive = false;
            this.state.isPending = false;
            this.state.isAiming = false;
            this.state.ballRef = null;
        }
    },
    
    // -----------------------------------------------------
    // المهارة الثانوية: لا تحتسب (It does not count)
    // -----------------------------------------------------
    'it_does_not_count': {
        id: 'it_does_not_count',
        name: 'It Does Not Count',
        type: 'secondary',
        price: 200,
        icon: 'images/sk3.jpg',
        description: '[Secondary Skill] The paddle flashes 3 times (0.5s active, 1s rest). During a flash, any goal or incoming boss attack is immediately nullified and repelled. (Consumes 1 Plasma).',
        plasmaCost: 1,

        state: {
            isActive: false,
            startTime: 0,
            nullifiedEvents: []
        },

        activate: function(ctxData) {
            this.state.isActive = true;
            this.state.startTime = performance.now();
            this.state.nullifiedEvents = [];
        },

        update: function(dt, balls, ctxData) {
            if (!this.state.isActive) return;

            let t = performance.now() - this.state.startTime;
            
            // حساب فترات الإضاءة (0 إلى 500)، (1500 إلى 2000)، (3000 إلى 3500)
            let isFlashing = (t >= 0 && t <= 500) || (t >= 1500 && t <= 2000) || (t >= 3000 && t <= 3500);

            // إنهاء المهارة بعد 3.5 ثانية
            if (t > 3500) {
                this.state.isActive = false;
                return;
            }

            if (isFlashing) {
                let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
                
                // الحل هنا: استخدمنا المتغير العام canvas مباشرة بدلاً من ctxData.canvas
                let pY = canvas.height - (canvas.height * 0.05) - pH;

                balls.forEach(ball => {
                    // إذا تخطت الكرة خط المضرب وكانت متجهة للأسفل (سواء هدف عادي أو ضربة زعيم مدمرة)
                    if (ball.y + ctxData.ballRadius > pY && ball.dy > 0) {
                        
                        ball.dy = -Math.abs(ball.dy); // صد الكرة للأعلى بقوة
                        ball.y = pY - ctxData.ballRadius;
                        ball.lastHitter = 'player';
                        
                        if (typeof playHitSound === 'function') playHitSound();

                        // تسجيل حدث الإلغاء لعرض النص
                        this.state.nullifiedEvents.push({
                            x: ball.x,
                            y: pY - 20,
                            time: performance.now()
                        });
                    }
                });
            }
        },
        
        drawEffects: function(ctx) {
            if (!this.state.isActive) return;

            let now = performance.now();
            let t = now - this.state.startTime;
            let isFlashing = (t >= 0 && t <= 500) || (t >= 1500 && t <= 2000) || (t >= 3000 && t <= 3500);

            // رسم تأثير الإضاءة والحماية على المضرب
            if (isFlashing) {
                let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
                let pX = typeof paddleX !== 'undefined' ? paddleX : 0;
                let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
                let pY = canvas.height - (canvas.height * 0.05) - pH;

                ctx.save();
                // إضاءة بيضاء ساطعة للمضرب
                ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                ctx.shadowColor = "#FFFFFF";
                ctx.shadowBlur = 20;
                ctx.fillRect(pX - 2, pY - 2, pWidth + 4, pH + 4);
                
                // خط حماية أخضر فوق المضرب
                ctx.strokeStyle = "#2ECC71"; 
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(pX - 20, pY - 10);
                ctx.lineTo(pX + pWidth + 20, pY - 10);
                ctx.stroke();
                ctx.restore();
            }

            // رسم الكلمات العائمة "NULLIFIED!" التي تختفي تدريجياً
            for (let i = this.state.nullifiedEvents.length - 1; i >= 0; i--) {
                let ev = this.state.nullifiedEvents[i];
                let age = now - ev.time;
                
                if (age > 1000) {
                    this.state.nullifiedEvents.splice(i, 1);
                    continue;
                }
                
                let alpha = 1 - (age / 1000);
                let floatY = ev.y - (age / 20); // حركة للأعلى

                ctx.save();
                ctx.fillStyle = `rgba(46, 204, 113, ${alpha})`;
                ctx.font = "bold 20px 'Segoe UI'";
                ctx.textAlign = "center";
                ctx.shadowColor = "#000";
                ctx.shadowBlur = 4;
                ctx.fillText("NULLIFIED!", ev.x, floatY);
                ctx.restore();
            }
        },

        reset: function() {
            this.state.isActive = false;
            this.state.nullifiedEvents = [];
        }
    },
     
    
    // -----------------------------------------------------
    // المهارة الرئيسية: هجوم متفجر (Explosive Strike)
    // -----------------------------------------------------
    'explosive_attack': {
        id: 'explosive_attack',
        name: 'Explosive Strike',
        type: 'primary',
        price: 180,
        icon: 'images/sk4.jpg',
        description: '[Primary Skill] Queues a bomb effect. When the ball hits your paddle, it turns into a time bomb that flashes 3 times before detonating. Anyone in the blast radius loses the round! (Consumes 3 Plasma).',
        plasmaCost: 3,

        state: {
            isActive: false,
            isPending: false,
            isArmed: false,
            ballRef: null,
            bombTimer: 0,
            lastFlashSecond: 0,
            explosionAlpha: 0,
            explosionX: 0,
            explosionY: 0,
            explosionRadius: 0
        },

        activate: function(ctxData) {
            // تجهيز المهارة لانتظار اللمسة القادمة
            this.state.isActive = true;
            this.state.isPending = true;
            this.state.isArmed = false;
            this.state.explosionAlpha = 0;
        },

        explode: function() {
            let ball = this.state.ballRef;
            let exX = ball.x;
            let exY = ball.y;
            this.state.explosionX = exX;
            this.state.explosionY = exY;
            this.state.explosionRadius = 0;
            this.state.explosionAlpha = 1.0; // تشغيل تأثير الانفجار البصري

            // تشغيل صوت الانفجار إذا كان متوفراً في نظامك
            if (typeof bombSound !== 'undefined') {
                let soundClone = bombSound.cloneNode();
                soundClone.volume = 1.0;
                soundClone.play().catch(e => console.log(e));
            }

            let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
            let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
            let radius = pWidth * 2; // نطاق الانفجار يغطي ضعف عرض المضرب

            // 1. التحقق من إصابة مضرب اللاعب
            let pX = typeof paddleX !== 'undefined' ? paddleX : 0;
            let pY = canvas.height - (canvas.height * 0.05) - pH;
            let closestPX = Math.max(pX, Math.min(exX, pX + pWidth));
            let closestPY = Math.max(pY, Math.min(exY, pY + pH));
            let distP = (exX - closestPX)**2 + (exY - closestPY)**2;

            // 2. التحقق من إصابة مضرب الزعيم (الخصم)
            let eX = typeof champEnemyPaddleX !== 'undefined' ? champEnemyPaddleX : 0;
            let eY = canvas.height * 0.05;
            let closestEX = Math.max(eX, Math.min(exX, eX + pWidth));
            let closestEY = Math.max(eY, Math.min(exY, eY + pH));
            let distE = (exX - closestEX)**2 + (exY - closestEY)**2;

            // إزالة الكرة من الشاشة لأنها انفجرت
            let ballList = (typeof champBalls !== 'undefined') ? champBalls : (typeof balls !== 'undefined' ? balls : []);
            let ballIndex = ballList.indexOf(ball);
            if (ballIndex !== -1) ballList.splice(ballIndex, 1);

            // تطبيق الضرر: احتساب نقطة لصالح من لم يتضرر
            if (distP <= radius**2) {
                // اللاعب تضرر -> نقطة للزعيم
                if (typeof champEnemyScore !== 'undefined') {
                    champEnemyScore++;
                    if (typeof updateChampUI === 'function') updateChampUI();
                    if (typeof checkMatchResult === 'function') checkMatchResult('enemy');
                }
            } else if (distE <= radius**2) {
                // الزعيم تضرر -> نقطة للاعب
                if (typeof champPlayerScore !== 'undefined') {
                    champPlayerScore++;
                    if (typeof updateChampUI === 'function') updateChampUI();
                    if (typeof checkMatchResult === 'function') checkMatchResult('player');
                }
            } else {
                // الانفجار حدث في المنتصف دون أن يصيب أحداً -> إعادة الكرة فقط
                if (typeof resetChampionBall === 'function') resetChampionBall(ball.lastHitter);
            }
        },

        update: function(dt, balls, ctxData) {
            if (!this.state.isActive) return;

            let ballList = (typeof champBalls !== 'undefined' && champBalls.length > 0) ? champBalls : balls;

            // 1. حالة الانتظار: استشعار ملامسة الكرة للمضرب
            if (this.state.isPending) {
                if (ballList.length === 0) return;
                let ball = ballList[0];
                
                // الكرة لمست المضرب
                if (ball.lastHitter === 'player' && ball.dy < 0 && ball.y > canvas.height / 2) {
                    this.state.isPending = false;
                    this.state.isArmed = true; // تحويل الكرة لقنبلة
                    this.state.ballRef = ball;
                    this.state.bombTimer = 3.0; // مؤقت 3 ثواني
                    this.state.lastFlashSecond = 3;
                    ball.isFlashing = 0;
                }
            }

            // 2. حالة القنبلة الموقوتة: تحديث العداد والوميض
            if (this.state.isArmed && this.state.ballRef) {
                this.state.bombTimer -= dt;
                let currentSecond = Math.ceil(this.state.bombTimer);

                // إطلاق وميض مع بداية كل ثانية جديدة
                if (currentSecond < this.state.lastFlashSecond && currentSecond > 0) {
                    this.state.lastFlashSecond = currentSecond;
                    this.state.ballRef.isFlashing = 0.15; 
                }

                if (this.state.ballRef.isFlashing > 0) {
                    this.state.ballRef.isFlashing -= dt;
                }

                // الانفجار عند انتهاء الوقت!
                if (this.state.bombTimer <= 0) {
                    this.state.isArmed = false;
                    this.explode();
                }
            }
            
            // 3. تحديث فيزياء تلاشي تأثير الانفجار البصري
            if (this.state.explosionAlpha > 0) {
                this.state.explosionAlpha -= 1.5 * dt;
                this.state.explosionRadius += 500 * dt;
            } else if (this.state.explosionAlpha <= 0 && !this.state.isPending && !this.state.isArmed) {
                this.state.isActive = false; // إنهاء المهارة كلياً
            }
        },

        drawEffects: function(ctx) {
            if (!this.state.isActive) return;

            // رسم خط الاستعداد الأحمر فوق المضرب
            if (this.state.isPending) {
                let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
                let pX = typeof paddleX !== 'undefined' ? paddleX : 0;
                let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
                let pY = canvas.height - (canvas.height * 0.05) - pH;
                
                ctx.save();
                ctx.fillStyle = "rgba(231, 76, 60, 0.7)"; // أحمر ناري
                ctx.shadowColor = "#E74C3C";
                ctx.shadowBlur = 15;
                ctx.fillRect(pX, pY, pWidth, 5); 
                ctx.restore();
            }

            // رسم تأثير القنبلة الموقوتة على الكرة
            if (this.state.isArmed && this.state.ballRef) {
                let ball = this.state.ballRef;
                ctx.save();
                
                // تضخيم حجم الكرة وتغيير لونها
                ctx.beginPath();
                ctx.arc(ball.x, ball.y, (typeof ballRadius !== 'undefined' ? ballRadius : 6) * 1.5, 0, Math.PI*2);
                ctx.fillStyle = (ball.isFlashing > 0) ? "#FFFFFF" : "#E74C3C";
                ctx.shadowColor = "#E74C3C";
                ctx.shadowBlur = (ball.isFlashing > 0) ? 25 : 10;
                ctx.fill();
                ctx.restore();
                
                // رسم العداد التنازلي المصاحب للكرة
                ctx.save();
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "bold 20px 'Segoe UI'";
                ctx.textAlign = "center";
                ctx.shadowColor = "#000";
                ctx.shadowBlur = 4;
                ctx.fillText(Math.ceil(this.state.bombTimer), ball.x, ball.y - 20);
                ctx.restore();
            }

            // رسم دائرة الانفجار المدمرة
            if (this.state.explosionAlpha > 0) {
                ctx.save();
                // الهالة الخارجية الحمراء
                ctx.beginPath();
                ctx.arc(this.state.explosionX, this.state.explosionY, this.state.explosionRadius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(231, 76, 60, ${this.state.explosionAlpha})`;
                ctx.fill();
                ctx.closePath();
                
                // القلب البرتقالي المشتعل للانفجار
                ctx.beginPath();
                ctx.arc(this.state.explosionX, this.state.explosionY, this.state.explosionRadius * 0.7, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 165, 0, ${this.state.explosionAlpha})`;
                ctx.fill();
                ctx.closePath();
                ctx.restore();
            }
        },

        reset: function() {
            this.state.isActive = false;
            this.state.isPending = false;
            this.state.isArmed = false;
            this.state.ballRef = null;
            this.state.explosionAlpha = 0;
        }
    },
    // -----------------------------------------------------
    // المهارة الثانوية: الجدار الكبير (The Great Wall)
    // -----------------------------------------------------
    'the_great_wall': {
        id: 'the_great_wall',
        name: 'The Great Wall',
        type: 'secondary',
        price: 200,
        icon: 'images/sk5.jpg',
        description: '[Secondary Skill] Expands the paddle until it fills the screen over 3 hits, then shrinks it back to normal over the next 3 hits. (Consumes 1 Plasma).',
        plasmaCost: 1,

        state: {
            isActive: false,
            isPending: false,
            hitCount: 0,
            baseWidth: 0,
            hasProcessedHit: false
        },

        activate: function(ctxData) {
            this.state.isActive = true;
            this.state.isPending = true;
            this.state.hitCount = 0;
            this.state.hasProcessedHit = false;
            // حفظ الحجم الأصلي للمضرب لاستعادته لاحقاً
            this.state.baseWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
        },

        update: function(dt, balls, ctxData) {
            if (!this.state.isActive) return;

            let ballList = (typeof champBalls !== 'undefined' && champBalls.length > 0) ? champBalls : balls;
            if (ballList.length === 0) return;
            let ball = ballList[0];

            // 1. استشعار ملامسة الكرة للمضرب
            if (ball.lastHitter === 'player' && ball.dy < 0) {
                if (!this.state.hasProcessedHit) {
                    this.state.hasProcessedHit = true;
                    this.state.isPending = false;
                    this.state.hitCount++;

                    // إنهاء المهارة واستعادة الحجم الأصلي بعد 6 ضربات
                    if (this.state.hitCount >= 6) {
                        paddleWidth = this.state.baseWidth;
                        this.state.isActive = false;
                    } else {
                        // حساب الحجم الجديد بناءً على عدد الضربات
                        let targetWidth = ctxData.canvas.width;
                        let progress = 0;
                        
                        if (this.state.hitCount <= 3) {
                            // زيادة تدريجية في أول 3 ضربات (33%، 66%، 100%)
                            progress = this.state.hitCount / 3; 
                        } else {
                            // نقصان تدريجي في الضربات 4 و 5 (66%، 33%)
                            progress = (6 - this.state.hitCount) / 3; 
                        }
                        
                        paddleWidth = this.state.baseWidth + (targetWidth - this.state.baseWidth) * progress;
                        
                        // تعديل موقع المضرب لكي لا يخرج عن الشاشة بعد التكبير
                        if (typeof paddleX !== 'undefined') {
                            paddleX = Math.max(0, Math.min(ctxData.canvas.width - paddleWidth, paddleX));
                        }
                    }
                }
            } else if (ball.dy > 0 || ball.lastHitter === 'enemy') {
                // إعادة التهيئة لتسجيل الضربة القادمة
                this.state.hasProcessedHit = false;
            }
        },

        drawEffects: function(ctx) {
            if (!this.state.isActive) return;

            let pX = typeof paddleX !== 'undefined' ? paddleX : 0;
            let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
            let pY = canvas.height - (canvas.height * 0.05) - pH;

            if (this.state.isPending) {
                // تأثير الانتظار (توهج أخضر خفيف فوق المضرب)
                ctx.save();
                ctx.fillStyle = "rgba(46, 204, 113, 0.7)"; 
                ctx.shadowColor = "#2ECC71";
                ctx.shadowBlur = 15;
                ctx.fillRect(pX, pY, this.state.baseWidth, 5); 
                ctx.restore();
            } else {
                // رسم تأثير جدار متوهج على المضرب النشط
                let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;

                ctx.save();
                ctx.strokeStyle = "rgba(46, 204, 113, 0.8)"; 
                ctx.lineWidth = 4;
                ctx.shadowColor = "#2ECC71";
                ctx.shadowBlur = 20;
                ctx.strokeRect(pX, pY, pWidth, pH);
                
                // كتابة عدد الضربات المتبقية لإنهاء المهارة
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "bold 14px 'Segoe UI'";
                ctx.textAlign = "center";
                ctx.shadowBlur = 4;
                ctx.shadowColor = "#000";
                let hitsLeft = 6 - this.state.hitCount;
                ctx.fillText(hitsLeft + " Hits", pX + pWidth / 2, pY - 10);
                
                ctx.restore();
            }
        },

        reset: function() {
            // استعادة الحجم الأصلي فوراً في حال تسجيل هدف أو انتهاء الجولة
            if (this.state.isActive && this.state.baseWidth > 0) {
                paddleWidth = this.state.baseWidth; 
            }
            this.state.isActive = false;
            this.state.isPending = false;
            this.state.hitCount = 0;
            this.state.hasProcessedHit = false;
        }
    },
    // -----------------------------------------------------
    // المهارة الرئيسية: الارتداد المتسارع (Accelerated Ricochet)
    // -----------------------------------------------------
    'accelerated_ricochet': {
        id: 'accelerated_ricochet',
        name: 'Accelerated Ricochet',
        type: 'primary',
        price: 260,
        icon: 'images/sk6.jpg',
        description: '[Primary Skill] Activates an 8-second window. If you hit the ball and it bounces off a side wall, it gains extreme speed and increases the enemy miss chance to 75%. (Consumes 3 Plasma).',
        plasmaCost: 3,

        state: {
            isActive: false,
            isPending: false,
            isArmed: false,
            hasBounced: false,
            pendingEndTime: 0,
            lastDxSign: 1,
            ballRef: null
        },

        activate: function(ctxData) {
            this.state.isActive = true;
            this.state.isPending = true;
            this.state.isArmed = false;
            this.state.hasBounced = false;
            // إعطاء اللاعب مهلة 8 ثواني لضرب الكرة
            this.state.pendingEndTime = performance.now() + 8000; 
            this.state.ballRef = null;
        },

        update: function(dt, balls, ctxData) {
            if (!this.state.isActive) return;

            let ballList = (typeof champBalls !== 'undefined' && champBalls.length > 0) ? champBalls : balls;
            if (ballList.length === 0) return;
            let ball = ballList[0];

            // 1. حالة الانتظار (تفعيل مهلة الـ 8 ثواني)
            if (this.state.isPending) {
                if (performance.now() > this.state.pendingEndTime) {
                    this.state.isActive = false; // انتهى الوقت ولم يضربها
                    this.state.isPending = false;
                    return;
                }

                // ملامسة الكرة لمضرب اللاعب
                if (ball.lastHitter === 'player' && ball.dy < 0) {
                    this.state.isPending = false;
                    this.state.isArmed = true; // الكرة الآن مسلحة
                    this.state.hasBounced = false;
                    this.state.ballRef = ball;
                    this.state.lastDxSign = Math.sign(ball.dx); // حفظ اتجاه الكرة الحالي
                }
            }

            // 2. حالة التسليح (الكرة في طريقها للخصم)
            if (this.state.isArmed && this.state.ballRef) {
                let activeBall = this.state.ballRef;

                // إذا ارتدت الكرة نحو الأسفل (صدها الخصم أو اصطدمت بالسقف/الطوب)، نلغي المهارة
                if (activeBall.dy > 0 || activeBall.lastHitter === 'enemy') {
                    this.state.isActive = false;
                    this.state.isArmed = false;
                    return;
                }

                // مراقبة اصطدام الجدار (تغير إشارة السرعة الأفقية)
                let currentDxSign = Math.sign(activeBall.dx);
                if (currentDxSign !== 0 && currentDxSign !== this.state.lastDxSign && !this.state.hasBounced) {
                    
                    // الكرة اصطدمت للتو بالجدار الجانبي!
                    this.state.hasBounced = true;

                    // مضاعفة السرعة لتصبح خارقة (نضرب السرعة الحالية في 1.8)
                    activeBall.dx *= 1.8;
                    activeBall.dy *= 1.8;

                    // رفع نسبة خطأ الزعيم إلى 75%
                    // إخبار الذكاء الاصطناعي بأن هذه الكرة مهارة هجومية سريعة
                    if (typeof champIsIncomingSkill !== 'undefined') {
                        champAiGuaranteedHits = 0; 
                        champIsIncomingSkill = true;
                        champActiveSkillMissChance = 75; // إرسال 75% ليتم تقليلها للزعيم 6 و 7
                    }
                    
                    // تشغيل صوت الاصطدام
                    if (typeof playHitSound === 'function') playHitSound();
                }
                
                this.state.lastDxSign = currentDxSign;
            }
        },

        drawEffects: function(ctx) {
            if (!this.state.isActive) return;

            // أ- رسم عداد الـ 8 ثواني فوق المضرب
            if (this.state.isPending) {
                let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
                let pX = typeof paddleX !== 'undefined' ? paddleX : 0;
                let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
                let pY = canvas.height - (canvas.height * 0.05) - pH;
                
                let timeLeft = Math.max(0, (this.state.pendingEndTime - performance.now()) / 1000).toFixed(1);

                ctx.save();
                // هالة كهربائية زرقاء حول المضرب
                ctx.fillStyle = "rgba(0, 255, 255, 0.7)";
                ctx.shadowColor = "#00FFFF";
                ctx.shadowBlur = 15;
                ctx.fillRect(pX, pY, pWidth, 5); 

                // كتابة الوقت المتبقي
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "bold 16px 'Segoe UI'";
                ctx.textAlign = "center";
                ctx.shadowColor = "#000";
                ctx.shadowBlur = 4;
                ctx.fillText(timeLeft + "s", pX + pWidth / 2, pY - 10);
                ctx.restore();
            }

            // ب- رسم التأثيرات البصرية على الكرة
            if (this.state.isArmed && this.state.ballRef) {
                let ball = this.state.ballRef;
                ctx.save();
                
                if (this.state.hasBounced) {
                    // بعد الارتداد بالجدار: سرعة خارقة (ذيل لامع وكرة متوهجة بلون سماوي/أبيض)
                    let grad = ctx.createLinearGradient(ball.x, ball.y, ball.x - (ball.dx * 0.05), ball.y - (ball.dy * 0.05));
                    grad.addColorStop(0, "rgba(0, 255, 255, 1)");
                    grad.addColorStop(1, "rgba(0, 255, 255, 0)");
                    
                    ctx.beginPath();
                    ctx.arc(ball.x, ball.y, (typeof ballRadius !== 'undefined' ? ballRadius : 6) * 1.5, 0, Math.PI*2);
                    ctx.fillStyle = "#FFFFFF";
                    ctx.shadowColor = "#00FFFF";
                    ctx.shadowBlur = 30;
                    ctx.fill();
                    
                    // رسم خط الذيل الكهربائي
                    ctx.beginPath();
                    ctx.moveTo(ball.x, ball.y);
                    ctx.lineTo(ball.x - (ball.dx * 0.04), ball.y - (ball.dy * 0.04));
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = typeof ballRadius !== 'undefined' ? ballRadius * 2 : 12;
                    ctx.lineCap = "round";
                    ctx.stroke();

                } else {
                    // قبل الارتداد: الكرة متوهجة ومستعدة لتلقي الانعكاس
                    ctx.beginPath();
                    ctx.arc(ball.x, ball.y, (typeof ballRadius !== 'undefined' ? ballRadius : 6) * 1.2, 0, Math.PI*2);
                    ctx.fillStyle = "#00FFFF";
                    ctx.shadowColor = "#00FFFF";
                    ctx.shadowBlur = 15;
                    ctx.fill();
                }
                ctx.restore();
            }
        },

        reset: function() {
            this.state.isActive = false;
            this.state.isPending = false;
            this.state.isArmed = false;
            this.state.hasBounced = false;
            this.state.ballRef = null;
        }
    },
    // -----------------------------------------------------
    // المهارة الثانوية: النجم الخماسي (The Pentagram)
    // -----------------------------------------------------
    'pentagram_star': {
        id: 'pentagram_star',
        name: 'The Pentagram',
        type: 'secondary',
        price: 190,
        icon: 'images/sk7.jpg',
        description: '[Secondary Skill] Hit the ball 5 times without a goal to summon a pentagram for 12s. During this time, ALL skills (Player & Boss) are silenced. (Consumes 1 Plasma).',
        plasmaCost: 1,

        state: {
            isActive: false,
            isPending: false,
            hitCount: 0,
            hasProcessedHit: false,
            isStarActive: false,
            starEndTime: 0,
            isSilenced: false,
            originalPlayerTrigger: null,
            originalBossOnHit: null
        },

        activate: function(ctxData) {
            this.state.isActive = true;
            this.state.isPending = true;
            this.state.hitCount = 0;
            this.state.hasProcessedHit = false;
            this.state.isStarActive = false;
        },

        update: function(dt, balls, ctxData) {
            if (!this.state.isActive) return;

            // 1. مرحلة الانتظار (تجميع 5 ضربات)
            if (this.state.isPending) {
                // إلغاء المهارة إذا توقف اللعب (تم تسجيل هدف أو تلقي هدف)
                if (typeof champIsBallLaunched !== 'undefined' && !champIsBallLaunched) {
                    this.reset();
                    return;
                }

                let ballList = (typeof champBalls !== 'undefined' && champBalls.length > 0) ? champBalls : balls;
                if (ballList.length === 0) return;
                let ball = ballList[0];

                if (ball.lastHitter === 'player' && ball.dy < 0) {
                    if (!this.state.hasProcessedHit) {
                        this.state.hasProcessedHit = true;
                        this.state.hitCount++;

                        // اكتملت الـ 5 ضربات بنجاح
                        if (this.state.hitCount >= 5) {
                            this.state.isPending = false;
                            this.state.isStarActive = true;
                            this.state.starEndTime = performance.now() + 12000; // 12 ثانية
                            
                            // تفعيل الصمت (Silence) على الجانبين
                            if (!this.state.isSilenced) {
                                this.state.isSilenced = true;
                                
                                // تعطيل مهارات اللاعب عن طريق تغليف دالة التفعيل مؤقتاً
                                this.state.originalPlayerTrigger = window.triggerPlayerSkill;
                                window.triggerPlayerSkill = function(type) {
                                    // صمت تام: لا تفعل شيئاً
                                };
                                
                                // تعطيل مهارات الزعيم (إيهامه بأن البلازما دائماً 0)
                                if (typeof champCurrentBoss !== 'undefined' && champCurrentBoss.onHit) {
                                    this.state.originalBossOnHit = champCurrentBoss.onHit;
                                    let self = this;
                                    champCurrentBoss.onHit = function(b, ctxD) {
                                        let fakeCtx = { 
                                            ...ctxD, 
                                            gameState: { 
                                                ...ctxD.gameState, 
                                                enemyPlasma: 0 // تصفير وهمي مؤقت
                                            } 
                                        };
                                        self.state.originalBossOnHit.call(champCurrentBoss, b, fakeCtx);
                                    };
                                }
                            }
                        }
                    }
                } else if (ball.dy > 0 || ball.lastHitter === 'enemy') {
                    this.state.hasProcessedHit = false;
                }
            }

            // 2. مرحلة النجم (إبطال المهارات لـ 12 ثانية)
            if (this.state.isStarActive) {
                // إلغاء التأثير فوراً إذا سُجل هدف خلال فترة الـ 12 ثانية لإنهاء الجولة
                if (typeof champIsBallLaunched !== 'undefined' && !champIsBallLaunched) {
                    this.reset();
                    return;
                }

                if (performance.now() > this.state.starEndTime) {
                    this.reset(); // انتهاء الوقت وعودة الأمور لطبيعتها
                }
            }
        },

        drawEffects: function(ctx) {
            if (!this.state.isActive) return;

            // رسم عداد الضربات فوق المضرب أثناء التجميع
            if (this.state.isPending) {
                let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
                let pX = typeof paddleX !== 'undefined' ? paddleX : 0;
                let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
                let pY = canvas.height - (canvas.height * 0.05) - pH;
                
                ctx.save();
                ctx.fillStyle = "#FFD700";
                ctx.font = "bold 16px 'Segoe UI'";
                ctx.textAlign = "center";
                ctx.shadowColor = "#000";
                ctx.shadowBlur = 4;
                ctx.fillText(this.state.hitCount + " / 5", pX + pWidth/2, pY - 15);
                ctx.restore();
            }

            // رسم النجم الخماسي المفرغ في الخلفية
            if (this.state.isStarActive) {
                let cx = canvas.width / 2;
                let cy = canvas.height / 2;
                let outerRadius = Math.min(canvas.width, canvas.height) * 0.35;
                let innerRadius = outerRadius * 0.382; // النسبة الذهبية لنجم مثالي مفرغ
                
                let timeLeft = this.state.starEndTime - performance.now();
                
                // تأثير الظهور والاختفاء التدريجي (Fade)
                let alpha = 0.5;
                if (timeLeft > 11000) alpha = (12000 - timeLeft) / 1000 * 0.5;
                else if (timeLeft < 1000) alpha = timeLeft / 1000 * 0.5;

                let rotation = performance.now() / 2000; 

                ctx.save();
                ctx.beginPath();
                // رسم مضلع بـ 10 نقاط لتشكيل نجم خماسي مفرغ من الداخل (خطوط محيطية فقط)
                for (let i = 0; i < 10; i++) {
                    let r = (i % 2 === 0) ? outerRadius : innerRadius;
                    let a = rotation + (i * Math.PI / 5) - Math.PI / 2;
                    if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
                    else ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
                }
                ctx.closePath();
                
                ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
                ctx.lineWidth = 4;
                ctx.shadowColor = "#FFD700";
                ctx.shadowBlur = 20;
                ctx.stroke();

                // كلمة SILENCED للتوضيح في منتصف النجم
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha + 0.2})`;
                ctx.font = "bold 30px 'Segoe UI'";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.shadowColor = "#FFD700";
                ctx.shadowBlur = 10;
                ctx.fillText("SILENCED", cx, cy);
                ctx.restore();
            }
        },

        reset: function() {
            // استرجاع الدوال الأصلية للاعب والزعيم بمجرد انتهاء أو إلغاء المهارة
            if (this.state.isSilenced) {
                if (this.state.originalPlayerTrigger) {
                    window.triggerPlayerSkill = this.state.originalPlayerTrigger;
                }
                if (this.state.originalBossOnHit && typeof champCurrentBoss !== 'undefined') {
                    champCurrentBoss.onHit = this.state.originalBossOnHit;
                }
                this.state.isSilenced = false;
            }
            
            this.state.isActive = false;
            this.state.isPending = false;
            this.state.isStarActive = false;
            this.state.hitCount = 0;
            this.state.hasProcessedHit = false;
            this.state.originalPlayerTrigger = null;
            this.state.originalBossOnHit = null;
        }
    },
    // -----------------------------------------------------
    // المهارة الرئيسية: هجوم متتالي (Consecutive Attack)
    // -----------------------------------------------------
    'consecutive_attack': {
        id: 'consecutive_attack',
        name: 'Consecutive Attack',
        type: 'primary',
        price: 180,
        icon: 'images/sk8.jpg',
        description: '[Primary Skill] Enter Attacker Mode! Your next hit triggers a 4-strike combo. If the boss blocks the first 3 strikes, the ball instantly returns to your paddle for an immediate counter-smash! (Consumes 3 Plasma).',
        plasmaCost: 3,

        state: {
            isActive: false,
            isPending: false,
            currentShot: 0,
            ballRef: null
        },

        activate: function(ctxData) {
            this.state.isActive = true;
            this.state.isPending = true;
            this.state.currentShot = 0;
            this.state.ballRef = null;
        },

        update: function(dt, balls, ctxData) {
            if (!this.state.isActive) return;
            
            // إبطال تأثير المهارة فوراً إذا سُجل هدف وانتهت الجولة
            if (typeof champIsBallLaunched !== 'undefined' && !champIsBallLaunched) {
                this.reset();
                return;
            }

            let ballList = (typeof champBalls !== 'undefined' && champBalls.length > 0) ? champBalls : balls;
            if (ballList.length === 0) return;
            let ball = ballList[0];

            // 1. حالة الانتظار: استشعار أول ضربة لبدء الهجوم المتتالي
            if (this.state.isPending) {
                if (ball.lastHitter === 'player' && ball.dy < 0 && ball.y > canvas.height / 2) {
                   this.state.isPending = false;
                    this.state.currentShot = 1;
                    this.state.ballRef = ball;
                }
            } 
            // 2. حالة الهجوم المتتالي النشط
            else if (this.state.ballRef) {
                let activeBall = this.state.ballRef;

                // هل قام الزعيم بصد الكرة للتو؟
                if (activeBall.lastHitter === 'enemy' && activeBall.dy > 0) {
                    if (this.state.currentShot < 4) {
                        this.state.currentShot++;
                        
                        // النقل الآني للكرة إلى مضرب اللاعب لتسديدها فوراً
                        let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
                        let pX = typeof paddleX !== 'undefined' ? paddleX : 0;
                        let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
                        let pY = canvas.height - (canvas.height * 0.05) - pH;
                        activeBall.x = pX + pWidth / 2;
                        activeBall.y = pY - ctxData.ballRadius - 5;
                        
                        // حساب السرعة الحالية وتوجيهها للأعلى مع تغيير طفيف في الزاوية
                        let currentSpeed = Math.sqrt(activeBall.dx**2 + activeBall.dy**2);
                        let randomAngle = (Math.random() - 0.5) * Math.PI / 2.5; // زاوية عشوائية خفيفة
                        
                        activeBall.dx = currentSpeed * Math.sin(randomAngle);
                        activeBall.dy = -Math.abs(currentSpeed * Math.cos(randomAngle));

                        activeBall.lastHitter = 'player';
                        
                        // إرسال الكرة كمهارة هجومية قياسية (بدون نسبة إضافية، ليعتمد الزعيم على نسبته الأساسية)
                        if (typeof champIsIncomingSkill !== 'undefined') {
                            champAiGuaranteedHits = 0;
                            champIsIncomingSkill = true;
                            champActiveSkillMissChance = 0; 
                        }
                        
                        // تشغيل صوت الضرب لتعزيز الإحساس بالهجوم المتتالي
                        if (typeof playHitSound === 'function') {
                            playHitSound();
                        }
                    } else {
                        // الضربة الرابعة صُدت: ترتد الكرة طبيعياً وتنتهي المهارة
                        this.state.isActive = false;
                    }
                }
            }
        },

        drawEffects: function(ctx) {
            if (!this.state.isActive) return;

            // رسم تأثير التجهيز (خط برتقالي/أحمر فوق المضرب)
            if (this.state.isPending) {
                let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
                let pX = typeof paddleX !== 'undefined' ? paddleX : 0;
                let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
                let pY = canvas.height - (canvas.height * 0.05) - pH;
                
                ctx.save();
                ctx.fillStyle = "rgba(255, 69, 0, 0.7)"; 
                ctx.shadowColor = "#FF4500";
                ctx.shadowBlur = 15;
                ctx.fillRect(pX, pY, pWidth, 5); 
                ctx.restore();
            }

            // رسم تأثيرات الهجوم (توهج الكرة وعداد الضربات)
            if (!this.state.isPending && this.state.ballRef) {
                let activeBall = this.state.ballRef;
                
                // هالة نارية حول الكرة
                ctx.save();
                ctx.beginPath();
                ctx.arc(activeBall.x, activeBall.y, (typeof ballRadius !== 'undefined' ? ballRadius : 6) * 1.5, 0, Math.PI*2);
                ctx.fillStyle = "rgba(255, 69, 0, 0.6)";
                ctx.shadowColor = "#FF4500";
                ctx.shadowBlur = 25;
                ctx.fill();
                ctx.restore();

                // عرض عداد الضربات (Combo) في منتصف الشاشة مع نبض بصري
                let alpha = 0.5 + 0.5 * Math.abs(Math.sin(performance.now() / 150));
                ctx.save();
                ctx.fillStyle = `rgba(255, 69, 0, ${alpha})`;
                ctx.font = "bold 50px 'Segoe UI'";
                ctx.textAlign = "center";
                ctx.shadowColor = "#FF4500";
                ctx.shadowBlur = 15;
                ctx.fillText(this.state.currentShot + " / 4", canvas.width / 2, canvas.height / 2);
                
                ctx.font = "bold 20px 'Segoe UI'";
                ctx.fillText("COMBO STRIKE!", canvas.width / 2, canvas.height / 2 + 40);
                ctx.restore();
            }
        },

        reset: function() {
            this.state.isActive = false;
            this.state.isPending = false;
            this.state.currentShot = 0;
            this.state.ballRef = null;
        }
    },
};

// =========================================================================
// مشغل المهارات وربطها بمحرك اللعبة

let consecutiveSecondaryUses = 0; // عداد الاستخدام المتتالي للمهارة الثانوية

// دالة لتفعيل المهارة (تُستدعى عند النقر المزدوج)
function triggerPlayerSkill(type) {
    let skillId = type === 'primary' ? equippedPrimary : equippedSecondary;
    if (!skillId) return;

    let skill = PlayerSkillRegistry[skillId];
    if (!skill) return;

    // شرط جديد: منع التفعيل إذا استخدمت المهارة الثانوية مرتين متتاليتين
    if (type === 'secondary' && consecutiveSecondaryUses >= 2) {
        return; // تجاهل التفعيل بصمت
    }

    let canActivate = false;

    // التحقق من إمكانية التفعيل بناءً على الطور
    if (typeof isChampionMode !== 'undefined' && isChampionMode) {
        // طور الزعيم: يعتمد على البلازما
        if (typeof champPlayerPlasmaCharges !== 'undefined' && champPlayerPlasmaCharges >= skill.plasmaCost) {
            champPlayerPlasmaCharges -= skill.plasmaCost;
            if (typeof updateChampUI === 'function') updateChampUI();
            canActivate = true;
        }
    } else {
        // المراحل العادية: يعتمد على امتلاء العمود الزمني
        if (type === 'primary' && typeof primarySkillTimer !== 'undefined' && primarySkillTimer >= PRIMARY_SKILL_MAX) {
            primarySkillTimer = 0; // تصفير العمود بعد الاستخدام
            canActivate = true;
        } else if (type === 'secondary' && typeof secondarySkillTimer !== 'undefined' && secondarySkillTimer >= SECONDARY_SKILL_MAX) {
            secondarySkillTimer = 0; // تصفير العمود بعد الاستخدام
            canActivate = true;
        }
    }

    // إذا تحققت الشروط، نُفعل المهارة
    if (canActivate) {
        let pY = canvas.height - (canvas.height * 0.05) - paddleHeight;
        let ctxData = {
            paddleX: paddleX,
            pY: pY,
            paddleWidth: paddleWidth,
            paddleHeight: paddleHeight,
            ballRadius: ballRadius,
            canvas: canvas
        };
        skill.activate(ctxData);

        // تحديث عداد الاستخدام المتتالي
        if (type === 'secondary') {
            consecutiveSecondaryUses++;
        } else if (type === 'primary') {
            consecutiveSecondaryUses = 0; // تصفير العداد لفك القفل عن المهارة الثانوية
        }
    }
}

// دالة لتحديث فيزياء المهارات (توضع في حلقة اللعب)
function updatePlayerSkills(dt, balls, ctxData) {
    if (equippedSecondary && PlayerSkillRegistry[equippedSecondary] && PlayerSkillRegistry[equippedSecondary].update) {
        PlayerSkillRegistry[equippedSecondary].update(dt, balls, ctxData);
    }
    if (equippedPrimary && PlayerSkillRegistry[equippedPrimary] && PlayerSkillRegistry[equippedPrimary].update) {
        PlayerSkillRegistry[equippedPrimary].update(dt, balls, ctxData);
    }
}

// دالة لرسم تأثيرات المهارات (توضع في حلقة اللعب)
function drawPlayerSkills(ctx) {
    if (equippedSecondary && PlayerSkillRegistry[equippedSecondary] && PlayerSkillRegistry[equippedSecondary].drawEffects) {
        PlayerSkillRegistry[equippedSecondary].drawEffects(ctx);
    }
    if (equippedPrimary && PlayerSkillRegistry[equippedPrimary] && PlayerSkillRegistry[equippedPrimary].drawEffects) {
        PlayerSkillRegistry[equippedPrimary].drawEffects(ctx);
    }
}

// تصفير المهارات عند بدء أو انتهاء جولة الزعيم
function resetPlayerSkills() {
    if (equippedSecondary && PlayerSkillRegistry[equippedSecondary] && PlayerSkillRegistry[equippedSecondary].reset) {
        PlayerSkillRegistry[equippedSecondary].reset();
    }
    if (equippedPrimary && PlayerSkillRegistry[equippedPrimary] && PlayerSkillRegistry[equippedPrimary].reset) {
        PlayerSkillRegistry[equippedPrimary].reset();
    }
}