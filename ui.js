// ==========================================
// 1. المتغيرات الخاصة بواجهة المستخدم والقوائم
// ==========================================
const mainMenu = document.getElementById('mainMenu');
const settingsMenu = document.getElementById('settingsMenu');
const gameOverMenu = document.getElementById('gameOverMenu'); 
const finalScoreText = document.getElementById('finalScore'); 
const levelSelectMenu = document.getElementById('levelSelectMenu');
const equipMenu = document.getElementById('equipMenu');

// أضف هذه الدالة الجديدة للتحكم في ظهور القائمة

let sensitivityMultiplier = 2.0; 
let maxUnlockedLevel = parseInt(localStorage.getItem('maxUnlockedLevel')) || 1;
let savedStars = JSON.parse(localStorage.getItem('levelStars')) || {};
let isChampionMode = false; 
let isPlaying = false;
let animationId;
let level = 1;
let score = 0;
let lastTime = 0;


    // ==========================================


// إدارة قوائم الشراء والتجهيز (Shop & Loadout)
// ==========================================
let currentEquipView = 'shop'; // 'shop' أو 'loadout'
let isSecondarySlotUnlocked = localStorage.getItem('isSecondarySlotUnlocked') === 'true';

// 1. رسم قائمة الشراء
function renderShopMenu() {
    document.getElementById('playerCurrencyUI').innerText = playerCurrency;
    const container = document.getElementById('skillsContainer');
    container.innerHTML = '';

    for (const key in PlayerSkillRegistry) {
        const skill = PlayerSkillRegistry[key];
        const isPurchased = purchasedSkills.includes(skill.id);

        let btnClass = isPurchased ? 'btn-equipped' : 'btn-buy';
        let btnText = isPurchased ? 'Purchased' : `Buy (${skill.price} C)`;

        const card = document.createElement('div');
        card.className = 'skill-card';
        card.onclick = () => toggleSkillDesc(skill.id);

        card.innerHTML = `
            <div class="skill-content">
                <div class="skill-icon">
                    <img src="${skill.icon}" alt="${skill.name}" class="skill-img">
                </div>
                <div class="skill-name">${skill.name}</div>
                <button class="skill-btn ${btnClass}" onclick="event.stopPropagation(); handleShopBuy('${skill.id}')" ${isPurchased ? 'disabled' : ''}>${btnText}</button>
            </div>
            <div id="desc_${skill.id}" class="skill-desc">${skill.description}</div>
        `;
        container.appendChild(card);
    }
}

// معالجة الشراء (تم إلغاء التجهيز التلقائي)
function handleShopBuy(skillId) {
    const skill = PlayerSkillRegistry[skillId];
    if (!purchasedSkills.includes(skillId)) {
        if (playerCurrency >= skill.price) {
            playerCurrency -= skill.price;
            purchasedSkills.push(skillId);
            localStorage.setItem('purchasedSkills', JSON.stringify(purchasedSkills));
            localStorage.setItem('playerCurrency', playerCurrency);
            
            renderShopMenu();
               }
    }
}

// دالة شراء الخانة الثانوية بـ 100C
function unlockSecondarySlot() {
    if (playerCurrency >= 100) {
        playerCurrency -= 100;
        isSecondarySlotUnlocked = true;
        localStorage.setItem('playerCurrency', playerCurrency);
        localStorage.setItem('isSecondarySlotUnlocked', 'true');
        renderLoadoutMenu();
  }
}

// دوال إظهار وإخفاء شاشة التعليمات
function showTutorial() {
    document.getElementById('tutorialOverlay').classList.remove('hidden');
}

