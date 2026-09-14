document.addEventListener('DOMContentLoaded', () => {
  // Service Worker 등록
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const now = new Date();

  // 날짜 문자열 포맷팅 헬퍼 (_9/14 월)
  function formatDateBadge(d) {
    return `_${d.getMonth() + 1}/${d.getDate()} ${dayNames[d.getDay()]}`;
  }

  // 입력된 텍스트(_9/14 월 등)에서 YYYY-MM-DD 추출
  function parseDateKey(dateStr, fallbackYear) {
    const match = dateStr.match(/(\d{1,2})\s*[\/\.]\s*(\d{1,2})/);
    if (match) {
      const month = String(parseInt(match, 10)).padStart(2, '0');
      const day = String(parseInt(match, 10)).padStart(2, '0');
      return `${fallbackYear}-${month}-${day}`;
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  const dateInput = document.getElementById('diary-date');
  const userNameInput = document.getElementById('user-name');
  const saveStatusText = document.getElementById('save-status-text');
  const toast = document.getElementById('toast');

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

  // --- 자동 임시 저장 & 복원 ---
  function saveDraft() {
    const draftData = {};
    formFieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) draftData[id] = el.value;
    });
    localStorage.setItem('diary_draft', JSON.stringify(draftData));
    
    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    saveStatusText.textContent = `저장됨 (${timeStr})`;
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
        console.error('Draft load error:', e);
      }
    }
    if (!dateInput.value) {
      dateInput.value = formatDateBadge(now);
    }
  }

  loadDraft();
  setInterval(saveDraft, 5000);

  // --- Habit Tracker 달력 로직 ---
  let calCurrentYear = now.getFullYear();
  let calCurrentMonth = now.getMonth(); // 0 ~ 11

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

    // 첫 주 빈칸 채우기
    for (let i = 0; i < firstDayIndex; i++) {
      const emptyDiv = document.createElement('div');
      calDaysContainer.appendChild(emptyDiv);
    }

    // 날짜 렌더링
    for (let day = 1; day <= lastDate; day++) {
      const dayDiv = document.createElement('div');
      dayDiv.textContent = day;

      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = (dateKey === todayStr);
      const isPast = (dateKey < todayStr);
      const isDone = completedList.includes(dateKey);

      if (isToday) {
        dayDiv.classList.add('today');
      }

      if (isDone) {
        dayDiv.classList.add('completed');
        monthDoneCount++;
      } else if (isPast) {
        // 과거 날짜 중 작성 안 한 날
        dayDiv.classList.add('missed');
        monthMissedCount++;
      }

      // 날짜 클릭 시 해당 날짜로 작성 날짜 변경
      dayDiv.addEventListener('click', () => {
        const targetDate = new Date(year, month, day);
        dateInput.value = formatDateBadge(targetDate);
        showToast(`${month + 1}월 ${day}일(${dayNames[targetDate.getDay()]})로 변경되었습니다.`);
      });

      calDaysContainer.appendChild(dayDiv);
    }

    // 상단 통계 뱃지 업데이트
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

  renderCalendar(calCurrentYear, calCurrentMonth);

  // --- 작성 완료 및 복사 ---
  const copyBtn = document.getElementById('copy-btn');
  const resetBtn = document.getElementById('reset-btn');

  copyBtn.addEventListener('click', async () => {
    saveDraft();

    const name = userNameInput.value.trim() || '준영';
    const date = dateInput.value.trim() || formatDateBadge(now);
    const v = (id) => document.getElementById(id)?.value || '';

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

      // 작성 날짜 파싱하여 해당 날짜를 '작성 완료' 목록에 기록
      const targetDateKey = parseDateKey(date, calCurrentYear);
      const completedList = getCompletedDates();
      if (!completedList.includes(targetDateKey)) {
        completedList.push(targetDateKey);
        localStorage.setItem('completed_dates', JSON.stringify(completedList));
      }
      renderCalendar(calCurrentYear, calCurrentMonth);

      showToast('일기가 복사되고 완료(✅) 기록되었습니다.');
    } catch (err) {
      console.error(err);
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
      dateInput.value = formatDateBadge(now);
      localStorage.removeItem('diary_draft');
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
