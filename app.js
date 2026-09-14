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

  const todayList = document.getElementById('today-schedule-list');
  const tomorrowList = document.getElementById('tomorrow-schedule-list');
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

  // --- 2. 스케줄 세로형 카드 생성 함수 ---
  function createScheduleCard(item = { time: '', text: '', status: '' }, isToday = true) {
    const card = document.createElement('div');
    card.className = 'schedule-item-card';
    card.dataset.status = item.status || '';

    // 시간 입력부
    const timeField = document.createElement('div');
    timeField.className = 'schedule-field';
    const timeLabel = document.createElement('label');
    timeLabel.className = 'field-label';
    timeLabel.textContent = '시간';
    const timeInput = document.createElement('input');
    timeInput.type = 'text';
    timeInput.className = 'schedule-input schedule-time';
    timeInput.value = item.time || '';
    timeInput.addEventListener('input', saveDraft);
    timeField.appendChild(timeLabel);
    timeField.appendChild(timeInput);

    // 내용 입력부
    const textField = document.createElement('div');
    textField.className = 'schedule-field';
    const textLabel = document.createElement('label');
    textLabel.className = 'field-label';
    textLabel.textContent = '내용';
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'schedule-input schedule-text';
    textInput.value = item.text || '';
    textInput.addEventListener('input', saveDraft);
    textField.appendChild(textLabel);
    textField.appendChild(textInput);

    // 하단 바 (토글 및 삭제)
    const bottomBar = document.createElement('div');
    bottomBar.className = 'schedule-bottom-bar' + (isToday ? '' : ' right-only');

    if (isToday) {
      const toggleGroup = document.createElement('div');
      toggleGroup.className = 'toggle-group';

      const btnO = document.createElement('button');
      btnO.type = 'button';
      btnO.className = 'toggle-btn toggle-o' + (item.status === 'O' ? ' active-o' : '');
      btnO.textContent = '⭕️ 완료';
      btnO.addEventListener('click', () => {
        if (card.dataset.status === 'O') {
          card.dataset.status = '';
          btnO.classList.remove('active-o');
        } else {
          card.dataset.status = 'O';
          btnO.classList.add('active-o');
          btnX.classList.remove('active-x');
        }
        saveDraft();
      });

      const btnX = document.createElement('button');
      btnX.type = 'button';
      btnX.className = 'toggle-btn toggle-x' + (item.status === 'X' ? ' active-x' : '');
      btnX.textContent = '❌ 미완료';
      btnX.addEventListener('click', () => {
        if (card.dataset.status === 'X') {
          card.dataset.status = '';
          btnX.classList.remove('active-x');
        } else {
          card.dataset.status = 'X';
          btnX.classList.add('active-x');
          btnO.classList.remove('active-o');
        }
        saveDraft();
      });

      toggleGroup.appendChild(btnO);
      toggleGroup.appendChild(btnX);
      bottomBar.appendChild(toggleGroup);
    }

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'delete-item-btn';
    delBtn.textContent = '✕ 삭제';
    delBtn.addEventListener('click', () => {
      const parent = card.parentElement;
      card.remove();
      if (parent && parent.children.length === 0) {
        addScheduleCard(parent.id, { time: '', text: '', status: '' }, isToday);
      }
      saveDraft();
    });

    bottomBar.appendChild(delBtn);

    card.appendChild(timeField);
    card.appendChild(textField);
    card.appendChild(bottomBar);

    return card;
  }

  function addScheduleCard(containerId, item = { time: '', text: '', status: '' }, isToday = true) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const card = createScheduleCard(item, isToday);
    container.appendChild(card);
  }

  function getScheduleData(containerId, isToday) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const cards = container.querySelectorAll('.schedule-item-card');
    const list = [];
    cards.forEach(card => {
      const time = card.querySelector('.schedule-time')?.value || '';
      const text = card.querySelector('.schedule-text')?.value || '';
      const status = isToday ? (card.dataset.status || '') : '';
      if (time.trim() || text.trim() || status) {
        list.push({ time: time.trim(), text: text.trim(), status });
      }
    });
    return list;
  }

  function formatScheduleText(items, isToday) {
    if (!items || items.length === 0) return '';
    const lines = items
      .map(it => {
        const time = (it.time || '').trim();
        const text = (it.text || '').trim();
        if (!time && !text) return '';
        let line = `${time} ${text}`.trim();
        if (isToday) {
          if (it.status === 'O') line += ' ⭕️';
          else if (it.status === 'X') line += ' ❌';
        }
        return line;
      })
      .filter(l => l.length > 0);
    return lines.join('\n');
  }

  addTodayBtn.addEventListener('click', () => {
    addScheduleCard('today-schedule-list', { time: '', text: '', status: '' }, true);
  });

  addTomorrowBtn.addEventListener('click', () => {
    addScheduleCard('tomorrow-schedule-list', { time: '', text: '' }, false);
  });

  // --- 3. 날짜별 스케줄 로드 & 전날 계획 연동 로직 ---
  function loadScheduleForDateKey(targetDateKey) {
    todayList.innerHTML = '';
    tomorrowList.innerHTML = '';

    const savedToday = localStorage.getItem('today_schedule_' + targetDateKey);
    const savedTomorrow = localStorage.getItem('tomorrow_schedule_' + targetDateKey);

    if (savedToday) {
      try {
        const list = JSON.parse(savedToday);
        if (Array.isArray(list) && list.length > 0) {
          list.forEach(it => addScheduleCard('today-schedule-list', it, true));
        } else {
          addScheduleCard('today-schedule-list', { time: '', text: '', status: '' }, true);
        }
      } catch (e) {
        addScheduleCard('today-schedule-list', { time: '', text: '', status: '' }, true);
      }
    } else {
      // 전날 내일 계획 확인 후 자동 로드
      const yesterdayKey = getYesterdayDateKey(targetDateKey);
      const prevTomorrow = localStorage.getItem('tomorrow_schedule_' + yesterdayKey);
      let loadedFromYesterday = false;

      if (prevTomorrow) {
        try {
          const list = JSON.parse(prevTomorrow);
          if (Array.isArray(list) && list.length > 0) {
            list.forEach(it => {
              addScheduleCard('today-schedule-list', { time: it.time || '', text: it.text || '', status: '' }, true);
            });
            loadedFromYesterday = true;
            showToast('전날 계획했던 일정을 오늘 일정으로 불러왔습니다 ✨');
          }
        } catch (e) {}
      }

      if (!loadedFromYesterday) {
        addScheduleCard('today-schedule-list', { time: '', text: '', status: '' }, true);
      }
    }

    if (savedTomorrow) {
      try {
        const list = JSON.parse(savedTomorrow);
        if (Array.isArray(list) && list.length > 0) {
          list.forEach(it => addScheduleCard('tomorrow-schedule-list', it, false));
        } else {
          addScheduleCard('tomorrow-schedule-list', { time: '', text: '' }, false);
        }
      } catch (e) {
        addScheduleCard('tomorrow-schedule-list', { time: '', text: '' }, false);
      }
    } else {
      addScheduleCard('tomorrow-schedule-list', { time: '', text: '' }, false);
    }
  }

  // --- 4. 자동 임시 저장 & 복원 ---
  function saveDraft() {
    const targetDateKey = parseDateKey(dateInput.value, calCurrentYear);
    const draftData = {};

    generalFieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) draftData[id] = el.value;
    });

    const todayItems = getScheduleData('today-schedule-list', true);
    const tomorrowItems = getScheduleData('tomorrow-schedule-list', false);

    draftData['todaySchedule'] = todayItems;
    draftData['tomorrowSchedule'] = tomorrowItems;
    draftData['dateKey'] = targetDateKey;

    localStorage.setItem('diary_draft', JSON.stringify(draftData));
    localStorage.setItem('today_schedule_' + targetDateKey, JSON.stringify(todayItems));
    localStorage.setItem('tomorrow_schedule_' + targetDateKey, JSON.stringify(tomorrowItems));

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

  // --- 5. Habit Tracker 달력 시스템 ---
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

  // --- 6. 작성 완료 및 복사 (원래 텍스트 템플릿 유지) ---
  const copyBtn = document.getElementById('copy-btn');
  const resetBtn = document.getElementById('reset-btn');

  copyBtn.addEventListener('click', async () => {
    saveDraft();

    const name = userNameInput.value.trim() || '준영';
    const date = dateInput.value.trim() || formatDateBadge(now);
    const v = (id) => document.getElementById(id)?.value || '';

    const todayItems = getScheduleData('today-schedule-list', true);
    const tomorrowItems = getScheduleData('tomorrow-schedule-list', false);

    const todayScheduleText = formatScheduleText(todayItems, true);
    const tomorrowScheduleText = formatScheduleText(tomorrowItems, false);

    const formattedText = `🪽${name}의 스신말기🪽 ${date}
🤍step.1 스케줄
⏰오늘(⭕️❌)
${todayScheduleText}
⏰내일
${tomorrowScheduleText}
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
      localStorage.removeItem('today_schedule_' + targetDateKey);
      localStorage.removeItem('tomorrow_schedule_' + targetDateKey);

      todayList.innerHTML = '';
      tomorrowList.innerHTML = '';
      addScheduleCard('today-schedule-list', { time: '', text: '', status: '' }, true);
      addScheduleCard('tomorrow-schedule-list', { time: '', text: '' }, false);

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