function hideTutorial() {
    document.getElementById('tutorialOverlay').classList.add('hidden');
}
// 2. رسم وتحديث شاشة التجهيز (Loadout)
function renderLoadoutMenu() {
    document.getElementById('playerCurrencyUI').innerText = playerCurrency;

    const primarySlot = document.getElementById('primarySlot');
    const secondarySlot = document.getElementById('secondarySlot');

    // -- تجهيز الخانة الأساسية --
    if (equippedPrimary && PlayerSkillRegistry[equippedPrimary]) {
        primarySlot.innerHTML = `<img src="${PlayerSkillRegistry[equippedPrimary].icon}" class="skill-img draggable-equipped" data-skill-id="${equippedPrimary}" data-skill-type="primary" draggable="true">`;
        bindDragEvents(primarySlot.querySelector('img'), 'slot');
        primarySlot.onclick = () => unequipSkill('primary');
    } else {
        primarySlot.innerHTML = `<span class="slot-placeholder">Empty</span>`;
        primarySlot.onclick = null;
    }
    setupDropSlot(primarySlot, 'primary');

    // -- تجهيز الخانة الثانوية (مع التحقق من القفل) --
    if (!isSecondarySlotUnlocked) {
        secondarySlot.innerHTML = `<span class="slot-placeholder" style="color:#E74C3C;">🔒 100 C</span>`;
        secondarySlot.classList.add('locked-slot');
        secondarySlot.onclick = () => unlockSecondarySlot();
        secondarySlot.ondrop = null;
        secondarySlot.ondragover = null;
    } else {
        secondarySlot.classList.remove('locked-slot');
        if (equippedSecondary && PlayerSkillRegistry[equippedSecondary]) {
            secondarySlot.innerHTML = `<img src="${PlayerSkillRegistry[equippedSecondary].icon}" class="skill-img draggable-equipped" data-skill-id="${equippedSecondary}" data-skill-type="secondary" draggable="true">`;
            bindDragEvents(secondarySlot.querySelector('img'), 'slot');
            secondarySlot.onclick = () => unequipSkill('secondary');
        } else {
            secondarySlot.innerHTML = `<span class="slot-placeholder">Empty</span>`;
            secondarySlot.onclick = null;
        }
        setupDropSlot(secondarySlot, 'secondary');
    }

    // -- تعبئة صفوف المهارات المملوكة --
    const primaryRow = document.getElementById('primaryInventoryRow');
    const secondaryRow = document.getElementById('secondaryInventoryRow');
    primaryRow.innerHTML = '';
    secondaryRow.innerHTML = '';

    purchasedSkills.forEach(skillId => {
        // إخفاء المهارة من الصف السفلي إذا كانت مجهزة
        if (skillId === equippedPrimary || skillId === equippedSecondary) return;

        const skill = PlayerSkillRegistry[skillId];
        if (!skill) return;

        const img = document.createElement('img');
        img.src = skill.icon;
        img.alt = skill.name;
        img.className = 'draggable-skill skill-img';
        img.draggable = true;
        img.dataset.skillId = skill.id;
        img.dataset.skillType = skill.type;

        // تجهيز بنقرة واحدة
        img.onclick = () => {
            if (skill.type === 'secondary' && !isSecondarySlotUnlocked) {
                
                return;
            }
            equipSkill(skill.id, skill.type);
        };

        bindDragEvents(img, 'inventory');

        if (skill.type === 'primary') primaryRow.appendChild(img);
        else secondaryRow.appendChild(img);
    });
}

// التجهيز ونزع التجهيز
function equipSkill(skillId, type) {
    if (type === 'primary') {
        equippedPrimary = skillId;
        localStorage.setItem('equippedPrimary', skillId);
    } else if (type === 'secondary') {
        equippedSecondary = skillId;
        localStorage.setItem('equippedSecondary', skillId);
    }
    renderLoadoutMenu();
}

function unequipSkill(type) {
    if (type === 'primary') {
        equippedPrimary = null;
        localStorage.removeItem('equippedPrimary');
    } else if (type === 'secondary') {
        equippedSecondary = null;
        localStorage.removeItem('equippedSecondary');
    }
    renderLoadoutMenu();
}

// 3. نظام السحب والإفلات (المحدث بالكامل)
let draggedSkillData = null;
let touchClone = null;

