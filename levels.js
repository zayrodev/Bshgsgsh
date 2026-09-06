// =========================================================================
// 0. مولد أرقام عشوائية ثابت بناءً على رقم المستوى (Seeded Random)
// =========================================================================
let levelSeed = 1;

function seededRandom() {
    let x = Math.sin(levelSeed++) * 10000;
    return x - Math.floor(x);
}

function getLevelConfig(levelIndex) {
    if (levelIndex >= 1 && levelIndex <= 8) {
        return { rows: 14, cols: 20, targetBricks: 120 };
    } else if (levelIndex >= 9 && levelIndex <= 16) {
        // إعدادات المرحلة الثانية (حجم أكبر يتسع لـ 180-220 طوبة)
        return { rows: 18, cols: 26, targetBricks: 200 };
    } else {
        return { rows: 18, cols: 26, targetBricks: 220 };
    }
}

function getLevel(levelIndex) {
    levelSeed = levelIndex * 9999; 
    const config = getLevelConfig(levelIndex);

    // قائمة بالأشكال السبعة الفريدة (بدون أي تكرار)
    const uniqueShapes = [
        generateQuadStar,         // النجمة الرباعية (الجديدة)
        generateArcadeMonster,    // وحش الآركيد
        generateNestedGeometry,   // الأشكال المتداخلة
        generateSteppedPyramid,   // الهرم المدرج
        generateSkyscrapers,      // ناطحات السحاب
        generateSpiderWeb,        // الشبكة العنكبوتية
        generatePixelSpaceship    // سفينة الفضاء
    ];

    // حساب رقم المستوى العادي داخل المرحلة الحالية (من 0 إلى 6)
    // المستوى 8 (الزعيم) لا يستخدم هذه الدالة لإنشاء الطوب، لكن نضع حماية احتياطية
    let phaseLevelIndex = (levelIndex - 1) % 8;
    if (phaseLevelIndex >= 7) phaseLevelIndex = 0; 

    // إزاحة الترتيب بناءً على رقم العالم، حتى لا يبدأ كل عالم بنفس الشكل، 
    // مع الحفاظ على قاعدة "لا تكرار للشكل في نفس العالم"
    let worldIndex = Math.floor((levelIndex - 1) / 8);
    let selectedShapeIndex = (phaseLevelIndex + worldIndex) % uniqueShapes.length;

    let shapeData = uniqueShapes[selectedShapeIndex](config);
    let color = `hsl(${Math.floor(seededRandom() * 360)}, 90%, 65%)`;

    return { data: shapeData, color: color };
}

