// main.js (Doğru Geri Sayım Mantığı ile Son Hali)

const SUPABASE_URL = 'YOUR_SUPABASE_URL'; 
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const TELEGRAM_BOT_USERNAME = 'YOUR_BOT_USERNAME';

const SYMBOLS = ['BTC/USDT', 'ETH/USDT'];
const CRYPTO_CARDS_CONTAINER = document.getElementById('crypto-cards-container');
let marketData = {};
let apiCallCounter = 0; // API çağrılarını yavaşlatmak için sayaç (her 10 saniyede bir)

function initializeCards() {
    CRYPTO_CARDS_CONTAINER.innerHTML = '';
    SYMBOLS.forEach(symbol => {
        const symbolId = symbol.replace('/', '-');
        const card = document.createElement('div');
        card.className = 'card';
        card.id = `card-${symbolId}`;
        card.innerHTML = `<div class="crypto-card-header"><span class="crypto-symbol">${symbol}</span><span class="crypto-price" id="price-${symbolId}">Yükleniyor...</span></div><div class="signal-status-container" id="status-${symbolId}"><div class="status-text">Veriler yükleniyor...</div></div>`;
        CRYPTO_CARDS_CONTAINER.appendChild(card);
        marketData[symbol] = { price: 0, lastPrice: 0, signal: null };
    });
    document.querySelector('.telegram-button').href = `https://t.me/${TELEGRAM_BOT_USERNAME}`;
}

async function fetchApiData() {
    try {
        const [pricePromises, signalsResponse] = await Promise.all([
            Promise.all(SYMBOLS.map(symbol => fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol.replace('/', '')}`).then(res => res.json()))),
            fetch(`${SUPABASE_URL}/rest/v1/signals?select=*&status=eq.active`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            })
        ]);

        pricePromises.forEach(data => {
            const symbol = SYMBOLS.find(s => s.replace('/', '') === data.symbol);
            if (symbol) {
                marketData[symbol].lastPrice = marketData[symbol].price;
                marketData[symbol].price = parseFloat(data.price);
            }
        });

        const activeSignals = await signalsResponse.json();
        SYMBOLS.forEach(symbol => {
            marketData[symbol].signal = activeSignals.find(s => s.symbol === symbol) || null;
        });

    } catch (error) {
        console.error("API verileri çekilirken hata:", error);
    }
}

function renderDashboard() {
    // New York saatini al
    const nyTime = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
    const nyHour = nyTime.getHours();
    
    // Tarama zamanı başladı mı? (NY saatiyle sabah 4 ve sonrası)
    const isScanningTime = nyHour >= 4;

    SYMBOLS.forEach(symbol => {
        const symbolId = symbol.replace('/', '-');
        const priceElement = document.getElementById(`price-${symbolId}`);
        const statusContainer = document.getElementById(`status-${symbolId}`);
        const data = marketData[symbol];

        // Fiyatları her zaman güncelle
        if (priceElement && data.price > 0) {
            priceElement.textContent = `$${data.price.toFixed(2)}`;
            priceElement.classList.toggle('price-up', data.price > data.lastPrice);
            priceElement.classList.toggle('price-down', data.price < data.lastPrice);
        }
        
        if (statusContainer) {
            // 1. Öncelik: Aktif bir sinyal varsa, her zaman sinyal barını göster
            if (data.signal) {
                const { entry_price, stop_loss, take_profit_2r } = data.signal;
                const minPrice = Math.min(stop_loss, take_profit_2r);
                const maxPrice = Math.max(stop_loss, take_profit_2r);
                const totalRange = maxPrice - minPrice;
                const calculatePosition = (price) => totalRange === 0 ? 0 : ((price - minPrice) / totalRange) * 100;
                
                const slPos = calculatePosition(stop_loss);
                const entryPos = calculatePosition(entry_price);
                let currentPos = calculatePosition(data.price);
                const tpPos = calculatePosition(take_profit_2r);
                currentPos = Math.max(0, Math.min(100, currentPos));

                statusContainer.innerHTML = `
                    <div class="progress-bar-area">
                        <div class="price-marker marker-top marker-sl" style="left: ${slPos}%;">
                            <span class="marker-label">SL</span><span class="marker-value">${stop_loss.toFixed(2)}</span>
                        </div>
                        <div class="price-marker marker-top marker-entry" style="left: ${entryPos}%;">
                            <span class="marker-label">Giriş</span><span class="marker-value">${entry_price.toFixed(2)}</span>
                        </div>
                        <div class="price-marker marker-top marker-tp" style="left: ${tpPos}%;">
                            <span class="marker-label">TP</span><span class="marker-value">${take_profit_2r.toFixed(2)}</span>
                        </div>
                        <div class="progress-bar-track"></div>
                        <div class="price-marker marker-bottom marker-current" style="left: ${currentPos}%;">
                             <span class="marker-value">${data.price.toFixed(2)}</span>
                        </div>
                    </div>`;
            }
            // 2. Öncelik: Sinyal yoksa ve tarama zamanı DEĞİLSE, geri sayımı göster
            else if (!isScanningTime) {
                const targetTime = new Date(nyTime);
                targetTime.setHours(4, 0, 0, 0);
                const diff = targetTime - nyTime;
                const h = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
                const m = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
                const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
                
                statusContainer.innerHTML = `<div class="status-text">Tarama başlangıcına kalan süre:<div class="countdown">${h}:${m}:${s}</div></div>`;
            }
            // 3. Öncelik: Sinyal yoksa ve tarama zamanı GELDİYSE, "Sinyal Aranıyor" göster
            else {
                statusContainer.innerHTML = `<div class="status-text">Sinyal Aranıyor...</div>`;
            }
        }
    });
}

// --- ANA DÖNGÜ ---
async function masterLoop() {
    // API çağrılarını her 10 saniyede bir yap
    if (apiCallCounter % 10 === 0) {
        await fetchApiData();
    }
    // Arayüzü her saniye anlık olarak güncelle
    renderDashboard();
    apiCallCounter++;
}

// Sayfa ilk yüklendiğinde kartları oluştur ve verileri hemen çek
initializeCards();
fetchApiData().then(renderDashboard);

// Ana döngüyü her saniye çalıştır
setInterval(masterLoop, 1000);