function bindDragEvents(elem, sourceOrigin) {
    // --- للكمبيوتر والماوس ---
    elem.addEventListener('dragstart', (e) => {
        draggedSkillData = { id: elem.dataset.skillId, type: elem.dataset.skillType, source: sourceOrigin };
        // إخفاء العنصر الأصلي ليتبع الماوس فقط
        setTimeout(() => elem.classList.add('hide-while-drag'), 0);
        e.dataTransfer.setData('text/plain', JSON.stringify(draggedSkillData));
    });

    elem.addEventListener('dragend', (e) => {
        elem.classList.remove('hide-while-drag');
        // إذا تم السحب من خانة التجهيز وأُفلت في الهواء (إلغاء التجهيز)
        if (draggedSkillData && draggedSkillData.source === 'slot' && e.dataTransfer.dropEffect === 'none') {
            unequipSkill(draggedSkillData.type);
        }
        draggedSkillData = null;
    });

    // --- للهواتف وشاشات اللمس ---
    elem.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        draggedSkillData = { id: elem.dataset.skillId, type: elem.dataset.skillType, source: sourceOrigin };

        // إنشاء نسخة عائمة تتبع الإصبع
        touchClone = elem.cloneNode(true);
        touchClone.classList.remove('hide-while-drag');
        touchClone.style.position = 'fixed';
        touchClone.style.zIndex = '1000';
        touchClone.style.pointerEvents = 'none';
        touchClone.style.width = '45px';
        touchClone.style.height = '45px';
        touchClone.style.left = `${touch.clientX - 22.5}px`;
        touchClone.style.top = `${touch.clientY - 22.5}px`;
        document.body.appendChild(touchClone);

        // إخفاء العنصر الأصلي فوراً
        elem.classList.add('hide-while-drag');
    }, { passive: false });

    elem.addEventListener('touchmove', (e) => {
        if (!touchClone) return;
        e.preventDefault();
        const touch = e.touches[0];
        touchClone.style.left = `${touch.clientX - 22.5}px`;
        touchClone.style.top = `${touch.clientY - 22.5}px`;
        highlightTargetSlotUnderPoint(touch.clientX, touch.clientY);
    }, { passive: false });

    elem.addEventListener('touchend', (e) => {
        elem.classList.remove('hide-while-drag');
        if (touchClone) {
            touchClone.remove();
            touchClone = null;
        }

        const touch = e.changedTouches[0];
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        const dropSlot = targetElement ? targetElement.closest('.equip-slot') : null;

        if (dropSlot && draggedSkillData) {
            const requiredType = dropSlot.dataset.slotType;
            if (draggedSkillData.type === requiredType) {
                if (requiredType === 'secondary' && !isSecondarySlotUnlocked) {
                         } else {
                    equipSkill(draggedSkillData.id, requiredType);
                }
            } else if (draggedSkillData.source === 'slot') {
                unequipSkill(draggedSkillData.type); // سحب لخانة خاطئة = نزع المهارة
            }
        } else if (draggedSkillData && draggedSkillData.source === 'slot') {
            unequipSkill(draggedSkillData.type); // إفلات في الهواء = نزع المهارة
        }

        document.querySelectorAll('.equip-slot').forEach(s => s.classList.remove('drag-over'));
        draggedSkillData = null;
    });
}

function highlightTargetSlotUnderPoint(x, y) {
    const targetElement = document.elementFromPoint(x, y);
    const dropSlot = targetElement ? targetElement.closest('.equip-slot') : null;
    document.querySelectorAll('.equip-slot').forEach(s => s.classList.remove('drag-over'));
    if (dropSlot) dropSlot.classList.add('drag-over');
}

function setupDropSlot(slotElem, expectedType) {
    slotElem.ondragover = (e) => {
        e.preventDefault();
        slotElem.classList.add('drag-over');
    };

    slotElem.ondragleave = () => {
        slotElem.classList.remove('drag-over');
    };

    slotElem.ondrop = (e) => {
        e.preventDefault();
        slotElem.classList.remove('drag-over');
        if (draggedSkillData && draggedSkillData.type === expectedType) {
            equipSkill(draggedSkillData.id, expectedType);
            draggedSkillData = null; // تفريغ البيانات لمنع تنفيذ dragend للإزالة
        }
    };
}

// 4. دوال التبديل وإظهار القوائم
function showEquipMenu() {
    mainMenu.classList.add('hidden');
    document.getElementById('floatingCurrency').classList.remove('hidden');
    document.getElementById('floatingNavContainer').classList.remove('hidden');

    currentEquipView = 'shop';
    updateEquipView();
    manageBgMusic();
}

function toggleShopAndLoadout() {
    currentEquipView = (currentEquipView === 'shop') ? 'loadout' : 'shop';
    updateEquipView();
}

