// =========================================================================
// سجل الزعماء (Boss Registry) ومهاراتهم المستقلة
// =========================================================================
const BossRegistry = {
    // -----------------------------------------------------
    // الزعيم: Void Phantom
    // -----------------------------------------------------
    'North Star': {
        createState: () => ({
            hitCounter: 0,
            lightBallUsageCount: 0,
            isDeviationActive: false,
            deviationDone: false,
            deviationTriggerY: 0,
            isLightBallActive: false,
            lightBallEndTime: 0
        }),
        onHit: function(ball, ctxData) {
            this.state.hitCounter++;
            
            // المهارة الجانبية: كرة النور
            if (this.state.hitCounter >= 5 && ctxData.gameState.enemyPlasma > 0 && this.state.lightBallUsageCount < 2) {
                ctxData.gameState.consumeEnemyPlasma(1);
                this.state.hitCounter = 0;
                this.state.lightBallUsageCount++;
                
                this.state.isLightBallActive = true;
                this.state.lightBallEndTime = performance.now() + 3000;
            }
            
            // المهارة الأساسية: الانحراف (Deviation)
            if (ctxData.gameState.enemyPlasma === 3) {
                ctxData.gameState.incrementHitsAfterPlasma();
                if (ctxData.gameState.hitsAfterFullPlasma >= ctxData.gameState.hitsToActivate) {
                    ctxData.gameState.resetEnemyPlasma();
                    this.state.hitCounter = 0;
                    this.state.lightBallUsageCount = 0;
                    
                    this.state.isDeviationActive = true;
                    this.state.deviationDone = false;
                    
                    let hitEY = ctxData.eY + ctxData.paddleHeight;
                    this.state.deviationTriggerY = hitEY + (ctxData.pY - hitEY) * 0.75;
                    
                    ball.dx = 0;
                    ball.dy = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                    
                    ctxData.gameState.triggerCinematic(1700, "DEVIATION");
                }
            }
        },
        onPlayerHit: function() {
            this.state.isDeviationActive = false;
        },
        update: function(dt, ball, ctxData) {
            if (this.state.isDeviationActive && !this.state.deviationDone && ball.dy > 0 && ball.y >= this.state.deviationTriggerY) {
                this.state.deviationDone = true;
                this.state.isDeviationActive = false;
                
                let distLeft = ball.x;
                let distRight = ctxData.canvas.width - ball.x;
                let direction = (distLeft < distRight) ? 1 : -1;
                let deviationAngle = 45 * (Math.PI / 180);
                let currentTotalSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                
                ball.dx = direction * currentTotalSpeed * Math.sin(deviationAngle);
                ball.dy = currentTotalSpeed * Math.cos(deviationAngle); 
                
                if (typeof playHitSound === "function") playHitSound();
            }
        },
        drawEffects: function(ctx, canvas, ctxData) {
            if (this.state.isLightBallActive) {
                if (performance.now() > this.state.lightBallEndTime) {
                    this.state.isLightBallActive = false;
                } else if (ctxData.balls.length > 0) {
                    let ball = ctxData.balls[0];
                    ctx.save();
                    let maxScreenRadius = Math.max(canvas.width, canvas.height) * 1.5;
                    let gradient = ctx.createRadialGradient(ball.x, ball.y, ctxData.ballRadius, ball.x, ball.y, maxScreenRadius);
                    
                    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
                    gradient.addColorStop(0.3, "rgba(255, 255, 200, 0.95)");
                    gradient.addColorStop(0.7, "rgba(255, 210, 50, 0.85)");
                    gradient.addColorStop(1, "rgba(255, 255, 255, 0.7)");
                    
                    ctx.fillStyle = gradient;
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    ctx.restore();
                }
            }
        },
        overrideDrawBall: function(ball, ctx, ballRadius) {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI*2);
            ctx.fillStyle = "#e74c3c"; 
            ctx.fill();
            ctx.closePath();
        }
    },
    // -----------------------------------------------------
    // الزعيم: Default (المهارة الافتراضية - الضربة المخفية)
    // -----------------------------------------------------
    'Default': {
        createState: () => ({
            isBallHidden: false,
            hitCounter: 0
        }),
        onHit: function(ball, ctxData) {
            this.state.hitCounter++;
            
            if (ctxData.gameState.enemyPlasma === 3) {
                ctxData.gameState.incrementHitsAfterPlasma();
                if (ctxData.gameState.hitsAfterFullPlasma >= ctxData.gameState.hitsToActivate) {
                    ctxData.gameState.resetEnemyPlasma();
                    this.state.hitCounter = 0;
                    this.state.isBallHidden = true;
                    ctxData.gameState.triggerCinematic(1700, "THE HIDDEN BLOW");
                }
            }
        },
        onPlayerHit: function() {
            this.state.isBallHidden = false;
        },
        update: function(dt, ball, ctxData) {}, // فارغة للزعيم الافتراضي
        drawEffects: function(ctx, canvas, ctxData) {}, // فارغة
        overrideDrawBall: function(ball, ctx, ballRadius) {
            if (!this.state.isBallHidden) {
                ctx.beginPath();
                ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI*2);
                ctx.fillStyle = "#e74c3c"; 
                ctx.fill();
                ctx.closePath();
            }
        }
    },
    // -----------------------------------------------------
    // الزعيم الثالث: Overgrowth Core (الاستنساخ + ممنوع العبور)
    // -----------------------------------------------------
    'Oxidon': {
        createState: () => ({
            hitCounter: 0,
            
            // متغيرات المهارة الأساسية (الاستنساخ)
            isCloningActive: false,
            clonesLaunched: false,
            fakeBalls: [],
            
            // متغيرات المهارة الثانوية (ممنوع العبور)
            secondaryUsageCount: 0,
            isBlockZoneActive: false,
            blockZoneEndTime: 0,
            blockZoneStartX: 0,
            blockZoneWidth: 0
        }),
        onHit: function(ball, ctxData) {
            this.state.hitCounter++;
            
            // المهارة الثانوية: ممنوع العبور (جدار أحمر عشوائي يمنع اللاعب)
            if (this.state.hitCounter >= 5 && ctxData.gameState.enemyPlasma > 0 && this.state.secondaryUsageCount < 2) {
                ctxData.gameState.consumeEnemyPlasma(1);
                this.state.hitCounter = 0;
                this.state.secondaryUsageCount++;
                
                this.state.isBlockZoneActive = true;
                this.state.blockZoneEndTime = performance.now() + 3000; // تدوم لـ 3 ثوانٍ
                this.state.blockZoneWidth = paddleWidth; // عرض الجدار بنفس عرض المضرب
                
                // اختيار موقع عشوائي للمنطقة الحمراء على محور X
                this.state.blockZoneStartX = Math.random() * (ctxData.canvas.width - this.state.blockZoneWidth);
            }
            
            // المهارة الأساسية: الاستنساخ الوهمي
            if (ctxData.gameState.enemyPlasma === 3) {
                ctxData.gameState.incrementHitsAfterPlasma();
                if (ctxData.gameState.hitsAfterFullPlasma >= ctxData.gameState.hitsToActivate) {
                    ctxData.gameState.resetEnemyPlasma();
                    this.state.hitCounter = 0;
                    this.state.secondaryUsageCount = 0; // تصفير المهارة الثانوية للدورة القادمة
                    
                    this.state.isCloningActive = true;
                    this.state.clonesLaunched = false;
                    this.state.fakeBalls = [];
                    
                    ctxData.gameState.triggerCinematic(1700, "PHANTOM CLONES");
                }
            }
        },
        onPlayerHit: function() {
            // إلغاء تفعيل حالة الاستنساخ إذا ضرب اللاعب الكرة الأصلية
            this.state.isCloningActive = false;
            // ملاحظة: لا نلغي المهارة الثانوية هنا لتستمر لـ 3 ثواني كاملة
        },
        update: function(dt, ball, ctxData) {
            // 1. معالجة فيزياء الجدار المانع (المهارة الثانوية)
            if (this.state.isBlockZoneActive) {
                if (performance.now() > this.state.blockZoneEndTime) {
                    this.state.isBlockZoneActive = false;
                } else {
                    // إحداثيات مضرب اللاعب الحالية
                    let pLeft = paddleX;
                    let pRight = paddleX + paddleWidth;
                    
                    // إحداثيات المنطقة الحمراء المحظورة
                    let bLeft = this.state.blockZoneStartX;
                    let bRight = this.state.blockZoneStartX + this.state.blockZoneWidth;
                    
                    // إذا تداخل المضرب مع المنطقة المحظورة
                    if (pRight > bLeft && pLeft < bRight) {
                        // إيجاد أقرب مسار لردع المضرب (الدفع للخارج)
                        let distLeft = Math.abs(pRight - bLeft);
                        let distRight = Math.abs(pLeft - bRight);
                        
                        if (distLeft < distRight) {
                            paddleX = bLeft - paddleWidth; // دفع لليسار
                        } else {
                            paddleX = bRight; // دفع لليمين
                        }
                        
                        // التأكد من عدم خروج المضرب من الشاشة بعد الدفع
                        if (paddleX < 0) paddleX = 0;
                        if (paddleX > ctxData.canvas.width - paddleWidth) paddleX = ctxData.canvas.width - paddleWidth;
                    }
                }
            }

            // 2. إطلاق النسخ المزيّفة (المهارة الأساسية)
            if (this.state.isCloningActive && !this.state.clonesLaunched && ball.dy > 0) {
                this.state.clonesLaunched = true;
                
                let currentTotalSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                let speedBoost = currentTotalSpeed * 1.3; 
                
                let baseAngle = Math.atan2(ball.dy, ball.dx);
                ball.dx = speedBoost * Math.cos(baseAngle);
                ball.dy = speedBoost * Math.sin(baseAngle);
                
                let angleOffsets = [25 * (Math.PI / 180), -25 * (Math.PI / 180)];
                
                for (let offset of angleOffsets) {
                    this.state.fakeBalls.push({
                        x: ball.x,
                        y: ball.y,
                        dx: speedBoost * Math.cos(baseAngle + offset),
                        dy: speedBoost * Math.sin(baseAngle + offset),
                        active: true
                    });
                }
            }

            // 3. تحديث الكرات المزيفة
            if (this.state.fakeBalls.length > 0) {
                let pY = canvas.height - (canvas.height * 0.05) - paddleHeight;
                
                for (let i = this.state.fakeBalls.length - 1; i >= 0; i--) {
                    let fBall = this.state.fakeBalls[i];
                    if (!fBall.active) continue;

                    fBall.x += fBall.dx * dt;
                    fBall.y += fBall.dy * dt;

                    if (fBall.x > canvas.width - ballRadius || fBall.x < ballRadius) fBall.dx = -fBall.dx;
                    if (fBall.y < ballRadius) fBall.dy = -fBall.dy;

                    let closestX = Math.max(paddleX, Math.min(fBall.x, paddleX + paddleWidth));
                    let closestY = Math.max(pY, Math.min(fBall.y, pY + paddleHeight));
                    if (((fBall.x - closestX) ** 2) + ((fBall.y - closestY) ** 2) < (ballRadius * ballRadius)) {
                        fBall.active = false; 
                        if (typeof playHitSound === "function") playHitSound();
                    }

                    if (fBall.y > canvas.height + ballRadius) {
                        fBall.active = false;
                    }
                }
            }
        },
        drawEffects: function(ctx, canvas, ctxData) {
            // رسم المنطقة المحظورة (ممنوع العبور)
            if (this.state.isBlockZoneActive) {
                let pY = canvas.height - (canvas.height * 0.05) - paddleHeight;
                
                ctx.save();
                // رسم مستطيل أحمر شبه شفاف
                ctx.fillStyle = "rgba(231, 76, 60, 0.4)";
                ctx.fillRect(this.state.blockZoneStartX, pY, this.state.blockZoneWidth, paddleHeight);
                
                // رسم حدود ليزرية للمنطقة
                ctx.strokeStyle = "#e74c3c";
                ctx.lineWidth = 2;
                ctx.shadowColor = "#e74c3c";
                ctx.shadowBlur = 10;
                ctx.strokeRect(this.state.blockZoneStartX, pY, this.state.blockZoneWidth, paddleHeight);
                
                // إضافة تأثير شعاع يمتد للأعلى ليكون مرئياً أكثر
                let gradient = ctx.createLinearGradient(0, pY, 0, pY - (canvas.height * 0.15));
                gradient.addColorStop(0, "rgba(231, 76, 60, 0.2)");
                gradient.addColorStop(1, "rgba(231, 76, 60, 0)");
                ctx.fillStyle = gradient;
                ctx.fillRect(this.state.blockZoneStartX, pY - (canvas.height * 0.15), this.state.blockZoneWidth, canvas.height * 0.15);
                ctx.restore();
            }

            // رسم الكرات المزيفة للاستنساخ
            if (this.state.fakeBalls && this.state.fakeBalls.length > 0) {
                for (let i = 0; i < this.state.fakeBalls.length; i++) {
                    let fBall = this.state.fakeBalls[i];
                    if (!fBall.active) continue;

                    ctx.beginPath();
                    ctx.arc(fBall.x, fBall.y, ctxData.ballRadius, 0, Math.PI * 2);
                    ctx.fillStyle = "#e74c3c"; 
                    ctx.fill();
                    ctx.closePath();
                    
                    if (this.state.isCloningActive) {
                        ctx.beginPath();
                        ctx.arc(fBall.x - (fBall.dx * 0.01), fBall.y - (fBall.dy * 0.01), ctxData.ballRadius * 0.8, 0, Math.PI * 2);
                        ctx.fillStyle = "rgba(46, 204, 113, 0.4)";
                        ctx.fill();
                        ctx.closePath();
                    }
                }
            }
        },
        overrideDrawBall: function(ball, ctx, ballRadius) {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI*2);
            ctx.fillStyle = "#e74c3c"; 
            ctx.fill();
            ctx.closePath();
            
            if (this.state.isCloningActive && this.state.clonesLaunched) {
                ctx.beginPath();
                ctx.arc(ball.x - (ball.dx * 0.01), ball.y - (ball.dy * 0.01), ballRadius * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(46, 204, 113, 0.4)";
                ctx.fill();
                ctx.closePath();
            }
        }
    },
    
   
    // -----------------------------------------------------
    // الزعيم الرابع: Crimson Fury (التقلص المميت + نبضة الغضب)
    // -----------------------------------------------------
    'The Facade': {
        createState: () => ({
            hitCounter: 0,
            
            // متغيرات المهارة الأساسية (التقلص)
            isShrinkActive: false,
            playerHits: 0,
            checkFakeHit: false,
            
            // متغيرات المهارة الثانوية (نبضة الغضب)
            secondaryUsageCount: 0,
            isFuryActive: false,
            furyTriggerY: 0,
            hasSurged: false // لمعرفة إذا تمت مضاعفة السرعة لتطبيق التأثير البصري
        }),
        onHit: function(ball, ctxData) {
            this.state.hitCounter++;
            
            // المهارة الثانوية: نبضة الغضب (تستهلك 1 بلازما وتحدث بعد 5 ضربات)
            if (this.state.hitCounter >= 5 && ctxData.gameState.enemyPlasma > 0 && this.state.secondaryUsageCount < 2 && !this.state.isShrinkActive) {
                ctxData.gameState.consumeEnemyPlasma(1);
                this.state.hitCounter = 0;
                this.state.secondaryUsageCount++;
                
                this.state.isFuryActive = true;
                this.state.hasSurged = false;
                this.state.furyTriggerY = ctxData.canvas.height / 2; // منتصف الشاشة
            }

            // المهارة الرئيسية: التقلص المميت
            if (ctxData.gameState.enemyPlasma === 3) {
                ctxData.gameState.incrementHitsAfterPlasma();
                if (ctxData.gameState.hitsAfterFullPlasma >= ctxData.gameState.hitsToActivate) {
                    ctxData.gameState.resetEnemyPlasma();
                    this.state.hitCounter = 0;
                    this.state.secondaryUsageCount = 0; // تصفير المهارة الثانوية
                    
                    this.state.isShrinkActive = true;
                    this.state.playerHits = 0;
                    this.state.checkFakeHit = false;
                    
                    ctxData.gameState.triggerCinematic(1700, "FATAL SHRINK");
                }
            }
        },
        onPlayerHit: function() {
            // تجاهل الحدث إذا كان ناتجاً عن إعادة تعيين الكرة بعد الهدف
            if (typeof champIsBallLaunched !== 'undefined' && !champIsBallLaunched) {
                this.state.isShrinkActive = false;
                this.state.playerHits = 0;
                this.state.checkFakeHit = false;
                this.state.isFuryActive = false;
                this.state.hasSurged = false;
                return;
            }
            
            if (this.state.isShrinkActive) {
                this.state.playerHits++;
                this.state.checkFakeHit = true; // التحقق من اختراق الكرة
            }

            // إيقاف التأثير البصري للنبضة بمجرد صدك للكرة
            if (this.state.hasSurged) {
                this.state.hasSurged = false;
            }
        },
        update: function(dt, ball, ctxData) {
            // إلغاء المهارات فوراً إذا توقف اللعب (تم تسجيل هدف)
            if (typeof champIsBallLaunched !== 'undefined' && !champIsBallLaunched) {
                this.state.isShrinkActive = false;
                this.state.playerHits = 0;
                this.state.checkFakeHit = false;
                this.state.isFuryActive = false;
                this.state.hasSurged = false;
            }

            // 1. تفعيل نبضة الغضب (تسريع الكرة بنسبة 100%) عندما تعبر خط المنتصف
            if (this.state.isFuryActive && ball.dy > 0 && ball.y >= this.state.furyTriggerY) {
                this.state.isFuryActive = false; // تفعيل لمرة واحدة فقط
                this.state.hasSurged = true; // لتشغيل التأثير البصري
                
                // مضاعفة السرعة
                ball.dx *= 2.0;
                ball.dy *= 2.0;

                // تشغيل صوت للفت انتباه اللاعب للتسارع المفاجئ
                if (typeof playHitSound === 'function') {
                    playHitSound(); 
                }
            }

            // 2. التحقق من "الضربة الوهمية" للمهارة الأساسية (التقلص)
            if (this.state.checkFakeHit && ball.lastHitter === 'player' && ball.dy < 0) {
                this.state.checkFakeHit = false; 
                
                let previousHits = this.state.playerHits - 1;
                let shrinkFactor = 1.0;
                if (previousHits === 1) shrinkFactor = 0.75;
                else if (previousHits === 2) shrinkFactor = 0.50;
                else if (previousHits === 3) shrinkFactor = 0.25;
                else if (previousHits >= 4) shrinkFactor = 0.0;
                
                let originalWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
                let activeWidth = originalWidth * shrinkFactor;
                let activeLeft = typeof paddleX !== 'undefined' ? paddleX + (originalWidth - activeWidth) / 2 : 0;
                let activeRight = activeLeft + activeWidth;
                
                if (ball.x < activeLeft || ball.x > activeRight) {
                    ball.dy = Math.abs(ball.dy); 
                    let pY = ctxData.canvas.height - (ctxData.canvas.height * 0.05) - (typeof paddleHeight !== 'undefined' ? paddleHeight : 18);
                    ball.y = pY + 10; 
                    ball.lastHitter = null;
                    
                    this.state.playerHits--; 
                }
            }
        },
        drawEffects: function(ctx, canvas, ctxData) {
            // رسم خط تحذيري للمهارة الثانوية قبل تفعيلها
            if (this.state.isFuryActive) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(0, this.state.furyTriggerY);
                ctx.lineTo(canvas.width, this.state.furyTriggerY);
                ctx.strokeStyle = "rgba(231, 76, 60, 0.4)";
                ctx.lineWidth = 2;
                ctx.setLineDash([15, 15]);
                ctx.stroke();
                
                ctx.fillStyle = "rgba(231, 76, 60, 0.6)";
                ctx.font = "bold 14px 'Segoe UI', Arial";
                ctx.textAlign = "center";
                ctx.fillText("FURY LINE", canvas.width / 2, this.state.furyTriggerY - 5);
                ctx.restore();
            }

            // رسم تأثير المهارة الأساسية (التقلص)
            if (this.state.isShrinkActive && typeof paddleWidth !== 'undefined') {
                let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
                let pY = canvas.height - (canvas.height * 0.05) - pH;
                
                let shrinkFactor = 1.0;
                if (this.state.playerHits === 1) shrinkFactor = 0.75;
                else if (this.state.playerHits === 2) shrinkFactor = 0.50;
                else if (this.state.playerHits === 3) shrinkFactor = 0.25;
                else if (this.state.playerHits >= 4) shrinkFactor = 0.0;
                
                let activeWidth = paddleWidth * shrinkFactor;
                let erasedWidth = (paddleWidth - activeWidth) / 2;
                
                if (erasedWidth > 0) {
                    ctx.clearRect(paddleX - 1, pY - 1, erasedWidth + 1, pH + 2);
                    ctx.clearRect(paddleX + activeWidth + erasedWidth - 1, pY - 1, erasedWidth + 2, pH + 2);
                    
                    if (ctxData && ctxData.balls) {
                        for (let i = 0; i < ctxData.balls.length; i++) {
                            this.overrideDrawBall(ctxData.balls[i], ctx, ctxData.ballRadius);
                        }
                    }
                }
                
                if (activeWidth > 0) {
                    let activeLeft = paddleX + erasedWidth;
                    ctx.save();
                    ctx.strokeStyle = "#E74C3C"; 
                    ctx.lineWidth = 3 + Math.sin(performance.now() / 100) * 2; 
                    ctx.shadowColor = "#E74C3C";
                    ctx.shadowBlur = 15;
                    ctx.strokeRect(activeLeft, pY, activeWidth, pH);
                    
                    let hitsLeft = Math.max(0, 4 - this.state.playerHits);
                    ctx.fillStyle = "#E74C3C";
                    ctx.font = "bold 16px 'Segoe UI', Arial";
                    ctx.textAlign = "center";
                    ctx.shadowBlur = 0;
                    ctx.fillText(hitsLeft, activeLeft + (activeWidth / 2), pY - 10);
                    ctx.restore();
                } else {
                    ctx.save();
                    ctx.fillStyle = "#E74C3C";
                    ctx.font = "bold 16px 'Segoe UI', Arial";
                    ctx.textAlign = "center";
                    ctx.fillText("0", paddleX + (paddleWidth / 2), pY - 10);
                    ctx.restore();
                }
            }
        },
        overrideDrawBall: function(ball, ctx, ballRadius) {
            // تأثير بصري للكرة عند تفعيل مهارة نبضة الغضب (ذيل ناري ووميض)
            if (this.state.hasSurged && ball.dy > 0) {
                ctx.save();
                let trailLen = 40;
                let grad = ctx.createLinearGradient(ball.x, ball.y, ball.x - (ball.dx * 0.05), ball.y - (ball.dy * 0.05));
                grad.addColorStop(0, "rgba(255, 50, 50, 1)");
                grad.addColorStop(1, "rgba(255, 50, 50, 0)");
                
                ctx.beginPath();
                ctx.moveTo(ball.x - ballRadius, ball.y);
                ctx.lineTo(ball.x - (ball.dx * 0.05), ball.y - (ball.dy * 0.05));
                ctx.lineTo(ball.x + ballRadius, ball.y);
                ctx.fillStyle = grad;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(ball.x, ball.y, ballRadius * 1.3, 0, Math.PI * 2);
                ctx.fillStyle = "#FFFFFF";
                ctx.shadowColor = "#FF0000";
                ctx.shadowBlur = 20;
                ctx.fill();
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI*2);
                ctx.fillStyle = "#E74C3C"; 
                ctx.fill();
                ctx.closePath();
            }
        }
    },
    // -----------------------------------------------------
    // الزعيم الخامس: Ember Lord (مهارة التبديل البعدي - Swap)

    // -----------------------------------------------------
    // الزعيم الخامس: Ember Lord (التبديل البعدي + سرقة المهارات)
    // -----------------------------------------------------
    'The Ray': {
        createState: () => ({
            hitCounter: 0,
            
            // متغيرات المهارة الأساسية: التبديل البعدي (Dimensional Swap)
            isSwapActive: false,
            bossVisualX: 0,
            
            // متغيرات المهارة الثانوية: عكس الأماكن وسرقة المهارة (Skill Hijack)
            secondaryUsageCount: 0,
            isCounterSwapActive: false
        }),
        onHit: function(ball, ctxData) {
            this.state.hitCounter++;
            
            // المهارة الأساسية: التبديل البعدي
            if (ctxData.gameState.enemyPlasma === 3 && !this.state.isCounterSwapActive) {
                ctxData.gameState.incrementHitsAfterPlasma();
                if (ctxData.gameState.hitsAfterFullPlasma >= ctxData.gameState.hitsToActivate) {
                    ctxData.gameState.resetEnemyPlasma();
                    this.state.hitCounter = 0;
                    
                    // تصفير عداد المهارة الثانوية ليتمكن من استخدامها مرتين مجدداً
                    this.state.secondaryUsageCount = 0; 
                    
                    this.state.isSwapActive = true;
                    this.state.bossVisualX = ctxData.canvas.width / 2;
                    ctxData.gameState.triggerCinematic(1700, "DIMENSIONAL SWAP");
                }
            }
        },
        onPlayerHit: function() {
            // إنهاء التأثيرات فوراً إذا تم تسجيل هدف (توقف اللعب)
            if (typeof champIsBallLaunched !== 'undefined' && !champIsBallLaunched) {
                this.state.isSwapActive = false;
                this.state.isCounterSwapActive = false;
            }
        },
        update: function(dt, ball, ctxData) {
            if (typeof champIsBallLaunched !== 'undefined' && !champIsBallLaunched) {
                this.state.isSwapActive = false;
                this.state.isCounterSwapActive = false;
                return;
            }

            // 1. التحقق مما إذا كان اللاعب قد فعل إحدى مهاراته (الأساسية أو الثانوية)
            let pSkill1 = typeof equippedPrimary !== 'undefined' && equippedPrimary ? PlayerSkillRegistry[equippedPrimary] : null;
            let pSkill2 = typeof equippedSecondary !== 'undefined' && equippedSecondary ? PlayerSkillRegistry[equippedSecondary] : null;
            
            let isPlayerSkillActive = false;
            if (pSkill1 && (pSkill1.state.isActive || pSkill1.state.isPending)) isPlayerSkillActive = true;
            if (pSkill2 && (pSkill2.state.isActive || pSkill2.state.isPending)) isPlayerSkillActive = true;

            // 2. تفعيل المهارة الثانوية (عكس الأماكن وسرقة المهارة)
            // الشروط: مهارة اللاعب مفعلة + يوجد 1 بلازما + لم تُستخدم مرتين متتاليتين + غير مفعلة حالياً
            if (isPlayerSkillActive && typeof champEnemyPlasmaCharges !== 'undefined' && champEnemyPlasmaCharges >= 1 && this.state.secondaryUsageCount < 2 && !this.state.isCounterSwapActive && !this.state.isSwapActive) {
                ctxData.gameState.consumeEnemyPlasma(1); // استهلاك 1 بلازما
                this.state.secondaryUsageCount++;
                this.state.isCounterSwapActive = true;
                
                // مشهد سينمائي سريع يوضح سرقة المهارة
                ctxData.gameState.triggerCinematic(1500, "SKILL HIJACKED!");
            }

            // 3. إنهاء مفعول السرقة إذا انتهت مهارة اللاعب
            if (!isPlayerSkillActive && this.state.isCounterSwapActive) {
                this.state.isCounterSwapActive = false;
            }

            // 4. تنفيذ ميكانيكا السرقة وعكس الأماكن (المهارة الثانوية)
            if (this.state.isCounterSwapActive) {
                // الزعيم يستحوذ على مكانك في الأسفل (مكان تأثير مهاراتك) 
                // وأنت تُنقل للأعلى. لن تستفيد من مهاراتك لأن الزعيم هو من يتحكم في مضربك الأصلي!
                
                // أ- إذا لمست الكرة مضربك في الأسفل، نحوّلها لضربة مملوكة للزعيم (ليأخذ هو تأثير مهاراتك)!
                if (ball.lastHitter === 'player' && ball.dy < 0 && ball.y > ctxData.canvas.height / 2) {
                    ball.lastHitter = 'enemy'; 
                }
                
                // ب- إذا ضربت الكرة المضرب العلوي (حيث نُقلت أنت)، تحسب لك (لكن بدون مهاراتك لأنها في الأسفل)
                if (ball.lastHitter === 'enemy' && ball.dy > 0 && ball.y < ctxData.canvas.height / 2) {
                    ball.lastHitter = 'player';
                }
            }

            // 5. ميكانيكا المهارة الأساسية (التبديل البعدي العادي)
            if (this.state.isSwapActive) {
                let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
                let dodgeX = ball.x > ctxData.canvas.width / 2 ? 10 : ctxData.canvas.width - pWidth - 10;
                this.state.bossVisualX += (dodgeX - this.state.bossVisualX) * 0.15; 

                let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
                let pY = ctxData.canvas.height - (ctxData.canvas.height * 0.05) - pH;
                
                if (ball.lastHitter === 'player' && ball.dy < 0 && ball.y >= pY - ctxData.ballRadius - 20) {
                    ball.dy = Math.abs(ball.dy); 
                    ball.y = pY + pH + 10; 
                    ball.lastHitter = 'enemy'; 
                }
            }
        },
        drawEffects: function(ctx, canvas, ctxData) {
            let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
            let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
            let pY = canvas.height - (canvas.height * 0.05) - pH;
            let eY = canvas.height * 0.05;

            // دمج التأثير البصري لعكس الأماكن للمهارتين
            if (this.state.isCounterSwapActive || this.state.isSwapActive) {
                
                // إخفاء المضارب الأصلية من أماكنها
                ctx.fillStyle = "#081A33";
                ctx.fillRect(paddleX - 2, pY - 2, pWidth + 4, pH + 4);
                ctx.fillRect(champEnemyPaddleX - 2, eY - 2, pWidth + 4, pH + 4);

                if (ctxData && ctxData.balls) {
                    for (let i = 0; i < ctxData.balls.length; i++) {
                        this.overrideDrawBall(ctxData.balls[i], ctx, ctxData.ballRadius);
                    }
                }

                // رسم مضرب اللاعب في الأعلى مقلوباً
                if (typeof playerPaddleImg !== 'undefined' && playerPaddleImg.complete) {
                    let pVW = 30, pVH = 25;
                    ctx.save();
                    ctx.translate(paddleX + pWidth / 2, eY + pH / 2);
                    ctx.scale(1, -1); 
                    ctx.drawImage(playerPaddleImg, -(pWidth + pVW) / 2, -(pH + pVH) / 2, pWidth + pVW, pH + pVH);
                    ctx.restore();
                } else {
                    ctx.fillStyle = "#ecf0f1";
                    ctx.fillRect(paddleX, eY, pWidth, pH);
                }

                // رسم مضرب الزعيم في الأسفل (يحتل مكان اللاعب)
                let bossIdx = level / 8;
                let bossImg = typeof bossImages !== 'undefined' ? bossImages[bossIdx] : null;
                
                // في حالة السرقة، الزعيم يلتصق بموقع اللاعب (paddleX) ليأخذ تأثير مهارته البصري!
                let bossCurrentX = this.state.isCounterSwapActive ? paddleX : this.state.bossVisualX;
                
                if (bossImg && bossImg.complete) {
                    let bVW = 30, bVH = 30;
                    ctx.drawImage(bossImg, bossCurrentX - (bVW / 2), pY - (bVH / 2), pWidth + bVW, pH + bVH);
                } else {
                    ctx.fillStyle = "#F39C12"; 
                    ctx.fillRect(bossCurrentX, pY, pWidth, pH);
                }

                // تأثير بصري يملأ الشاشة (أرجواني للسرقة، برتقالي للتبديل الأساسي)
                ctx.save();
                ctx.fillStyle = this.state.isCounterSwapActive ? "rgba(157, 80, 187, 0.15)" : "rgba(243, 156, 18, 0.1)";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                ctx.fillStyle = this.state.isCounterSwapActive ? "rgba(157, 80, 187, 0.6)" : "rgba(243, 156, 18, 0.5)";
                ctx.font = "bold " + Math.max(30, canvas.width * 0.08) + "px 'Segoe UI', Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.shadowColor = this.state.isCounterSwapActive ? "#9D50BB" : "#F39C12";
                ctx.shadowBlur = 20;
                
                let text = this.state.isCounterSwapActive ? "SKILL HIJACKED!" : "SWAPPED!";
                ctx.fillText(text, canvas.width / 2, canvas.height / 2);
                ctx.restore();
            }
        },
        overrideDrawBall: function(ball, ctx, ballRadius) {
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI*2);
            // تغيير لون الكرة إلى الأرجواني الداكن لتمييز حالة سرقة المهارة
            ctx.fillStyle = this.state.isCounterSwapActive ? "#9D50BB" : "#e74c3c"; 
            ctx.fill();
            ctx.closePath();
        }
    },
    // الزعيم السادس: Steel Colossus (مسح المسافة + عجلة الحظ)
    // -----------------------------------------------------
    'Head Y': {
        createState: () => ({
            hitCounter: 0,
            
            // متغيرات مهارة مسح المسافة
            isEraseActive: false,
            skillPhase: 'idle', // الحالات: idle, cinematic, flash1, delay, flash2
            phaseTimer: 0,
            startX: 0, startY: 0,
            targetX: 0, targetY: 0,
            storedSpeed: 0,
            ballRef: null,
            
            // متغيرات عجلة الحظ
            lastPlayerScore: 0,
            rouletteActive: false,
            rouletteStartTime: 0,
            rouletteDuration: 3500,
            rouletteWinner: '',
            targetDetermined: false
        }),
        onHit: function(ball, ctxData) {
            this.state.hitCounter++;
            
            // المهارة الرئيسية: مسح المسافة
            if (ctxData.gameState.enemyPlasma === 3) {
                ctxData.gameState.incrementHitsAfterPlasma();
                if (ctxData.gameState.hitsAfterFullPlasma >= ctxData.gameState.hitsToActivate) {
                    ctxData.gameState.resetEnemyPlasma();
                    this.state.hitCounter = 0;
                    
                    this.state.isEraseActive = true;
                    this.state.skillPhase = 'cinematic';
                    
                    // حفظ موقع الكرة الأصلي وسرعتها
                    this.state.startX = ball.x;
                    this.state.startY = ball.y;
                    this.state.ballRef = ball;
                    let totalSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                    this.state.storedSpeed = totalSpeed;
                    
                    // الإصلاح: وضع الكرة في منتصف الشاشة وتجميدها حتى لا تحتسب هدفاً بالخطأ
                    ball.x = ctxData.canvas.width / 2;
                    ball.y = ctxData.canvas.height / 2;
                    ball.dx = 0;
                    ball.dy = 0;
                    
                    // تشغيل التأثير السينمائي
                    ctxData.gameState.triggerCinematic(1700, "DISTANCE ERASE");
                }
            }
        },
        onPlayerHit: function() {
            this.state.isEraseActive = false;
            this.state.skillPhase = 'idle';
        },
        update: function(dt, ball, ctxData) {
            // إلغاء المهارة إذا توقف اللعب (مثل دخول هدف طبيعي)
            if (typeof champIsBallLaunched !== 'undefined' && !champIsBallLaunched) {
                this.state.isEraseActive = false;
                this.state.skillPhase = 'idle';
            }

            // إدارة مراحل مهارة مسح المسافة بتوقيت دقيق
            if (this.state.isEraseActive && this.state.ballRef) {
                let now = performance.now();
                
                // 1. بعد انتهاء الشاشة السينمائية، يبدأ الفلاش الأول
                if (this.state.skillPhase === 'cinematic' && typeof champCinematicPause !== 'undefined' && !champCinematicPause) {
                    this.state.skillPhase = 'flash1';
                    this.state.phaseTimer = now;
                }
                // 2. الفلاش الأول يستمر لـ 150 ملي ثانية، ثم تبدأ فترة التأخير (الكرة مختفية)
                else if (this.state.skillPhase === 'flash1' && (now - this.state.phaseTimer) >= 150) {
                    this.state.skillPhase = 'delay';
                    this.state.phaseTimer = now;
                }
                // 3. فترة التأخير تستمر 0.4 ثانية (400 ملي ثانية)، ثم يبدأ الفلاش الثاني
                else if (this.state.skillPhase === 'delay' && (now - this.state.phaseTimer) >= 400) {
                    this.state.skillPhase = 'flash2';
                    this.state.phaseTimer = now;
                    
                    // حساب مكان الفلاش الثاني (والكرة) في أبعد نقطة عن اللاعب
                    let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
                    let pCenter = typeof paddleX !== 'undefined' ? paddleX + (pWidth / 2) : ctxData.canvas.width / 2;
                    
                    let targetX = (pCenter < ctxData.canvas.width / 2) 
                        ? ctxData.canvas.width - ctxData.ballRadius - 20 // أقصى اليمين
                        : ctxData.ballRadius + 20; // أقصى اليسار
                        
                    let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
                    let pY = ctxData.canvas.height - (ctxData.canvas.height * 0.05) - pH;
                    let targetY = pY - ctxData.ballRadius - 5; // فوق خط مضرب اللاعب مباشرة
                    
                    this.state.targetX = targetX;
                    this.state.targetY = targetY;
                }
                // 4. الفلاش الثاني يستمر لـ 150 ملي ثانية، وبمجرد اختفائه تظهر الكرة وتسقط!
                else if (this.state.skillPhase === 'flash2' && (now - this.state.phaseTimer) >= 150) {
                    this.state.skillPhase = 'idle';
                    this.state.isEraseActive = false;
                    
                    // ظهور الكرة وانطلاقها للأسفل
                    this.state.ballRef.x = this.state.targetX;
                    this.state.ballRef.y = this.state.targetY;
                    this.state.ballRef.dx = 0;
                    this.state.ballRef.dy = this.state.storedSpeed;
                }
            }

            // --- المهارة الجانبية: عجلة الحظ ---
            if (typeof champPlayerScore !== 'undefined' && champPlayerScore > this.state.lastPlayerScore) {
                if (typeof champEnemyPlasmaCharges !== 'undefined' && champEnemyPlasmaCharges >= 1 && champPlayerScore > 0) {
                    champEnemyPlasmaCharges--;
                    if (typeof updateChampUI === 'function') updateChampUI();
                    
                    this.state.rouletteActive = true;
                    this.state.rouletteStartTime = performance.now();
                    this.state.targetDetermined = false;
                    this.state.rouletteWinner = Math.random() > 0.5 ? 'enemy' : 'player';
                    
                    if (typeof champCinematicPause !== 'undefined') {
                        champCinematicPause = true;
                        champCinematicEndTime = performance.now() + this.state.rouletteDuration;
                        champCinematicText = ""; 
                    }
                }
                this.state.lastPlayerScore = champPlayerScore;
            }
            
            if (typeof champPlayerScore !== 'undefined' && champPlayerScore === 0) {
                this.state.lastPlayerScore = 0;
            }
            
            if (this.state.rouletteActive) {
                let elapsed = performance.now() - this.state.rouletteStartTime;
                if (elapsed >= this.state.rouletteDuration && !this.state.targetDetermined) {
                    this.state.targetDetermined = true;
                    this.state.rouletteActive = false;
                    
                    if (this.state.rouletteWinner === 'enemy' && typeof champPlayerScore !== 'undefined' && champPlayerScore > 0) {
                        champPlayerScore--;
                        this.state.lastPlayerScore = champPlayerScore; 
                        if (typeof updateChampUI === 'function') updateChampUI();
                    }
                }
            }
        },
        drawEffects: function(ctx, canvas, ctxData) {
            // 1. رسم تأثير الفلاش لمسح المسافة
            if (this.state.isEraseActive && (this.state.skillPhase === 'flash1' || this.state.skillPhase === 'flash2')) {
                ctx.save();
                let maxRad = canvas.width * 0.15;
                
                // حساب تلاشي الفلاش بناءً على الوقت (يصغر ويختفي)
                let progress = Math.min((performance.now() - this.state.phaseTimer) / 150, 1);
                let currentRad = maxRad * (1 - progress);
                
                let drawFlash = (x, y) => {
                    if (currentRad <= 0) return;
                    let grad = ctx.createRadialGradient(x, y, 0, x, y, currentRad);
                    grad.addColorStop(0, "rgba(255, 255, 255, 1)");
                    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(x, y, currentRad, 0, Math.PI*2);
                    ctx.fill();
                };

                if (this.state.skillPhase === 'flash1') {
                    drawFlash(this.state.startX, this.state.startY);
                } else if (this.state.skillPhase === 'flash2') {
                    drawFlash(this.state.targetX, this.state.targetY);
                }
                
                ctx.restore();
            }
            
            // 2. رسم تأثير عجلة الحظ
            if (this.state.rouletteActive) {
                let elapsed = performance.now() - this.state.rouletteStartTime;
                let progress = Math.min(elapsed / (this.state.rouletteDuration - 500), 1.0); 
                let easeOut = 1 - Math.pow(1 - progress, 3); 
                
                let targetAngle = (this.state.rouletteWinner === 'enemy') ? Math.PI : 0;
                let currentAngle = (targetAngle + Math.PI * 2 * 8) * easeOut; 
                
                let cx = canvas.width / 2;
                let cy = canvas.height / 2;
                let radius = Math.min(canvas.width, canvas.height) * 0.25;
                
                ctx.save();
                
                ctx.shadowColor = "rgba(0,0,0,0.8)";
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.arc(cx, cy, radius + 5, 0, Math.PI*2);
                ctx.fillStyle = "#222";
                ctx.fill();
                ctx.shadowBlur = 0;
                
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, radius, currentAngle, currentAngle + Math.PI);
                ctx.fillStyle = "#BDC3C7"; 
                ctx.fill();
                
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, radius, currentAngle + Math.PI, currentAngle + Math.PI * 2);
                ctx.fillStyle = "#00AEEF"; 
                ctx.fill();
                
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(currentAngle + Math.PI/2);
                ctx.fillStyle = "#000";
                ctx.font = "bold " + (radius*0.3) + "px Arial";
                ctx.textAlign = "center";
                ctx.fillText("BOSS", 0, -radius*0.5);
                ctx.restore();
                
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(currentAngle + Math.PI*1.5);
                ctx.fillStyle = "#FFF";
                ctx.font = "bold " + (radius*0.3) + "px Arial";
                ctx.textAlign = "center";
                ctx.fillText("PLAYER", 0, -radius*0.5);
                ctx.restore();
                
                ctx.fillStyle = "#E74C3C";
                ctx.beginPath();
                ctx.moveTo(cx, cy - radius - 15);
                ctx.lineTo(cx - 15, cy - radius - 35);
                ctx.lineTo(cx + 15, cy - radius - 35);
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(cx, cy, radius * 0.1, 0, Math.PI*2);
                ctx.fillStyle = "#FFF";
                ctx.fill();
                
                if (progress >= 1.0) {
                    ctx.fillStyle = (this.state.rouletteWinner === 'enemy') ? "#BDC3C7" : "#00AEEF";
                    ctx.font = "bold " + (radius*0.4) + "px 'Segoe UI'";
                    ctx.textAlign = "center";
                    let msg = (this.state.rouletteWinner === 'enemy') ? "GOAL CANCELLED!" : "SAFE!";
                    ctx.fillText(msg, cx, cy + radius + 40);
                } else {
                    ctx.fillStyle = "#FFF";
                    ctx.font = "bold " + (radius*0.3) + "px 'Segoe UI'";
                    ctx.textAlign = "center";
                    ctx.fillText("WHEEL OF FATE", cx, cy + radius + 40);
                }
                
                ctx.restore();
            }
        },
        overrideDrawBall: function(ball, ctx, ballRadius) {
            // إخفاء الكرة بالكامل طالما أن المهارة فعالة
            if (this.state.isEraseActive && this.state.skillPhase !== 'idle') return;
            
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI*2);
            ctx.fillStyle = "#e74c3c"; 
            ctx.fill();
            ctx.closePath();
        }
    },
    
    // الزعيم السابع (الأخير): Abyss Weaver 
    // (مهارة الشهاب الساقط + الثقب الأسود) - النسخة النهائية
    // -----------------------------------------------------
    'Black Hole': {
        createState: () => ({
            hitCounter: 0,
            
            // متغيرات الثقب الأسود
            secondaryUsageCount: 0,
            isBlackHoleActive: false,
            blackHoleEndTime: 0,
            bossFixedX: 0,
            
            // متغيرات الشهاب الساقط
            isMeteorActive: false,
            meteorLaunched: false,
            paddleBroken: false,
            meteorStartX: 0 
        }),
        
        onHit: function(ball, ctxData) {
            this.state.hitCounter++;
            let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;

            // المهارة الثانوية: الثقب الأسود 
            if (this.state.hitCounter >= 5 && typeof champEnemyPlasmaCharges !== 'undefined' && champEnemyPlasmaCharges > 0 && this.state.secondaryUsageCount < 2 && !this.state.isBlackHoleActive && !this.state.isMeteorActive) {
                ctxData.gameState.consumeEnemyPlasma(1);
                this.state.hitCounter = 0;
                this.state.secondaryUsageCount++;
                
                this.state.isBlackHoleActive = true;
                this.state.blackHoleEndTime = performance.now() + 6000;
                
                this.state.bossFixedX = typeof champEnemyPaddleX !== 'undefined' ? champEnemyPaddleX : ctxData.canvas.width / 2;
            }
            
            // المهارة الرئيسية: الشهاب الساقط
            if (ctxData.gameState.enemyPlasma === 3) {
                // الشرط 1: لا يستطيع تفعيل المهارة الرئيسية إذا كان الثقب الأسود مفعلاً
                if (!this.state.isBlackHoleActive) {
                    ctxData.gameState.incrementHitsAfterPlasma();
                    if (ctxData.gameState.hitsAfterFullPlasma >= ctxData.gameState.hitsToActivate) {
                        ctxData.gameState.resetEnemyPlasma();
                        this.state.hitCounter = 0;
                        this.state.secondaryUsageCount = 0; 
                        
                        this.state.isMeteorActive = true;
                        this.state.meteorLaunched = false;
                        this.state.paddleBroken = false;
                        
                        this.state.meteorStartX = (typeof champEnemyPaddleX !== 'undefined' ? champEnemyPaddleX : ctxData.canvas.width / 2) + pWidth / 2;
                        
                        ctxData.gameState.triggerCinematic(1700, "FALLING METEOR");
                    }
                }
            }
        },
        
        onPlayerHit: function() {
            // إعادة تعيين المهارة فور توقف اللعب 
            if (typeof champIsBallLaunched !== 'undefined' && !champIsBallLaunched) {
                this.state.isMeteorActive = false;
                this.state.meteorLaunched = false;
                this.state.paddleBroken = false;
            }
        },
        
        update: function(dt, ball, ctxData) {
            // الشرط 2: إلغاء التأثيرات فوراً عند تسجيل الهدف
            if (typeof champIsBallLaunched !== 'undefined' && !champIsBallLaunched) {
                this.state.isMeteorActive = false;
                this.state.isBlackHoleActive = false;
                this.state.paddleBroken = false; 
                this.state.meteorLaunched = false;
                return;
            }

            let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
            let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
            let eY = ctxData.canvas.height * 0.05;
            let pY = ctxData.canvas.height - (ctxData.canvas.height * 0.05) - pH;

            // --- 1. منطق الشهاب الساقط ---
            if (this.state.isMeteorActive) {
                if (typeof champCinematicPause !== 'undefined' && champCinematicPause) {
                    ball.x = this.state.meteorStartX;
                    ball.y = eY + pH + ctxData.ballRadius + 10;
                    ball.dx = 0;
                    ball.dy = 0;
                } else if (!this.state.meteorLaunched) {
                    this.state.meteorLaunched = true;
                    ball.dx = 0;
                    ball.dy = 2200; 
                } else {
                    // التحقق مما إذا كانت الكرة قد اصطدمت بالمضرب قبل أن نُجبر اتجاهها للأسفل
                    let hasBounced = (ball.lastHitter === 'player');
                    
                    // الإجبار الدائم على النزول بشكل مستقيم
                    ball.dx = 0;
                    ball.dy = 2200; 

                    // الشرط 3: إذا لمست المضرب، يتم الكسر والاختراق المباشر دون تزحزح
                    if (hasBounced && !this.state.paddleBroken) {
                        ball.y = pY + pH + ctxData.ballRadius + 10; // تجاوز المضرب تماماً ووضعها في الأسفل
                        ball.lastHitter = 'enemy'; 
                        
                        this.state.paddleBroken = true; 
                        
                        if (typeof playHitSound === 'function') {
                            playHitSound(); 
                            setTimeout(playHitSound, 50); // صوت كسر إضافي
                        }
                    }
                }
            }

            // --- 2. منطق الثقب الأسود ---
            if (this.state.isBlackHoleActive) {
                if (performance.now() > this.state.blackHoleEndTime) {
                    this.state.isBlackHoleActive = false;
                } else {
                    if (typeof champEnemyPaddleX !== 'undefined') {
                        champEnemyPaddleX = this.state.bossFixedX;
                    }

                    let bossCenterX = this.state.bossFixedX + pWidth / 2;
                    let bossCenterY = eY + pH / 2;

                    if (ball.lastHitter === 'player') {
                        let dx = bossCenterX - ball.x;
                        let dy = bossCenterY - ball.y;
                        let dist = Math.sqrt(dx * dx + dy * dy);

                        let currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                        let dirX = dx / dist;
                        let dirY = dy / dist;
                        
                        let turnSpeed = 8 * dt; 
                        ball.dx = ball.dx * (1 - turnSpeed) + (dirX * currentSpeed) * turnSpeed;
                        ball.dy = ball.dy * (1 - turnSpeed) + (dirY * currentSpeed) * turnSpeed;

                        if (ball.y < bossCenterY + 150) {
                            ball.x += (bossCenterX - ball.x) * 15 * dt;
                        }
                    }

                    if (typeof champPlasmaBalls !== 'undefined') {
                        for (let i = champPlasmaBalls.length - 1; i >= 0; i--) {
                            let p = champPlasmaBalls[i];
                            let pdx = bossCenterX - p.x;
                            let pdy = bossCenterY - p.y;
                            let pdist = Math.sqrt(pdx * pdx + pdy * pdy);

                            if (pdist < pWidth / 2) {
                                champPlasmaBalls.splice(i, 1);
                                if (typeof champEnemyPlasmaCharges !== 'undefined' && champEnemyPlasmaCharges < 3) {
                                    champEnemyPlasmaCharges++;
                                    if (typeof updateChampUI === 'function') updateChampUI();
                                }
                            } else {
                                let pForce = 800; 
                                p.x += (pdx / pdist) * pForce * dt;
                                p.y += (pdy / pdist) * pForce * dt;
                            }
                        }
                    }
                }
            }
        },
        
        drawEffects: function(ctx, canvas, ctxData) {
            let pWidth = typeof paddleWidth !== 'undefined' ? paddleWidth : 100;
            let pH = typeof paddleHeight !== 'undefined' ? paddleHeight : 18;
            let eY = canvas.height * 0.05;
            let pY = canvas.height - (canvas.height * 0.05) - pH;
            
            if (this.state.isBlackHoleActive) {
                let bossCenterX = this.state.bossFixedX + pWidth / 2;
                let bossCenterY = eY + pH / 2;
                let time = performance.now();
                
                ctx.save();
                ctx.translate(bossCenterX, bossCenterY);
                ctx.rotate(time / 200); 

                let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, pWidth);
                grad.addColorStop(0, "rgba(0, 0, 0, 1)");
                grad.addColorStop(0.3, "rgba(100, 0, 200, 0.8)"); 
                grad.addColorStop(1, "rgba(0, 0, 0, 0)");
                
                ctx.beginPath();
                ctx.arc(0, 0, pWidth, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();

                ctx.strokeStyle = "#9D50BB";
                ctx.lineWidth = 2;
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    let radius = pWidth * 0.5 + Math.sin(time / 200 + i) * 15;
                    ctx.arc(0, 0, radius, (Math.PI / 2) * i, (Math.PI / 2) * (i + 1));
                    ctx.stroke();
                }
                ctx.restore();
            }

            if (this.state.paddleBroken) {
                let pX = typeof paddleX !== 'undefined' ? paddleX : 0;
                
                ctx.fillStyle = "#081A33";
                ctx.fillRect(pX - 2, pY - 2, pWidth + 4, pH + 4);

                ctx.fillStyle = "#E74C3C"; 
                
                ctx.save();
                ctx.translate(pX + pWidth / 4, pY + pH / 2);
                ctx.rotate(-0.3); 
                ctx.fillRect(-pWidth / 4, -pH / 2, pWidth / 2 - 2, pH);
                ctx.restore();

                ctx.save();
                ctx.translate(pX + 3 * pWidth / 4, pY + pH / 2);
                ctx.rotate(0.3); 
                ctx.fillRect(-pWidth / 4 + 2, -pH / 2, pWidth / 2, pH);
                ctx.restore();
                
                ctx.fillStyle = "#F39C12";
                for (let i = 0; i < 6; i++) {
                    ctx.beginPath();
                    ctx.arc(pX + pWidth / 2 + (Math.random() - 0.5) * 40, pY + (Math.random() - 0.5) * 20, Math.random() * 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        },
        
        overrideDrawBall: function(ball, ctx, ballRadius) {
            // الشرط 2 (تكملة): إخفاء تأثيرات الشهاب الناري فور تسجيل الهدف
            if (typeof champIsBallLaunched !== 'undefined' && !champIsBallLaunched) {
                this.state.isMeteorActive = false;
                this.state.paddleBroken = false;
            }

            if (this.state.isMeteorActive) {
                ctx.save();
                let trailLen = 60;
                let grad = ctx.createLinearGradient(ball.x, ball.y, ball.x, ball.y - trailLen);
                grad.addColorStop(0, "rgba(255, 100, 0, 1)");
                grad.addColorStop(1, "rgba(255, 0, 0, 0)");
                
                ctx.beginPath();
                ctx.moveTo(ball.x - ballRadius, ball.y);
                ctx.lineTo(ball.x, ball.y - trailLen);
                ctx.lineTo(ball.x + ballRadius, ball.y);
                ctx.fillStyle = grad;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(ball.x, ball.y, ballRadius * 1.3, 0, Math.PI * 2);
                ctx.fillStyle = "#FFFFFF";
                ctx.shadowColor = "#FF4500";
                ctx.shadowBlur = 25;
                ctx.fill();
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
                ctx.fillStyle = "#e74c3c"; 
                ctx.fill();
                ctx.closePath();
            }
        }
    },         
    
};