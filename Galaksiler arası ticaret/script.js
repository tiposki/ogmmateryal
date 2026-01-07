// Yıldız Kaptanı: Bayes Kuşağı - Game Script
// Koşullu Olasılık (Bayes Teoremi) Eğitim Oyunu

// Game State
let credits = 250;
let fuel = 10;
const SCAN_COST = 100;
const WIN_REWARD_WITH_SCAN = 270;
const WIN_REWARD_WITHOUT_SCAN = 270;
const WIN_TARGET = 2000; // Kazanmak için gereken minimum kredi
const TOTAL_SECTORS = 10; // Toplam sektör sayısı

// Özel sektör değişkenleri
let specialSector = 0; // Hangi sektörde radar kristali doğru gösterecek
let currentSector = 0; // Şu anki sektör numarası
let isSpecialSector = false; // Bu sektör özel mi?

// Prior Probabilities (Başlangıç Olasılıkları) - Her sektörde dinamik olarak belirlenir
// Dinamik prior değişkenleri
let currentPriorA = 0;
let currentPriorB = 0;
let currentPriorC = 0;
let currentPriorD = 0;

// Normalize edilmiş olasılıklar (toplam = 1) - dinamik
let NORM_PRIOR_A = 0;
let NORM_PRIOR_B = 0;
let NORM_PRIOR_C = 0;
let NORM_PRIOR_D = 0;

// Her sektör için birbirinden farklı rastgele olasılıklar üret
function generateRandomPriors() {
    // Güvenli algoritma: Önceden tanımlı farklı aralıklardan seçim yap
    // Bu sayede sonsuz döngü riski ortadan kalkar

    // 4 farklı aralık tanımla (birbirine yakın, farklar küçük)
    // Bu sayede sadece en yükseği seçmek avantaj sağlamaz
    const ranges = [
        { min: 18, max: 22 },  // Düşük
        { min: 23, max: 27 },  // Orta-düşük
        { min: 28, max: 32 },  // Orta-yüksek
        { min: 33, max: 38 }   // Yüksek
    ];

    // Aralıkları karıştır
    const shuffledRanges = ranges.sort(() => Math.random() - 0.5);

    // Her aralıktan bir değer seç
    const values = shuffledRanges.map(range => {
        const rangeSize = range.max - range.min + 1;
        return Math.floor(Math.random() * rangeSize) + range.min;
    });

    // Değerleri tekrar karıştır (kuşaklara rastgele atama için)
    values.sort(() => Math.random() - 0.5);

    currentPriorA = values[0] / 100;
    currentPriorB = values[1] / 100;
    currentPriorC = values[2] / 100;
    currentPriorD = values[3] / 100;

    // Normalize et
    const total = currentPriorA + currentPriorB + currentPriorC + currentPriorD;
    NORM_PRIOR_A = currentPriorA / total;
    NORM_PRIOR_B = currentPriorB / total;
    NORM_PRIOR_C = currentPriorC / total;
    NORM_PRIOR_D = currentPriorD / total;
}

// Özel sektör için: Kristal olan kuşağa yüksek olasılık ver
function generateSpecialPriors(crystalBelt) {
    // Kristal olan kuşak %40-50 arası yüksek değer alsın
    const highValue = Math.floor(Math.random() * 11) + 40; // 40-50

    // Diğer 3 kuşak düşük değerler alsın (15-25 arası)
    const lowValues = [];
    for (let i = 0; i < 3; i++) {
        lowValues.push(Math.floor(Math.random() * 11) + 15); // 15-25
    }

    // Kuşaklara atama yap
    const belts = ['A', 'B', 'C', 'D'];
    let lowIndex = 0;

    belts.forEach(belt => {
        if (belt === crystalBelt) {
            if (belt === 'A') currentPriorA = highValue / 100;
            else if (belt === 'B') currentPriorB = highValue / 100;
            else if (belt === 'C') currentPriorC = highValue / 100;
            else currentPriorD = highValue / 100;
        } else {
            if (belt === 'A') currentPriorA = lowValues[lowIndex++] / 100;
            else if (belt === 'B') currentPriorB = lowValues[lowIndex++] / 100;
            else if (belt === 'C') currentPriorC = lowValues[lowIndex++] / 100;
            else currentPriorD = lowValues[lowIndex++] / 100;
        }
    });

    // Normalize et
    const total = currentPriorA + currentPriorB + currentPriorC + currentPriorD;
    NORM_PRIOR_A = currentPriorA / total;
    NORM_PRIOR_B = currentPriorB / total;
    NORM_PRIOR_C = currentPriorC / total;
    NORM_PRIOR_D = currentPriorD / total;
}

// Likelihood (Sondanın doğru sinyal verme olasılığı)
const SENSOR_ACCURACY = 0.95; // %95 doğruluk - sonda kullanmak çok avantajlı