function updateEquipView() {
    const shopCard = document.getElementById('equipMenu');
    const loadoutCard = document.getElementById('loadoutMenu');
    const toggleBtn = document.getElementById('floatingToggleBtn');

    if (currentEquipView === 'shop') {
        loadoutCard.classList.add('hidden');
        shopCard.classList.remove('hidden');
        toggleBtn.innerText = "To Equip";
        toggleBtn.style.background = "#F39C12";
        renderShopMenu();
    } else {
        shopCard.classList.add('hidden');
        loadoutCard.classList.remove('hidden');
        toggleBtn.innerText = "To Shop";
        toggleBtn.style.background = "#2ECC71";
        renderLoadoutMenu();
    }
}

function showMainMenu() {
    isPlaying = false;
    cancelAnimationFrame(animationId);

    settingsMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    levelSelectMenu.classList.add('hidden');
    manageBgMusic();

    document.getElementById('equipMenu').classList.add('hidden');
    document.getElementById('loadoutMenu').classList.add('hidden');
    document.getElementById('floatingCurrency').classList.add('hidden');
    document.getElementById('floatingNavContainer').classList.add('hidden');

    canvas.style.display = 'none';
    mainMenu.classList.remove('hidden');
    document.getElementById('starfieldCanvas').style.display = 'block';
}
function showSettings() {
    mainMenu.classList.add('hidden');
    settingsMenu.classList.remove('hidden');
    
    
    // تحديث شريط الموسيقى عند فتح الإعدادات
    const musicSlider = document.getElementById('musicSlider');
    if(musicSlider) {
        musicSlider.value = Math.round(bgMusic.volume * 100);
        document.getElementById('musicValue').innerText = bgMusic.volume === 0 ? "Muted" : Math.round(bgMusic.volume * 100) + "%";
    }
    manageBgMusic();
}

function updateSensitivity() {
    const slider = document.getElementById('sensSlider');
    let val = parseInt(slider.value);
    
    sensitivityMultiplier = 0.5 + (val * 0.25);
    
    const textValue = document.getElementById('sensValue');
    if (val === 0) textValue.innerText = val + " (Low)";
    else if (val === 5) textValue.innerText = val + " (Medium)";
    else if (val === 10) textValue.innerText = val + " (Very High)";
    else textValue.innerText = val; 
}

function showLevelSelect() {
    mainMenu.classList.add('hidden');
    settingsMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    levelSelectMenu.classList.remove('hidden');
    
    const container = document.getElementById('worldsContainer');
    container.innerHTML = ''; 
    
    // إضافة مسار الصور إلى كل عالم
    // إضافة مسار الصور إلى كل عالم
    const worlds = [
        { name: "Phase 1: Galaxy Outskirts", theme: "theme-blue", image: "images/bb1.jpg" },
        { name: "Phase 2: Star Corridor", theme: "theme-purple", image: "images/bb2.jpg" },
        { name: "Phase 3: Stardust", theme: "theme-green", image: "images/bb3.jpg" },
        { name: "Phase 4: Crossroads", theme: "theme-red", image: "images/bb4.jpg" },
        { name: "Phase 5: Heart of Fire", theme: "theme-orange", image: "images/bb5.jpg" },
        { name: "Phase 6: Station Ruins", theme: "theme-silver", image: "images/bb6.jpg" },
        { name: "Phase 7: Pressure Center", theme: "theme-black", image: "images/bb7.jpg" }
    ];
    for (let w = 0; w < worlds.length; w++) {
        const worldCard = document.createElement('div');
        worldCard.className = `world-card ${worlds[w].theme}`;
        
        // تطبيق الصورة كخلفية مع طبقة تظليل متدرجة (Gradient Overlay) لدمجها باحترافية
        worldCard.style.backgroundImage = `linear-gradient(rgba(8, 26, 51, 0.5), rgba(0, 0, 0, 0.7)), url('${worlds[w].image}')`;
        worldCard.style.backgroundSize = 'cover';
        worldCard.style.backgroundPosition = 'center';
        worldCard.style.backgroundRepeat = 'no-repeat';
        
        const worldTitle = document.createElement('h3');
        worldTitle.innerText = worlds[w].name;
        // إضافة ظل للنص لجعله بارزاً وواضحاً فوق الصورة
        worldTitle.style.textShadow = "2px 2px 5px rgba(0,0,0,1)";
        worldCard.appendChild(worldTitle);

        const grid = document.createElement('div');
        grid.className = 'level-grid';

        for (let i = 1; i <= 8; i++) {
            let actualLevel = (w * 8) + i; 
            const btn = document.createElement('button');
            btn.className = 'level-btn';
            
            let levelText = (actualLevel % 8 === 0) ? "BOSS" : actualLevel;
            let fontSize = (actualLevel % 8 === 0) ? "20px" : "24px";
            
            if (actualLevel <= maxUnlockedLevel) {
                let starsEarned = savedStars[actualLevel] || 0;
                let starsHTML = '';
                for(let s = 0; s < 3; s++) {
                    starsHTML += (s < starsEarned) ? '★' : '☆';
                }
                
                // إضافة شفافية بسيطة للأزرار لتبدو منسجمة مع الخلفية
                btn.style.boxShadow = "4px 4px 0px rgba(0,0,0,0.7)";
                btn.innerHTML = `<div style="font-size: ${fontSize}; font-weight: bold;">${levelText}</div><div class="stars-display">${starsHTML}</div>`;
                btn.onclick = () => startSpecificLevel(actualLevel);
            } else {
                btn.classList.add('locked');
                btn.innerHTML = `<div style="font-size: ${fontSize}; font-weight: bold;">${levelText}</div><div class="stars-display" style="color:rgba(255,255,255,0.2);">☆☆☆</div>`;
            }
            grid.appendChild(btn);
        }
        worldCard.appendChild(grid);
        container.appendChild(worldCard);
    }
}


