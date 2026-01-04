/* =========================================
   城九爵士鼓 - 挑戰系統核心邏輯 (精確修正版)
   ========================================= */

let students = JSON.parse(localStorage.getItem('drumStudents') || '[]');
let records = JSON.parse(localStorage.getItem('drumRecords') || '[]');
let currentStudent = "";

let timerInterval, metroInterval, prepInterval;
let startTime;
let audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// 1. 照片處理 (保留 UI 結構)
document.getElementById('photoInput').onchange = function(e) {
    const reader = new FileReader();
    reader.onload = function(event){
        const img = new Image();
        img.onload = function(){
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            let width = img.width, height = img.height;
            if (width > height) {
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
                if (height > MAX_WIDTH) { width *= MAX_WIDTH / height; height = MAX_WIDTH; }
            }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            document.getElementById('preview').src = canvas.toDataURL('image/jpeg', 0.9);
            document.getElementById('preview').style.display = 'block';
        }
        img.src = event.target.result;
    }
    if(e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
};

// 2. 學生功能 (保留 UI 結構)
function saveStudent() {
    const name = document.getElementById('studentName').value.trim();
    const imgData = document.getElementById('preview').src;
    if(!name || !imgData || imgData.includes('undefined')) return alert("請輸入姓名並上傳照片");
    if(students.some(s => s.name === name)) return alert("姓名重複");
    students.push({ id: Date.now(), name, photo: imgData });
    localStorage.setItem('drumStudents', JSON.stringify(students));
    document.getElementById('studentName').value = "";
    document.getElementById('preview').style.display = "none";
    renderStudents();
}

function renderStudents() {
    const list = document.getElementById('studentList');
    if (!list) return;
    list.innerHTML = students.map(s => `
        <div class="student-item">
            <div class="student-info" onclick="selectStudent('${s.name}')" style="display:flex; align-items:center; flex-grow:1; cursor:pointer;">
                <img src="${s.photo}"> <span>${s.name}</span>
            </div>
            <button class="student-delete-btn" onclick="event.stopPropagation(); deleteStudent(${s.id})">✕</button>
        </div>
    `).join('');
}

function selectStudent(name) {
    currentStudent = name;
    document.querySelectorAll('.student-item').forEach(item => {
        item.style.border = "1px solid #444";
        item.style.backgroundColor = "#333";
        if (item.querySelector('span').innerText === name) {
            item.style.border = "2px solid #e74c3c";
            item.style.backgroundColor = "rgba(231, 76, 60, 0.1)";
        }
    });
}

function deleteStudent(id) {
    if(confirm("確定刪除？")) {
        students = students.filter(s => s.id !== id);
        localStorage.setItem('drumStudents', JSON.stringify(students));
        renderStudents();
    }
}

// 3. 節拍器與重音邏輯
function playClick(isStrong = false) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.frequency.value = isStrong ? 1200 : 800; // 重音拉高至 1200Hz 更有穿透力
    env.gain.value = 1;
    env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.connect(env); env.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}

function startChallenge() {
    if(!currentStudent) return alert("請選擇學生！");
    resetChallenge();
    const bpm = parseInt(document.getElementById('bpmDisplay').value);
    const noteValue = parseInt(document.getElementById('noteValue').value);
    const subInterval = (60000 / bpm) / noteValue;

    document.getElementById('startBtn').disabled = true;
    let prepCount = 1; 
    
    // 預備拍邏輯：固定四拍四分音符
    document.getElementById('countdownText').innerText = `預備拍: 1`;
    playClick(true); 

    prepInterval = setInterval(() => {
        prepCount++;
        if(prepCount <= 4) {
            playClick(true);
            document.getElementById('countdownText').innerText = `預備拍: ${prepCount}`;
        } else {
            clearInterval(prepInterval);
            document.getElementById('countdownText').innerText = "挑戰開始！";
            document.getElementById('stopBtn').disabled = false;
            
            // --- 關鍵修正：進入正式挑戰 ---
            startTime = Date.now();
            startTimer(bpm, subInterval, noteValue);
        }
    }, 60000 / bpm);
}

