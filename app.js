document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const now = new Date();

  function formatDateBadge(d) {
    return `_${d.getMonth() + 1}/${d.getDate()} ${dayNames[d.getDay()]}`;
  }

  function parseDateKey(dateStr, fallbackYear) {
    const match = (dateStr || '').match(/(\d{1,2})\s*[\/\.]\s*(\d{1,2})/);
    if (match) {
      const month = String(parseInt(match, 10)).padStart(2, '0');
      const day = String(parseInt(match, 10)).padStart(2, '0');
      return `${fallbackYear}-${month}-${day}`;
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function getYesterdayDateKey(dateKey) {
    const parts = dateKey.split('-').map(Number);
    const d = new Date(parts[0], parts - 1, parts);
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const dateInput = document.getElementById('diary-date');
  const userNameInput = document.getElementById('user-name');
  const saveStatusText = document.getElementById('save-status-text');
  const toast = document.getElementById('toast');

  const todayBody = document.getElementById('today-table-body');
  const tomorrowBody = document.getElementById('tomorrow-table-body');
  const addTodayBtn = document.getElementById('add-today-row-btn');
  const addTomorrowBtn = document.getElementById('add-tomorrow-row-btn');

  const generalFieldIds = [
    'user-name', 'diary-date',
    'media-search', 'media-sns', 'media-video', 'media-etc',
    'meditation-chapter', 'meditation-content',
    'faith-emotion', 'faith-situation', 'faith-desire', 'faith-lesson',
    'faith-gratitude-1', 'faith-gratitude-2',
    'faith-repent-1', 'faith-repent-2',
    'prayer-content'
  ];

  // --- 1. 다크 모드 토글 ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('app_theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  applyTheme(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
    themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    const themeMeta = document.getElementById('theme-color-meta');
    if (themeMeta) {
      themeMeta.setAttribute('content', theme === 'dark' ? '#111318' : '#ffffff');
    }
  }

  // --- 2. 오늘 일정 표 행 생성 (시간 | 내용 | O/X | ✕) ---
  function createTodayRow(item = { time: '', text: '', status: '' }) {
    const tr = document.createElement('tr');
    tr.dataset.status = item.status || '';

    // 시간 칸
    const tdTime = document.createElement('td');
    const timeInput = document.createElement('input');
    timeInput.type = 'text';
    timeInput.className = 'cell-input today-time-input';
    timeInput.value = item.time || '';
    timeInput.addEventListener('input', saveDraft);
    tdTime.appendChild(timeInput);

    // 내용 칸
    const tdText = document.createElement('td');
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'cell-input text-left today-text-input';
    textInput.value = item.text || '';
    textInput.addEventListener('input', saveDraft);
    tdText.appendChild(textInput);

    // O / X 칸
    const tdOx = document.createElement('td');
    const oxWrap = document.createElement('div');
    oxWrap.className = 'ox-cell-wrap';

    const btnO = document.createElement('button');
    btnO.type = 'button';
    btnO.className = 'ox-btn ox-o' + (item.status === 'O' ? ' active-o' : '');
    btnO.textContent = 'o';
    btnO.addEventListener('click', () => {
      if (tr.dataset.status === 'O') {
        tr.dataset.status = '';
        btnO.classList.remove('active-o');
      } else {
        tr.dataset.status = 'O';
        btnO.classList.add('active-o');
        btnX.classList.remove('active-x');
      }
      saveDraft();
    });

    const btnX = document.createElement('button');
    btnX.type = 'button';
    btnX.className = 'ox-btn ox-x' + (item.status === 'X' ? ' active-x' : '');
    btnX.textContent = 'x';
    btnX.addEventListener('click', () => {
      if (tr.dataset.status === 'X') {
        tr.dataset.status = '';
        btnX.classList.remove('active-x');
      } else {
        tr.dataset.status = 'X';
        btnX.classList.add('active-x');
        btnO.classList.remove('active-o');
      }
      saveDraft();
    });

    oxWrap.appendChild(btnO);
    oxWrap.appendChild(btnX);
    tdOx.appendChild(oxWrap);

    // 삭제 칸
    const tdDel = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'del-cell-btn';
    delBtn.innerHTML = '&times;';
    delBtn.addEventListener('click', () => {
      tr.remove();
      if (todayBody.children.length === 0) {
        todayBody.appendChild(createTodayRow({ time: '', text: '', status: '' }));
      }
      saveDraft();
    });
    tdDel.appendChild(delBtn);

    tr.appendChild(tdTime);
    tr.appendChild(tdText);
    tr.appendChild(tdOx);
    tr.appendChild(tdDel);

    return tr;
  }

  // --- 3. 내일 일정 표 행 생성 (시작 | ~ | 종료 | 내용 | ✕) ---
  function createTomorrowRow(item = { start: '', end: '', text: '' }) {
    const tr = document.createElement('tr');

    // 시작 시간
    const tdStart = document.createElement('td');
    const startInput = document.createElement('input');
    startInput.type = 'text';
    startInput.className = 'cell-input tomorrow-start-input';
    startInput.value = item.start || '';
    startInput.addEventListener('input', saveDraft);
    tdStart.appendChild(startInput);

    // 물결 구분자
    const tdTilde = document.createElement('td');
    tdTilde.className = 'cell-tilde';
    tdTilde.textContent = '~';

    // 종료 시간
    const tdEnd = document.createElement('td');
    const endInput = document.createElement('input');
    endInput.type = 'text';
    endInput.className = 'cell-input tomorrow-end-input';
    endInput.value = item.end || '';
    endInput.addEventListener('input', saveDraft);
    tdEnd.appendChild(endInput);

    // 내용 칸
    const tdText = document.createElement('td');
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'cell-input text-left tomorrow-text-input';
    textInput.value = item.text || '';
    textInput.addEventListener('input', saveDraft);
    tdText.appendChild(textInput);

    // 삭제 칸
    const tdDel = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'del-cell-btn';
    delBtn.innerHTML = '&times;';
    delBtn.addEventListener('click', () => {
      tr.remove();
      if (tomorrowBody.children.length === 0) {
        tomorrowBody.appendChild(createTomorrowRow({ start: '', end: '', text: '' }));
      }
      saveDraft();
    });
    tdDel.appendChild(delBtn);

    tr.appendChild(tdStart);
    tr.appendChild(tdTilde);
    tr.appendChild(tdEnd);
    tr.appendChild(tdText);
    tr.appendChild(tdDel);

    return tr;
  }

  addTodayBtn.addEventListener('click', () => {
    todayBody.appendChild(createTodayRow({ time: '', text: '', status: '' }));
  });

  addTomorrowBtn.addEventListener('click', () => {
    tomorrowBody.appendChild(createTomorrowRow({ start: '', end: '', text: '' }));
  });

  // 데이터 추출 헬퍼
  function getTodayScheduleData() {
    const rows = todayBody.querySelectorAll('tr');
    const list = [];
    rows.forEach(tr => {
      const time = tr.querySelector('.today-time-input')?.value.trim() || '';
      const text = tr.querySelector('.today-text-input')?.value.trim() || '';
      const status = tr.dataset.status || '';
      if (time || text || status) {
        list.push({ time, text, status });
      }
    });
    return list;
  }

  function getTomorrowScheduleData() {
    const rows = tomorrowBody.querySelectorAll('tr');
    const list = [];
    rows.forEach(tr => {
      const start = tr.querySelector('.tomorrow-start-input')?.value.trim() || '';
      const end = tr.querySelector('.tomorrow-end-input')?.value.trim() || '';
      const text = tr.querySelector('.tomorrow-text-input')?.value.trim() || '';
      if (start || end || text) {
        list.push({ start, end, text });
      }
    });
    return list;
  }

  // --- 4. 날짜별 스케줄 로드 & 전날 계획 연동 로직 ---
  function loadScheduleForDateKey(targetDateKey) {
    todayBody.innerHTML = '';
    tomorrowBody.innerHTML = '';

    const savedToday = localStorage.getItem('table_today_' + targetDateKey);
    const savedTomorrow = localStorage.getItem('table_tomorrow_' + targetDateKey);

    // 오늘 일정 복원
    if (savedToday) {
      try {
        const list = JSON.parse(savedToday);
        if (Array.isArray(list) && list.length > 0) {
          list.forEach(it => todayBody.appendChild(createTodayRow(it)));
        } else {
          todayBody.appendChild(createTodayRow());
        }
      } catch (e) {
        todayBody.appendChild(createTodayRow());
      }
    } else {
      // 전날 '내일 일정' 확인 후 오늘 일정으로 자동 로드
      const yesterdayKey = getYesterdayDateKey(targetDateKey);
      const prevTomorrow = localStorage.getItem('table_tomorrow_' + yesterdayKey);
      let loadedFromYesterday = false;

      if (prevTomorrow) {
        try {
          const list = JSON.parse(prevTomorrow);
          if (Array.isArray(list) && list.length > 0) {
            list.forEach(it => {
              // 시작시간과 종료시간 결합 (예: 12:00~13:00)
              const timeCombined = (it.start && it.end) ? `${it.start}~${it.end}` : (it.start || it.end || '');
              todayBody.appendChild(createTodayRow({
                time: timeCombined,
                text: it.text || '',
                status: ''
              }));
            });
            loadedFromYesterday = true;
            showToast('전날 계획했던 일정을 오늘 일정으로 불러왔습니다 ✨');
          }
        } catch (e) {}
      }

      if (!loadedFromYesterday) {
        todayBody.appendChild(createTodayRow());
      }
    }

    // 내일 일정 복원
    if (savedTomorrow) {
      try {
        const list = JSON.parse(savedTomorrow);
        if (Array.isArray(list) && list.length > 0) {
          list.forEach(it => tomorrowBody.appendChild(createTomorrowRow(it)));
        } else {
          tomorrowBody.appendChild(createTomorrowRow());
        }
      } catch (e) {
        tomorrowBody.appendChild(createTomorrowRow());
      }
    } else {
      tomorrowBody.appendChild(createTomorrowRow());
    }
  }

  // --- 5. 자동 임시 저장 & 복원 ---
  function saveDraft() {
    const targetDateKey = parseDateKey(dateInput.value, calCurrentYear);
    const draftData = {};

    generalFieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) draftData[id] = el.value;
    });

    const todayItems = getTodayScheduleData();
    const tomorrowItems = getTomorrowScheduleData();

    draftData['tableToday'] = todayItems;
    draftData['tableTomorrow'] = tomorrowItems;
    draftData['dateKey'] = targetDateKey;

    localStorage.setItem('diary_draft', JSON.stringify(draftData));
    localStorage.setItem('table_today_' + targetDateKey, JSON.stringify(todayItems));
    localStorage.setItem('table_tomorrow_' + targetDateKey, JSON.stringify(tomorrowItems));

    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    saveStatusText.textContent = `저장됨 (${timeStr})`;
  }

  function loadDraft() {
    const saved = localStorage.getItem('diary_draft');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        generalFieldIds.forEach(id => {
          const el = document.getElementById(id);
          if (el && data[id] !== undefined) {
            el.value = data[id];
          }
        });
      } catch (e) {
        console.error('Draft load error:', e);
      }
    }
    if (!dateInput.value) {
      dateInput.value = formatDateBadge(now);
    }

    const currentKey = parseDateKey(dateInput.value, calCurrentYear);
    loadScheduleForDateKey(currentKey);
  }

  // --- 6. Habit Tracker 달력 ---
  let calCurrentYear = now.getFullYear();
  let calCurrentMonth = now.getMonth();

  const calTitle = document.getElementById('calendar-title');
  const calDaysContainer = document.getElementById('calendar-days');
  const statDone = document.getElementById('stat-done');
  const statMissed = document.getElementById('stat-missed');
  const prevMonthBtn = document.getElementById('prev-month-btn');
  const nextMonthBtn = document.getElementById('next-month-btn');

  function getCompletedDates() {
    const raw = localStorage.getItem('completed_dates');
    return raw ? JSON.parse(raw) : [];
  }

  function renderCalendar(year, month) {
    calTitle.textContent = `${year}.${String(month + 1).padStart(2, '0')}`;
    calDaysContainer.innerHTML = '';

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const completedList = getCompletedDates();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    let monthDoneCount = 0;
    let monthMissedCount = 0;

    for (let i = 0; i < firstDayIndex; i++) {
      const emptyDiv = document.createElement('div');
      calDaysContainer.appendChild(emptyDiv);
    }

    for (let day = 1; day <= lastDate; day++) {
      const dayDiv = document.createElement('div');
      dayDiv.textContent = day;

      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = (dateKey === todayStr);
      const isPast = (dateKey < todayStr);
      const isDone = completedList.includes(dateKey);

      if (isToday) dayDiv.classList.add('today');
      if (isDone) {
        dayDiv.classList.add('completed');
        monthDoneCount++;
      } else if (isPast) {
        dayDiv.classList.add('missed');
        monthMissedCount++;
      }

      dayDiv.addEventListener('click', () => {
        saveDraft();
        const targetDate = new Date(year, month, day);
        dateInput.value = formatDateBadge(targetDate);
        loadScheduleForDateKey(dateKey);
        showToast(`${month + 1}월 ${day}일(${dayNames[targetDate.getDay()]})로 변경되었습니다.`);
      });

      calDaysContainer.appendChild(dayDiv);
    }

    statDone.textContent = `작성: ${monthDoneCount}일`;
    statMissed.textContent = `미작성: ${monthMissedCount}일`;
  }

  prevMonthBtn.addEventListener('click', () => {
    calCurrentMonth--;
    if (calCurrentMonth < 0) {
      calCurrentMonth = 11;
      calCurrentYear--;
    }
    renderCalendar(calCurrentYear, calCurrentMonth);
  });

  nextMonthBtn.addEventListener('click', () => {
    calCurrentMonth++;
    if (calCurrentMonth > 11) {
      calCurrentMonth = 0;
      calCurrentYear++;
    }
    renderCalendar(calCurrentYear, calCurrentMonth);
  });

  dateInput.addEventListener('change', () => {
    const targetKey = parseDateKey(dateInput.value, calCurrentYear);
    loadScheduleForDateKey(targetKey);
  });

  generalFieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', saveDraft);
  });

  loadDraft();
  renderCalendar(calCurrentYear, calCurrentMonth);
  setInterval(saveDraft, 5000);

  // --- 7. 작성 완료 및 복사 (원래 양식 완벽 유지) ---
  const copyBtn = document.getElementById('copy-btn');
  const resetBtn = document.getElementById('reset-btn');

  copyBtn.addEventListener('click', async () => {
    saveDraft();

    const name = userNameInput.value.trim() || '준영';
    const date = dateInput.value.trim() || formatDateBadge(now);
    const v = (id) => document.getElementById(id)?.value || '';

    // 오늘 일정 문자열 포맷
    const todayItems = getTodayScheduleData();
    const todayLines = todayItems.map(it => {
      let line = `${it.time} ${it.text}`.trim();
      if (it.status === 'O') line += ' ⭕️';
      else if (it.status === 'X') line += ' ❌';
      return line;
    }).filter(l => l.length > 0).join('\n');

    // 내일 일정 문자열 포맷
    const tomorrowItems = getTomorrowScheduleData();
    const tomorrowLines = tomorrowItems.map(it => {
      const timeCombined = (it.start && it.end) ? `${it.start}~${it.end}` : (it.start || it.end || '');
      return `${timeCombined} ${it.text}`.trim();
    }).filter(l => l.length > 0).join('\n');

    const formattedText = `🪽${name}의 스신말기🪽 ${date}
🤍step.1 스케줄
⏰오늘(⭕️❌)
${todayLines}
⏰내일
${tomorrowLines}
∞----------------------------𓏲𓎨ෆ ̖́-
🤍step.2 미디어 디톡스
▫️오늘 사용량

검색 : ${v('media-search')}
커뮤니티,SNS,유튜브 : ${v('media-sns')}
영상물 : ${v('media-video')}
기타 : ${v('media-etc')}
∞----------------------------𓏲𓎨ෆ ̖́-
🤍step.3 묵상
🕯️성경 장: ${v('meditation-chapter')}
와닿은 구절 & 와닿은 이유 및 느낀점:
${v('meditation-content')}
∞----------------------------𓏲𓎨ෆ ̖́-
🤍step.4 신앙일기
•오늘 느낀 감정의 종류
: ${v('faith-emotion')}

감정을 느낀 상황은 무엇인가요?
: ${v('faith-situation')}
나의 본심찾기 (나의 욕구:내가 원한 것)
: ${v('faith-desire')}
이 일을 통해 하나님께서 내게 알려주시고 싶으신 것은 무엇이었을까? (하나님의 도우심, 깨달은 점)
: ${v('faith-lesson')}
💛감사한 점

${v('faith-gratitude-1')}
${v('faith-gratitude-2')}
🙏🏻회개할 점

${v('faith-repent-1')}
${v('faith-repent-2')}
∞----------------------------𓏲𓎨ෆ ̖́-
🤍step.5 기도문
${v('prayer-content')}
🧎🏻시 62:1 나의 영혼이 잠잠히 하나님만 바람이여 나의 구원이 그에게서 나는도다`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(formattedText);
      } else {
        const temp = document.createElement('textarea');
        temp.value = formattedText;
        temp.style.position = 'fixed';
        temp.style.left = '-9999px';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }

      const targetDateKey = parseDateKey(date, calCurrentYear);
      const completedList = getCompletedDates();
      if (!completedList.includes(targetDateKey)) {
        completedList.push(targetDateKey);
        localStorage.setItem('completed_dates', JSON.stringify(completedList));
      }
      renderCalendar(calCurrentYear, calCurrentMonth);

      showToast('일기가 복사되고 완료(✅) 처리되었습니다.');
    } catch (err) {
      console.error(err);
      showToast('복사 권한 오류가 발생했습니다.');
    }
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('현재 작성 중인 내용을 모두 초기화하시겠습니까?')) {
      generalFieldIds.forEach(id => {
        if (id !== 'user-name') {
          const el = document.getElementById(id);
          if (el) el.value = '';
        }
      });
      dateInput.value = formatDateBadge(now);
      const targetDateKey = parseDateKey(dateInput.value, calCurrentYear);
      
      localStorage.removeItem('diary_draft');
      localStorage.removeItem('table_today_' + targetDateKey);
      localStorage.removeItem('table_tomorrow_' + targetDateKey);

      todayBody.innerHTML = '';
      tomorrowBody.innerHTML = '';
      todayBody.appendChild(createTodayRow());
      tomorrowBody.appendChild(createTomorrowRow());

      saveStatusText.textContent = '초기화됨';
      showToast('내용이 초기화되었습니다.');
    }
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }
});