function startSpecificLevel(selectedLevel) {
    levelSelectMenu.classList.add('hidden');
    canvas.style.display = 'block';
    document.getElementById('starfieldCanvas').style.display = 'none';
    
    level = selectedLevel;
    
    if (level % 8 === 0) {
        isChampionMode = true;
        isPlaying = false; 
        cancelAnimationFrame(animationId);
        
        if (typeof startChampionMatch === "function") {
            startChampionMatch(level); 
        }
    } else {
        isChampionMode = false;
        score = 0;
        isPlaying = true;
        initLevel();
        lastTime = performance.now();
        requestAnimationFrame(draw);
    }
}

function startGame() {
    mainMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden'); 
    canvas.style.display = 'block';
    document.getElementById('starfieldCanvas').style.display = 'none';
    
    level = 1;
    score = 0;
    isPlaying = true;
    initLevel();
    lastTime = performance.now(); 
    requestAnimationFrame(draw); 
}

// دالة إظهار النتيجة (تقبل true للفوز و false للخسارة)
function showResult(isWin) {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    manageBgMusic();
    const resultTitle = document.getElementById('resultTitle');
    const resultActionBtn = document.getElementById('resultActionBtn');
    const earnedDisplay = document.getElementById('earnedCurrencyDisplay');
    const earnedAmountText = document.getElementById('earnedCurrency');
    
    finalScoreText.innerText = score;
    
    // --- نظام حساب مكافأة العملات (C) ---
    if (!isChampionMode) {
        let earnedC = 0;
        // نعطي اللاعب عملة إضافية لكل 300 نقطة يجمعها
        let scoreBonus = Math.floor(score / 300); 

        if (isWin) {
            // عند الفوز: من 15 إلى 20 كحد أقصى
            earnedC = Math.min(15 + scoreBonus, 20);
        } else {
            // عند الخسارة: من 3 إلى 6 كحد أقصى
            earnedC = Math.min(3 + scoreBonus, 6);
        }
        
        // إضافة العملات للرصيد وحفظها
        playerCurrency += earnedC;
        localStorage.setItem('playerCurrency', playerCurrency);
        
        // عرض النص في واجهة المستخدم
        earnedAmountText.innerText = earnedC;
        earnedDisplay.style.display = 'block';
    } else {
        // إخفاء نص المكافأة في طور الزعيم
        earnedDisplay.style.display = 'none';
    }
    // ------------------------------------

    if (isWin) {
        resultTitle.innerText = "LEVEL CLEARED!";
        resultTitle.style.color = "#2ECC71"; // لون أخضر للفوز
        
        // التحقق مما إذا كان المستوى القادم هو مستوى زعيم
        if ((level + 1) % 8 === 0) {
            resultActionBtn.innerText = " Fight Boss";
        } else {
            resultActionBtn.innerText = " Next Level";
        }
        resultActionBtn.onclick = nextLevel;
    } else {
        resultTitle.innerText = "GAME OVER";
        resultTitle.style.color = "#e74c3c"; // لون أحمر للخسارة
        resultActionBtn.innerText = "↻ Retry Level";
        resultActionBtn.onclick = retryLevel;
    }
    
    canvas.style.display = 'none';
    document.getElementById('starfieldCanvas').style.display = 'block';
    gameOverMenu.classList.remove('hidden');
}

