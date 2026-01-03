/* =========================================
   城九爵士鼓 - 挑戰系統核心邏輯 (修正版)
   ========================================= */

let students = JSON.parse(localStorage.getItem('drumStudents') || '[]');
let records = JSON.parse(localStorage.getItem('drumRecords') || '[]');
let currentStudent = "";

let timerInterval, metroInterval, prepInterval;
let startTime;
let audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// 2. 學生建檔功能
document.getElementById('photoInput').onchange = function(e) {
    const reader = new FileReader();
    reader.onload = function(event){
        const img = new Image();
        img.onload = function(){
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
                if (height > MAX_WIDTH) { width *= MAX_WIDTH / height; height = MAX_WIDTH; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            document.getElementById('preview').src = canvas.toDataURL('image/jpeg', 0.9);
            document.getElementById('preview').style.display = 'block';
        }
        img.src = event.target.result;
    }
    if(e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
};

// 2. 學生建檔功能 (優化版)
function saveStudent() {
    const name = document.getElementById('studentName').value.trim();
    const imgData = document.getElementById('preview').src;
    
    // 防止空白與未上傳照片
    if(!name) return alert("請輸入學生姓名");
    if(!imgData || imgData.includes('undefined') || imgData === window.location.href) {
        return alert("請上傳學生照片");
    }

    // 防止重複姓名新增 (客觀邏輯：同名視為同一人)
    const isDuplicate = students.some(s => s.name === name);
    if(isDuplicate) return alert("該學生姓名已存在，請勿重複建立");
    
    // 正式新增
    students.push({ id: Date.now(), name, photo: imgData });
    localStorage.setItem('drumStudents', JSON.stringify(students));
    
    // 清空輸入欄位
    document.getElementById('studentName').value = "";
    document.getElementById('preview').style.display = "none";
    document.getElementById('preview').src = ""; 
    renderStudents();
}

// 渲染學生清單 (加入右側刪除按鈕)
function renderStudents() {
    const list = document.getElementById('studentList');
    if (!list) return;

    list.innerHTML = students.map(s => `
        <div class="student-item">
            <div class="student-info" onclick="selectStudent('${s.name}')" style="display:flex; align-items:center; flex-grow:1; overflow:hidden;">
                <img src="${s.photo}"> 
                <span>${s.name}</span>
            </div>
            <button class="student-delete-btn" onclick="event.stopPropagation(); deleteStudent(${s.id})">✕</button>
        </div>
    `).join('');
}

// 刪除學生功能
function deleteStudent(id) {
    const student = students.find(s => s.id === id);
    if(confirm(`確定要刪除學生「${student.name}」嗎？\n這不會刪除排行榜紀錄，但該項目將失去照片。`)) {
        students = students.filter(s => s.id !== id);
        localStorage.setItem('drumStudents', JSON.stringify(students));
        
        // 如果剛好是目前選中的學生，清空選擇狀態
        if (currentStudent === student.name) currentStudent = "";
        
        renderStudents();
        renderRanking(); // 重新渲染排行榜以更新照片狀態
    }
}

// 3. 排行榜與計分邏輯
function renderRanking() {
    const board = document.getElementById('rankingBoard');
    if (!board) return;
    const sorted = [...records].sort((a, b) => b.score - a.score);
    
    board.innerHTML = sorted.map((r, index) => {
        const rankNum = index + 1;
        const rankClass = rankNum <= 3 ? `rank-${rankNum}` : '';
        const studentData = students.find(s => s.name === r.name);
        const photoUrl = studentData ? studentData.photo : ''; 
        const dateStr = new Date(r.timestamp || Date.now()).toLocaleDateString();

        return `
            <div class="ranking-item ${rankClass}">
                <div class="rank-section">${rankNum}</div>
                <div class="photo-container">
                    <img src="${photoUrl}" class="rank-avatar">
                </div>
                <div class="name-section">
                    <div class="name-text">${r.name}</div>
                    <div class="date-text">${dateStr}</div>
                </div>
                <div class="data-section">
                    <div class="data-group">
                        <span class="data-label">持續時間</span>
                        <span class="data-value">${r.timeStr}</span>
                    </div>
                    <div class="data-group">
                        <span class="data-label">速度</span>
                        <span class="data-value">${r.bpm} <small>BPM</small></span>
                    </div>
                    <div class="data-group">
                        <span class="data-label">音符</span>
                        <span class="data-value">${r.noteText.split(' ')[0]}</span>
                    </div>
                </div>
                <div class="score-section">${r.score.toLocaleString()}</div>
                <button class="delete-btn" onclick="deleteRecord(${r.timestamp})">✕</button>
            </div>`;
    }).join('');
}

function deleteRecord(timestamp) {
    if(confirm("確定刪除此紀錄？")) {
        records = records.filter(r => r.timestamp !== timestamp);
        localStorage.setItem('drumRecords', JSON.stringify(records));
        renderRanking();
    }
}

// 4. 節拍器與計時器核心
function playClick() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const envelope = audioCtx.createGain();
    osc.frequency.value = 880;
    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.connect(envelope);
    envelope.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function resetChallenge() {
    clearInterval(timerInterval);
    clearInterval(metroInterval);
    clearInterval(prepInterval);
    const timerElem = document.getElementById('timer');
    if (timerElem) timerElem.innerText = "00:00.00";
    const countElem = document.getElementById('countdownText');
    if (countElem) countElem.innerText = "挑戰準備";
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    startTime = null;
}

function startChallenge() {
    if(!currentStudent) return alert("請先在左側選單選擇學生！");
    resetChallenge();
    
    document.getElementById('startBtn').disabled = true;
    const bpm = parseInt(document.getElementById('bpmDisplay').value);
    const interval = 60000 / bpm;

    document.getElementById('countdownText').innerText = "準備中...";
    let prepCount = 0;
    
    prepInterval = setInterval(() => {
        playClick();
        prepCount++;
        document.getElementById('countdownText').innerText = `預備拍: ${prepCount}`;
        if(prepCount >= 4) {
            clearInterval(prepInterval);
            document.getElementById('countdownText').innerText = "挑戰開始！";
            document.getElementById('stopBtn').disabled = false;
            startTimer(bpm, interval);
        }
    }, interval);
}

function startTimer(bpm, interval) {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const diff = Date.now() - startTime;
        const m = Math.floor(diff / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        const ms = Math.floor((diff % 1000) / 10).toString().padStart(2, '0');
        document.getElementById('timer').innerText = `${m}:${s}.${ms}`;
    }, 30);
    metroInterval = setInterval(playClick, interval);
}

function stopChallenge() {
    clearInterval(timerInterval);
    clearInterval(metroInterval);
    clearInterval(prepInterval);
    
    const timeStr = document.getElementById('timer').innerText;
    const durationMs = Date.now() - startTime;
    const durationMin = durationMs / 60000;
    const durationSec = durationMs / 1000;
    
    const bpm = parseInt(document.getElementById('bpmDisplay').value);
    const noteSelect = document.getElementById('noteValue');
    const noteValue = parseInt(noteSelect.value);
    const noteText = noteSelect.options[noteSelect.selectedIndex].text;

    const totalFreq = bpm * noteValue; 

    let baseMultiplier = 1;
    if (totalFreq >= 800) baseMultiplier = 500;
    else if (totalFreq >= 720) baseMultiplier = 100;
    else if (totalFreq >= 640) baseMultiplier = 20;
    else if (totalFreq >= 560) baseMultiplier = 5;
    else if (totalFreq >= 480) baseMultiplier = 2;

    let enduranceBonus = 1.0;
    if (durationMin > 5) {
        enduranceBonus += Math.min(0.5, (Math.floor(durationMin / 5) * 0.1));
    }

    const score = Math.floor(totalFreq * durationSec * baseMultiplier * enduranceBonus / 10);

    // --- 核心邏輯調整：破紀錄判定 ---
    const existingIndex = records.findIndex(r => r.name === currentStudent);
    const isNewStudent = (existingIndex === -1);
    const isHighScore = !isNewStudent && (score > records[existingIndex].score);

    if (isNewStudent) {
        // 情況 A：新學生第一次登錄
        if(confirm(`挑戰結束！\n最終得分：${score.toLocaleString()}\n\n這是你的第一次紀錄，是否登入排行榜？`)) {
            saveAndRefresh(score, bpm, durationMs, timeStr, noteText, -1);
        }
    } else if (isHighScore) {
        // 情況 B：老同學破紀錄了！
        const diff = score - records[existingIndex].score;
        if(confirm(`太強了！破紀錄了！\n進步了：${diff.toLocaleString()} 分\n新紀錄：${score.toLocaleString()}\n\n是否更新排行榜？`)) {
            saveAndRefresh(score, bpm, durationMs, timeStr, noteText, existingIndex);
        }
    } else {
        // 情況 C：沒破紀錄
        alert(`挑戰結束！得分：${score.toLocaleString()}\n可惜沒能超越個人紀錄 (${records[existingIndex].score.toLocaleString()})。\n城九老師勉勵你：再接再厲，穩住節奏！`);
        closeChallenge();
    }
}

// 為了讓代碼整潔，我們把儲存動作獨立出來
function saveAndRefresh(score, bpm, durationMs, timeStr, noteText, index) {
    const newRecord = { 
        name: currentStudent, 
        bpm, 
        duration: durationMs, 
        timeStr, 
        noteText, 
        score,
        timestamp: Date.now() 
    };

    if (index !== -1) {
        records[index] = newRecord; // 覆蓋舊紀錄
    } else {
        records.push(newRecord);    // 新增紀錄
    }

    localStorage.setItem('drumRecords', JSON.stringify(records));
    renderRanking();
    closeChallenge();
}

function openChallenge() { 
    document.getElementById('challengeModal').style.display = 'flex'; 
}

function closeChallenge() { 
    resetChallenge();
    document.getElementById('challengeModal').style.display = 'none'; 
}

// 初始化執行
renderStudents();
renderRanking();