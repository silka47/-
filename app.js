document.addEventListener('DOMContentLoaded', () => {
  // PWA Service Worker 등록
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('Service Worker Registered'))
      .catch(err => console.error('SW Registration Failed:', err));
  }

  // --- 날짜 생성 유틸 ---
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const now = new Date();
  const defaultDateStr = `_${now.getMonth() + 1}/${now.getDate()} ${dayNames[now.getDay()]}`;

  const dateInput = document.getElementById('diary-date');
  const userNameInput = document.getElementById('user-name');
  const saveStatus = document.getElementById('save-status');
  const toast = document.getElementById('toast');

  // 요소 키 매핑
  const formFieldIds = [
    'user-name', 'diary-date',
    'schedule-today', 'schedule-tomorrow',
    'media-search', 'media-sns', 'media-video', 'media-etc',
    'meditation-chapter', 'meditation-content',
    'faith-emotion', 'faith-situation', 'faith-desire', 'faith-lesson',
    'faith-gratitude-1', 'faith-gratitude-2',
    'faith-repent-1', 'faith-repent-2',
    'prayer-content'
  ];

  // --- 다크 모드 토글 ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('app_theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  applyTheme(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
    themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    const themeMeta = document.getElementById('theme-color-meta');
    if (themeMeta) {
      themeMeta.setAttribute('content', theme === 'dark' ? '#121417' : '#ffffff');
    }
  }

  // --- 5초 자동 임시 저장 및 복구 ---
  function saveDraft() {
    const draftData = {};
    formFieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) draftData[id] = el.value;
    });
    localStorage.setItem('diary_draft', JSON.stringify(draftData));
    
    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    saveStatus.textContent = `자동 저장 완료 (${timeStr})`;
  }

  function loadDraft() {
    const saved = localStorage.getItem('diary_draft');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        formFieldIds.forEach(id => {
          const el = document.getElementById(id);
          if (el && data[id] !== undefined) {
            el.value = data[id];
          }
        });
      } catch (e) {
        console.error('Failed to parse draft:', e);
      }
    }
    // 날짜 기본값 세팅 (비어있는 경우)
    if (!dateInput.value) {
      dateInput.value = defaultDateStr;
    }
  }

  loadDraft();
  setInterval(saveDraft, 5000);

  // --- Habit Tracker (달력 시스템) ---
  let calCurrentYear = now.getFullYear();
  let calCurrentMonth = now.getMonth(); // 0 ~ 11

  const calTitle = document.getElementById('calendar-title');
  const calDaysContainer = document.getElementById('calendar-days');
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

    // 시작 공백
    for (let i = 0; i < firstDayIndex; i++) {
      const emptyDiv = document.createElement('div');
      calDaysContainer.appendChild(emptyDiv);
    }

    // 날짜 렌더링
    for (let day = 1; day <= lastDate; day++) {
      const dayDiv = document.createElement('div');
      dayDiv.textContent = day;

      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // 오늘 강조
      if (year === now.getFullYear() && month === now.getMonth() && day === now.getDate()) {
        dayDiv.classList.add('today');
      }

      // 완료 체크 표시
      if (completedList.includes(dateKey)) {
        dayDiv.classList.add('completed');
      }

      calDaysContainer.appendChild(dayDiv);
    }
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

  renderCalendar(calCurrentYear, calCurrentMonth);

  // --- 템플릿 결합 및 클립보드 복사 ---
  const copyBtn = document.getElementById('copy-btn');
  const resetBtn = document.getElementById('reset-btn');

  copyBtn.addEventListener('click', async () => {
    saveDraft();

    const name = userNameInput.value.trim() || '00';
    const date = dateInput.value.trim() || defaultDateStr;

    const v = (id) => document.getElementById(id)?.value || '';

    // 요청된 템플릿 양식 구성 (빈 값은 빈 줄/공백 유지)
    const formattedText = `🪽${name}의 스신말기🪽 ${date}
🤍step.1 스케줄
⏰오늘(⭕️❌)
${v('schedule-today')}
⏰내일
${v('schedule-tomorrow')}
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

    // 클립보드 복사 실행
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(formattedText);
      } else {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = formattedText;
        tempTextArea.style.position = 'fixed';
        tempTextArea.style.left = '-9999px';
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
      }

      // 작성 완료 날짜 기록 (Habit Tracker)
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const completedList = getCompletedDates();
      if (!completedList.includes(todayKey)) {
        completedList.push(todayKey);
        localStorage.setItem('completed_dates', JSON.stringify(completedList));
        renderCalendar(calCurrentYear, calCurrentMonth);
      }

      showToast('일기가 복사되고 완료 처리되었습니다 ✅');
    } catch (err) {
      console.error('복사 실패:', err);
      showToast('복사 권한 오류가 발생했습니다.');
    }
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('작성 중인 내용을 모두 지우시겠습니까?')) {
      formFieldIds.forEach(id => {
        if (id !== 'user-name') {
          const el = document.getElementById(id);
          if (el) el.value = '';
        }
      });
      dateInput.value = defaultDateStr;
      localStorage.removeItem('diary_draft');
      saveStatus.textContent = '초기화 완료';
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