// دالة العودة لنفس المستوى عند الخسارة
function retryLevel() {
    gameOverMenu.classList.add('hidden');
    canvas.style.display = 'block';
    document.getElementById('starfieldCanvas').style.display = 'none';
    
    // لم نقم بتعديل المتغير level هنا، مما يحافظ على المرحلة الحالية
    score = 0; 
    isPlaying = true;
    initLevel();
    lastTime = performance.now();
    requestAnimationFrame(draw);
}

// دالة الانتقال للمستوى التالي عند الفوز
function nextLevel() {
    gameOverMenu.classList.add('hidden');
    level++; // الانتقال للرقم التالي
    
    if (level % 8 === 0) {
        // تشغيل طور الزعيم إذا كان المستوى القادم هو 8، 16، 24... الخ
        startSpecificLevel(level);
    } else {
        canvas.style.display = 'block';
        document.getElementById('starfieldCanvas').style.display = 'none';
        isPlaying = true;
        initLevel();
        lastTime = performance.now();
        requestAnimationFrame(draw);
    }
}

// إعادة توجيه دالة gameOver القديمة لدالة النتائج الجديدة لضمان التوافقية
function gameOver() {
    showResult(false);
}

function autoFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`تعذر تفعيل وضع ملء الشاشة: ${err.message}`);
        });
    }
}
document.addEventListener('touchstart', autoFullScreen, { passive: true });
document.addEventListener('click', autoFullScreen);

// ==========================================
// 3. تأثير النجوم الخلفية (Starfield Background)
// ==========================================
const starCanvas = document.getElementById('starfieldCanvas');
const starCtx = starCanvas.getContext('2d');
let stars = [];
const numStars = 300; 

function resizeStarfield() {
    starCanvas.width = window.innerWidth;
    starCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeStarfield);
resizeStarfield();

for (let i = 0; i < numStars; i++) {
    stars.push({
        x: (Math.random() - 0.5) * starCanvas.width * 2,
        y: (Math.random() - 0.5) * starCanvas.height * 2,
        z: Math.random() * starCanvas.width,
        color: Math.random() > 0.85 ? '#00AEEF' : '#FFFFFF' 
    });
}




function toggleSkillDesc(skillId) {
    const descDiv = document.getElementById(`desc_${skillId}`);
    descDiv.style.display = descDiv.style.display === 'block' ? 'none' : 'block';
}

function handleSkillAction(skillId) {
    const skill = PlayerSkillRegistry[skillId];
    
    if (!purchasedSkills.includes(skillId)) {
        // الشراء
        if (playerCurrency >= skill.price) {
            playerCurrency -= skill.price;
            purchasedSkills.push(skillId);
            localStorage.setItem('purchasedSkills', JSON.stringify(purchasedSkills));
            
        } 
    } else {
        // التجهيز بناءً على نوع المهارة (أساسية أو ثانوية)
        if (skill.type === 'primary') {
            equippedPrimary = skillId;
            localStorage.setItem('equippedPrimary', skillId);
        } else if (skill.type === 'secondary') {
            equippedSecondary = skillId;
            localStorage.setItem('equippedSecondary', skillId);
        }
    }
    renderEquipMenu(); // تحديث الواجهة
}
// قم بتعديل دالة showEquipMenu التي كتبناها سابقاً لتستدعي دالة الرسم


function animateStarfield() {
    if (!isPlaying) {
        starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
        const centerX = starCanvas.width / 2;
        const centerY = starCanvas.height / 2;

        stars.forEach(star => {
            star.z -= 2; 
            if (star.z <= 0) {
                star.x = (Math.random() - 0.5) * starCanvas.width * 2;
                star.y = (Math.random() - 0.5) * starCanvas.height * 2;
                star.z = starCanvas.width;
            }

            const px = centerX + (star.x / star.z) * starCanvas.width;
            const py = centerY + (star.y / star.z) * starCanvas.width;
            const radius = Math.max(0.1, (1 - star.z / starCanvas.width) * 2.5);

            starCtx.beginPath();
            starCtx.arc(px, py, radius, 0, Math.PI * 2);
            starCtx.fillStyle = star.color;
            
            if (radius > 1.5) {
                starCtx.shadowBlur = 5;
                starCtx.shadowColor = star.color;
            } else {
                starCtx.shadowBlur = 0;
            }
            
            starCtx.fill();
            starCtx.closePath();
        });
    }
    requestAnimationFrame(animateStarfield);
}
animateStarfield();