// =========================================================================
// مولد النجمة الرباعية (مع نجمات صغيرة في الزوايا وماسة مفرغة في القلب)
// =========================================================================
function generateQuadStar(config) {
    const rows = config.rows;
    const cols = config.cols;
    let shape = Array.from({ length: rows }, () => Array(cols).fill(0));

    let centerR = (rows - 1) / 2;
    let centerC = (cols - 1) / 2;

    // مقاييس النجمة المركزية الكبيرة
    let bigScaleR = rows * 0.38;
    let bigScaleC = cols * 0.38;
    let p = 0.65; // معامل التقعر (Astroid Curve) - يحدد مدى حدة النجمة

    // مقاييس النجمات الصغيرة الأربع
    let smallScaleR = rows * 0.12;
    let smallScaleC = cols * 0.12;
    let marginR = rows * 0.18;
    let marginC = cols * 0.18;

    // إحداثيات زوايا النجمات الصغيرة
    let corners = [
        { r: marginR, c: marginC },                                // أعلى اليسار
        { r: rows - 1 - marginR, c: marginC },                     // أسفل اليسار
        { r: marginR, c: cols - 1 - marginC },                     // أعلى اليمين
        { r: rows - 1 - marginR, c: cols - 1 - marginC }           // أسفل اليمين
    ];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // رسم النجمة المركزية
            let dR_big = Math.abs(r - centerR) / bigScaleR;
            let dC_big = Math.abs(c - centerC) / bigScaleC;
            if (Math.pow(dR_big, p) + Math.pow(dC_big, p) <= 1.1) {
                shape[r][c] = 1;
            }

            // رسم النجمات الصغيرة الأربع
            for (let corner of corners) {
                let dR_small = Math.abs(r - corner.r) / smallScaleR;
                let dC_small = Math.abs(c - corner.c) / smallScaleC;
                if (Math.pow(dR_small, p) + Math.pow(dC_small, p) <= 1.0) {
                    shape[r][c] = 1;
                }
            }
        }
    }

    // لمسة إبداعية: تفريغ ماسة صغيرة في قلب النجمة الكبيرة
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let coreDist = Math.abs(r - centerR) + Math.abs(c - centerC);
            if (coreDist <= Math.min(rows, cols) * 0.08) {
                shape[r][c] = 0; // إزالة الطوب من المركز
            }
        }
    }

    return shape;
}
// مولد الهرم المدرج
function generateSteppedPyramid(config) {
    const rows = config.rows;
    const cols = config.cols;
    let shape = Array.from({ length: rows }, () => Array(cols).fill(0));
    let maxStepWidth = cols - 4; 
    
    for (let r = 2; r < rows; r++) {
        let progress = r / rows; 
        let stepWidth = Math.floor(progress * maxStepWidth);
        if(stepWidth % 2 !== 0) stepWidth++; 
        
        let startC = Math.floor((cols - stepWidth) / 2);
        
        for (let c = startC; c < startC + stepWidth; c++) {
            if (c % 2 !== 0 && r % 2 === 0) shape[r][c] = 0; // نقوش
            else shape[r][c] = 1;
        }
    }
    
    // بوابة متناسبة مع حجم الإعدادات
    let doorWidth = Math.floor(cols * 0.25);
    if(doorWidth % 2 !== 0) doorWidth++;
    let doorHeight = Math.floor(rows * 0.3);
    let doorStartC = Math.floor((cols - doorWidth) / 2);
    
    for (let r = rows - doorHeight; r < rows; r++) {
        for (let c = doorStartC; c < doorStartC + doorWidth; c++) {
            shape[r][c] = 0;
        }
    }
    
    // قمة الهرم
    let topC = Math.floor(cols / 2);
    shape[0][topC - 1] = 1; shape[0][topC] = 1;
    shape[1][topC - 1] = 1; shape[1][topC] = 1;

    return shape;
}

// مولد الشبكة العنكبوتية
function generateSpiderWeb(config) {
    const rows = config.rows;
    const cols = config.cols;
    let shape = Array.from({ length: rows }, () => Array(cols).fill(0));
    
    let centerR = (rows - 1) / 2;
    let centerC = (cols - 1) / 2;
    let ringSpacing = Math.max(3, Math.floor(cols / 5));

    for(let r = 0; r < rows; r++) {
        for(let c = 0; c < cols; c++) {
            let yDist = Math.abs(r - centerR);
            let xDist = Math.abs(c - centerC);
            
            // الخيوط القطرية
            if (Math.abs(yDist - xDist) < 1.5) { shape[r][c] = 1; }
            
            // المحور الأفقي والعمودي
            if (Math.abs(r - centerR) < 1 || Math.abs(c - centerC) < 1) { shape[r][c] = 1; }
            
            // حلقات الشبكة الماسية
            let manhattanDist = yDist + xDist;
            if (Math.round(manhattanDist) > 0 && Math.round(manhattanDist) % ringSpacing === 0) {
                shape[r][c] = 1;
            }
        }
    }
    
    // مسح المركز لخلق منطقة واسعة آمنة للكرة
    let safeRadiusR = Math.floor(rows * 0.15);
    let safeRadiusC = Math.floor(cols * 0.15);
    for (let r = Math.floor(centerR - safeRadiusR); r <= Math.ceil(centerR + safeRadiusR); r++) {
        for (let c = Math.floor(centerC - safeRadiusC); c <= Math.ceil(centerC + safeRadiusC); c++) {
            if(r >= 0 && r < rows && c >= 0 && c < cols) {
                shape[r][c] = 0;
            }
        }
    }
    return shape;
}