function startTimer(bpm, subInterval, noteValue) {
    // A. 計時器顯示
    timerInterval = setInterval(() => {
        const diff = Date.now() - startTime;
        const m = Math.floor(diff / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        const ms = Math.floor((diff % 1000) / 10).toString().padStart(2, '0');
        document.getElementById('timer').innerText = `${m}:${s}.${ms}`;
    }, 30);

    // B. 節拍器邏輯：確保 4/4 拍循環
    // 無論是 4/8/16分音符，重音永遠發生在「第一拍」
    let clickCount = 0;
    
    // 立即補上第一拍重音，避免 setInterval 的延遲
    playClick(true);
    clickCount++;

    metroInterval = setInterval(() => {
        // 判定重音循環：
        // 4分音符(nv=1)：每 4 下一重 (0, 4, 8...)
        // 8分音符(nv=2)：每 8 下一重 (0, 8, 16...)
        // 16分音符(nv=4)：每 16 下一重 (0, 16, 32...)
        const cycle = noteValue * 4; 
        const isStrong = (clickCount % cycle === 0);
        
        playClick(isStrong);
        clickCount++;
    }, subInterval);
}


// 4. 分數與排行榜 (城九含金量修正版)
function stopChallenge() {
    clearInterval(timerInterval); 
    clearInterval(metroInterval); 
    clearInterval(prepInterval);
    
    if (!startTime) return resetChallenge();

    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;
    const bpm = parseInt(document.getElementById('bpmDisplay').value);
    const noteSelect = document.getElementById('noteValue');
    // 注意：此處 noteValue 變數雖然取得，但依照您的要求，公式不再乘上它，僅依據 BPM 判定含金量

    /* 城九含金量計分公式 (指數加權 1.07)
       目標：200 BPM 1分鐘 (約 1041萬) > 180 BPM 3分鐘 (約 730萬)
    */
    const speedBonus = Math.pow(1.07, (bpm - 100)); 
    const score = Math.floor(bpm * durationSec * speedBonus);

    const existingIndex = records.findIndex(r => r.name === currentStudent);
    
    if (existingIndex === -1 || score > records[existingIndex].score) {
        if(confirm(`破紀錄！含金量得分：${score.toLocaleString()}\n是否存入排行榜？`)) {
            saveAndRefresh(
                score, 
                bpm, 
                durationMs, 
                document.getElementById('timer').innerText, 
                noteSelect.options[noteSelect.selectedIndex].text, 
                existingIndex
            );
        }
    } else {
        alert(`挑戰結束！得分：${score.toLocaleString()}\n(未超越個人紀錄)`);
    }
    closeChallenge();
}

function saveAndRefresh(score, bpm, ms, timeStr, noteText, index) {
    const newRecord = { name: currentStudent, bpm, duration: ms, timeStr, noteText, score, timestamp: Date.now() };
    if (index !== -1) records[index] = newRecord; else records.push(newRecord);
    localStorage.setItem('drumRecords', JSON.stringify(records));
    renderRanking();
    closeChallenge();
}

function renderRanking() {
    const board = document.getElementById('rankingBoard');
    if (!board) return;
    board.innerHTML = [...records].sort((a,b) => b.score - a.score).map((r, i) => {
        const student = students.find(s => s.name === r.name);
        return `
            <div class="ranking-item ${i < 3 ? 'rank-' + (i+1) : ''}">
                <div class="rank-section">${i + 1}</div>
                <div class="photo-container"><img src="${student ? student.photo : ''}" class="rank-avatar"></div>
                <div class="name-section">
                    <div class="name-text">${r.name}</div>
                    <div class="date-text">${new Date(r.timestamp).toLocaleDateString()}</div>
                </div>
                <div class="data-section">
                    <div class="data-group"><span class="data-label">時間</span><span class="data-value">${r.timeStr}</span></div>
                    <div class="data-group"><span class="data-label">速度</span><span class="data-value">${r.bpm} BPM</span></div>
                    <div class="data-group"><span class="data-label">音符</span><span class="data-value">${r.noteText.split(' ')[0]}</span></div>
                </div>
                <div class="score-section">${r.score.toLocaleString()}</div>
                <button class="delete-btn" onclick="deleteRecord(${r.timestamp})">✕</button>
            </div>`;
    }).join('');
}

function deleteRecord(ts) {
    if(confirm("刪除紀錄？")) {
        records = records.filter(r => r.timestamp !== ts);
        localStorage.setItem('drumRecords', JSON.stringify(records));
        renderRanking();
    }
}

function resetChallenge() {
    clearInterval(timerInterval); clearInterval(metroInterval); clearInterval(prepInterval);
    document.getElementById('timer').innerText = "00:00.00";
    document.getElementById('countdownText').innerText = "挑戰準備";
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    startTime = null;
}

function openChallenge() { document.getElementById('challengeModal').style.display = 'flex'; }
function closeChallenge() { resetChallenge(); document.getElementById('challengeModal').style.display = 'none'; }

renderStudents();
renderRanking();