// Game Variables
let selectedBelt = null; // Kristal bulunan gerçek kuşak
let observationDone = false;
let gameEnded = false;
let posteriorA = NORM_PRIOR_A;
let posteriorB = NORM_PRIOR_B;
let posteriorC = NORM_PRIOR_C;
let posteriorD = NORM_PRIOR_D;

// DOM Elements
const messageElement = document.getElementById('message');
const posteriorInfoElement = document.getElementById('posterior-info');
const observationButton = document.getElementById('observation-button');
const doorsContainer = document.getElementById('doors-container');

// Initialize game on load
document.addEventListener('DOMContentLoaded', () => {
    // İlk oyun için rastgele özel sektör belirle (1-10 arası)
    specialSector = Math.floor(Math.random() * 10) + 1;
    initializeGame();
});

function initializeGame() {
    if (fuel <= 0) {
        showGameOver();
        return;
    }

    // Sektör sayacını artır
    currentSector++;

    // Bu sektör özel mi kontrol et
    isSpecialSector = (currentSector === specialSector);

    // Önce kristal konumunu belirle (eşit olasılıkla)
    const belts = ['A', 'B', 'C', 'D'];
    selectedBelt = belts[Math.floor(Math.random() * 4)];

    // Sonra olasılıkları üret
    if (isSpecialSector) {
        // Özel sektör: Kristal olan kuşak yüksek olasılık göstersin
        generateSpecialPriors(selectedBelt);
    } else {
        // Normal sektör: Standart olasılıklar
        generateRandomPriors();
    }

    observationDone = false;
    gameEnded = false;
    posteriorA = NORM_PRIOR_A;
    posteriorB = NORM_PRIOR_B;
    posteriorC = NORM_PRIOR_C;
    posteriorD = NORM_PRIOR_D;

    // Update UI
    updateStats();
    messageElement.innerHTML = "Kaptan, yeni sektöre giriş yapıldı! 🚀<br>Radar, <strong>dört asteroit kuşağı</strong> tespit etti. Sadece birinde değerli kristaller var, diğer üçünde uzay enkazı. Sonda göndererek olasılıkları güncelleyebilir veya şansınızı deneyebilirsiniz.";
    posteriorInfoElement.style.display = 'none';
    observationButton.disabled = false;

    // Başlangıç radar verisini güncelle
    const radarDataElement = document.getElementById('radar-data');
    if (radarDataElement) {
        radarDataElement.innerHTML = `
            <strong>📊 Başlangıç Radar Verisi:</strong><br>
            A: %${(NORM_PRIOR_A * 100).toFixed(0)} | B: %${(NORM_PRIOR_B * 100).toFixed(0)} | C: %${(NORM_PRIOR_C * 100).toFixed(0)} | D: %${(NORM_PRIOR_D * 100).toFixed(0)}
        `;
    }

    renderAsteroids();
}

function selectRandomBelt() {
    // Ağırlıklı rastgele seçim
    const rand = Math.random();
    if (rand < NORM_PRIOR_A) {
        return 'A';
    } else if (rand < NORM_PRIOR_A + NORM_PRIOR_B) {
        return 'B';
    } else if (rand < NORM_PRIOR_A + NORM_PRIOR_B + NORM_PRIOR_C) {
        return 'C';
    } else {
        return 'D';
    }
}

function updateStats() {
    document.getElementById('player-credits').textContent = credits;
    document.getElementById('player-fuel').textContent = fuel;
}

function renderAsteroids() {
    doorsContainer.innerHTML = '';

    // Belt A
    const beltA = createAsteroidElement('A', posteriorA);
    doorsContainer.appendChild(beltA);

    // Belt B
    const beltB = createAsteroidElement('B', posteriorB);
    doorsContainer.appendChild(beltB);

    // Belt C
    const beltC = createAsteroidElement('C', posteriorC);
    doorsContainer.appendChild(beltC);

    // Belt D
    const beltD = createAsteroidElement('D', posteriorD);
    doorsContainer.appendChild(beltD);
}

function createAsteroidElement(belt, probability) {
    const div = document.createElement('div');
    div.className = `door belt-${belt.toLowerCase()}`;
    div.id = `belt-${belt}`;
    div.onclick = () => selectBelt(belt);

    div.innerHTML = `
        <div class="door-label">KUŞAK ${belt}</div>
        <div class="door-prob">${(probability * 100).toFixed(0)}% Kristal</div>
    `;

    return div;
}