// مولد سفينة الفضاء (بنية ذكية للتكبير التلقائي)
function generatePixelSpaceship(config) {
    const targetRows = config.rows;
    const targetCols = config.cols;
    
    // التصميم الأساسي المسطح للسفينة
    const baseShape = [
        [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
        [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,1,1,0,1,1,1,1,0,1,1,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
        [0,1,1,1,0,1,1,1,1,1,1,0,1,1,1,0],
        [1,1,1,0,0,0,1,1,1,1,0,0,0,1,1,1],
        [1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,1,1,1,1,0,0,0,0,0,1],
        [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
        [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0]
    ];
    
    let baseRows = baseShape.length;
    let baseCols = baseShape[0].length;
    let scaledShape = Array.from({ length: targetRows }, () => Array(targetCols).fill(0));
    
    // التكبير الديناميكي لتناسب الإعدادات (Upscaling)
    for (let r = 0; r < targetRows; r++) {
        for (let c = 0; c < targetCols; c++) {
            let origR = Math.floor((r / targetRows) * baseRows);
            let origC = Math.floor((c / targetCols) * baseCols);
            scaledShape[r][c] = baseShape[origR][origC];
        }
    }
    return scaledShape;
}

// مولد الأشكال المتداخلة
function generateNestedGeometry(config) {
    const rows = config.rows;
    const cols = config.cols;
    let shape = Array.from({ length: rows }, () => Array(cols).fill(0));
    
    // حساب المسافة ديناميكياً بين الجدران
    let spacing = Math.max(2, Math.floor(cols / 7)); 
    
    for(let r = 0; r < rows; r++) {
        for(let c = 0; c < cols; c++) {
            let distFromEdge = Math.min(r, rows - 1 - r, c, cols - 1 - c);
            
            if (distFromEdge % spacing === 0 && distFromEdge < (Math.min(rows, cols) / 2.5)) {
                shape[r][c] = 1;
            }
        }
    }
    return shape;
}

// مولد ناطحات السحاب
function generateSkyscrapers(config) {
    const rows = config.rows;
    const cols = config.cols;
    let shape = Array.from({ length: rows }, () => Array(cols).fill(0));
    
    // توزيع 4 أبراج بشكل متساوٍ
    let towerWidth = Math.floor(cols / 6);
    let gap = Math.floor((cols - (towerWidth * 4)) / 5);
    
    for(let t = 0; t < 4; t++) {
        let startC = gap + (t * (towerWidth + gap));
        let endC = startC + towerWidth - 1;
        
        // ارتفاع الأبراج عشوائي ولكنه يتناسب مع إجمالي الصفوف
        let height = Math.floor(seededRandom() * (rows * 0.3)) + Math.floor(rows * 0.6);
        
        for(let r = 0; r < height; r++) {
            for(let c = startC; c <= endC; c++) {
                shape[r][c] = 1;
            }
        }
        
        // حفر النوافذ
        let midC = Math.floor((startC + endC) / 2);
        for(let r = 1; r < height - 1; r += 2) { 
            shape[r][midC] = 0; 
        }
    }
    
    return shape;
}

// مولد وحوش الآركيد (النمو العضوي المتماثل)
function generateArcadeMonster(config) {
    const rows = config.rows; 
    const cols = config.cols; 
    const halfCols = Math.floor(cols / 2);
    let shape = [];
    
    let halfGrid = Array.from({ length: rows }, () => Array(halfCols).fill(0));
    let placed = 0;
    
    // استهداف نصف العدد الإجمالي للطوب المكتوب في لوحة التحكم
    let targetHalf = Math.floor(config.targetBricks / 2); 
    
    halfGrid[Math.floor(rows/2)][halfCols-1] = 1; // نقطة البداية
    placed++;

    let attempts = 0;
    while (placed < targetHalf && attempts < config.targetBricks * 10) {
        let r = Math.floor(seededRandom() * rows);
        let c = Math.floor(seededRandom() * halfCols);

        if (halfGrid[r][c] === 0) {
            let hasNeighbor = (
                (r > 0 && halfGrid[r-1][c] === 1) ||
                (r < rows-1 && halfGrid[r+1][c] === 1) ||
                (c > 0 && halfGrid[r][c-1] === 1) ||
                (c < halfCols-1 && halfGrid[r][c+1] === 1)
            );
            if (hasNeighbor) { halfGrid[r][c] = 1; placed++; }
        }
        attempts++;
    }

    // بناء الشكل النهائي وعكسه
    for (let r = 0; r < rows; r++) {
        let row = [];
        for (let c = 0; c < halfCols; c++) row.push(halfGrid[r][c]);
        for (let c = halfCols - 1; c >= 0; c--) row.push(halfGrid[r][c]);
        shape.push(row);
    }
    return shape;
}



// =========================================================================
// 4. تصميم القلب المربع (Pixel Art Heart) للفرص
// =========================================================================
const pixelHeart = [
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0]
];