// ==========================================
// إدارة موسيقى الخلفية
// ==========================================

// دالة ذكية لتحديد متى يجب تشغيل أو إيقاف الموسيقى
function manageBgMusic() {
    // تعمل الموسيقى فقط إذا لم نكن نلعب (في الطور العادي أو الزعيم) وكانت الشاشة مضاءة ومفتوحة
    if (!isPlaying && !isChampionMode && document.visibilityState === 'visible') {
        // نستخدم catch لتجنب أخطاء المتصفحات التي تمنع التشغيل التلقائي قبل تفاعل المستخدم
        bgMusic.play().catch(e => console.log("Waiting for user interaction to play music."));
    } else {
        bgMusic.pause();
    }
}

// تحديث مستوى الصوت من شريط الإعدادات
function updateMusicVolume() {
    const slider = document.getElementById('musicSlider');
    let val = parseInt(slider.value);
    
    bgMusic.volume = val / 100;
    localStorage.setItem('musicVolume', val); // حفظ المستوى
    
    const textValue = document.getElementById('musicValue');
    if (val === 0) {
        textValue.innerText = "Muted";
    } else {
        textValue.innerText = val + "%";
    }
    
    manageBgMusic(); // تشغيلها إذا رفع الصوت وكان من المفترض أن تعمل
}

// 1. إيقاف الموسيقى تلقائياً عند إطفاء الشاشة أو الخروج من التطبيق
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        bgMusic.pause(); // إيقاف إجباري عند الخروج
    } else {
        manageBgMusic(); // إعادة التحقق عند العودة
    }
});

// 2. تشغيل الموسيقى عند أول لمسة/نقرة للشاشة لتجاوز حظر المتصفحات
document.addEventListener('click', () => {
    if (!isPlaying && !isChampionMode && bgMusic.paused) {
        manageBgMusic();
    }
}, { once: true });
document.addEventListener('touchstart', () => {
    if (!isPlaying && !isChampionMode && bgMusic.paused) {
        manageBgMusic();
    }
}, { once: true });

// دالة تشغيل إعلان AdSense وإعطاء 30 عملة
// دالة تشغيل إعلان AdSense وإعطاء 30 عملة
function watchAdSenseReward() {
    if (typeof adBreak !== 'function') {
        alert("نظام الإعلانات غير جاهز بعد، أو أنك تستخدم مانع إعلانات (AdBlock).");
        return;
    }

    // إيقاف موسيقى الخلفية مؤقتاً حتى لا تتداخل مع الإعلان
    if (typeof bgMusic !== 'undefined' && !bgMusic.paused) {
        bgMusic.pause();
    }

    adBreak({
        type: 'reward',
        name: 'shop_coins_reward',
        beforeReward: (showAdFn) => {
            // تشغيل الإعلان
            showAdFn();
        },
        beforeAd: () => {
            // إيقاف أي حركة في اللعبة أثناء عرض الإعلان
            if (typeof isPlaying !== 'undefined' && isPlaying) {
                isPlaying = false;
            }
        },
        afterAd: () => {
            // إعادة تشغيل الموسيقى بعد إغلاق الإعلان
            if (typeof manageBgMusic === 'function') {
                manageBgMusic();
            }
        },
        adViewed: () => {
            // إذا شاهد اللاعب الإعلان للنهاية، نعطيه 30 عملة
            if (typeof playerCurrency !== 'undefined') {
                playerCurrency += 30; 
                localStorage.setItem('playerCurrency', playerCurrency); 
                
                // تحديث الرقم في واجهة اللعبة العلوية
                const currencyUI = document.getElementById('playerCurrencyUI');
                if (currencyUI) {
                    currencyUI.innerText = playerCurrency;
                }
            }
        },
        adDismissed: () => {
            // المستخدم أغلق الإعلان قبل اكتماله (لن يحصل على المكافأة)
            console.log("تم إغلاق الإعلان مبكراً.");
        }
    });
}