function performObservation() {
    if (observationDone || gameEnded) return;

    if (credits < SCAN_COST) {
        messageElement.innerHTML = "⚠️ Yetersiz kredi! Sonda göndermek için en az 100 krediniz olmalı.";
        return;
    }

    credits -= SCAN_COST;
    updateStats();
    observationDone = true;
    observationButton.disabled = true;

    // Simulate sensor reading
    const sensorReading = simulateSensor();

    // Bayes Theorem calculation
    calculatePosterior(sensorReading);

    // Update UI with sensor result
    const beltNames = { 'A': "Kuşak A'dan", 'B': "Kuşak B'den", 'C': "Kuşak C'den", 'D': "Kuşak D'den" };
    const sensorResult = `${beltNames[sensorReading]} güçlü sinyal!`;

    messageElement.innerHTML = `📡 Sonda verisi alındı: <strong>${sensorResult}</strong><br>Olasılıklar Bayes teoremiyle güncellendi. Şimdi hedefinizi seçin!`;

    posteriorInfoElement.innerHTML = `
        🎯 Güncel Olasılıklar (Bayes Sonrası):<br>
        <strong>A:</strong> ${(posteriorA * 100).toFixed(1)}% | 
        <strong>B:</strong> ${(posteriorB * 100).toFixed(1)}% |
        <strong>C:</strong> ${(posteriorC * 100).toFixed(1)}% |
        <strong>D:</strong> ${(posteriorD * 100).toFixed(1)}%
    `;
    posteriorInfoElement.style.display = 'block';

    renderAsteroids();
}

function simulateSensor() {
    // Sensör, gerçek kristal konumuna göre sinyal üretir
    // Doğru kuşak için %65, diğer her biri için ~%11.67 olasılık
    const rand = Math.random();
    const wrongProb = (1 - SENSOR_ACCURACY) / 3; // Her yanlış kuşak için olasılık

    const belts = ['A', 'B', 'C', 'D'];
    const correctIndex = belts.indexOf(selectedBelt);

    let cumulative = 0;
    for (let i = 0; i < belts.length; i++) {
        if (i === correctIndex) {
            cumulative += SENSOR_ACCURACY;
        } else {
            cumulative += wrongProb;
        }
        if (rand < cumulative) {
            return belts[i];
        }
    }
    return belts[3]; // Fallback
}

function calculatePosterior(sensorReading) {
    // Bayes Teoremi: P(Kristal_X|Sinyal) = P(Sinyal|Kristal_X) * P(Kristal_X) / P(Sinyal)

    // Likelihood'lar
    const pSignalGivenCorrect = SENSOR_ACCURACY; // %65
    const pSignalGivenWrong = (1 - SENSOR_ACCURACY) / 3; // ~%11.67 her biri için

    let pSignalA, pSignalB, pSignalC, pSignalD;

    if (sensorReading === 'A') {
        pSignalA = pSignalGivenCorrect;
        pSignalB = pSignalGivenWrong;
        pSignalC = pSignalGivenWrong;
        pSignalD = pSignalGivenWrong;
    } else if (sensorReading === 'B') {
        pSignalA = pSignalGivenWrong;
        pSignalB = pSignalGivenCorrect;
        pSignalC = pSignalGivenWrong;
        pSignalD = pSignalGivenWrong;
    } else if (sensorReading === 'C') {
        pSignalA = pSignalGivenWrong;
        pSignalB = pSignalGivenWrong;
        pSignalC = pSignalGivenCorrect;
        pSignalD = pSignalGivenWrong;
    } else {
        pSignalA = pSignalGivenWrong;
        pSignalB = pSignalGivenWrong;
        pSignalC = pSignalGivenWrong;
        pSignalD = pSignalGivenCorrect;
    }

    // P(Sinyal) = Σ P(Sinyal|X) * P(X)
    const pSignal = pSignalA * NORM_PRIOR_A + pSignalB * NORM_PRIOR_B + pSignalC * NORM_PRIOR_C + pSignalD * NORM_PRIOR_D;

    // Posterior hesaplama
    posteriorA = (pSignalA * NORM_PRIOR_A) / pSignal;
    posteriorB = (pSignalB * NORM_PRIOR_B) / pSignal;
    posteriorC = (pSignalC * NORM_PRIOR_C) / pSignal;
    posteriorD = (pSignalD * NORM_PRIOR_D) / pSignal;
}

function selectBelt(choice) {
    if (gameEnded) return;

    gameEnded = true;
    fuel--;
    updateStats();

    const isWin = choice === selectedBelt;

    // Reveal all belts
    revealBelts(choice, isWin);

    if (isWin) {
        const gain = observationDone ? WIN_REWARD_WITH_SCAN : WIN_REWARD_WITHOUT_SCAN;
        credits += gain;
        updateStats();

        setTimeout(() => {
            showResult(true, gain);
        }, 800);
    } else {
        setTimeout(() => {
            showResult(false, 0);
        }, 800);
    }
}

