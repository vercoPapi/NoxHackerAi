-- Konfigurasi Awal
local baseBet = 100 -- Taruhan awal
local currentBet = baseBet
local winMultiplier = 2 -- Pengali setiap kali menang

-- Fungsi untuk menang
function onWin(amount)
    print("Selamat! Kamu menang: " .. amount)
    
    -- Logika Auto Double
    currentBet = currentBet * winMultiplier
    
    print("Taruhan berikutnya dinaikkan menjadi: " .. currentBet)
    return currentBet
end

-- Fungsi untuk kalah (Reset taruhan ke awal)
function onLose()
    print("Sayang sekali, kalah. Reset taruhan ke awal.")
    currentBet = baseBet
    return currentBet
end

-- Simulasi penggunaan
print("Mulai permainan dengan taruhan: " .. currentBet)
currentBet = onWin(500) -- Simulasi menang
currentBet = onWin(1000) -- Simulasi menang lagi
currentBet = onLose()    -- Simulasi kalah