function revealBelts(choice, isWin) {
    const beltA = document.getElementById('belt-A');
    const beltB = document.getElementById('belt-B');
    const beltC = document.getElementById('belt-C');
    const beltD = document.getElementById('belt-D');

    beltA.classList.add('revealed');
    beltB.classList.add('revealed');
    beltC.classList.add('revealed');
    beltD.classList.add('revealed');

    // Show content for each belt
    const belts = { 'A': beltA, 'B': beltB, 'C': beltC, 'D': beltD };

    for (const [key, element] of Object.entries(belts)) {
        if (key === selectedBelt) {
            element.innerHTML += '<div class="content-icon">💎</div>';
            element.classList.add('win');
        } else {
            element.innerHTML += '<div class="content-icon">🪨</div>';
            element.classList.add('lose');
        }
    }
}

function showResult(isWin, gain) {
    const overlay = document.createElement('div');
    overlay.className = 'result-overlay';
    overlay.id = 'result-overlay';

    if (isWin) {
        overlay.innerHTML = `
            <div class="result-content win">
                <div class="result-icon">💎✨</div>
                <div class="result-title">KRİSTAL BULUNDU!</div>
                <div class="result-message">
                    Tebrikler Kaptan! Madencilik başarılı.<br>
                    <strong>+${gain} Kredi</strong> kazandınız!
                    ${!observationDone ? '<br><small>(Risk aldınız, bonus ödül!)</small>' : ''}
                </div>
                <button class="result-close" onclick="closeResult()">DEVAM</button>
            </div>
        `;
    } else {
        overlay.innerHTML = `
            <div class="result-content lose">
                <div class="result-icon">🪨💨</div>
                <div class="result-title">SADECE ENKAZ!</div>
                <div class="result-message">
                    Maalesef Kaptan, bu kuşakta sadece uzay çöpü vardı.<br>
                    Kristaller <strong>Kuşak ${selectedBelt}</strong>'daymış!
                </div>
                <button class="result-close" onclick="closeResult()">DEVAM</button>
            </div>
        `;
    }

    document.body.appendChild(overlay);
}

function closeResult() {
    const overlay = document.getElementById('result-overlay');
    if (overlay) {
        overlay.remove();
    }

    if (fuel <= 0) {
        showGameOver();
    } else {
        // Otomatik olarak sonraki sektöre geç
        initializeGame();
    }
}

function showGameOver() {
    const isVictory = credits >= WIN_TARGET;
    const gameOver = document.createElement('div');
    gameOver.id = 'game-over';
    gameOver.className = isVictory ? 'victory' : 'defeat';

    if (isVictory) {
        gameOver.innerHTML = `
            <div class="game-over-icon">🏆✨</div>
            <h2>GÖREV BAŞARILI!</h2>
            <div class="final-score">
                <span style="color: var(--color-success);">💰 ${credits}</span> Kredi
            </div>
            <p style="color: #22c55e; margin-bottom: 10px; font-size: 1.3rem;">
                Tebrikler Kaptan! Hedefe ulaştınız!
            </p>
            <p style="color: #94a3b8; margin-bottom: 30px; font-size: 1rem;">
                ${TOTAL_SECTORS} sektörde ${WIN_TARGET}+ kredi topladınız.
            </p>
            <button id="restart-button" onclick="restartGame()">YENİDEN OYNA</button>
        `;
    } else {
        gameOver.innerHTML = `
            <div class="game-over-icon">💫🚀</div>
            <h2>GÖREV BAŞARISIZ</h2>
            <div class="final-score">
                <span style="color: var(--color-danger);">💰 ${credits}</span> Kredi
            </div>
            <p style="color: #ef4444; margin-bottom: 10px; font-size: 1.3rem;">
                Hedefe ulaşamadınız!
            </p>
            <p style="color: #94a3b8; margin-bottom: 30px; font-size: 1rem;">
                ${TOTAL_SECTORS} sektörde ${WIN_TARGET} krediye ulaşmanız gerekiyordu.
            </p>
            <button id="restart-button" onclick="restartGame()">TEKRAR DENE</button>
        `;
    }
    document.body.appendChild(gameOver);
}

function restartGame() {
    // LMS'e tamamlanma sinyali gönder
    sinyalYolla();

    const gameOver = document.getElementById('game-over');
    if (gameOver) {
        gameOver.remove();
    }

    credits = 250;
    fuel = 10;
    currentSector = 0;
    // Yeni oyun için rastgele özel sektör belirle (1-10 arası)
    specialSector = Math.floor(Math.random() * 10) + 1;
    initializeGame();
}

// LMS/SCORM entegrasyonu için tamamlanma sinyali
function sinyalYolla() {
    var result = {
        completion: true
    };

    var completeWindow = window.parent.document.getElementById("frmSubjectApp")?.contentWindow;

    if (completeWindow?.onCompleted) {
        completeWindow.onCompleted(result);
    }
}
