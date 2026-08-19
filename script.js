/**
 * הופכת מחרוזת חופשית (טקסט שהוזן ע"י משתמש - שם אמצעי, טקסט בקשה וכו') לבטוחה להכנסה
 * ל-innerHTML, כדי למנוע הזרקת HTML/סקריפט (XSS) דרך שדות טקסט חופשיים במערכת.
 * יש להשתמש בה בכל מקום שמכניסים ערך שמקורו בקלט משתמש לתוך תבנית HTML (לא ל-.value של שדה קלט).
 * @param {*} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ================================
   הגדרות טבלאות (לחישובים כלליים)
================================ */
const tableConfigs = {
  keshertable: { startCol: 1, endCol: 29, totalUnitCol: 30, failCol: 31, totalRegulatedCol: 32, availableCol: 33, excessCol: 34 },
  optictable:  { startCol: 1, endCol: 29, totalUnitCol: 30, failCol: 31, totalRegulatedCol: 32, excessCol: 33 }
};

// טבלאות (מנהל + יחידה) שעליהן חל מעקב שינויים (הדגשה כתומה עד שמירה/הפצה) - אפיון 1.2 ו-1.9
const MANAGER_TRACKED_TABLES = [
  'keshertable', 'optictable', 'esukTable', 'hirgTable', 'pikudTable', 'tazamTable', 'bahalagTable',
  'reqesukTable', 'reqhirgTable', 'reqpikudTable', 'reqtazamTable', 'reqbahalagTable',
  'esukkeshertable', 'kkeshertable', 'pkeshertable', 'tkeshertable', 'bkeshertable',
  'esukoptictable', 'koptictable', 'poptictable', 'toptictable', 'boptictable'
];

/* כללי הדגשה כתומה בטבלאות המשולבות (הגדולות) קשר/אופטיקה - אפיון QA:
   הסימון הכתום שם אינו נגזר יותר מהשוואת draft מול published (זה ערבב בין עריכה ישירה
   של המנהל לבין ייבוא מהיחידות, וגם סימן בטעות עמודות סה"כ מחושבות). במקום זאת מנוהלת
   רשימת "אינדקסים ממתינים" מפורשת שמתעדכנת אך ורק ע"י importFromSubTable (מוסיפה אינדקס
   כשהערך המיובא שונה מהמפורסם, ומסירה כשהוא זהה), ומתאפסת רק ע"י הפצה. כך:
   - ייבוא ראשון אי-פעם כן מסמן כתום (אין יותר תלות בקיום published קודם).
   - הקלדה ישירה של המנהל בטבלה הגדולה (בכל עמודה, כולל אחרי ריענון הדף) לעולם לא מוסיפה/
     מסירה סימון - ראו גם החסימה המוקדמת ל-MASTER_COMBINED_TABLES בהאזנת ה-input הגלובלית.
   - עמודות מחושבות/מסוכמות (דרישה, וויסות גדודי, עודף, סה"כ כללי) לעולם לא מגיעות לרשימה,
     כי importFromSubTable מלכתחילה כותבת רק לעמודות החברה/יחידה שבאמת מיובאות. */
const MASTER_COMBINED_TABLES = ['keshertable', 'optictable'];

function getPendingImportKey(tableId, week, year) {
  return `pendingImport_${tableId}_week${week}_year${year}`;
}

async function loadPendingImportIndexes(tableId, week, year) {
  const key = getPendingImportKey(tableId, week, year);
  const list = (typeof fetchTableData === 'function')
    ? await fetchTableData(key)
    : JSON.parse(localStorage.getItem(key) || 'null');
  return Array.isArray(list) ? list : [];
}

function savePendingImportIndexes(tableId, week, year, indexes) {
  persist(getPendingImportKey(tableId, week, year), indexes);
}

/* ================================
   מצב גלובלי (שבועות)
================================ */
let currentWeek = 1;
let currentYear = new Date().getFullYear();
const tableWeeks = {};

let _storageErrorNotified = false;
/**
 * מטפלת בכשל כתיבה ל-localStorage (בד"כ המכסה מלאה - QuotaExceededError) בצורה גלויה
 * למשתמש, במקום לבלוע אותו בשקט. בעבר כשל כזה לא הציג שום שגיאה, כך שהמשתמש היה חושב
 * שהעריכה נשמרה כשבפועל היא אבדה. מוצגת פעם אחת בלבד לטעינת עמוד (לא על כל הקשה חוזרת).
 * @param {*} err
 */
function _handleStorageWriteFailure(err) {
  console.warn('LocalStorage save failed:', err);
  if (_storageErrorNotified) return;
  _storageErrorNotified = true;
  // ה-alert קודם, ובלתי-תלוי בשמירה - אם האחסון באמת מלא, גם ניסיון להוסיף התראה (שגם
  // הוא כותב ל-localStorage) עלול להיכשל בעצמו, ואסור שזה ימנע מהמשתמש לראות את האזהרה.
  alert('שמירת הנתונים נכשלה! ייתכן שנפח האחסון המקומי (localStorage) של הדפדפן מלא. העריכה האחרונה שלך עלולה לא להישמר בפועל - מומלץ לגבות/לייצא נתונים ולפנות למנהל המערכת.');
  try {
    if (typeof addNotification === 'function') {
      addNotification('⚠️ שמירת נתונים נכשלה - ייתכן שנפח האחסון המקומי בדפדפן מלא. העריכה האחרונה עלולה לא להישמר.', 'error');
    }
  } catch (e2) { /* האחסון מלא לגמרי - האזהרה כבר הוצגה, אין מה לעשות נוסף */ }
}

/**
 * שמירת נתון דרך שכבת הסנכרון ההיברידית (אפיון חלק 2):
 * מנתב ל-DataService (localStorage מיידי + סנכרון לשרת/תור), עם נפילה חזרה ל-localStorage.
 * @param {string} key - מפתח השמירה
 * @param {*} data - אובייקט הנתונים (לא מחרוזת)
 */
function persist(key, data) {
  if (typeof DataService !== 'undefined') {
    DataService.setItem(key, data);
  } else {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { _handleStorageWriteFailure(e); }
  }
}

/* =========================================================
   אכיפת הרשאות (אפיון חלק 3)
   נעילת עריכה למשתמשים ללא הרשאה בעמוד הנוכחי.
========================================================= */

/** האם העמוד נמצא כרגע במצב צפייה בלבד */
function isReadOnlyMode() {
  return document.body.classList.contains('readonly-mode');
}

/**
 * מחילה את הרשאות המשתמש המחובר על העמוד:
 * נועלת שדות עריכה ומסתירה כפתורי פעולה כאשר אין הרשאת עריכה.
 * נקראת מחדש לאחר כל רינדור של טבלאות (השדות נוצרים דינמית).
 */
function applyPermissions() {
  if (typeof AUTH === 'undefined') return;
  const session = AUTH.getSession();
  if (!session) return;

  const canEdit = AUTH.canEditPage();
  document.body.classList.toggle('readonly-mode', !canEdit);
  // סימוני "שינויים שטרם הופצו" (כתום) מוצגים למנהל בלבד
  document.body.classList.toggle('hide-conflict-overlap', session.role !== 'admin');
  // גריד השיבוץ בחדר"ג/שק"ם (גרירה, שינוי גודל, צביעה, הדבקה) נעול למנהל בלבד - גם עורך
  // (שיכול לערוך כל טבלה אחרת) אינו אמור להזיז/לערוך שיבוצים בגריד הזה (אפיון QA).
  document.body.classList.toggle('hadrag-grid-readonly', session.role !== 'admin');
  if (canEdit) return;

  // נעילת שדות הקלט (למעט ניווט השבועות והסרגל העליון)
  document.querySelectorAll('input[type="text"], input[type="time"], textarea, select').forEach(el => {
    if (el.id === 'weekInput' || el.id === 'weekInputOptic') return;
    if (el.closest('#top-nav-placeholder')) return;
    if (el.tagName === 'SELECT') el.disabled = true;
    else el.readOnly = true;
  });

  // הסתרת כפתורי הפעולה
  const actionSelectors = [
    '#global-export-btn', '.add-row-btn', '.table-import-btn', '.week-copy-btn',
    '.undo-btn', '.status-btn', '.row-delete-icon', '.row-drag-handle',
    '.color-picker-toggle', '.hipok-choice-btn', '.btn-approve', '.btn-reject',
    '.hipok-delete-btn', '#openHipokModalBtn', '.excel-upload-btn'
  ];
  document.querySelectorAll(actionSelectors.join(',')).forEach(el => { el.style.display = 'none'; });

  // כפתורי ייבוא/הוספה המוגדרים inline בכותרות הטבלאות
  document.querySelectorAll('thead button').forEach(btn => {
    const action = btn.getAttribute('onclick') || '';
    if (/import|promptAddItemRow|submit|approve|reject/i.test(action)) btn.style.display = 'none';
  });
}

/* ================================
   יצירת תפריטי ניווט גלובליים
================================ */

/**
 * מנהלת פתיחה/כיווץ של סרגל הצד (Sidebar) ושומרת את מצבו ב-LocalStorage.
 */
function toggleSidebar() {
  const container2 = document.querySelector('.container2');
  if (!container2) return;
  
  const isCollapsed = container2.classList.toggle('collapsed');
  localStorage.setItem('sidebar_collapsed', isCollapsed ? 'true' : 'false');

  const toggleBtn = document.getElementById('sidebar-toggle');
  if (toggleBtn) {
    toggleBtn.innerHTML = isCollapsed 
      ? `<span>►</span>` 
      : `<span>◄</span> <span class="sidebar-text">כווץ תפריט</span>`;
  }
}

const UNIT_TITLE_MAP = {
  'esuk.html': 'בא"ח איסו"ק',
  'hirg.html': 'בא"ח חיר"ג',
  'pikud.html': 'גדוד הפיקוד',
  'tazam.html': 'ענף תצ"מ',
  'bahalag.html': 'מפח"ט',
  'kesher.html': 'טבלאות מנהל',
  'optic.html': 'טבלאות מנהל',
  'modiein.html': 'טבלאות מנהל',
  'hipokim.html': 'טבלאות מנהל',
  'hadrag.html': 'טבלאות מנהל',
  'shekem.html': 'טבלאות מנהל',
  'index.html': 'עמוד ראשי'
};

/**
 * מייצרת ומזריקה את סרגלי הניווט העליון והצדדי באופן דינמי לכל עמודי המערכת.
 */
function renderNavbars() {
  const topNav = document.getElementById('top-nav-placeholder');
  const sideNav = document.getElementById('side-nav-placeholder');

  const rawPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const currentPage = rawPage.split('?')[0].split('#')[0];
  const isUnitPage = ['esuk', 'hirg', 'pikud', 'tazam', 'bahalag'].some(u => currentPage.includes(u));

  const urlParams = new URLSearchParams(window.location.search);
  const currentView = urlParams.get('view') || 'bakashot';
  const isHaktzaotView = currentView === 'haktzaot';
  
  const isCollapsedStored = localStorage.getItem('sidebar_collapsed') === 'true';

  const isMain = currentPage.includes('main') || currentPage === '' || currentPage.includes('index');

  // 1. הזרקת תפריט עליון (Top Nav)
  if (topNav) {
    const isKesher = currentPage.includes('kesher');
    const isOptic = currentPage.includes('optic');
    const isHipok = currentPage.includes('hipok');
    const isModiein = currentPage.includes('modiein');
    const isHadrag = currentPage.includes('hadrag');
    const isShekem = currentPage.includes('shekem');

    const logoBlock = !isUnitPage ? `
      <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="clearViewedWeek(); clearViewedCategory(); window.location.href='index.html'">
        <h1 style="font-size:20px; color:white; margin:0;">PAKADEX</h1>
        <img src="images/לוגו בהלג בלי רקע.png" alt="לוגו" class="sidebar-image" width="36" style="height:auto;">
      </div>
    ` : '';

    // חיווי משתמש מחובר + יציאה (אפיון חלק 3)
    const session = (typeof AUTH !== 'undefined') ? AUTH.getSession() : null;
    const userChipBlock = session ? `
      <div class="user-chip">
        <div class="user-chip-info">
          <span class="user-chip-name">${escapeHtml(session.name) || escapeHtml(session.pn)}</span>
          <span class="user-chip-role">${AUTH.roleLabel(session)}</span>
        </div>
        ${AUTH.canManageUsers()
          ? '<button class="user-chip-btn" onclick="clearViewedWeek(); clearViewedCategory(); window.location.href=\'users.html\'" title="ניהול הרשאות">👥</button>'
          : ''}
        <button class="user-chip-btn logout" onclick="AUTH.logout()" title="יציאה מהמערכת">⏻</button>
      </div>
    ` : '';

    // הוסר סממן טקסט נפרד למנהל ("✓ הכל הופץ" / "⏳ יש שינויים שלא הופצו") - במקומו כפתור
    // "הפץ שינויים" עצמו משנה צבע (אדום/ירוק) לפי updateGlobalExportButtonStatus, בהתבסס על
    // בדיקה גלובלית לכל המערכת (קשר/אופטיקה/מודיעין/חיפוקים/חדר"ג/שק"ם) לשבוע הנוכחי - לא רק העמוד הנוכחי.

    // הוסר גם סממן הטקסט הנפרד לעמוד יחידה ("✓ הכל נשמר" / "⏳ נוספו שינויים שטרם נשמרו") -
    // אותו קונספט של כפתור אדום/ירוק חל גם כאן: כפתור "שמור ומוכן לייבוא" עצמו (אותו כפתור
    // כללי לכל טבלאות הדרישה של הקבוצה - קשר, אופטיקה ומודיעין) משנה צבע לפי
    // updateGlobalExportButtonStatus, ולא רק לפי הטבלה/הכרטיסייה שפתוחה כרגע.

    // כפתור הדפסה (אפיון 1.6) - זמין בכל עמודי הטבלאות
    const printBtnBlock = '<button class="print-btn" onclick="window.print()" title="הדפס טבלה">🖨️</button>';

    // כפתורי בטל/בצע-שוב (אפיון 1.4)
    const undoRedoBlock = `
      <button class="undo-btn" onclick="doUndo()" title="בטל (Ctrl+Z)">↶</button>
      <button class="undo-btn" onclick="doRedo()" title="בצע שוב (Ctrl+Y)">↷</button>`;

    // מרכז התראות - פעמון (אפיון 1.8)
    const bellBlock = `
      <div class="notif-wrap">
        <button class="notif-bell" id="notif-bell" onclick="toggleNotifPanel(event)" title="התראות">🔔<span id="notif-badge" class="notif-badge" style="display:none;">0</span></button>
        <div id="notif-panel" class="notif-panel" style="display:none;"></div>
      </div>`;

    // סרגל הזהות (לוגו + חיווי משתמש) - תמיד בשורה עצמאית לעמודי מנהל; בעמודי יחידה הלוגו כבר קבוע ב-HTML
    // (בתוך container1 סטטי עם placeholder לחיווי המשתמש) - ראו הזרקה ל-#user-chip-placeholder בהמשך.
    const identityRowBlock = !isUnitPage ? `
      <div class="container1">
        ${userChipBlock}
        ${logoBlock}
      </div>
    ` : '';

    const exportBtnBlock = !isUnitPage
      ? '<button id="global-export-btn" class="global-export-btn" onclick="globalExportManager()">הפץ שינויים</button>'
      : '<button id="global-export-btn" class="global-export-btn unit-ready" onclick="globalExportUnit()">שמור ומוכן לייבוא</button>';

    // שורת כלים: כרטיסיות ניווט בין הקטגוריות מימין, וכלי עבודה + פעולת ההפצה משמאל - מקובצים בבירור כדי לצמצם עומס חזותי.
    const toolbarRowBlock = !isMain ? `
      <div class="toolbar-row">
        <div class="nav-tabs ${!isUnitPage ? 'nav-tabs-master' : ''}">
          <button class="topnav-btn ${isKesher ? 'active' : ''}" id="btn-kesher" onclick="${isUnitPage ? "showTopSection('kesher')" : "window.location.href='kesher.html'"}">קשר</button>
          <button class="topnav-btn ${isOptic ? 'active' : ''}" id="btn-optic" onclick="${isUnitPage ? "showTopSection('optic')" : "window.location.href='optic.html'"}">אופטיקה</button>
          <button class="topnav-btn ${isModiein ? 'active' : ''}" id="btn-modiein" onclick="${isUnitPage ? "showTopSection('modiein')" : "window.location.href='modiein.html'"}">מודיעין</button>
          <button class="topnav-btn ${isHipok ? 'active' : ''}" id="btn-hipok" onclick="${isUnitPage ? "showTopSection('hipok')" : "window.location.href='hipokim.html'"}">חיפוקים</button>
          <button class="topnav-btn ${isHadrag ? 'active' : ''}" id="btn-chadrag" onclick="${isUnitPage ? "showTopSection('chadrag')" : "window.location.href='hadrag.html'"}">פלוגתי</button>
          <button class="topnav-btn ${isShekem ? 'active' : ''}" id="btn-shekem" onclick="${isUnitPage ? "showTopSection('shekem')" : "window.location.href='shekem.html'"}">שעות שקם</button>
          ${!isUnitPage ? `<button class="topnav-btn ${currentPage.includes('general') ? 'active' : ''}" id="btn-excel" onclick="window.location.href='general.html'">📗 אקסל</button>` : ''}
        </div>
        <div class="toolbar-actions">
          <div class="tool-group">
            ${bellBlock}
            ${undoRedoBlock}
            ${printBtnBlock}
          </div>
          <div class="toolbar-divider"></div>
          ${exportBtnBlock}
        </div>
      </div>
    ` : '';

    topNav.innerHTML = `${identityRowBlock}${toolbarRowBlock}`;

    // בעמודי יחידה חיווי המשתמש מוזרק לתוך ה-container1 הסטטי (הקבוע ב-HTML של העמוד עצמו),
    // כדי שיישב תמיד בצד ימין הכותרת יחד עם הלוגו - זהה למראה בעמודי המנהל.
    if (isUnitPage) {
      const chipPlaceholder = document.getElementById('user-chip-placeholder');
      if (chipPlaceholder) chipPlaceholder.innerHTML = userChipBlock;
    }

    if (typeof updateNotifBadge === 'function') updateNotifBadge();
    if (typeof updateSyncIndicator === 'function') updateSyncIndicator();
    if (typeof updatePublishIndicator === 'function') updatePublishIndicator();
    if (typeof initPublishIndicatorObserver === 'function') initPublishIndicatorObserver();
  }

  // 2. הזרקת תפריט צדדי (Side Nav)
  if (sideNav) {
    const isTabels = ['tabels', 'kesher', 'optic', 'modiein', 'hipok', 'hadrag', 'shekem'].some(p => currentPage.includes(p));

    const isEsuk = currentPage.includes('esuk');
    const isHirg = currentPage.includes('hirg');
    const isPikud = currentPage.includes('pikud');
    const isTazam = currentPage.includes('tazam');
    const isBahalag = currentPage.includes('bahalag');

    // משתמש מסוג 'unit' רואה בסרגל הצד רק את הפלוגות שהוא מורשה להן (ייתכן כמה); שאר התפקידים רואים הכל.
    const canSeeUnit = (unitKey) => {
      if (typeof AUTH === 'undefined') return true;
      const session = AUTH.getSession();
      if (!session || session.role !== 'unit') return true;
      const units = Array.isArray(session.unit) ? session.unit : (session.unit ? [session.unit] : []);
      return units.includes(unitKey);
    };

    const unitBlock = (key, isActive, label, emoji) => `
        <button class="sidebar-btn ${isActive ? 'active' : ''}" onclick="toggleMenu('subMenu_${key}')">
          <span>${emoji}</span> <span class="sidebar-text">${label}</span>
        </button>
        <div id="subMenu_${key}" class="submenu ${isActive ? 'show' : ''}">
          <button class="sidebar-btn ${isActive && !isHaktzaotView ? 'active' : ''}" onclick="clearViewedWeek(); window.location.href='${key}.html?view=bakashot'">
            <span class="sidebar-text">דרישות</span>
          </button>
          <button class="sidebar-btn ${isActive && isHaktzaotView ? 'active' : ''}" onclick="clearViewedWeek(); window.location.href='${key}.html?view=haktzaot'">
            <span class="sidebar-text">הקצאות</span>
          </button>
        </div>`;

    sideNav.innerHTML = `
      <div class="container2 ${isCollapsedStored ? 'collapsed' : ''}" style="margin-top: 0;">
        <button id="sidebar-toggle" class="sidebar-toggle-btn" onclick="toggleSidebar()">
          <span>${isCollapsedStored ? '►' : '◄'}</span>
          <span class="sidebar-text">כווץ תפריט</span>
        </button>

        <button class="sidebar-btn ${isMain ? 'active' : ''}" onclick="clearViewedWeek(); clearViewedCategory(); window.location.href='index.html'">
          <span>🏠</span> <span class="sidebar-text">ראשי</span>
        </button>
        <button class="sidebar-btn ${isTabels ? 'active' : ''}" onclick="clearViewedWeek(); clearViewedCategory(); window.location.href='kesher.html'">
          <span>📊</span> <span class="sidebar-text">טבלאות</span>
        </button>
        ${(typeof AUTH !== 'undefined' && AUTH.canManageUsers()) ? `
        <button class="sidebar-btn ${currentPage.includes('users') ? 'active' : ''}" onclick="clearViewedWeek(); clearViewedCategory(); window.location.href='users.html'">
          <span>👥</span> <span class="sidebar-text">ניהול הרשאות</span>
        </button>` : ''}

        ${canSeeUnit('esuk') ? unitBlock('esuk', isEsuk, 'בא"ח איסו"ק', '🟡') : ''}
        ${canSeeUnit('hirg') ? unitBlock('hirg', isHirg, 'בא"ח חיר"ג', '🟢') : ''}
        ${canSeeUnit('pikud') ? unitBlock('pikud', isPikud, 'גדוד הפיקוד', '🔵') : ''}
        ${canSeeUnit('tazam') ? unitBlock('tazam', isTazam, 'ענף תצ"מ', '🟣') : ''}
        ${canSeeUnit('bahalag') ? unitBlock('bahalag', isBahalag, 'מפח"ט', '🟠') : ''}
      </div>
    `;
  }
}

/**
 * מציגה או מסתירה תת-תפריט בסרגל הצדדי, וסוגרת את שאר תתי-התפריטים הפתוחים.
 * @param {string} menuId - מזהה האלמנט של תת-התפריט
 */
function toggleMenu(menuId) {
  const targetId = typeof menuId === 'string' ? menuId : 'subMenu_esuk';
  const targetMenu = document.getElementById(targetId);

  document.querySelectorAll('.submenu').forEach(menu => {
    if (menu !== targetMenu) {
      menu.style.display = 'none';
      menu.classList.remove('show');
    }
  });

  if (targetMenu) {
    const isVisible = targetMenu.style.display === 'flex' || targetMenu.classList.contains('show');
    targetMenu.style.display = isVisible ? 'none' : 'flex';
    targetMenu.classList.toggle('show', !isVisible);
  }
}

/* ================================
   פונקציות עזר - תאריכים
================================ */

/**
 * מחשבת את מספר השבוע (ISO-8601) והשנה של תאריך נתון.
 * @param {Date} date
 * @returns {{week: number, year: number}}
 */
function getISOWeekInfo(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
}

/**
 * מספר שבועות ה-ISO בשנה נתונה (52 או 53) - לפי תקן ISO-8601 (28 בדצמבר תמיד נמצא
 * בשבוע ה-ISO האחרון של השנה). חשוב להשתמש בזה במקום קבוע קשיח - שנה עם 53 שבועות
 * שמטופלת כאילו יש בה רק 52 גורמת לשבוע ה-53 האמיתי להתמזג בטעות עם נתוני שבוע 52.
 * @param {number} year
 * @returns {number} 52 או 53
 */
function getWeeksInYear(year) {
  return getISOWeekInfo(new Date(year, 11, 28)).week;
}

/**
 * מחשבת את מספר השבוע והשנה הנוכחיים לפי תקן ISO-8601 הבינלאומי.
 * @returns {{week: number, year: number}} אובייקט המכיל את השבוע והשנה
 */
function getCurrentWeekAndYear() {
  const info = getISOWeekInfo(new Date());
  const maxWeek = getWeeksInYear(info.year);
  return { week: Math.min(Math.max(info.week, 1), maxWeek), year: info.year };
}

/**
 * מפיקה מפתח שמירה אחיד ב-LocalStorage עבור טבלה, שבוע ושנה נתונים.
 * @param {string} tableId - מזהה הטבלה
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 * @returns {string} מפתח שמירה מורכב
 */
function getStorageKey(tableId, week, year) {
  return `${tableId}_week${week}_year${year}`;
}

/* ================================
   קריאה ושמירה של טבלאות כלליות
================================ */

/**
 * קוראת ואוספת את נתוני שדות הקלט (cell-input) מטבלה נתונה במבנה אובייקט.
 * @param {string} tableId - מזהה הטבלה
 * @returns {Object} אובייקט המכיל את ערכי התאים לפי אינדקס
 */
function readTableData(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return {};
  const data = {};
  table.querySelectorAll('.cell-input').forEach((input, index) => data[index] = input.value);
  return data;
}

/**
 * מחזירה את רשימת מזהי כל הטבלאות הפעילות הנשמרות במערכת.
 * @returns {Array<string>} מערך מזהי טבלאות
 */
function getActiveTables() {
  return [
    'keshertable','esukkeshertable','kkeshertable','pkeshertable','tkeshertable','bkeshertable',
    'optictable','esukoptictable','koptictable','poptictable','toptictable','boptictable',
    'tazamTable', 'hirgTable', 'esukTable', 'pikudTable', 'bahalagTable',
    'reqesukTable', 'reqhirgTable', 'reqpikudTable', 'reqtazamTable', 'reqbahalagTable'
  ];
}

/**
 * שומרת את כל נתוני הטבלאות, החיפוקים, החדר"ג והשק"ם עבור השבוע והשנה הנוכחיים ב-DataService (SharePoint / Local).
 */
async function saveCurrentWeek() {
  const tables = getActiveTables();
  for (const tableId of tables) {
    const table = document.getElementById(tableId);
    if (table) {
      const tw = tableWeeks[tableId] || { week: currentWeek, year: currentYear };
      const key = getStorageKey(tableId, tw.week, tw.year);
      const data = readTableData(tableId);
      if (typeof DataService !== 'undefined') {
        await DataService.setItem(key, data);
      } else {
        localStorage.setItem(key, JSON.stringify(data));
      }
    }
  }
  
  if (typeof saveHipokData === 'function') await saveHipokData();
  if (typeof saveHadragTables === 'function') await saveHadragTables();
  if (typeof saveShekemTables === 'function') await saveShekemTables();
}

/**
 * שולפת אובייקט נתונים לטבלה, תוך שימוש ב-DataService במידה וקיים (גיבוי ב-localStorage).
 * @param {string} key - מפתח הנתונים
 * @returns {Promise<Object|null>}
 */
async function fetchTableData(key) {
  if (typeof DataService !== 'undefined') {
    return await DataService.getItem(key);
  }
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : null;
}

/**
 * טוענת את נתוני הטבלה המאוחסנים עבור שבוע ושנה ספציפיים מ-DataService, ומעדכנת את שדות הקלט ב-DOM.
 * @param {string} tableId - מזהה הטבלה
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
async function loadTableData(tableId, week, year) {
  const table = document.getElementById(tableId);
  if (!table) return;

  if (KESHER_TABLE_LIST.some(t => t.id === tableId) || OPTIC_TABLE_LIST.some(t => t.id === tableId)) {
    renderDynamicTableStructure(tableId, week, year);
  }

  const dynamicTables = [
    'tazamTable', 'hirgTable', 'esukTable', 'pikudTable', 'bahalagTable',
    'reqesukTable', 'reqhirgTable', 'reqpikudTable', 'reqtazamTable', 'reqbahalagTable'
  ];
  const isDynamic = dynamicTables.includes(tableId);

  if (isDynamic) {
    const tbody = table.tBodies[0];
    while (tbody.rows.length > 2) {
      tbody.deleteRow(-1);
    }
  }

  table.querySelectorAll('.cell-input').forEach(input => {
    input.value = '';
    if (input.classList.contains('topic-textarea')) {
      autoResizeTopicTextarea(input);
    }
  });

  const key = getStorageKey(tableId, week, year);
  // בטבלאות המשולבות (קשר/אופטיקה) משתמש שאינו מורשה לערוך את העמוד הזה (יחידתי/צפייה בלבד)
  // חייב לראות את הגרסה המופצת בפועל, לא את הטיוטה החיה של המנהל - אחרת הוא רואה שינויים
  // שהמנהל עדיין לא הפיץ (אפיון QA: "מעדכן בטבלאות הגדולות לפני שהמנהל עשה הפצה").
  const isMasterCombined = MASTER_COMBINED_TABLES.includes(tableId);
  const canViewDraft = !isMasterCombined || typeof AUTH === 'undefined' || AUTH.canEditPage();
  const effectiveKey = canViewDraft ? key : (key + '_published');
  const data = await fetchTableData(effectiveKey);

  if (data) {
    if (isDynamic) {
      const keysWithData = Object.keys(data).filter(k => data[k] && data[k].trim() !== '');
      if (keysWithData.length > 0) {
        const maxIndex = Math.max(...keysWithData.map(Number));
        let inputsPerRow = 7;
        if (table.tBodies[0].rows[1]) {
          inputsPerRow = table.tBodies[0].rows[1].querySelectorAll('.cell-input').length;
        }

        if (inputsPerRow > 0 && maxIndex >= 0) {
          const requiredRows = Math.floor(maxIndex / inputsPerRow) + 1;
          while (table.tBodies[0].rows.length < requiredRows) {
            addNewRow(tableId, false);
          }
        }
      }
    }

    const inputs = table.querySelectorAll('.cell-input');
    
    // Check for manager published data to highlight changes in orange
    let managerPublishedData = {};
    if (MANAGER_TRACKED_TABLES.includes(tableId)) {
      const managerPublishedKey = getStorageKey(tableId, week, year) + '_published';
      if (typeof fetchTableData === 'function') {
        managerPublishedData = await fetchTableData(managerPublishedKey) || {};
      } else {
        managerPublishedData = JSON.parse(localStorage.getItem(managerPublishedKey) || '{}');
      }
    }

    Object.keys(data).forEach(indexStr => {
      const idx = parseInt(indexStr);
      if (inputs[idx]) {
        inputs[idx].value = data[indexStr];
        // הצבת value ישירות לא מפעילה אירוע 'input' (רק הקלדה אמיתית/dispatchEvent מפעילים אותו) -
        // בלי זה, תיבת "נושא שבוע"/"הערות משיכה\זיכוי" נשארת בגובה המינימלי שנקבע כשרוקנו אותה קודם
        // (שורה 546-551 למעלה), כך שטקסט ארוך שהוזן קודם נשאר קיים ב-value אך "נעלם" ויזואלית
        // בכל טעינה/רענון מחדש (אפיון QA: "שיראו את כל הטקסט שמכניסים").
        if (inputs[idx].classList.contains('topic-textarea')) {
          autoResizeTopicTextarea(inputs[idx]);
        }

        // Add conflict-overlap if this is a manager table and value differs from published.
        // בטבלאות המשולבות (קשר/אופטיקה) הסימון לא נקבע כאן (draft מול published) אלא לפי
        // רשימת האינדקסים הממתינים (ראו למטה) - כדי לא לתלות אותו בעריכה ישירה של המנהל.
        if (MANAGER_TRACKED_TABLES.includes(tableId) && !isMasterCombined) {
          const publishedVal = managerPublishedData[indexStr] || '';
          if (data[indexStr] !== publishedVal) {
            const td = inputs[idx].closest('td');
            if (td) td.classList.add('conflict-overlap');
          }
        }
      }
    });

    // סימוני "ממתין לייבוא" רלוונטיים רק למי שבכלל רואה את הטיוטה (מנהל/עורך) - צופה
    // שמוגבל לגרסה המופצת רואה ערכים שכבר זהים לפרסום מטבעם, ואין טעם/משמעות לסמן אותם.
    if (isMasterCombined && canViewDraft) {
      const pendingIndexes = await loadPendingImportIndexes(tableId, week, year);
      pendingIndexes.forEach(idx => {
        if (inputs[idx]) {
          const td = inputs[idx].closest('td');
          if (td) td.classList.add('conflict-overlap');
        }
      });
    }

    inputs.forEach(input => {
      if (input.classList.contains('topic-textarea')) {
        autoResizeTopicTextarea(input);
      }
    });

    if (isDynamic) {
      const tbody = table.tBodies[0];
      const lastRow = tbody.lastElementChild;
      if (lastRow) {
        const isLastRowEmpty = Array.from(lastRow.querySelectorAll('.cell-input')).every(input => input.value.trim() === '');
        if (!isLastRowEmpty) addNewRow(tableId, false);
      }
    }
  }

  if (isUnitReqTable(tableId)) recalcUnitReqTotals(table);
}

/* ================================
   ניווט שבועות
================================ */

// השבוע שהמשתמש צופה בו כרגע, לפי חלון/כרטיסייה (sessionStorage) - כדי שמעבר בין טבלאות
// (קשר, אופטיקה, מודיעין וכו') לא יאפס בחזרה לשבוע הקלנדרי האמיתי (אפיון QA).
const VIEWED_WEEK_KEY = 'pakadex_viewed_week';

function saveViewedWeek(week, year) {
  try { sessionStorage.setItem(VIEWED_WEEK_KEY, JSON.stringify({ week, year })); } catch (e) {}
}

function loadViewedWeek() {
  try {
    const raw = sessionStorage.getItem(VIEWED_WEEK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Number.isInteger(parsed.week) && Number.isInteger(parsed.year)) return parsed;
  } catch (e) {}
  return null;
}

// מנקה את השבוע הנצפה לפני ניווט לאזור/עמוד אחר בתפריט הצדדי (ראשי/טבלאות/ניהול הרשאות/
// עמוד יחידה) - כדי שמעבר בין *אזורים* שונים באפליקציה תמיד ינחת מחדש על השבוע הקלנדרי
// האמיתי, בניגוד למעבר בין *קטגוריות טבלה* (קשר/אופטיקה/מודיעין/חיפוקים/פלוגתי/שעות שק"ם)
// דרך סרגל הקטגוריות העליון, שממשיך לשמר את השבוע הנצפה כרגיל (אפיון QA: "בין עמודים תמיד
// לשבוע הנוכחי, אבל בין טבלה לטבלה באותו עמוד להישאר על השבוע שנבחר").
function clearViewedWeek() {
  try { sessionStorage.removeItem(VIEWED_WEEK_KEY); } catch (e) {}
}

// קטגוריית הטבלה הנצפית כרגע (קשר/אופטיקה/מודיעין/חיפוקים/פלוגתי/שעות שק"ם) בעמוד יחידה -
// נשמרת ב-sessionStorage כדי שמעבר בין "דרישות" ל"הקצאות" (שמבוצע כניווט מלא לעמוד עם
// ?view=... ולא כהחלפת סקשן פנימית) יישאר על אותה קטגוריה, במקום לקפוץ תמיד לקשר (אפיון QA).
const CURRENT_CATEGORY_KEY = 'pakadex_current_category';

function saveCurrentCategory(category) {
  try { sessionStorage.setItem(CURRENT_CATEGORY_KEY, category); } catch (e) {}
}

function loadCurrentCategory() {
  try { return sessionStorage.getItem(CURRENT_CATEGORY_KEY); } catch (e) { return null; }
}

// מנקה את הקטגוריה הנצפית - נקראת לצד clearViewedWeek() בניווט ל*אזור* אחר באפליקציה
// (ראשי/טבלאות/ניהול הרשאות/עמוד ראשי), כדי שכניסה טרייה לעמוד יחידה תתחיל מקשר כברירת מחדל.
// בכוונה *לא* נקראת בקישורי "דרישות"/"הקצאות" של אותה יחידה, כדי לשמר שם את הקטגוריה.
function clearViewedCategory() {
  try { sessionStorage.removeItem(CURRENT_CATEGORY_KEY); } catch (e) {}
}

/**
 * שומרת את השבוע הנוכחי ומעבירה את תצוגת המערכת לשבוע ושנה חדשים.
 * @param {number} year - השנה
 * @param {number} week - מספר השבוע
 */
async function loadWeek(year, week) {
  await saveCurrentWeek();
  currentWeek = week;
  currentYear = year;
  saveViewedWeek(week, year);
  await updateUIForWeek();
  if (typeof resetUndoHistory === 'function') resetUndoHistory();
}

/**
 * מעבירה את התצוגה לשבוע הקודם (כולל מעבר שנה במידת הצורך).
 */
function prevWeek() {
  let week = currentWeek - 1, year = currentYear;
  if (week < 1) { year--; week = getWeeksInYear(year); }
  loadWeek(year, week);
}

/**
 * מעבירה את התצוגה לשבוע הבא (כולל מעבר שנה במידת הצורך).
 */
function nextWeek() {
  let week = currentWeek + 1, year = currentYear;
  if (week > getWeeksInYear(currentYear)) { week = 1; year++; }
  loadWeek(year, week);
}

/**
 * מעדכנת את כל רכיבי ממשק המשתמש (שדות שבוע, טבלאות, רשימות חיפוקים, חדר"ג ושק"ם) בעת החלפת שבוע.
 */
async function updateUIForWeek() {
  const weekInput = document.getElementById('weekInput');
  const weekInputOptic = document.getElementById('weekInputOptic');
  if (weekInput) weekInput.value = currentWeek;
  if (weekInputOptic) weekInputOptic.value = currentWeek;

  const tables = getActiveTables();
  for (const tableId of tables) {
    tableWeeks[tableId] = { week: currentWeek, year: currentYear };
    await loadTableData(tableId, currentWeek, currentYear);
  }

  if (typeof loadHipokData === 'function') await loadHipokData(currentWeek, currentYear);

  recalcAll('keshertable');
  recalcAll('optictable', tableConfigs.optictable);
  checkRequirementChanges('keshertable');
  checkRequirementChanges('optictable');

  renderPageNumbers();

  const haktzaot = document.getElementById('haktzaot');
  if (haktzaot && haktzaot.style.display !== 'none') {
    if (typeof renderHaktzaot === 'function') await renderHaktzaot();
    if (typeof renderHaktzaotOptic === 'function') await renderHaktzaotOptic();
    if (typeof renderHaktzaotEsuk === 'function') await renderHaktzaotEsuk();
    if (typeof renderHaktzaotHirg === 'function') await renderHaktzaotHirg();
    if (typeof renderHaktzaotPikud === 'function') await renderHaktzaotPikud();
    if (typeof renderHaktzaotTazam === 'function') await renderHaktzaotTazam();
    if (typeof renderHaktzaotBahalag === 'function') await renderHaktzaotBahalag();
    if (typeof renderHaktzaotHadrag === 'function') await renderHaktzaotHadrag();
    if (typeof renderHaktzaotShekem === 'function') await renderHaktzaotShekem();
    if (typeof renderHaktzaotHipok === 'function') await renderHaktzaotHipok();
  }

  if (typeof renderHipokEntriesList === 'function') await renderHipokEntriesList();
  
  // פונקציות החדר"ג והשק"ם: הטבלאות (עם סימוני הכתום) חייבות להיטען לפני גריד הבקשות של היחידה,
  // כדי שהסריקה הישירה של הגריד המפורסם (paintUnitRequestGrid) תפעל על נתונים עדכניים.
  if (typeof loadHadragTables === 'function') await loadHadragTables(currentWeek, currentYear);
  if (typeof renderHadragRequestsList === 'function') await renderHadragRequestsList();
  if (typeof renderHadragPendingRequests === 'function') await renderHadragPendingRequests();
  if (typeof loadShekemTables === 'function') await loadShekemTables(currentWeek, currentYear);
  if (typeof renderShekemRequestsList === 'function') await renderShekemRequestsList();
  if (typeof renderShekemPendingRequests === 'function') await renderShekemPendingRequests();

  if (typeof updatePublishIndicator === 'function') await updatePublishIndicator();

  // הטבלאות נבנות דינמית - יש להחיל מחדש את ההרשאות לאחר כל רינדור
  if (typeof applyPermissions === 'function') applyPermissions();
}

/* ================================
   סממן הפצה (ליד כפתור "הפץ שינויים")
   מבוסס על קיום/היעדר תאים מסומנים בכתום (.conflict-overlap) - סימן לשינויים שטרם הופצו.
================================ */
let _publishIndicatorObserver = null;

/**
 * מפעילה בדיקה שצובעת את כפתור "הפץ שינויים"/"שמור ומוכן לייבוא" (אדום/ירוק) -
 * ראו updateGlobalExportButtonStatus.
 */
async function updatePublishIndicator() {
  await updateGlobalExportButtonStatus();
}

/**
 * מפעילה מעקב (MutationObserver) שמעדכן את סממן ההפצה בכל שינוי בסימוני הכתום בעמוד.
 */
function initPublishIndicatorObserver() {
  if (_publishIndicatorObserver) return;
  _publishIndicatorObserver = new MutationObserver(() => updatePublishIndicator());
  _publishIndicatorObserver.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
}

/* ================================
   בדיקה גלובלית: האם קיימים בכלל המערכת (לא רק בעמוד הנוכחי) שינויים שטרם הופצו
   לשבוע הנוכחי - קשר/אופטיקה (לפי רשימת הממתינים), טבלאות מודיעין/דרישת יחידה,
   חדר"ג, שק"ם וחיפוקים (השוואת draft מול published ישירות מהאחסון).
================================ */

/** מסננת ערכי תא "ריקים למעשה" (מחרוזת ריקה, או תא חדר"ג/שק"ם ללא טקסט וללא צבע) כדי שהשוואת draft מול published לא תיתקל בפער מלאכותי. */
function _isEffectivelyEmptyCell(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'object') {
    const valEmpty = !v.val || String(v.val).trim() === '';
    const noColor = !v.classes || v.classes.length === 0 || (v.classes.length === 1 && !v.classes[0]);
    return valEmpty && noColor;
  }
  return false;
}

function _normalizeCellDataForCompare(obj) {
  const out = {};
  if (!obj) return out;
  Object.keys(obj).forEach(k => {
    if (!_isEffectivelyEmptyCell(obj[k])) out[k] = obj[k];
  });
  return out;
}

async function _hasUnpublishedDraft(key) {
  const draft = await fetchTableData(key);
  const normalizedDraft = _normalizeCellDataForCompare(draft);
  if (Object.keys(normalizedDraft).length === 0) return false;
  const published = await fetchTableData(key + '_published');
  const normalizedPublished = _normalizeCellDataForCompare(published);
  return JSON.stringify(normalizedDraft) !== JSON.stringify(normalizedPublished);
}

async function hasAnySystemPendingChanges(week, year) {
  // קשר/אופטיקה - כפתור "הפץ שינויים" הוא סממן גלובלי ("האם יש בכלל משהו שלא הופץ"), ולכן
  // בודק את הטיוטה מול הפרסום של הטבלה כולה - כולל עריכה ישירה של המנהל בטבלה הגדולה, לא רק
  // ייבוא (בשונה מהסימון הכתום על תא ספציפי, שנשאר מוגבל לייבוא בלבד כדי לא "ללכלך" תאים
  // שהמנהל פשוט מילא/תיקן בעצמו - ראו MASTER_COMBINED_TABLES והסימון ב-loadTableData).
  for (const tableId of MASTER_COMBINED_TABLES) {
    if (await _hasUnpublishedDraft(getStorageKey(tableId, week, year))) return true;
  }

  // מודיעין, דרישות יחידה, ותת-טבלאות קשר/אופטיקה
  const otherTrackedTables = MANAGER_TRACKED_TABLES.filter(id => !MASTER_COMBINED_TABLES.includes(id));
  for (const tableId of otherTrackedTables) {
    if (await _hasUnpublishedDraft(getStorageKey(tableId, week, year))) return true;
  }

  // חדר"ג
  for (const tableId of Object.keys(HADRAG_TABLES_MAP)) {
    if (await _hasUnpublishedDraft(`hadragData_${tableId}_week${week}_year${year}`)) return true;
  }

  // שק"ם
  if (await _hasUnpublishedDraft(`shekemData_body-shekem_week${week}_year${year}`)) return true;

  // חיפוקים - טבלת המנהל עצמה
  if (await _hasUnpublishedDraft(getStorageKey('hipoktable', week, year))) return true;

  // בקשות חיפוקים שיחידה פרסמה וטרם יובאו לטבלת המנהל
  const publishedHipokEntries = (await fetchTableData(getHipokEntriesKey(week, year) + '_published')) || [];
  if (publishedHipokEntries.length > 0) {
    const importedIds = new Set(await loadHipokImportedIds(week, year));
    if (publishedHipokEntries.some(e => !importedIds.has(e.id))) return true;
  }

  // בקשות חדר"ג/שק"ם שיחידה פרסמה וטרם אושרו על ידי המנהל
  const publishedHadragRequests = (await fetchTableData(getHadragRequestsKey(week, year) + '_published')) || [];
  if (publishedHadragRequests.some(r => r.status !== 'approved')) return true;

  const publishedShekemRequests = (await fetchTableData(getShekemRequestsKey(week, year) + '_published')) || [];
  if (publishedShekemRequests.some(r => r.status !== 'approved')) return true;

  return false;
}

// טבלאות הדרישה של כל יחידה (קשר, אופטיקה, מודיעין) - "שמור ומוכן לייבוא" הוא כפתור כללי
// אחד לכולן יחד, ולכן גם צביעת הכפתור (אדום/ירוק) בודקת את כל השלוש, לא רק את הכרטיסייה הפתוחה כרגע.
const UNIT_OWN_TABLES = {
  'esuk.html': ['esukkeshertable', 'esukoptictable', 'reqesukTable'],
  'hirg.html': ['kkeshertable', 'koptictable', 'reqhirgTable'],
  'pikud.html': ['pkeshertable', 'poptictable', 'reqpikudTable'],
  'tazam.html': ['tkeshertable', 'toptictable', 'reqtazamTable'],
  'bahalag.html': ['bkeshertable', 'boptictable', 'reqbahalagTable']
};

// משווה תת-קבוצה (מסוננת ליחידה הנוכחית) מתוך רשימה משותפת (חיפוקים/חדר"ג/שק"ם) בין draft
// ל-published, כדי לגלות אם ליחידה יש רשומות משלה שעדיין לא נשמרו/פורסמו - ללא תלות
// בשינויים שביצעו יחידות אחרות באותה רשימה משותפת.
function _normalizeEntryListForCompare(list, filterFn) {
  return (list || [])
    .filter(filterFn)
    .map(item => ({ ...item }))
    .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
}

async function _hasUnitOwnEntryListPending(key, filterFn) {
  const draft = await fetchTableData(key);
  const published = await fetchTableData(key + '_published');
  const normDraft = _normalizeEntryListForCompare(draft, filterFn);
  const normPublished = _normalizeEntryListForCompare(published, filterFn);
  return JSON.stringify(normDraft) !== JSON.stringify(normPublished);
}

async function hasUnitPendingChanges(currentPage, week, year) {
  const tables = UNIT_OWN_TABLES[currentPage] || [];
  for (const tableId of tables) {
    if (await _hasUnpublishedDraft(getStorageKey(tableId, week, year))) return true;
  }

  // "שמור ומוכן לייבוא" הוא כפתור כללי - חל גם על בקשות חיפוקים/חדר"ג/שק"ם שהיחידה הגישה
  // (רשימות משותפות לכל היחידות, מסוננות כאן לפי הצבע של היחידה הנוכחית בלבד).
  const unitColor = PAGE_UNIT_MAP[currentPage];
  if (unitColor) {
    if (await _hasUnitOwnEntryListPending(getHipokEntriesKey(week, year), e => e.color === unitColor)) return true;
    if (await _hasUnitOwnEntryListPending(getHadragRequestsKey(week, year), r => r.unit === unitColor)) return true;
    if (await _hasUnitOwnEntryListPending(getShekemRequestsKey(week, year), r => r.unit === unitColor)) return true;
  }

  // בלוקים שנוצרו/הוזזו/שונה גודלם/נערך הטקסט שלהם בגריד הבקשות (חדר"ג/שק"ם) אך עדיין לא
  // הפכו לרשומת בקשה בפועל - קיימים רק בזיכרון (hadragStagedBlocks/shekemStagedBlocks), כך
  // שההשוואה draft-מול-published למעלה לא תופסת אותם. אין כפתור "שמור בקשות" נפרד - גם הם
  // נכללים ב"יש שינויים שטרם נשמרו" של "שמור ומוכן לייבוא" (commitHadragStagedBlocks/
  // commitShekemStagedBlocks נקראות משם וממירות אותם לרשומה בפועל).
  if (typeof hadragStagedBlocks !== 'undefined' && hadragStagedBlocks.some(b => !b.reqId || b.dirty)) return true;
  if (typeof shekemStagedBlocks !== 'undefined' && shekemStagedBlocks.some(b => !b.reqId || b.dirty)) return true;

  return false;
}

/**
 * צובעת את כפתור הייצוא (אדום = יש שינויים חדשים, ירוק = הכל מעודכן לשבוע הנוכחי):
 * - "הפץ שינויים" (עמודי מנהל) - בדיקה גלובלית לכל המערכת (קשר/אופטיקה/מודיעין/חיפוקים/
 *   חדר"ג/שק"ם), לא רק לעמוד הנוכחי.
 * - "שמור ומוכן לייבוא" (עמוד יחידה, מזוהה לפי מחלקת unit-ready) - כפתור כללי לכל טבלאות
 *   הדרישה של אותה קבוצה (קשר+אופטיקה+מודיעין), לא רק לכרטיסייה הפתוחה כרגע.
 */
async function updateGlobalExportButtonStatus() {
  const btn = document.getElementById('global-export-btn');
  if (!btn) return;
  if (typeof currentWeek === 'undefined' || typeof currentYear === 'undefined') return;

  const isUnitBtn = btn.classList.contains('unit-ready');
  const hasPending = isUnitBtn
    ? await hasUnitPendingChanges(AUTH.currentPage(), currentWeek, currentYear)
    : await hasAnySystemPendingChanges(currentWeek, currentYear);

  btn.classList.toggle('has-pending', hasPending);
  btn.classList.toggle('all-published', !hasPending);
}

/**
 * פונקציית ייצוא מנהל: שומרת את הנתונים הנוכחיים למצב 'published'.
 * מנקה צבעים כתומים שסימנו שינויים.
 */
/**
 * בודקת אם הגרסה המפורסמת של אחד ממפתחות הטיוטה שעומדים להיכתב כבר השתנתה "מרחוק" (משתמש/
 * מכשיר אחר שהפיץ שינויים במקביל, במצב שרת מרכזי) מאז שהעותק המקומי האחרון נטען - כדי להזהיר
 * לפני הפצה שעלולה לדרוס בשקט את השינוי המקביל ההוא. פעילה רק כשמוגדר שרת מרכזי
 * (SharePoint/רשת צבאית); במצב מקומי (localStorage בלבד, ברירת המחדל) תמיד מחזירה false -
 * אין מכשיר אחר שיכול להתנגש איתו כשהאחסון הוא אותו localStorage בדיוק.
 * @param {string[]} draftKeys - מפתחות הטיוטה שעומדים להיות מועתקים ל-published
 * @returns {Promise<boolean>}
 */
async function _detectConcurrentPublish(draftKeys) {
  if (typeof DataService === 'undefined' || typeof DataService._isRemote !== 'function' || !DataService._isRemote()) {
    return false;
  }
  for (const draftKey of draftKeys) {
    const pubKey = draftKey + '_published';
    const localCached = localStorage.getItem(pubKey);
    let remote;
    try { remote = await DataService.getItem(pubKey); } catch (e) { continue; }
    const remoteStr = (remote !== null && remote !== undefined) ? JSON.stringify(remote) : null;
    if (remoteStr !== null && remoteStr !== localCached) return true;
  }
  return false;
}

async function globalExportManager() {
  if (!confirm('האם אתה בטוח שברצונך להפיץ את כלל השינויים לשבוע זה? (פעולה זו תאשר את המצב הנוכחי ותנקה סימונים כתומים)')) return;

  const currentPrefix = `week${currentWeek}_year${currentYear}`;

  // 1. Copy all draft keys to published
  // חשוב: קודם ממצים את כל מפתחות ה-localStorage לרשימה קבועה (snapshot), ורק אז כותבים.
  // כתיבה תוך כדי איטרציה לפי localStorage.key(i)/localStorage.length משבשת את סדר
  // האינדקסים הפנימי (המפתחות החדשים לא בהכרח נוספים בסוף), מה שגרם לדילוג אקראי
  // על טבלאות מסוימות - הסימן שהמשתמש דיווח עליו כ"לפעמים מתבלבל בטבלאות גדולות".
  const draftKeysSnapshot = Object.keys(localStorage).filter(
    key => key.includes(currentPrefix) && !key.includes('_published')
  );

  if (await _detectConcurrentPublish(draftKeysSnapshot)) {
    if (!confirm('שים לב: נראה שמשתמש/מכשיר אחר כבר הפיץ שינויים לשבוע זה מאז שהעמוד הזה נטען לאחרונה. המשך ההפצה עלול לדרוס את השינוי הזה. לרענן ולבדוק קודם מומלץ.\n\nלהמשיך בכל זאת ולהפיץ?')) return;
  }

  for (const key of draftKeysSnapshot) {
    const data = localStorage.getItem(key);
    if (typeof DataService !== 'undefined') {
      await DataService.setItem(`${key}_published`, JSON.parse(data));
    } else {
      localStorage.setItem(`${key}_published`, data);
    }
  }

  // 2. Remove orange highlights
  document.querySelectorAll('.conflict-overlap').forEach(el => {
    el.classList.remove('conflict-overlap');
  });

  // 2.5 מרוקנים את רשימות האינדקסים הממתינים בטבלאות המשולבות (קשר/אופטיקה) - ראו
  // MASTER_COMBINED_TABLES - כדי שהסימון הכתום שם יתאפס גם הוא עם ההפצה. חשוב לעשות זאת
  // *לפני* updatePublishIndicator, אחרת הבדיקה הגלובלית עדיין תמצא את הרשימה הישנה.
  MASTER_COMBINED_TABLES.forEach(tableId => savePendingImportIndexes(tableId, currentWeek, currentYear, []));

  if (typeof updatePublishIndicator === 'function') await updatePublishIndicator();

  // 3. Trigger save again so the orange class removal is saved (רק חדר"ג/שק"ם - קשר/אופטיקה/מודיעין/
  // חיפוקים לא נשמרים דרך פונקציית save ייעודית; סימון הכתום שלהם מחושב חי מהשוואת draft מול published
  // ומתעדכן ממילא בטעינה/עדכון הבא, לא צריך "שמירה חוזרת" מפורשת).
  if (typeof saveHadragTables === 'function') saveHadragTables();
  if (typeof saveShekemTables === 'function') saveShekemTables();

  if (typeof addNotification === 'function') {
    addNotification(`📢 המנהל הפיץ שינויים לשבוע ${currentWeek} (${currentYear})`, 'distribute');
  }

  alert('השינויים הופצו בהצלחה!');
}

/**
 * פונקציית ייצוא פלוגה: שומרת את הטיוטה למצב שמאפשר למנהל לייבא.
 */
async function globalExportUnit() {
  if (!confirm('האם סיימת את השיבוץ וברצונך לשמור את הנתונים כך שיהיו מוכנים לייבוא על ידי המנהל?')) return;

  // ממירים קודם כל בלוק "ממתין" שנוצר/הוזז בגריד הבקשות (חדר"ג/שק"ם) לרשומת בקשה בפועל -
  // אין כפתור "שמור בקשות" נפרד, "שמור ומוכן לייבוא" הוא הפעולה היחידה ששומרת אותן. אם יש
  // בלוק עם טקסט ריק העדכון עוצר כאן (ראו commitHadragStagedBlocks/commitShekemStagedBlocks).
  if (typeof commitHadragStagedBlocks === 'function' && !(await commitHadragStagedBlocks())) return;
  if (typeof commitShekemStagedBlocks === 'function' && !(await commitShekemStagedBlocks())) return;

  const currentPrefix = `week${currentWeek}_year${currentYear}`;

  // ראו הערה במימוש globalExportManager: יש למצות snapshot של המפתחות לפני כתיבה,
  // אחרת כתיבה תוך כדי איטרציה עלולה לדלג על מפתחות באופן לא צפוי.
  const draftKeysSnapshot = Object.keys(localStorage).filter(
    key => key.includes(currentPrefix) && !key.includes('_published')
  );

  if (await _detectConcurrentPublish(draftKeysSnapshot)) {
    if (!confirm('שים לב: נראה שהנתונים האלה כבר עודכנו במקביל ממכשיר/משתמש אחר מאז שהעמוד הזה נטען. שמירה עכשיו עלולה לדרוס את העדכון הזה. לרענן ולבדוק קודם מומלץ.\n\nלהמשיך בכל זאת ולשמור?')) return;
  }

  for (const key of draftKeysSnapshot) {
    const data = localStorage.getItem(key);
    if (typeof DataService !== 'undefined') {
      await DataService.setItem(`${key}_published`, JSON.parse(data));
    } else {
      localStorage.setItem(`${key}_published`, data);
    }
  }

  document.querySelectorAll('.conflict-overlap').forEach(el => el.classList.remove('conflict-overlap'));
  if (typeof updatePublishIndicator === 'function') await updatePublishIndicator();

  if (typeof addNotification === 'function') {
    const page = (window.location.pathname.split('/').pop() || '').toLowerCase();
    const unitName = (typeof UNIT_TITLE_MAP !== 'undefined' && UNIT_TITLE_MAP[page]) || 'יחידה';
    addNotification(`✅ ${unitName} שמרה נתונים מוכנים לייבוא לשבוע ${currentWeek} (${currentYear})`, 'unit-ready');
  }

  alert('הנתונים נשמרו ומוכנים לייבוא!');
}

/* ================================
   העתקת שבוע / הדבקה לכל השנה (אפיון 1.3) - מנהל בלבד
================================ */

// מעתיקה גם את מבנה השורות (rowList) כדי לשמור התאמה בין הנתונים לשמות האמצעים.
function copyRowListToWeek(category, targetWeek, targetYear) {
  const rows = getRowsForWeek(category, currentWeek, currentYear);
  persist(getRowsStorageKey(category, targetWeek, targetYear), rows);
}

/**
 * מזהה את הקטגוריה (קשר/אופטיקה) של טבלה נתונה - טבלת מנהל או טבלת דרישה יחידתית.
 * @param {string} tableId - מזהה הטבלה
 * @returns {'kesher'|'optic'|null}
 */
function getKesherOpticCategory(tableId) {
  if (KESHER_TABLE_LIST.some(t => t.id === tableId)) return 'kesher';
  if (OPTIC_TABLE_LIST.some(t => t.id === tableId)) return 'optic';
  return null;
}

/**
 * מעתיקה את תוכן טבלת קשר/אופטיקה (מנהל או יחידה) משבוע הנוכחי לשבוע יעד שנבחר.
 */
async function copyWeekToTarget(tableId) {
  const category = getKesherOpticCategory(tableId);
  const catName = category === 'kesher' ? 'קשר' : 'אופטיקה';
  const weeksInYear = getWeeksInYear(currentYear);
  const targetStr = prompt(`העתקת נתוני ${catName} משבוע ${currentWeek} (${currentYear}) לשבוע יעד.\nהזן מספר שבוע יעד (1-${weeksInYear}):`);
  if (targetStr === null) return;
  const target = parseInt(targetStr);
  if (isNaN(target) || target < 1 || target > weeksInYear) { alert('מספר שבוע לא תקין.'); return; }
  if (target === currentWeek) { alert('שבוע היעד זהה לשבוע הנוכחי.'); return; }

  await saveCurrentWeek();
  const data = await fetchTableData(getStorageKey(tableId, currentWeek, currentYear));
  if (!data) { alert('אין נתונים להעתקה בשבוע הנוכחי.'); return; }

  await DataService.setItem(getStorageKey(tableId, target, currentYear), data);
  copyRowListToWeek(category, target, currentYear);
  alert(`הנתונים הועתקו לשבוע ${target} (${currentYear}).`);
}

/**
 * מדביקה את תוכן השבוע הנוכחי לכל השבועות הבאים באותה שנה (דורס נתונים קיימים).
 * בנוסף, שומרת ומייצאת (מפרסמת) אוטומטית את דרישות הפלוגות עבור השבוע הנוכחי ועבור כל
 * שבוע שאליו מדביקים:
 * - בטבלת מנהל משולבת (keshertable/optictable) - מפרסמת את טבלאות הבקשה היחידתיות
 *   שמיובאות אליה (ראו SUB_TABLE_MAPS), כדי שלא יווצר פער בין תוכן טבלת המנהל שהודבק
 *   לבין מצב "הדרישה המפורסמת" שהיחידות רואות (checkRequirementChanges קוראת רק מ-_published).
 * - בטבלת בקשה יחידתית עצמה (למשל esukkeshertable, מהעמוד של אותה יחידה) - מפרסמת אותה
 *   עצמה, אחרת טבלת המנהל לא תוכל לייבא ממנה (importFromSubTable קוראת גם היא רק מ-_published)
 *   עבור השבועות שאליהם הודבק, גם אם הטיוטה כן הועתקה.
 */
async function applyWeekToRestOfYear(tableId) {
  const category = getKesherOpticCategory(tableId);
  const catName = category === 'kesher' ? 'קשר' : 'אופטיקה';
  const weeksInYear = getWeeksInYear(currentYear);
  if (currentWeek >= weeksInYear) { alert('זהו השבוע האחרון בשנה - אין שבועות הבאים להדבקה.'); return; }
  if (!confirm(`פעולה זו תעתיק את תוכן טבלת ${catName} משבוע ${currentWeek} לכל השבועות ${currentWeek + 1}-${weeksInYear} בשנת ${currentYear}, ותדרוס את הנתונים הקיימים בהם.\nבנוסף, דרישות הפלוגות של השבוע הנוכחי יישמרו ויוצאו אוטומטית לכל אותם שבועות.\n\nלהמשיך?`)) return;

  await saveCurrentWeek();
  const data = await fetchTableData(getStorageKey(tableId, currentWeek, currentYear));
  if (!data) { alert('אין נתונים להעתקה בשבוע הנוכחי.'); return; }

  const isMasterCombined = MASTER_COMBINED_TABLES.includes(tableId);
  const subTableConfigs = isMasterCombined ? (SUB_TABLE_MAPS[tableId] || []) : [{ sourceTableId: tableId }];
  const subTableSnapshots = {};
  for (const cfg of subTableConfigs) {
    subTableSnapshots[cfg.sourceTableId] = (cfg.sourceTableId === tableId)
      ? data
      : await fetchTableData(getStorageKey(cfg.sourceTableId, currentWeek, currentYear));
  }
  for (const cfg of subTableConfigs) {
    const snap = subTableSnapshots[cfg.sourceTableId];
    if (!snap) continue;
    await DataService.setItem(getStorageKey(cfg.sourceTableId, currentWeek, currentYear) + '_published', snap);
  }

  let count = 0;
  for (let w = currentWeek + 1; w <= weeksInYear; w++) {
    await DataService.setItem(getStorageKey(tableId, w, currentYear), data);
    copyRowListToWeek(category, w, currentYear);

    for (const cfg of subTableConfigs) {
      const snap = subTableSnapshots[cfg.sourceTableId];
      if (!snap) continue;
      const subKey = getStorageKey(cfg.sourceTableId, w, currentYear);
      if (cfg.sourceTableId !== tableId) {
        await DataService.setItem(subKey, snap);
      }
      await DataService.setItem(subKey + '_published', snap);
    }

    count++;
  }

  if (typeof updatePublishIndicator === 'function') await updatePublishIndicator();

  alert(`הנתונים הועתקו ל-${count} שבועות (${currentWeek + 1}-${weeksInYear}), כולל שמירה וייצוא אוטומטיים של דרישות הפלוגות.`);
}

/**
 * מייצרת ומציגה כפתורי ניווט מהיר לשבועות הסמוכים (טווח של +-2 שבועות).
 */
function renderPageNumbers() {
  const containers = ['pageNumbers', 'pageNumbers-optic', 'pageNumbers2'];
  containers.forEach(id => {
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = '';
      // סדר הופעה הפוך (מהשבוע הגדול לקטן) - כדי שבתצוגה (RTL) השבוע הגדול/מאוחר יותר
      // יופיע בצד שמאל והקטן/מוקדם יותר בצד ימין, בהתאמה לכפתורי "הבא"/"קודם" שהוחלפו (אפיון QA).
      for (let offset = 2; offset >= -2; offset--) {
        let week = currentWeek + offset, year = currentYear;
        if (week < 1) { const prevYearWeeks = getWeeksInYear(year - 1); week += prevYearWeeks; year--; }
        if (week > getWeeksInYear(year)) { week -= getWeeksInYear(year); year++; }
        const btn = document.createElement('button');
        btn.textContent = `${week} (${year})`;
        btn.onclick = () => loadWeek(year, week);
        if (week === currentWeek && year === currentYear) btn.classList.add('active-week');
        container.appendChild(btn);
      }
    }
  });
}

/**
 * מאתחלת מאזיני אירועים לשדות הקלט הידניים של מזהה השבוע בסרגל העליון.
 */
function initWeekInput() {
  ['weekInput', 'weekInputOptic'].forEach(inputId => {
    const weekInput = document.getElementById(inputId);
    if (weekInput) weekInput.addEventListener('change', () => {
      let val = parseInt(weekInput.value);
      const maxWeek = (typeof getWeeksInYear === 'function') ? getWeeksInYear(currentYear) : 52;
      if (isNaN(val) || val < 1) val = 1;
      if (val > maxWeek) val = maxWeek;
      weekInput.value = val;
      loadWeek(currentYear, val);
    });
  });
}

/* ================================
   מערכת החיפוקים (+ צבעים)
================================ */

/**
 * קוראת את נתוני טבלת החיפוקים (משימות, שעות וצבעים) מתוך ה-DOM.
 * @returns {Object} אובייקט נתוני החיפוקים
 */
function readHipokData() {
  const data = {};
  document.querySelectorAll('#hipoktable .task-input').forEach((el, i) => { data['task_' + i] = el.value; });
  document.querySelectorAll('#hipoktable .time-input').forEach((el, i) => { data['time_' + i] = el.value; });
  
  if (typeof ALL_HIPOK_COLORS !== 'undefined') {
    document.querySelectorAll('#hipoktable .cell-wrapper').forEach((el, i) => {
       const colorClass = ALL_HIPOK_COLORS.find(c => el.classList.contains(c)) || '';
       data['color_' + i] = colorClass;
    });
  }
  return data;
}

/**
 * שומרת את נתוני טבלת החיפוקים עבור השבוע והשנה הנוכחיים.
 */
async function saveHipokData() {
  const table = document.getElementById('hipoktable');
  if (!table) return;
  const data = readHipokData();
  const key = getStorageKey('hipoktable', currentWeek, currentYear);
  if (typeof DataService !== 'undefined') {
    await DataService.setItem(key, data);
  } else {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

/**
 * טוענת את נתוני טבלת החיפוקים עבור שבוע ושנה נתונים ומעדכנת את שדות הטבלה והצבעים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
async function loadHipokData(week, year) {
  const table = document.getElementById('hipoktable');
  if (!table) return;

  document.querySelectorAll('#hipoktable .task-input').forEach(el => el.value = '');
  document.querySelectorAll('#hipoktable .time-input').forEach(el => el.value = '');
  document.querySelectorAll('#hipoktable .cell-wrapper').forEach(wrapper => { wrapper.className = 'cell-wrapper'; });

  const key = getStorageKey('hipoktable', week, year);
  let data = null;
  if (typeof DataService !== 'undefined') {
    data = await DataService.getItem(key);
  } else {
    const saved = localStorage.getItem(key);
    if (saved) data = JSON.parse(saved);
  }
  if (!data) return;

  document.querySelectorAll('#hipoktable .task-input').forEach((el, i) => {
    if (data['task_' + i] !== undefined) {
      el.value = data['task_' + i];
      if (data['task_' + i].trim() !== '') {
        const wrapper = el.closest('.cell-wrapper');
        if (wrapper) wrapper.classList.add('imported');
      }
    }
  });
  document.querySelectorAll('#hipoktable .time-input').forEach((el, i) => {
    if (data['time_' + i] !== undefined) {
      el.value = data['time_' + i];
      if (data['time_' + i].trim() !== '') {
        const wrapper = el.closest('.cell-wrapper');
        if (wrapper) wrapper.classList.add('imported');
      }
    }
  });

  if (typeof ALL_HIPOK_COLORS !== 'undefined') {
    document.querySelectorAll('#hipoktable .cell-wrapper').forEach((wrapper, i) => {
       if (data['color_' + i]) {
           wrapper.classList.add(data['color_' + i]);
       }
    });
  }
}

const HIPOK_DAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"];
const HIPOK_MAX_SLOTS_PER_GROUP = 6;

/**
 * מפיקה מפתח שמירה עבור רשימת בקשות החיפוקים של היחידות.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 * @returns {string} מפתח שמירה
 */
function getHipokEntriesKey(week, year) { return `hipokEntries_week${week}_year${year}`; }

/**
 * טוענת את רשימת בקשות החיפוקים המאוחסנות לשבוע ושנה מסוימים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 * @returns {Promise<Array<Object>>} מערך אובייקטי בקשות חיפוק
 */
async function loadHipokEntries(week, year) {
  const key = getHipokEntriesKey(week, year);
  if (typeof DataService !== 'undefined') {
    const data = await DataService.getItem(key);
    return data || [];
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

/**
 * שומרת את רשימת בקשות החיפוקים ב-DataService.
 * @param {Array<Object>} entries - מערך בקשות החיפוק
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
async function saveHipokEntriesList(entries, week, year) {
  const key = getHipokEntriesKey(week, year);
  if (typeof DataService !== 'undefined') {
    await DataService.setItem(key, entries);
  } else {
    localStorage.setItem(key, JSON.stringify(entries));
  }
}

/**
 * מוסיפה בקשת חיפוק חדשה לרשימה ומעדכנת את השמירה.
 * @param {string} type - סוג החיפוק ('dry' / 'wet')
 * @param {number} day - אינדקס יום (0-6)
 * @param {string} time - מחרוזת שעות
 * @param {string} [text] - פירוט המשימה
 * @param {string} [color] - מחלקת צבע היחידה
 * @returns {Array<Object>} הרשימה המעודכנת
 */
async function addHipokEntry(type, day, time, text = '', color = '') {
  const entries = await loadHipokEntries(currentWeek, currentYear);
  entries.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type, day, time, text, color });
  await saveHipokEntriesList(entries, currentWeek, currentYear);
  return entries;
}

/**
 * מוחקת בקשת חיפוק ספציפית לפי מזהה ייחודי.
 * @param {string} id - מזהה הבקשה
 * @returns {Array<Object>} הרשימה המעודכנת לאחר המחיקה
 */
async function deleteHipokEntry(id) {
  const entries = (await loadHipokEntries(currentWeek, currentYear)).filter(e => e.id !== id);
  await saveHipokEntriesList(entries, currentWeek, currentYear);
  return entries;
}

/**
 * מוחקת בקשת חיפוק ומעדכנת את התצוגה בעמוד היחידה.
 * @param {string} id - מזהה הבקשה
 */
async function removeHipokEntry(id) {
  await deleteHipokEntry(id);
  if (typeof renderHipokEntriesList === 'function') await renderHipokEntriesList();
}

const PAGE_UNIT_MAP = {
  'esuk.html': 'bg-esuk',
  'hirg.html': 'bg-hirg',
  'pikud.html': 'bg-pikud',
  'tazam.html': 'bg-tazam',
  'bahalag.html': 'bg-maphat'
};

/**
 * מרנדרת את רשימת בקשות החיפוקים המוגשות בעמוד היחידה הרלוונטית.
 */
async function renderHipokEntriesList() {
  const container = document.getElementById('hipokEntriesList');
  if (!container) return;

  const entries = await loadHipokEntries(currentWeek, currentYear);
  const currentPage = window.location.pathname.split('/').pop();
  const targetColor = PAGE_UNIT_MAP[currentPage];

  let filteredEntries = entries;
  if (targetColor) {
    filteredEntries = entries.filter(e => e.color === targetColor);
  }

  if (filteredEntries.length === 0) {
    container.innerHTML = '<p style="color:#666; text-align:center; padding: 15px; font-weight:bold;">אין חיפוקים שהוזנו לשבוע זה.</p>';
  } else {
    container.innerHTML = filteredEntries.map(entry => {
      const typeText = entry.type === 'dry' ? 'חיפוק יבש' : 'חיפוק רטוב';
      const dayText = HIPOK_DAY_LABELS[entry.day] !== undefined ? 'יום ' + HIPOK_DAY_LABELS[entry.day] : '';
      const styleObj = UNIT_BG_MAP[entry.color] || { bg: '#fff9c4', border: '#ffe082', text: '#856404' };

      return `
        <div class="hipok-entry-row" style="max-width: 700px; margin: 0 auto 10px auto; background-color: ${styleObj.bg}; border: 2px solid ${styleObj.border}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <span style="font-weight: bold; width: 100px; color: ${styleObj.text}; text-align: right;">${typeText}</span>
          <span style="font-weight: bold; width: 80px; color: #333;">${dayText}</span>
          <span style="flex:1; text-align:right; padding-right: 15px; color: #000;">${escapeHtml(entry.text) || '-'}</span>
          <span style="direction: ltr; font-weight: bold; color: #333; margin-left: 15px;">${escapeHtml(entry.time)}</span>
          <button class="hipok-delete-btn" onclick="removeHipokEntry('${entry.id}')">✕</button>
        </div>
      `;
    }).join('');
  }

  // רענון טבלת ההקצאות אם היא גלויה
  const haktzaotSection = document.getElementById('haktzaot');
  if (haktzaotSection && haktzaotSection.style.display !== 'none') {
    if (typeof renderHaktzaotHipok === 'function') await renderHaktzaotHipok();
  }
}


/**
 * מוצאת ומחזירה תא ספציפי בטבלת החיפוקים לפי סוג החיפוק, היום ואינדקס המשבצת.
 * @param {string} type - סוג ('dry' / 'wet')
 * @param {number} day - יום בשבוע
 * @param {number} slotIndex - אינדקס סלוט בתוך היום
 * @returns {HTMLTableCellElement|null} התא שנמצא או null
 */
function getHipokTableCell(type, day, slotIndex) {
  const table = document.getElementById('hipoktable');
  if (!table || !table.tBodies[0]) return null;
  const tbody = table.tBodies[0];
  let rowIndex, cellIndex;
  if (type === 'dry') {
    if (slotIndex === 0) { rowIndex = 0; cellIndex = day + 2; }
    else { rowIndex = slotIndex; cellIndex = day; }
  } else {
    if (slotIndex === 0) { rowIndex = 6; cellIndex = day + 1; }
    else { rowIndex = 6 + slotIndex; cellIndex = day; }
  }
  const row = tbody.rows[rowIndex];
  if (!row) return null;
  return row.cells[cellIndex] || null;
}

/**
 * מפתח השמירה של רשימת מזהי בקשות החיפוק שכבר יובאו לטבלת המנהל לשבוע נתון -
 * מונע ייבוא כפול (אפיון QA: לחיצה חוזרת על "ייבוא" יצרה עותק נוסף לבקשות שכבר יובאו).
 */
function getHipokImportedIdsKey(week, year) { return `hipokImportedIds_week${week}_year${year}`; }

async function loadHipokImportedIds(week, year) {
  const key = getHipokImportedIdsKey(week, year);
  if (typeof DataService !== 'undefined') {
    return (await DataService.getItem(key)) || [];
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

async function saveHipokImportedIds(ids, week, year) {
  const key = getHipokImportedIdsKey(week, year);
  if (typeof DataService !== 'undefined') {
    await DataService.setItem(key, ids);
  } else {
    localStorage.setItem(key, JSON.stringify(ids));
  }
}

/**
 * מייבאת את בקשות החיפוקים של היחידות לתוך טבלת החיפוקים של המנהל מול מגבלת המשבצות.
 */
async function importHipukim() {
  const table = document.getElementById('hipoktable');
  if (!table) { alert('טבלת החיפוקים לא נמצאה'); return; }

  // מייבאים רק חיפוקים שהיחידה שמרה ופרסמה בפועל ("שמור ומוכן לייבוא") - לא בקשה שהוקלדה
  // ועדיין לא נשמרה על ידי היחידה (אפיון QA).
  const publishedKey = getHipokEntriesKey(currentWeek, currentYear) + '_published';
  const allEntries = (await fetchTableData(publishedKey)) || [];
  if (allEntries.length === 0) {
    alert('אין חיפוקים מאושרים (לא בוצע שמירה לייבוא) לשבוע זה.');
    return;
  }

  const importedIds = await loadHipokImportedIds(currentWeek, currentYear);
  const importedIdSet = new Set(importedIds);
  const entries = allEntries.filter(entry => !importedIdSet.has(entry.id));

  if (entries.length === 0) {
    alert('כל החיפוקים שהוזנו כבר יובאו לטבלה.');
    return;
  }

  const slotCounters = {};
  const overflow = [];
  const newlyImportedIds = [];

  entries.forEach(entry => {
    const key = `${entry.type}_${entry.day}`;
    let slot = slotCounters[key] || 0;
    
    let targetCell = null;
    let targetTimeInput = null;
    let targetTaskInput = null;
    let targetWrapper = null;

    // Find the next empty slot that doesn't have manual data
    while (slot < HIPOK_MAX_SLOTS_PER_GROUP) {
      const cell = getHipokTableCell(entry.type, entry.day, slot);
      if (!cell) break;
      
      const timeInput = cell.querySelector('.time-input');
      const taskInput = cell.querySelector('.task-input');
      const wrapper = cell.querySelector('.cell-wrapper');
      
      let isOccupied = false;
      if (timeInput && timeInput.value.trim() !== '') isOccupied = true;
      if (taskInput && taskInput.value.trim() !== '') isOccupied = true;
      if (wrapper && typeof ALL_COLOR_CLASSES !== 'undefined') {
        if (ALL_COLOR_CLASSES.some(c => c !== 'imported' && c !== 'conflict-overlap' && wrapper.classList.contains(c))) {
          isOccupied = true;
        }
      }

      if (!isOccupied) {
        targetCell = cell;
        targetTimeInput = timeInput;
        targetTaskInput = taskInput;
        targetWrapper = wrapper;
        break;
      }
      slot++;
    }

    if (!targetCell) {
      overflow.push(entry);
      slotCounters[key] = slot; // update to where we stopped
      return;
    }

    slotCounters[key] = slot + 1; // start searching from next slot next time

    if (targetTimeInput && entry.time) targetTimeInput.value = entry.time;
    if (targetTaskInput && entry.text) targetTaskInput.value = entry.text;

    if (targetWrapper) {
      targetWrapper.classList.add('imported');
      if (typeof ALL_COLOR_CLASSES !== 'undefined') {
        const colorClassesOnly = ALL_COLOR_CLASSES.filter(c => c !== 'imported' && c !== 'conflict-overlap');
        targetWrapper.classList.remove(...colorClassesOnly);
      }
      if (entry.color) targetWrapper.classList.add(entry.color);
    }
    newlyImportedIds.push(entry.id);
  });

  await saveHipokImportedIds([...importedIds, ...newlyImportedIds], currentWeek, currentYear);
  saveHipokData();
  if (typeof updateHipokConflictHighlight === 'function') updateHipokConflictHighlight(currentWeek, currentYear);
  if (overflow.length > 0) {
    alert(`יובאו ${entries.length - overflow.length} חיפוקים.\n${overflow.length} לא נכנסו (חריגה מ-6 משבצות).`);
  } else {
    alert(`יובאו ${entries.length} חיפוקים בהצלחה`);
  }
}

/* ================================
   טבלאות דינמיות וייבוא כללי
================================ */

/**
 * בודקת אם כל תאי הקלט בשורה נתונה בטבלה ריקים מטקסט.
 * @param {HTMLTableRowElement} row - שורת טבלה
 * @returns {boolean} true אם השורה ריקה לחלוטין
 */
function isRowEmpty(row) {
  return Array.from(row.querySelectorAll('.cell-input')).every(input => input.value.trim() === '');
}

/**
 * מוסיפה שורה חדשה לטבלה דינמית ומשכפלת את מבנה תאי הקלט.
 * @param {string} tableId - מזהה הטבלה
 * @param {boolean} [autoSave=true] - האם לבצע שמירה אוטומטית לאחר ההוספה
 */
function addNewRow(tableId, autoSave = true) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.tBodies[0];
  if (!tbody.rows.length) return;
  let referenceRow = tbody.rows[1] || tbody.rows[0];
  const inputsCount = referenceRow.querySelectorAll('.cell-input').length;
  const newRow = document.createElement('tr');
  let tds = '';
  for (let i = 0; i < inputsCount; i++) { tds += `<td><input type="text" class="cell-input"></td>`; }
  if (hasUnitTotalColumn(tableId)) { tds += `<td class="row-total-cell">0</td>`; }
  newRow.innerHTML = tds;
  tbody.appendChild(newRow);
  if (autoSave) saveCurrentWeek();
}

/**
 * מאתחלת מאזיני הקלדה לטבלאות דינמיות להוספת שורות אוטומטית בסיפה ומחיקת שורות ריקות.
 */
function initDynamicRows() {
  const tables = [
    'tazamTable', 'hirgTable', 'esukTable', 'pikudTable', 'bahalagTable',
    'reqesukTable', 'reqhirgTable', 'reqpikudTable', 'reqtazamTable', 'reqbahalagTable'
  ];
  tables.forEach(tableId => {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.addEventListener('input', (e) => {
      const input = e.target;
      if (!input.classList.contains('cell-input')) return;
      const row = input.closest('tr');
      const tbody = row.parentElement;
      const isLastRow = row === tbody.lastElementChild;
      if (isLastRow && input.value.trim() !== '') { addNewRow(tableId, true); }
      if (row.cells[0] && row.cells[0].textContent.trim() !== "נושא שבוע" && isRowEmpty(row)) {
        if (tbody.rows.length > 2) { row.remove(); saveCurrentWeek(); }
      }
    });
  });
}

/**
 * מייבאת נתונים מצירי טבלאות יחידתיות אל טבלת מנהל ראשית (קשר/אופטיקה).
 * @param {string} sourceTableId - מזהה טבלת המקור
 * @param {string} targetTableId - מזהה טבלת היעד
 * @param {number} targetStartCol - עמודת התחלה ביעד
 * @param {number} [sourceCols] - מספר עמודות במקור
 */
async function importFromSubTable(sourceTableId, targetTableId, targetStartCol, sourceCols) {
  const target = document.getElementById(targetTableId);
  if (!target) return;
  const key = getStorageKey(sourceTableId, currentWeek, currentYear) + '_published';
  const data = await fetchTableData(key);
  if (!data) { alert(`אין נתונים מאושרים (לא בוצע ייצוא) לשבוע ${currentWeek}`); return; }
  
  if (!sourceCols) {
    const sourceTable = document.getElementById(sourceTableId);
    sourceCols = sourceTable ? sourceTable.tBodies[0].rows[0].cells.length - 1 : 7;
  }
  
  // Get manager's published data to compare
  const managerPublishedKey = getStorageKey(targetTableId, currentWeek, currentYear) + '_published';
  const managerPublishedData = await fetchTableData(managerPublishedKey) || {};

  // רשימת האינדקסים הממתינים להפצה בטבלה המשולבת (ראו MASTER_COMBINED_TABLES) - הייבוא הוא
  // המקום היחיד שמוסיף/מסיר מהרשימה הזו, כדי שהסימון הכתום ישקף אך ורק דרישות מיובאות
  // שטרם הופצו, ולא ישתנה כתוצאה מעריכה ישירה של המנהל.
  const isMasterCombined = MASTER_COMBINED_TABLES.includes(targetTableId);
  const pendingSet = isMasterCombined
    ? new Set(await loadPendingImportIndexes(targetTableId, currentWeek, currentYear))
    : null;

  const targetRows = target.tBodies[0].rows;
  Object.entries(data).forEach(([indexStr, value]) => {
    if (value === undefined || value === null || value.trim() === '') return;
    const index = parseInt(indexStr);
    const row = Math.floor(index / sourceCols);
    const col = index % sourceCols;
    if (!targetRows[row]) return;
    const targetColIdx = targetStartCol + col;
    const targetCell = targetRows[row].cells[targetColIdx];
    if (targetCell) {
      const input = targetCell.querySelector('.cell-input');
      if (input) {
        input.value = value;
        // Compare with manager's published data
        const globalIndex = row * (targetRows[0].cells.length - 1) + (targetColIdx - 1);
        const publishedVal = managerPublishedData[globalIndex] || '';
        if (value !== publishedVal) {
          targetCell.classList.add('conflict-overlap');
          if (pendingSet) pendingSet.add(globalIndex);
        } else {
          targetCell.classList.remove('conflict-overlap');
          if (pendingSet) pendingSet.delete(globalIndex);
        }
      }
    }
  });
  if (pendingSet) savePendingImportIndexes(targetTableId, currentWeek, currentYear, [...pendingSet]);
  saveCurrentWeek();
  const ackKey = getAckStorageKey(targetTableId, currentWeek, currentYear);
  const ackData = (await fetchTableData(ackKey)) || {};
  Object.entries(data).forEach(([indexStr, value]) => {
    const idx = parseInt(indexStr);
    const subVal = value !== undefined && value !== null ? String(value).trim() : '';
    ackData[`${sourceTableId}_${idx}`] = subVal;
  });
  persist(ackKey, ackData);

  if (targetTableId === 'keshertable') recalcAll(targetTableId);
  else recalcAll(targetTableId, tableConfigs[targetTableId]);
  checkRequirementChanges(targetTableId);
  if (typeof updateGlobalExportButtonStatus === 'function') await updateGlobalExportButtonStatus();
  alert(`יובאו נתונים בהצלחה`);
}

/**
 * מייבאת נתונים באופן ישיר לטבלאות דינמיות (כגון טבלאות מודיעין).
 * @param {string} sourceTableId - מזהה טבלת המקור
 * @param {string} targetTableId - מזהה טבלת היעד
 */
async function importDirectToTable(sourceTableId, targetTableId) {
  const target = document.getElementById(targetTableId);
  if (!target) return;
  // מייבאים רק נתונים שהיחידה שמרה ופרסמה בפועל ("שמור ומוכן לייבוא") - לא טיוטה חיה שעדיין
  // לא אושרה על ידי היחידה (אפיון QA).
  const key = getStorageKey(sourceTableId, currentWeek, currentYear) + '_published';
  const data = await fetchTableData(key);
  if (!data) { alert(`אין נתונים מאושרים (לא בוצע שמירה לייבוא) לשבוע ${currentWeek}`); return; }
  
  const keysWithData = Object.keys(data).filter(k => data[k] && data[k].trim() !== '');
  if (keysWithData.length > 0) {
    const maxIndex = Math.max(...keysWithData.map(Number));
    const inputsPerRow = target.tBodies[0].rows[1].querySelectorAll('.cell-input').length;
    if (inputsPerRow > 0 && maxIndex >= 0) {
      const requiredRows = Math.floor(maxIndex / inputsPerRow) + 1;
      while (target.tBodies[0].rows.length < requiredRows) { addNewRow(targetTableId, false); }
    }
  }

  const targetInputs = target.querySelectorAll('.cell-input');
  targetInputs.forEach((input, idx) => {
    if (data[idx] !== undefined && data[idx].trim() !== '') {
      input.value = data[idx];
    }
  });

  const tbody = target.tBodies[0];
  const lastRow = tbody.lastElementChild;
  if (lastRow) {
    const isLastRowEmpty = Array.from(lastRow.querySelectorAll('.cell-input')).every(input => input.value.trim() === '');
    if (!isLastRowEmpty) { addNewRow(targetTableId, false); }
  }
  saveCurrentWeek();
  if (tableConfigs[targetTableId]) recalcAll(targetTableId, tableConfigs[targetTableId]);
  alert(`יובאו נתונים בהצלחה`);
}

const DEFAULT_KESHER_ROWS = [
  "נושא שבוע", "715/709", "POC", "710", "שקדון", "CF-33", "700", "דיסקית", "סל\"צ", "נתונים",
  "מגבר", "מח-120", "מח-121", "מח-122", "מדונה", "אול\"רים", "מר2791",
  "מזוודת הטענה בומבה", "מזוודת הטענה ליתיום", "הערות משיכה\\זיכוי"
];

const DEFAULT_OPTIC_ROWS = [
  "נושא שבוע", "מת\"ן", "עמית", "עמית איכון", "חצובת עמית", "חצובת תבל", "יובל", "תבל ידני",
  "מיני תבל ידני", "תבל נשלט", "מיני תבל נשלט", "רחפן מטריס 300", "רחפן איבו",
  "רחפן אווטא (ערכה זוגית)", "15X80", "מצפן מעלות", "שטיינר", "צגון", "מצלמת NIKON",
  "איבו אלפא", "התקני הטלה/ כדור ברזל"
];

const KESHER_TABLE_LIST = [
  { id: 'keshertable', dataCols: 48 },
  { id: 'esukkeshertable', dataCols: 7 },
  { id: 'kkeshertable', dataCols: 6 },
  { id: 'pkeshertable', dataCols: 7 },
  { id: 'tkeshertable', dataCols: 8 },
  { id: 'bkeshertable', dataCols: 1 }
];

const OPTIC_TABLE_LIST = [
  { id: 'optictable', dataCols: 33 },
  { id: 'esukoptictable', dataCols: 7 },
  { id: 'koptictable', dataCols: 6 },
  { id: 'poptictable', dataCols: 7 },
  { id: 'toptictable', dataCols: 8 },
  { id: 'boptictable', dataCols: 1 }
];

function getRowsStorageKey(category, week, year) {
  return `rowList_${category}_week${week}_year${year}`;
}

/**
 * מרעננת מהשרת (אם מוגדר) את רשימות השורות המותאמות-אישית (אמצעי קשר/אופטיקה שנוספו/נמחקו)
 * לשבוע הנוכחי. getRowsForWeek נשארת סינכרונית בכוונה (נקראת גם בזמן בניית/רינדור טבלה, לא
 * רק בפעולות מנהל נדירות), אז במקום להפוך אותה ל-async בכל מקום, שומרים אותה כמו שהיא
 * וממלאים לה מטמון טרי מהשרת ברקע - אותה גישה בדיוק כמו refreshSubTablePublishedCache.
 */
async function refreshRowListsCache() {
  if (typeof fetchTableData !== 'function') return;
  await Promise.all([
    fetchTableData(getRowsStorageKey('kesher', currentWeek, currentYear)),
    fetchTableData(getRowsStorageKey('optic', currentWeek, currentYear))
  ]);
}

function getRowsForWeek(category, week, year) {
  const key = getRowsStorageKey(category, week, year);
  const saved = localStorage.getItem(key);
  if (saved) {
    const rows = JSON.parse(saved);
    // מיגרציה חד-פעמית בזמן טעינה: שבועות שכבר נשמרו לפני שינוי שם שורת "משיכה\זיכוי" ל"הערות
    // משיכה\זיכוי" עדיין מכילים את השם הישן במערך השמור - מתקנים אותו כאן כדי שכל השבועות
    // (גם ישנים) יציגו את השם המעודכן, בלי לפגוע בהגנות על השורה המיוחדת (מחיקה/גרירה/הדגשה).
    if (category === 'kesher') {
      const oldIdx = rows.indexOf("משיכה\\זיכוי");
      if (oldIdx !== -1) rows[oldIdx] = "הערות משיכה\\זיכוי";
    }
    return rows;
  }

  if (week > 1) {
    return getRowsForWeek(category, week - 1, year);
  } else if (year > new Date().getFullYear() - 2) {
    const prevYearKey = getRowsStorageKey(category, getWeeksInYear(year - 1), year - 1);
    if (localStorage.getItem(prevYearKey) !== null) {
      return getRowsForWeek(category, getWeeksInYear(year - 1), year - 1);
    }
  }

  return category === 'kesher' ? [...DEFAULT_KESHER_ROWS] : [...DEFAULT_OPTIC_ROWS];
}

/* ================================
   עמודת "סה"כ" בטבלאות הדרישה היחידתיות (אפיון 1.7)
   מסכמת את כמות האמצעים המבוקשת בכל שורה. לא חלה על טבלאות המנהל.
================================ */
function isUnitReqTable(tableId) {
  const inList = KESHER_TABLE_LIST.some(t => t.id === tableId) || OPTIC_TABLE_LIST.some(t => t.id === tableId);
  return inList && tableId !== 'keshertable' && tableId !== 'optictable';
}

// מפח"ט (bahalag) מכיל עמודת אמצעי בודדת בלבד - עמודת "סה"כ" תהיה תמיד זהה לערך היחיד ולכן מיותרת שם.
function hasUnitTotalColumn(tableId) {
  return isUnitReqTable(tableId) && tableId !== 'bkeshertable' && tableId !== 'boptictable';
}

// מזריקה כותרת "סה"כ" לטבלה (פעם אחת), ומרחיבה את שורת הכותרת העליונה בהתאם.
function ensureUnitTotalHeader(table) {
  const thead = table.tHead;
  if (!thead || thead.rows.length === 0) return;
  if (thead.querySelector('.unit-total-th')) return;

  const labelRow = thead.rows[thead.rows.length - 1];
  const th = document.createElement('th');
  th.className = 'unit-total-th';
  th.textContent = 'סה"כ';
  labelRow.appendChild(th);

  if (thead.rows.length > 1) {
    const topRow = thead.rows[0];
    const lastTh = topRow.cells[topRow.cells.length - 1];
    if (lastTh && lastTh.hasAttribute('colspan')) {
      lastTh.colSpan = lastTh.colSpan + 1;
    } else {
      const extra = document.createElement('th');
      topRow.appendChild(extra);
    }
  }
}

// מחשבת את סכום השורה (מתעלמת משורות "נושא שבוע"/הערה ומתאי טקסט לא-מספריים).
function recalcUnitRowTotal(row) {
  const totalCell = row.querySelector('.row-total-cell');
  if (!totalCell) return;
  if (row.classList.contains('topic-row') || row.classList.contains('special-note-row')) {
    totalCell.innerHTML = '';
    return;
  }
  let sum = 0;
  row.querySelectorAll('.cell-input').forEach(inp => {
    if (inp.classList.contains('topic-textarea')) return;
    const n = parseFloat(inp.value);
    if (!isNaN(n)) sum += n;
  });
  totalCell.textContent = sum;
}

function recalcUnitReqTotals(table) {
  Array.from(table.tBodies[0].rows).forEach(recalcUnitRowTotal);
}

// עדכון חי של עמודת "סה"כ" בעת הקלדה בטבלאות הדרישה היחידתיות.
document.addEventListener('input', (e) => {
  const inp = e.target;
  if (!inp || !inp.classList || !inp.classList.contains('cell-input')) return;
  const table = inp.closest('table');
  if (!table || !isUnitReqTable(table.id)) return;
  const row = inp.closest('tr');
  if (row) recalcUnitRowTotal(row);
});

function renderDynamicTableStructure(tableId, week, year) {
  const table = document.getElementById(tableId);
  if (!table) return;

  let category = null;
  let dataCols = 0;

  const kesherItem = KESHER_TABLE_LIST.find(t => t.id === tableId);
  const opticItem = OPTIC_TABLE_LIST.find(t => t.id === tableId);

  if (kesherItem) {
    category = 'kesher';
    dataCols = kesherItem.dataCols;
  } else if (opticItem) {
    category = 'optic';
    dataCols = opticItem.dataCols;
  } else {
    return;
  }

  const rowsList = getRowsForWeek(category, week, year);
  const tbody = table.tBodies[0];
  if (!tbody) return;

  let tbodyHtml = '';
  const totalCols = dataCols + 1;

  const isMasterTable = (tableId === 'keshertable' || tableId === 'optictable');

  rowsList.forEach((rowName, rowIndex) => {
    const isTopicRow = (rowIndex === 0);
    // שורת "הערות משיכה\זיכוי" בקשר היא שורה קבועה (תמיד אחרונה) - אסור שתהיה ניתנת למחיקה או לגרירה
    // (ראו גם ההגנה הזהה ב-deleteRowItem ואי-הוספת מחלקת reorderable-row).
    const isSpecialNoteRow = (category === 'kesher' && rowIndex === rowsList.length - 1 && rowName === "הערות משיכה\\זיכוי");
    const isReorderable = isMasterTable && !isTopicRow && !isSpecialNoteRow;

    let deleteBtnHtml = '';
    if (rowIndex > 0 && isMasterTable && !isSpecialNoteRow) {
      deleteBtnHtml = `<button type="button" class="row-delete-icon" onclick="deleteRowItem('${category}', ${rowIndex})" title="מחק אמצעי משבוע זה והלאה">✕</button>`;
    }
    const rowClasses = [];
    if (isTopicRow) rowClasses.push('topic-row');
    if (isSpecialNoteRow) rowClasses.push('special-note-row');
    if (isReorderable) rowClasses.push('reorderable-row');
    const trClassAttr = rowClasses.length > 0 ? ` class="${rowClasses.join(' ')}"` : '';

    // ידית גרירה לשינוי סדר האמצעים (אפיון 1.6) - טבלת מנהל בלבד
    const dragHandleHtml = isReorderable
      ? `<span class="row-drag-handle" draggable="true" title="גרור לשינוי סדר האמצעי">⠿</span>`
      : '';

    let tds = `<td class="test"><span class="row-name-text">${escapeHtml(rowName)}</span> ${dragHandleHtml}${deleteBtnHtml}</td>`;
    for (let i = 1; i < totalCols; i++) {
      if (isTopicRow || isSpecialNoteRow) {
        tds += `<td><textarea class="cell-input topic-textarea" rows="1"></textarea></td>`;
      } else {
        tds += `<td><input type="text" class="cell-input"></td>`;
      }
    }
    if (hasUnitTotalColumn(tableId)) {
      if (isTopicRow || isSpecialNoteRow) {
        tds += `<td class="row-total-cell"></td>`;
      } else {
        tds += `<td class="row-total-cell">0</td>`;
      }
    }
    tbodyHtml += `<tr${trClassAttr} data-rowindex="${rowIndex}">${tds}</tr>`;
  });

  tbody.innerHTML = tbodyHtml;

  if (isMasterTable) {
    initRowDragForMasterTable(table, category);
  }

  if (hasUnitTotalColumn(tableId)) {
    ensureUnitTotalHeader(table);
    recalcUnitReqTotals(table);
  }
}

/* ================================
   גרירת שורות בטבלת המנהל (אפיון 1.6)
   שינוי סדר האמצעים; ממופה מחדש בנתונים ומשתקף בטבלאות הפלוגות.
================================ */
function initRowDragForMasterTable(table, category) {
  const tbody = table.tBodies[0];
  if (!tbody) return;
  let dragSrcIndex = null;

  tbody.querySelectorAll('.row-drag-handle').forEach(handle => {
    handle.addEventListener('dragstart', (e) => {
      const tr = handle.closest('tr');
      dragSrcIndex = parseInt(tr.dataset.rowindex);
      tr.classList.add('row-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(dragSrcIndex)); } catch (err) {}
    });
    handle.addEventListener('dragend', () => {
      tbody.querySelectorAll('.row-dragging, .row-drop-target').forEach(el => el.classList.remove('row-dragging', 'row-drop-target'));
    });
  });

  tbody.querySelectorAll('tr.reorderable-row').forEach(tr => {
    tr.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      tbody.querySelectorAll('.row-drop-target').forEach(el => el.classList.remove('row-drop-target'));
      tr.classList.add('row-drop-target');
    });
    tr.addEventListener('dragleave', () => tr.classList.remove('row-drop-target'));
    tr.addEventListener('drop', (e) => {
      e.preventDefault();
      tr.classList.remove('row-drop-target');
      const targetIndex = parseInt(tr.dataset.rowindex);
      let src = dragSrcIndex;
      if (src == null || isNaN(src)) {
        const dt = e.dataTransfer.getData('text/plain');
        src = dt ? parseInt(dt) : null;
      }
      if (src != null && !isNaN(src) && src !== targetIndex) {
        reorderCategoryRow(category, src, targetIndex);
      }
    });
  });
}

/**
 * משנה את סדר האמצעים (שורות) עבור השבוע הנוכחי, ממפה מחדש את הנתונים של
 * כל הטבלאות בקטגוריה (מנהל + פלוגות + גרסאות מאושרות) כדי לשמור התאמה.
 */
async function reorderCategoryRow(category, fromIndex, toIndex) {
  const rows = getRowsForWeek(category, currentWeek, currentYear);
  // שורת "נושא שבוע" (0) קבועה בראש - לא ניתנת לגרירה או ליעד
  if (fromIndex <= 0 || toIndex <= 0 || fromIndex >= rows.length || toIndex >= rows.length) return;

  await saveCurrentWeek(); // שמירת עריכות ה-DOM הנוכחיות לפני מיפוי מחדש

  // בניית תמורה (permutation) של אינדקסי השורות
  const order = rows.map((_, i) => i);
  const [moved] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, moved);

  // רשימת אמצעים חדשה
  const newRows = order.map(i => rows[i]);
  persist(getRowsStorageKey(category, currentWeek, currentYear), newRows);

  // מיפוי מחדש של הנתונים לכל הטבלאות בקטגוריה
  const tableList = category === 'kesher' ? KESHER_TABLE_LIST : OPTIC_TABLE_LIST;
  tableList.forEach(t => {
    ['', '_published'].forEach(suffix => {
      const key = getStorageKey(t.id, currentWeek, currentYear) + suffix;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      let data;
      try { data = JSON.parse(raw); } catch (e) { return; }
      const newData = {};
      order.forEach((oldRow, newRow) => {
        for (let c = 0; c < t.dataCols; c++) {
          const oldIdx = oldRow * t.dataCols + c;
          const newIdx = newRow * t.dataCols + c;
          if (data[oldIdx] !== undefined) newData[newIdx] = data[oldIdx];
        }
      });
      persist(key, newData);
    });
  });

  // רענון טבלת המנהל הנוכחית
  const masterId = category === 'kesher' ? 'keshertable' : 'optictable';
  await loadTableData(masterId, currentWeek, currentYear);
  recalcAll(masterId, tableConfigs[masterId]);
  if (typeof resetUndoHistory === 'function') resetUndoHistory();
}

function promptAddItemRow(category) {
  const catName = category === 'kesher' ? 'קשר' : 'אופטיקה';
  const itemName = prompt(`הכנס שם אמצעי חדש לטבלאות ${catName} (משבוע ${currentWeek} והלאה):`);
  if (!itemName || !itemName.trim()) return;
  addItemRow(category, itemName.trim());
}

function addItemRow(category, itemName) {
  const tableList = category === 'kesher' ? KESHER_TABLE_LIST : OPTIC_TABLE_LIST;

  const snapshots = {};
  const hasExplicitSave = {};
  for (let y = currentYear; y <= currentYear + 1; y++) {
    const startW = (y === currentYear) ? currentWeek : 1;
    for (let w = startW; w <= getWeeksInYear(y); w++) {
      const key = getRowsStorageKey(category, w, y);
      snapshots[`${w}_${y}`] = [...getRowsForWeek(category, w, y)];
      hasExplicitSave[`${w}_${y}`] = (localStorage.getItem(key) !== null);
    }
  }

  for (let y = currentYear; y <= currentYear + 1; y++) {
    const startW = (y === currentYear) ? currentWeek : 1;
    for (let w = startW; w <= getWeeksInYear(y); w++) {
      const currentList = snapshots[`${w}_${y}`];
      
      let insertIdx = currentList.length;
      if (category === 'kesher' && currentList[currentList.length - 1] === "הערות משיכה\\זיכוי") {
        insertIdx = currentList.length - 1;
      }
      
      const newList = [...currentList];
      newList.splice(insertIdx, 0, itemName);
      
      if ((w === currentWeek && y === currentYear) || hasExplicitSave[`${w}_${y}`]) {
        persist(getRowsStorageKey(category, w, y), newList);
      }

      tableList.forEach(t => {
        const key = getStorageKey(t.id, w, y);
        const savedRaw = localStorage.getItem(key);
        if (savedRaw) {
          const oldData = JSON.parse(savedRaw);
          const newData = {};
          const cols = t.dataCols;

          Object.keys(oldData).forEach(idxStr => {
            const idx = parseInt(idxStr);
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            if (r < insertIdx) {
              newData[idx] = oldData[idx];
            } else {
              const newIdx = (r + 1) * cols + c;
              newData[newIdx] = oldData[idx];
            }
          });

          persist(key, newData);
        }
      });
    }
  }

  updateUIForWeek();
}

function deleteRowItem(category, rowIndex) {
  const currentList = getRowsForWeek(category, currentWeek, currentYear);
  const itemName = currentList[rowIndex];
  if (!itemName) return;

  if (rowIndex === 0) {
    alert("לא ניתן למחוק את שורת נושא השבוע.");
    return;
  }

  if (category === 'kesher' && rowIndex === currentList.length - 1 && itemName === "הערות משיכה\\זיכוי") {
    alert("לא ניתן למחוק את שורת \"הערות משיכה\\זיכוי\".");
    return;
  }

  const catName = category === 'kesher' ? 'קשר' : 'אופטיקה';
  if (!confirm(`האם למחוק את האמצעי "${itemName}" מטבלאות ${catName} משבוע ${currentWeek} והלאה?`)) {
    return;
  }

  const tableList = category === 'kesher' ? KESHER_TABLE_LIST : OPTIC_TABLE_LIST;

  const snapshots = {};
  const hasExplicitSave = {};
  for (let y = currentYear; y <= currentYear + 1; y++) {
    const startW = (y === currentYear) ? currentWeek : 1;
    for (let w = startW; w <= getWeeksInYear(y); w++) {
      const key = getRowsStorageKey(category, w, y);
      snapshots[`${w}_${y}`] = [...getRowsForWeek(category, w, y)];
      hasExplicitSave[`${w}_${y}`] = (localStorage.getItem(key) !== null);
    }
  }

  for (let y = currentYear; y <= currentYear + 1; y++) {
    const startW = (y === currentYear) ? currentWeek : 1;
    for (let w = startW; w <= getWeeksInYear(y); w++) {
      const listW = snapshots[`${w}_${y}`];
      const targetIdx = listW.indexOf(itemName);
      if (targetIdx === -1) continue;

      const newList = listW.filter((_, idx) => idx !== targetIdx);
      
      if ((w === currentWeek && y === currentYear) || hasExplicitSave[`${w}_${y}`]) {
        persist(getRowsStorageKey(category, w, y), newList);
      }

      tableList.forEach(t => {
        const key = getStorageKey(t.id, w, y);
        const savedRaw = localStorage.getItem(key);
        if (savedRaw) {
          const oldData = JSON.parse(savedRaw);
          const newData = {};
          const cols = t.dataCols;

          Object.keys(oldData).forEach(idxStr => {
            const idx = parseInt(idxStr);
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            
            if (r === targetIdx) return;
            
            if (r < targetIdx) {
              newData[idx] = oldData[idx];
            } else if (r > targetIdx) {
              const newIdx = (r - 1) * cols + c;
              newData[newIdx] = oldData[idx];
            }
          });

          persist(key, newData);
        }
      });
    }
  }

  updateUIForWeek();
}

const KESHER_ROW_NAMES = DEFAULT_KESHER_ROWS;
const OPTIC_ROW_NAMES = DEFAULT_OPTIC_ROWS;

/**
 * בונה שורות הקצאה לתצוגה בלבד על בסיס נתונים שנשמרו בטבלאות המנהל.
 * @param {Object} data - נתוני הטבלה
 * @param {Array<string>|string} names - שמות השורות או שם הקטגוריה
 * @param {number} totalCols - סך העמודות
 * @param {number} startCol - עמודת התחלה
 * @param {number} endCol - עמודת סיום
 * @param {string} tbodyId - מזהה tbody ביעד
 * @param {Array<number>} [specialRowIndices=[0]] - אינדקסים של שורות מיוחדות להדגשה
 */
async function buildHaktzaotRows(data, names, totalCols, startCol, endCol, tbodyId, specialRowIndices = [0]) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  if (typeof names === 'string') {
    names = await getRowsForWeek(names, currentWeek, currentYear);
  } else if (names === KESHER_ROW_NAMES) {
    names = await getRowsForWeek('kesher', currentWeek, currentYear);
  } else if (names === OPTIC_ROW_NAMES) {
    names = await getRowsForWeek('optic', currentWeek, currentYear);
  }

  tbody.innerHTML = '';
  let hasAny = false;

  names.forEach((name, rowIndex) => {
    let hasValue = false;
    const values = [];

    for (let col = startCol; col <= endCol; col++) {
      const globalIndex = rowIndex * (totalCols - 1) + (col - 1);
      const val = data[globalIndex] || '';
      values.push(val);
      if (val !== '') hasValue = true;
    }

    if (!hasValue) return;
    hasAny = true;

    const isSpecialRow = rowIndex === 0 || (name === "הערות משיכה\\זיכוי");
    let tds = `<td class="test">${escapeHtml(name)}</td>`;
    values.forEach(val => {
      tds += `<td style="text-align:center; font-weight:bold;">${escapeHtml(val)}</td>`;
    });
    tbody.innerHTML += `<tr class="${isSpecialRow ? 'special-row' : ''}">${tds}</tr>`;
  });

  if (!hasAny) {
    const colSpan = (endCol - startCol + 2);
    tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;">אין נתונים לשבוע זה</td></tr>`;
  }
}

/**
 * מרנדרת את תצוגת הקצאות המודיעין עבור יחידה ספציפית לפי מספר הפלוגות.
 * @param {string} sourceTableId - מזהה טבלת המקור של המודיעין
 * @param {string} tbodyId - מזהה tbody ביעד
 * @param {number} [companyCount=6] - מספר הפלוגות ביחידה
 */
async function renderHaktzaotModieinUnit(sourceTableId, tbodyId, companyCount = 6) {
  // הקצאות מוצגות ליחידה רק לאחר שהמנהל הפיץ בפועל - קוראים מה-published, לא מה-draft (אפיון QA)
  // חשוב: fetchTableData (לא localStorage.getItem ישיר) - כדי שגם במצב שרת מרוחק (SharePoint/
  // רשת צבאית) הנתונים ייטענו דרך DataService.getItem בפועל, ולא רק מתוך מטמון מקומי שעלול
  // להיות ריק/מיושן במכשיר שלא ביצע בעצמו את הפעולה האחרונה שכתבה למפתח הזה.
  const key = getStorageKey(sourceTableId, currentWeek, currentYear) + '_published';
  const data = await fetchTableData(key);
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  if (!data) {
    tbody.innerHTML = `<tr><td colspan="${companyCount + 1}" style="text-align:center;">אין נתונים מאושרים לשבוע זה</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  const keysWithData = Object.keys(data).filter(k => data[k] && data[k].trim() !== '');
  if (keysWithData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${companyCount + 1}" style="text-align:center;">אין נתונים מאושרים לשבוע זה</td></tr>`;
    return;
  }

  const maxIndex = Math.max(...keysWithData.map(Number));
  const requiredRows = maxIndex < companyCount ? 1 : 2 + Math.floor((maxIndex - companyCount) / (companyCount + 1));
  let hasAny = false;

  for (let r = 0; r < requiredRows; r++) {
    let tr = document.createElement('tr');
    if (r === 0) {
      tr.innerHTML += `<td class="test">נושא שבוע</td>`;
      let rowHasData = false;
      for (let c = 0; c < companyCount; c++) {
        const val = data[c] || '';
        if (val) rowHasData = true;
        tr.innerHTML += `<td style="text-align:center; font-weight:bold;">${escapeHtml(val)}</td>`;
      }
      if (rowHasData) {
        tr.classList.add('special-row'); 
        tbody.appendChild(tr);
        hasAny = true;
      }
    } else {
      let isEmpty = true;
      let rowHtml = '';
      for (let c = 0; c < companyCount + 1; c++) {
        const idx = companyCount + (r - 1) * (companyCount + 1) + c;
        const val = data[idx] || '';
        if (val !== '') isEmpty = false;
        rowHtml += `<td style="text-align:center; font-weight:bold;">${escapeHtml(val)}</td>`;
      }
      if (!isEmpty) {
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
        hasAny = true;
      }
    }
  }
  if (!hasAny) {
    tbody.innerHTML = `<tr><td colspan="${companyCount + 1}" style="text-align:center;">אין נתונים מאושרים לשבוע זה</td></tr>`;
  }
}

/** מרנדרת הקצאות מודיעין עבור בא"ח איסו"ק */
async function renderHaktzaotEsuk() {
  await renderHaktzaotModieinUnit('esukTable', 'haktzaot-esuk-body', 6);
}

/** מרנדרת הקצאות מודיעין עבור בא"ח חיר"ג */
async function renderHaktzaotHirg() {
  await renderHaktzaotModieinUnit('hirgTable', 'haktzaot-hirg-body', 6);
}

/** מרנדרת הקצאות מודיעין עבור גדוד הפיקוד */
async function renderHaktzaotPikud() {
  await renderHaktzaotModieinUnit('pikudTable', 'haktzaot-pikud-body', 7);
}

/** מרנדרת הקצאות מודיעין עבור ענף תצ"מ */
async function renderHaktzaotTazam() {
  await renderHaktzaotModieinUnit('tazamTable', 'haktzaot-tazam-body', 8);
}

/** מרנדרת הקצאות מודיעין עבור מפח"ט */
async function renderHaktzaotBahalag() {
  await renderHaktzaotModieinUnit('bahalagTable', 'haktzaot-bahalag-body', 1);
}

/* ================================
   חישובים (נוסחאות) לטבלת קשר ולשאר
================================ */

/**
 * מריצה נוסחאות וחישובי סיכום, דרישה, ויסות ועודפים עבור שורה בטבלת קשר.
 * @param {HTMLTableRowElement} row - שורת הטבלה
 */
function recalcKesherRow(row) {
  const groups = [
    { companyCols: [1, 2, 3, 4, 5, 6, 7], demandCol: 8, regCol: 9, surplusCol: 10 },
    { companyCols: [11, 12, 13, 14, 15, 16], demandCol: 17, regCol: 18, surplusCol: 19 },
    { companyCols: [20, 21, 22, 23, 24, 25, 26], demandCol: 27, regCol: 28, surplusCol: 29 },
    { companyCols: [30, 31, 32, 33, 34, 35, 36, 37], demandCol: 38, regCol: 39, surplusCol: 40 },
    { companyCols: [41], demandCol: 42, regCol: 43, surplusCol: 44 }
  ];

  let totalRegulatedAll = 0;
  let hasAnyCompanyInputOverall = false;

  groups.forEach(group => {
    let groupDemand = 0;
    let hasGroupCompanyInput = false;

    group.companyCols.forEach(colIdx => {
      const input = row.cells[colIdx]?.querySelector('.cell-input');
      if (input && input.value.trim() !== '') {
        const val = parseFloat(input.value);
        if (!isNaN(val)) {
          groupDemand += val;
          hasGroupCompanyInput = true;
          hasAnyCompanyInputOverall = true;
          input.classList.remove('invalid-number-input');
        } else {
          // ערך לא-מספרי מוחרג בשקט מהסיכום - מסמנים ויזואלית (מחלקת CSS בלבד; לא נוגעים
          // ב-title, כי checkRequirementChanges כבר "בעלים" של אותו attribute על אותם תאים
          // ומאפס אותו בכל הקלדה) כדי שהמשתמש ידע שהתא הזה לא נכלל בחישוב.
          input.classList.add('invalid-number-input');
        }
      } else if (input) {
        input.classList.remove('invalid-number-input');
      }
    });

    totalRegulatedAll += groupDemand;

    const demandInput = row.cells[group.demandCol]?.querySelector('.cell-input');
    if (demandInput) {
      demandInput.value = hasGroupCompanyInput ? groupDemand : '';
    }

    const regInput = row.cells[group.regCol]?.querySelector('.cell-input');
    const surplusInput = row.cells[group.surplusCol]?.querySelector('.cell-input');
    
    if (surplusInput && regInput) {
      const regValRaw = regInput.value ? regInput.value.trim() : '';
      if (regValRaw !== '' && !isNaN(parseFloat(regValRaw))) {
        const regVal = parseFloat(regValRaw);
        surplusInput.value = regVal - groupDemand;
      } else if (hasGroupCompanyInput) {
        surplusInput.value = -groupDemand;
      } else {
        surplusInput.value = '';
      }
    }
  });

  const totalUnitCol = 45;
  const failCol = 46;
  const totalRegulatedCol = 47;
  const excessCol = 48;

  const totalUnitInput = row.cells[totalUnitCol]?.querySelector('.cell-input');
  const failInput = row.cells[failCol]?.querySelector('.cell-input');

  const totalUnitRaw = totalUnitInput ? totalUnitInput.value.trim() : '';
  const failRaw = failInput ? failInput.value.trim() : '';

  const totalUnit = (totalUnitRaw !== '' && !isNaN(parseFloat(totalUnitRaw))) ? parseFloat(totalUnitRaw) : 0;
  const fail = (failRaw !== '' && !isNaN(parseFloat(failRaw))) ? parseFloat(failRaw) : 0;

  const hasBaseData = totalUnitRaw !== '' || failRaw !== '' || hasAnyCompanyInputOverall;

  const totalRegInput = row.cells[totalRegulatedCol]?.querySelector('.cell-input');
  if (totalRegInput) {
    totalRegInput.value = hasAnyCompanyInputOverall ? totalRegulatedAll : '';
  }

  const excessInput = row.cells[excessCol]?.querySelector('.cell-input');
  if (excessInput) {
    if (hasBaseData) {
      excessInput.value = totalUnit - fail - totalRegulatedAll;
    } else {
      excessInput.value = '';
    }
  }
}

/**
 * מריצה נוסחאות חישוב עבור שורה בטבלת אופטיקה בהתאם לקונפיגורציית העמודות.
 * @param {HTMLTableRowElement} row - שורת הטבלה
 * @param {Object} config - קונפיגורציית עמודות
 */
function recalcRow(row, config) {
  const { startCol, endCol, totalUnitCol, failCol, totalRegulatedCol, availableCol, excessCol } = config;
  let sum = 0, hasAnyValue = false;

  for (let i = startCol; i <= endCol; i++) {
    const input = row.cells[i]?.querySelector('.cell-input');
    if (input && input.value.trim() !== '') {
      const val = parseFloat(input.value);
      if (!isNaN(val)) {
        sum += val;
        hasAnyValue = true;
        input.classList.remove('invalid-number-input');
      } else {
        // ראו הערה מקבילה ב-recalcKesherRow - ערך לא-מספרי מוחרג בשקט מהסכום, ולכן מסומן
        // ויזואלית (מחלקת CSS בלבד, לא title) כדי שהמשתמש ידע שהוא לא נכלל.
        input.classList.add('invalid-number-input');
      }
    } else if (input) {
      input.classList.remove('invalid-number-input');
    }
  }

  const totalUnitInput = row.cells[totalUnitCol]?.querySelector('.cell-input');
  const failInput = row.cells[failCol]?.querySelector('.cell-input');
  
  const totalUnitRaw = totalUnitInput ? totalUnitInput.value.trim() : '';
  const failRaw = failInput ? failInput.value.trim() : '';
  
  const totalUnit = (totalUnitRaw !== '' && !isNaN(parseFloat(totalUnitRaw))) ? parseFloat(totalUnitRaw) : 0;
  const fail = (failRaw !== '' && !isNaN(parseFloat(failRaw))) ? parseFloat(failRaw) : 0;

  const hasBaseData = totalUnitRaw !== '' || failRaw !== '' || hasAnyValue;

  const totalRegInput = row.cells[totalRegulatedCol]?.querySelector('.cell-input');
  if (totalRegInput) totalRegInput.value = hasAnyValue ? sum : '';

  const availableInput = row.cells[availableCol]?.querySelector('.cell-input');
  if (availableInput) {
    if (totalUnitRaw !== '' || failRaw !== '') {
      availableInput.value = totalUnit - fail;
    } else {
      availableInput.value = '';
    }
  }

  const excessInput = row.cells[excessCol]?.querySelector('.cell-input');
  if (excessInput) {
    if (hasBaseData) {
      excessInput.value = totalUnit - fail - sum;
    } else {
      excessInput.value = '';
    }
  }
}

/**
 * מריצה חישוב מחדש של הנוסחאות על כל השורות בטבלה נתונה.
 * @param {string} tableId - מזהה הטבלה
 * @param {Object} [config] - קונפיגורציית חישוב אופציונלית
 */
function recalcAll(tableId, config) {
  const table = document.getElementById(tableId);
  if (!table || !table.tBodies[0]) return;
  
  for (let row of table.tBodies[0].rows) {
    if (row.sectionRowIndex === 0 || row.cells[0]?.querySelector('textarea')) continue;
    
    if (tableId === 'keshertable' && row.cells.length >= 49) {
      recalcKesherRow(row);
    } else if (config) {
      recalcRow(row, config);
    }
  }
}

function getAckStorageKey(tableId, week, year) {
  return `mgrAck_${tableId}_week${week}_year${year}`;
}

/**
 * מאתחלת מאזיני אירועי הקלדה בטבלאות לשמירה וחישוב אוטומטי בזמן אמת.
 */
function initTableListeners() {
  const tables = getActiveTables();
  tables.forEach(tableId => {
    const table = document.getElementById(tableId);
    if (table) {
      table.addEventListener('input', (e) => {
        saveCurrentWeek();
        if (tableId === 'keshertable') recalcAll('keshertable');
        else if (tableConfigs[tableId]) recalcAll(tableId, tableConfigs[tableId]);
        if (tableId === 'keshertable' || tableId === 'optictable') {
          const targetInput = e.target;
          if (targetInput && targetInput.dataset && targetInput.dataset.subTableId !== undefined) {
            const subTableId = targetInput.dataset.subTableId;
            const subIndex = targetInput.dataset.subIndex;
            const tw = tableWeeks[tableId] || { week: currentWeek, year: currentYear };
            const subKey = getStorageKey(subTableId, tw.week, tw.year);
            const subSavedRaw = localStorage.getItem(subKey);
            const subData = subSavedRaw ? JSON.parse(subSavedRaw) : {};
            const subVal = subData[subIndex] !== undefined ? String(subData[subIndex]).trim() : '';

            const ackKey = getAckStorageKey(tableId, tw.week, tw.year);
            const ackSavedRaw = localStorage.getItem(ackKey);
            const ackData = ackSavedRaw ? JSON.parse(ackSavedRaw) : {};
            ackData[`${subTableId}_${subIndex}`] = subVal;
            persist(ackKey, ackData);
          }
          checkRequirementChanges(tableId);
        }
      });
    }
  });
  
  const hipok = document.getElementById('hipoktable');
  if (hipok) hipok.addEventListener('input', () => {
    if (typeof saveHipokData === 'function') saveHipokData();
  });
}

/* ================================
   בדיקת שינויי דרישה (קשר ואופטיקה)
================================ */

const SUB_TABLE_MAPS = {
  keshertable: [
    { sourceTableId: 'esukkeshertable', targetStartCol: 1, sourceCols: 7 },
    { sourceTableId: 'kkeshertable', targetStartCol: 11, sourceCols: 6 },
    { sourceTableId: 'pkeshertable', targetStartCol: 20, sourceCols: 7 },
    { sourceTableId: 'tkeshertable', targetStartCol: 30, sourceCols: 8 },
    { sourceTableId: 'bkeshertable', targetStartCol: 41, sourceCols: 1 }
  ],
  optictable: [
    { sourceTableId: 'esukoptictable', targetStartCol: 1, sourceCols: 7 },
    { sourceTableId: 'koptictable', targetStartCol: 8, sourceCols: 6 },
    { sourceTableId: 'poptictable', targetStartCol: 14, sourceCols: 7 },
    { sourceTableId: 'toptictable', targetStartCol: 21, sourceCols: 8 },
    { sourceTableId: 'boptictable', targetStartCol: 29, sourceCols: 1 }
  ]
};

/**
 * מרעננת מהשרת (אם מוגדר) את הנתונים המפורסמים (_published) של כל טבלאות המשנה היחידתיות,
 * וכן את מפתחות "אישור המנהל" (mgrAck) - אלה בדיוק המפתחות ש-checkRequirementChanges קוראת
 * בקריאה מקומית-ישירה וסינכרונית (localStorage.getItem, לא DataService) כדי להישאר מהירה
 * גם כשהיא רצה על כל הקשה בטבלת המנהל. בלי הרענון התקופתי הזה, מכשיר של מנהל שלא ביצע
 * בעצמו ייבוא לאחרונה היה עלול לא לראות שיחידה עדכנה את הנתונים המפורסמים שלה במכשיר אחר,
 * עד שהוא עצמו יבצע פעולת ייבוא (ראו הערה מפורטת ליד checkRequirementChanges/importFromSubTable).
 */
async function refreshSubTablePublishedCache() {
  if (typeof fetchTableData !== 'function') return;
  const keys = [];
  Object.entries(SUB_TABLE_MAPS).forEach(([tableId, configs]) => {
    keys.push(getAckStorageKey(tableId, currentWeek, currentYear));
    configs.forEach(cfg => {
      keys.push(getStorageKey(cfg.sourceTableId, currentWeek, currentYear) + '_published');
    });
  });
  await Promise.all(keys.map(k => fetchTableData(k)));
}

/**
 * בודקת וצובעת משבצות בטבלאות קשר ואופטיקה שבהן דרישת היחידה השתנתה ביחס לשיוך/אישור המנהל.
 * @param {string} tableId - מזהה הטבלה ('keshertable' / 'optictable')
 */
function checkRequirementChanges(tableId) {
  const table = document.getElementById(tableId);
  if (!table || !table.tBodies[0]) return;
  const configs = SUB_TABLE_MAPS[tableId];
  if (!configs) return;

  const targetRows = table.tBodies[0].rows;
  const tw = tableWeeks[tableId] || { week: currentWeek, year: currentYear };

  const ackKey = getAckStorageKey(tableId, tw.week, tw.year);
  const ackSavedRaw = localStorage.getItem(ackKey);
  const ackData = ackSavedRaw ? JSON.parse(ackSavedRaw) : {};

  configs.forEach(config => {
    // קוראים מה-published (לא הטיוטה הגולמית) - הסימון הזה מיועד להראות למנהל רק דרישה
    // שהיחידה כבר שמרה ופרסמה בפועל ("שמור ומוכן לייבוא"), לא כל הקלדה שטרם פורסמה (אפיון QA).
    const subKey = getStorageKey(config.sourceTableId, tw.week, tw.year) + '_published';
    const subSavedRaw = localStorage.getItem(subKey);
    const subData = subSavedRaw ? JSON.parse(subSavedRaw) : {};

    for (let r = 0; r < targetRows.length; r++) {
      const row = targetRows[r];
      if (r === 0 || row.classList.contains('topic-row') || row.classList.contains('special-note-row') || row.cells[0]?.querySelector('textarea')) {
        continue;
      }
      for (let c = 0; c < config.sourceCols; c++) {
        const subIndex = r * config.sourceCols + c;
        const subVal = subData[subIndex] !== undefined ? String(subData[subIndex]).trim() : '';
        const targetCell = row.cells[config.targetStartCol + c];
        if (!targetCell) continue;
        const input = targetCell.querySelector('.cell-input');
        if (!input) continue;

        input.dataset.subTableId = config.sourceTableId;
        input.dataset.subIndex = subIndex;

        const ackVal = ackData[`${config.sourceTableId}_${subIndex}`];

        let isChanged = false;
        if (ackVal === undefined) {
          if (subVal !== '') {
            isChanged = true;
          }
        } else {
          if (subVal !== ackVal) {
            isChanged = true;
          }
        }

        if (isChanged) {
          input.classList.add('req-changed');
          targetCell.classList.add('req-changed-td');
          input.title = `הדרישה עודכנה ביחידה ל: ${subVal || 'ריק'}`;
        } else {
          input.classList.remove('req-changed');
          targetCell.classList.remove('req-changed-td');
          input.removeAttribute('title');
        }
      }
    }
  });
}

/* ================================
   התרחבות אוטומטית ל"נושא שבוע"
================================ */

/**
 * מתאימה באופן אוטומטי את גובה תיבת הטקסט בשורת "נושא שבוע" לפי גובה התוכן (scrollHeight).
 * @param {HTMLTextAreaElement} el - רכיב ה-textarea
 */
function autoResizeTopicTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, 42) + 'px';
}

/**
 * מאתחלת מאזינים להתרחבות אוטומטית של תיבות הטקסט בשורות נושא השבוע.
 */
function initTopicExpansion() {
  document.addEventListener('input', function(e) {
    if (e.target.classList.contains('topic-textarea')) {
      autoResizeTopicTextarea(e.target);
    }
  });

  document.querySelectorAll('.topic-textarea').forEach(autoResizeTopicTextarea);
}

/* =========================================================
   מערכת חדר"ג / כיתות - (ניהול בקשות ואישורים למנהל)
========================================================= */

const HADRAG_FACILITY_NAMES = {
  'chadrag': 'חדר"ג',
  'anafit8': 'ענפית 1',
  'anafit-bah': 'ענפית בא"ח',
  'tavor': 'פיקוד 1'
};
const HADRAG_DAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const ALL_COLOR_CLASSES = ['bg-esuk', 'bg-hirg', 'bg-pikud', 'bg-tazam', 'bg-maphat', 'imported', 'conflict-overlap'];
// 'conflict-overlap' הוא סימון ויזואלי-בלבד המחושב חי (updatePlatoonGridConflictHighlight) מהשוואת draft מול
// published, ואסור לו להישמר/להיגרר כחלק ממצב התא עצמו - אחרת השמירה מיד לאחר ניקוי הסימון הכתום בהפצה
// (globalExportManager, שלב 3) כותבת draft שונה מה-published שכבר הועתק, וכפתור "הפץ שינויים" נשאר אדום.
const PERSISTABLE_CELL_CLASSES = ALL_COLOR_CLASSES.filter(c => c !== 'conflict-overlap');

/* בדיקת חפיפת טווחי שעות (HH:MM) - עבור התראת התנגשות (אפיון 1.1) */
function _timeRangesOverlap(s1, e1, s2, e2) {
  return s1 < e2 && s2 < e1;
}

/* =========================================================
   גריד בקשות חדר"ג/שק"ם בעמוד היחידה (מחליף את טופס הבקשה הישן + תצוגת "לו"ז משובץ").
   היחידה רואה את כל השיבוצים המאושרים כמו שהם (קריאה בלבד, נטען מה-published בכל רינדור),
   ויכולה לגרור על תא ריק ליצירת בלוק "ממתין לאישור" (צבע מעומעם/מקווקו), לגרור בלוק ממתין
   כזה למשבצת אחרת, ולמחוק אותו. אין כפתור שמירה ייעודי - רק בלחיצה על "שמור ומוכן לייבוא"
   הכללי (globalExportUnit, ראו commitHadragStagedBlocks/commitShekemStagedBlocks) נגזרים
   day/startTime/endTime בפועל ממיקום הבלוק הנוכחי ונכתבים כרשומת בקשה (status: 'pending',
   אותה סכימה כמו קודם - תהליך האישור/דחייה של המנהל לא משתנה).
========================================================= */

let hadragStagedBlocks = [];
let shekemStagedBlocks = [];
let reqGridDragMode = null; // null | 'create' | 'move' | 'resize'
let reqGridDragCtx = null;

/** בונה תא-שעה + 7 תאי גריד ריקים (ללא textarea כברירת מחדל) לכל 36 השורות. */
function buildReqTableBody(tbody) {
  let html = '';
  for (let r = 0; r < 36; r++) {
    html += `<tr><td class="time-col">${rowIndexToTime(r)}</td>`;
    for (let c = 0; c < 7; c++) {
      html += `<td class="req-cell" data-row="${r}" data-col="${c}"></td>`;
    }
    html += `</tr>`;
  }
  tbody.innerHTML = html;
}

/** מציירת בלוק מאושר (קריאה בלבד) - טקסט דרך textContent, בטוח מ-XSS. */
function paintApprovedBlock(tbody, day, startRow, span, text, unitClasses) {
  const cell = tbody.querySelector(`td.req-cell[data-row="${startRow}"][data-col="${day}"]`);
  if (!cell) return;
  cell.rowSpan = span;
  cell.classList.add('approved-block', ...unitClasses);
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;font-weight:800;font-size:11.5px;padding:1px 2px;overflow:hidden;';
  div.textContent = text;
  cell.appendChild(div);
  for (let r = startRow + 1; r < startRow + span; r++) {
    const covered = tbody.querySelector(`td.req-cell[data-row="${r}"][data-col="${day}"]`);
    if (covered) covered.style.display = 'none';
  }
}

/** מציירת בלוק "ממתין לאישור" של היחידה - ידית גרירה, אייקון מחיקה, textarea לעריכת הטקסט. */
function paintPendingBlock(tbody, block, idx) {
  const cell = tbody.querySelector(`td.req-cell[data-row="${block.startRow}"][data-col="${block.day}"]`);
  if (!cell) return;
  cell.rowSpan = block.span;
  cell.classList.add('pending-block', block.unitClass || 'bg-esuk');
  cell.dataset.stagedIdx = String(idx);

  const handle = document.createElement('span');
  handle.className = 'req-drag-handle';
  handle.textContent = '⠿';
  handle.title = 'גרור למשבצת אחרת';
  handle.dataset.stagedIdx = String(idx);

  const del = document.createElement('span');
  del.className = 'req-delete-icon';
  del.textContent = '✕';
  del.title = 'מחק בקשה';
  del.dataset.stagedIdx = String(idx);

  const resizeHandle = document.createElement('span');
  resizeHandle.className = 'resize-handle';
  resizeHandle.title = 'שנה משך (גרור למעלה/למטה)';
  resizeHandle.dataset.stagedIdx = String(idx);

  const ta = document.createElement('textarea');
  ta.placeholder = 'פרטי הבקשה...';
  ta.value = block.text || '';
  ta.dataset.stagedIdx = String(idx);
  ta.addEventListener('input', () => {
    block.text = ta.value;
    block.dirty = true;
    if (typeof updateGlobalExportButtonStatus === 'function') updateGlobalExportButtonStatus();
    // רישום מדורג (לא מיידי) - כמו הקלדה בתאי הגריד של המנהל (generateTimeSlots) - כדי
    // שכל תו לא ייצור צעד ביטול נפרד, אבל Ctrl+Z עדיין יחזיר טקסט שהוקלד ולא רק פעולות בדידות.
    if (typeof _recordUndoChange === 'function') _recordUndoChange();
  });
  // ממקדים את reqSelectedCell גם דרך פוקוס רגיל על תיבת הטקסט (לא רק קליק ימני) - כדי ש-Ctrl+C
  // יעבוד באופן טבעי מיד אחרי לחיצה/הקלדה בבלוק, בלי צורך לעבור דרך תפריט קליק ימני קודם.
  ta.addEventListener('focus', () => { reqSelectedCell = cell; });

  cell.appendChild(handle);
  cell.appendChild(del);
  cell.appendChild(resizeHandle);
  cell.appendChild(ta);

  for (let r = block.startRow + 1; r < block.startRow + block.span; r++) {
    const covered = tbody.querySelector(`td.req-cell[data-row="${r}"][data-col="${block.day}"]`);
    if (covered) covered.style.display = 'none';
  }
}

/**
 * מציירת מחדש את גריד הבקשות (חדר"ג/שק"ם) - מבוססת על נתונים מפורסמים טריים (נשלפים כאן, לא
 * ממטמון) ועל מערך הבלוקים הממתינים הנוכחי בזיכרון. לא נוגעת באחסון - שימוש רגיל אחרי כל
 * יצירה/הזזה/מחיקה של בלוק ממתין, בלי לאבד בלוקים שעדיין לא נשמרו.
 * @param {'hadrag'|'shekem'} type
 */
async function paintUnitRequestGrid(type) {
  const isHadrag = type === 'hadrag';
  const facilities = isHadrag ? Object.keys(HADRAG_FACILITY_NAMES) : ['shekem'];
  const stagedArr = isHadrag ? hadragStagedBlocks : shekemStagedBlocks;

  for (const facility of facilities) {
    const tbody = document.getElementById('req-body-' + facility);
    if (!tbody) continue;
    buildReqTableBody(tbody);

    const dataTableId = isHadrag ? ('body-' + facility) : 'body-shekem';
    const pubKey = `${isHadrag ? 'hadragData' : 'shekemData'}_${dataTableId}_week${currentWeek}_year${currentYear}_published`;
    const published = await fetchTableData(pubKey);
    if (!published) continue;

    for (let c = 0; c < 7; c++) {
      for (let r = 0; r < 36; r++) {
        const cellData = published[`${r}_${c}`];
        if (cellData && cellData.val && String(cellData.val).trim() !== '') {
          const span = cellData.span || 1;
          const unitClasses = (cellData.classes || []).filter(cls => UNIT_BG_MAP[cls]);
          paintApprovedBlock(tbody, c, r, span, cellData.val, unitClasses.length ? unitClasses : ['bg-esuk']);
          r += (span - 1);
        }
      }
    }
  }

  stagedArr.forEach((block, idx) => {
    const facility = isHadrag ? block.facility : 'shekem';
    const tbody = document.getElementById('req-body-' + facility);
    if (tbody) paintPendingBlock(tbody, block, idx);
  });

  // אין כפתור "שמור בקשות" ייעודי לצבוע - מצב "יש שינויים שלא נשמרו" (block.dirty/reqId חסר)
  // נבדק כחלק מ-hasUnitPendingChanges, שכבר קובע את הצבע (אדום/ירוק) של הכפתור הכללי
  // "שמור ומוכן לייבוא".
  if (typeof updateGlobalExportButtonStatus === 'function') updateGlobalExportButtonStatus();
}

/**
 * טוענת מהאחסון את הבקשות הממתינות של היחידה הנוכחית לתוך מערך הבלוקים בזיכרון (מחליפה כל
 * מצב זמני שלא נשמר) ומציירת את הגריד מחדש. נקראת בכל מעבר ללשונית/שינוי שבוע/אחרי שמירה
 * או מחיקה שכתבו לאחסון - במצבים האלה אין בעיה "לאבד" מצב זמני כי האחסון כבר עדכני.
 * @param {'hadrag'|'shekem'} type
 */
async function loadUnitRequestGridState(type) {
  const isHadrag = type === 'hadrag';
  const currentPage = window.location.pathname.split('/').pop();
  const unitClass = PAGE_UNIT_MAP[currentPage] || 'bg-esuk';
  const unitName = PAGE_UNIT_NAMES[currentPage] || 'בא"ח איסו"ק';

  const allRequests = isHadrag
    ? await loadHadragRequests(currentWeek, currentYear)
    : await loadShekemRequests(currentWeek, currentYear);

  const own = allRequests.filter(r => r.status === 'pending' && (r.unit || 'bg-esuk') === unitClass);
  const staged = own.map(r => {
    const startRow = timeToRowIndex(r.startTime);
    return {
      reqId: r.id,
      facility: r.facility || null,
      day: r.day,
      startRow,
      span: Math.max(1, timeToRowIndex(r.endTime) - startRow),
      text: r.text,
      unitClass: r.unit || unitClass,
      unitName: r.unitName || unitName,
      dirty: false
    };
  });

  if (isHadrag) hadragStagedBlocks = staged;
  else shekemStagedBlocks = staged;

  await paintUnitRequestGrid(type);
}

/**
 * בודקת חפיפה בין טווח שורות (startRow..endRow) בעמודת יום נתונה לבין: (1) המצב המפורסם
 * בפועל בגריד (נשלף טרי בכל קריאה - כדי שהבדיקה תישאר נכונה גם אם המנהל הזיז שיבוץ מאושר
 * מיד קודם לכן), ו-(2) בלוקים ממתינים אחרים של אותה יחידה (מונע שיבוץ-כפול-של-עצמך). לא
 * נוגעת בשדות רשומת בקשה קיימת - ראו ההערה ליד relinkGridRequestToCell.
 */
async function reqGridHasConflict(type, facility, day, startRow, endRow, stagedArr, excludeIdx) {
  const isHadrag = type === 'hadrag';
  const dataTableId = isHadrag ? ('body-' + facility) : 'body-shekem';
  const pubKey = `${isHadrag ? 'hadragData' : 'shekemData'}_${dataTableId}_week${currentWeek}_year${currentYear}_published`;
  const published = await fetchTableData(pubKey);
  if (published) {
    for (let r = 0; r < 36; r++) {
      const cellData = published[`${r}_${day}`];
      if (cellData && cellData.val && String(cellData.val).trim() !== '') {
        const span = cellData.span || 1;
        const cellEnd = r + span - 1;
        if (startRow <= cellEnd && r <= endRow) return true;
      }
    }
  }
  for (let i = 0; i < stagedArr.length; i++) {
    if (i === excludeIdx) continue;
    const b = stagedArr[i];
    if (isHadrag && b.facility !== facility) continue;
    if (b.day !== day) continue;
    const bEnd = b.startRow + b.span - 1;
    if (startRow <= bEnd && b.startRow <= endRow) return true;
  }
  return false;
}

function markReqPreview(tbody, day, startRow, span) {
  for (let r = startRow; r < startRow + span && r < 36; r++) {
    const cell = tbody.querySelector(`td.req-cell[data-row="${r}"][data-col="${day}"]`);
    if (cell) cell.classList.add('req-preview-cell');
  }
}
function clearReqPreview(tbody) {
  tbody.querySelectorAll('.req-preview-cell').forEach(c => c.classList.remove('req-preview-cell'));
}

/** מתחילה מצב שינוי-משך על בלוק ממתין נתון (idx במערך הבלוקים של tbody). */
function startReqResize(tbody, idx) {
  if (!tbody || isNaN(idx)) return;
  const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
  const stagedArr = type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
  const block = stagedArr[idx];
  if (!block) return;
  reqGridDragMode = 'resize';
  reqGridDragCtx = { type, tbody, resizingIdx: idx, currentEndRow: block.startRow + block.span - 1 };
}

// 1. תחילת גרירה: יצירת בלוק חדש (mousedown על תא ריק), הזזת בלוק ממתין קיים (מהידית ⠿, כולל
//    בין טבלאות מתקנים שונות), או שינוי משך (מנקודת האחיזה resize-handle - ראו גם הגיבוי
//    למטה: בלוק בן שורה אחת בזום 75% הופך את נקודת האחיזה (כ-10px) לקשה מאוד לפגיעה מדויקת,
//    ופספוס קטן נופל על תא הבלוק עצמו שלא עושה כלום - נראה למשתמש כאילו "ההקטנה לא עובדת").
document.addEventListener('mousedown', function(e) {
  if (e.button !== 0) return;
  if (isReadOnlyMode()) return;

  const resizeHandle = e.target.closest('td.req-cell .resize-handle');
  if (resizeHandle) {
    e.preventDefault();
    startReqResize(resizeHandle.closest('tbody'), parseInt(resizeHandle.dataset.stagedIdx, 10));
    return;
  }

  const handle = e.target.closest('.req-drag-handle');
  if (handle) {
    e.preventDefault();
    const tbody = handle.closest('tbody');
    if (!tbody) return;
    const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
    reqGridDragMode = 'move';
    reqGridDragCtx = { type, tbody, movingIdx: parseInt(handle.dataset.stagedIdx, 10) };
    return;
  }

  if (e.target.closest('.req-delete-icon')) return;

  // גיבוי: קליק בתוך אזור הבלוק (לא ב-textarea עצמו) בטווח 8px האחרונים מהקצה התחתון של
  // הבלוק נחשב תפיסה של נקודת שינוי-המשך, גם אם לא פגעו בדיוק בה - זה בדיוק מה שמאפשר
  // להקטין בלוק קצר (שורה אחת) שבו נקודת האחיזה כמעט חופפת לשאר התא.
  const pendingCell = e.target.closest('td.req-cell.pending-block');
  if (pendingCell) {
    if (e.target.closest('textarea')) return;
    const rect = pendingCell.getBoundingClientRect();
    if (e.clientY >= rect.bottom - 8) {
      e.preventDefault();
      startReqResize(pendingCell.closest('tbody'), parseInt(pendingCell.dataset.stagedIdx, 10));
    }
    return;
  }

  const cell = e.target.closest('td.req-cell');
  if (!cell) return;
  if (cell.style.display === 'none' || cell.classList.contains('approved-block')) return;

  const tbody = cell.closest('tbody');
  if (!tbody) return;
  const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
  const row = parseInt(cell.dataset.row, 10);
  reqGridDragMode = 'create';
  reqGridDragCtx = { type, tbody, day: parseInt(cell.dataset.col, 10), startRow: row, currentRow: row };
  markReqPreview(tbody, reqGridDragCtx.day, row, 1);
});

// 2א. מהלך גרירת-יצירה (mouseover רגיל מספיק - תאים ריקים לעולם לא display:none).
document.addEventListener('mouseover', function(e) {
  if (reqGridDragMode !== 'create' || !reqGridDragCtx) return;
  const cell = e.target.closest('td.req-cell');
  if (!cell) return;
  const tbody = cell.closest('tbody');
  if (!tbody || tbody !== reqGridDragCtx.tbody) return;

  const hoverRow = parseInt(cell.dataset.row, 10);
  const hoverCol = parseInt(cell.dataset.col, 10);
  if (hoverCol !== reqGridDragCtx.day || hoverRow < reqGridDragCtx.startRow) return;
  clearReqPreview(tbody);
  reqGridDragCtx.currentRow = hoverRow;
  markReqPreview(tbody, reqGridDragCtx.day, reqGridDragCtx.startRow, hoverRow - reqGridDragCtx.startRow + 1);
});

// 2ב. מהלך הזזה/שינוי-משך - מבוסס קואורדינטת Y בפועל (getRowIndexAtY, כמו אצל המנהל) ולא
//    mouseover על תא ספציפי: כשמקטינים בלוק, השורות שצריך לגרור אליהן הן בדיוק השורות שכרגע
//    "מכוסות" (display:none) על ידי הבלוק עצמו (rowSpan) - mouseover לעולם לא נורה על תא
//    מוסתר, כך שהתא הראשון של הבלוק "בולע" את כל אירועי ה-mouseover באזור שלו ומונע כל
//    הקטנה (דיווח משתמש). getRowIndexAtY מודדת מול עמודת השעה (תמיד גלויה בכל שורה) ולא
//    תלויה בזה שהתא הספציפי בעמודת היום גלוי.
document.addEventListener('mousemove', function(e) {
  if (reqGridDragMode !== 'resize' && reqGridDragMode !== 'move') return;
  const ctx = reqGridDragCtx;
  if (!ctx) return;

  if (reqGridDragMode === 'resize') {
    const stagedArr = ctx.type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
    const block = stagedArr[ctx.resizingIdx];
    if (!block) return;
    const row = getRowIndexAtY(ctx.tbody, e.clientY);
    if (row === -1 || row < block.startRow || row === ctx.currentEndRow) return;
    clearReqPreview(ctx.tbody);
    ctx.currentEndRow = row;
    markReqPreview(ctx.tbody, block.day, block.startRow, row - block.startRow + 1);
  } else if (reqGridDragMode === 'move') {
    const elAtPoint = document.elementFromPoint(e.clientX, e.clientY);
    const cellAtPoint = elAtPoint ? elAtPoint.closest('td.req-cell') : null;
    if (!cellAtPoint) return;
    const tbody = cellAtPoint.closest('tbody');
    if (!tbody || !tbody.id.startsWith('req-body-')) return;
    const hoverType = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
    if (hoverType !== ctx.type) return;

    const stagedArr = ctx.type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
    const block = stagedArr[ctx.movingIdx];
    if (!block) return;
    const hoverCol = parseInt(cellAtPoint.dataset.col, 10);
    const row = getRowIndexAtY(tbody, e.clientY);
    if (row === -1) return;
    let previewStart = Math.min(row, 36 - block.span);
    if (previewStart < 0) previewStart = 0;
    if (tbody === ctx.previewTbody && hoverCol === ctx.previewDay && previewStart === ctx.previewStartRow) return;

    const prevPreviewTbody = ctx.previewTbody;
    if (prevPreviewTbody && prevPreviewTbody !== tbody) clearReqPreview(prevPreviewTbody);
    clearReqPreview(tbody);
    ctx.previewTbody = tbody;
    ctx.previewDay = hoverCol;
    ctx.previewStartRow = previewStart;
    markReqPreview(tbody, hoverCol, previewStart, block.span);
  }
});

// 3. סיום גרירה: בדיקת התנגשות מול הגריד המפורסם (טרי) ומול בלוקים ממתינים אחרים, ואז מימוש/ביטול
async function finishReqGridDrag() {
  if (!reqGridDragMode || !reqGridDragCtx) return;
  const mode = reqGridDragMode;
  const ctx = reqGridDragCtx;
  reqGridDragMode = null;
  reqGridDragCtx = null;
  clearReqPreview(ctx.tbody);
  if (ctx.previewTbody) clearReqPreview(ctx.previewTbody);

  const stagedArr = ctx.type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
  const facility = ctx.tbody.id.replace('req-body-', '');

  if (mode === 'create') {
    const span = ctx.currentRow - ctx.startRow + 1;
    const conflict = await reqGridHasConflict(ctx.type, facility, ctx.day, ctx.startRow, ctx.startRow + span - 1, stagedArr, -1);
    if (conflict) {
      alert('⛔ המשבצת תפוסה! יש לבחור שעה פנויה.');
    } else {
      const currentPage = window.location.pathname.split('/').pop();
      stagedArr.push({
        reqId: null,
        facility: ctx.type === 'hadrag' ? facility : null,
        day: ctx.day,
        startRow: ctx.startRow,
        span,
        text: '',
        unitClass: PAGE_UNIT_MAP[currentPage] || 'bg-esuk',
        unitName: PAGE_UNIT_NAMES[currentPage] || 'בא"ח איסו"ק'
      });
      await paintUnitRequestGrid(ctx.type);
      if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
      // פוקוס אוטומטי על ה-textarea של הבלוק החדש - כדי שהיחידה יכולה להתחיל להקליד מיד,
      // ובאותה הזדמנות שדה ממוקד מפעיל את השער הקיים (isEditingField) שמונע מהרענון האוטומטי
      // (ראו DataService.startAutoSync) לדרוס את הבלוק שעדיין לא נשמר.
      const newCell = ctx.tbody.querySelector(`td.req-cell[data-row="${ctx.startRow}"][data-col="${ctx.day}"]`);
      const newTextarea = newCell ? newCell.querySelector('textarea') : null;
      if (newTextarea) newTextarea.focus();
      return;
    }
    await paintUnitRequestGrid(ctx.type);
  } else if (mode === 'resize') {
    const block = stagedArr[ctx.resizingIdx];
    if (block) {
      const newSpan = Math.max(1, ctx.currentEndRow - block.startRow + 1);
      if (newSpan !== block.span) {
        const conflict = await reqGridHasConflict(ctx.type, block.facility, block.day, block.startRow, block.startRow + newSpan - 1, stagedArr, ctx.resizingIdx);
        if (conflict) {
          alert('⛔ המשבצת תפוסה! לא ניתן לשנות לגודל הזה.');
        } else {
          block.span = newSpan;
          block.dirty = true;
          if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
        }
      }
    }
    await paintUnitRequestGrid(ctx.type);
  } else if (mode === 'move') {
    const block = stagedArr[ctx.movingIdx];
    if (block && ctx.previewDay !== undefined && ctx.previewTbody) {
      const newFacility = ctx.type === 'hadrag' ? ctx.previewTbody.id.replace('req-body-', '') : null;
      const conflict = await reqGridHasConflict(ctx.type, newFacility, ctx.previewDay, ctx.previewStartRow, ctx.previewStartRow + block.span - 1, stagedArr, ctx.movingIdx);
      if (conflict) {
        alert('⛔ המשבצת תפוסה! יש לבחור מיקום פנוי.');
      } else {
        block.facility = newFacility;
        block.day = ctx.previewDay;
        block.startRow = ctx.previewStartRow;
        block.dirty = true;
        if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
      }
    }
    await paintUnitRequestGrid(ctx.type);
  }
}
document.addEventListener('mouseup', finishReqGridDrag);
window.addEventListener('blur', () => {
  if (reqGridDragCtx) {
    clearReqPreview(reqGridDragCtx.tbody);
    if (reqGridDragCtx.previewTbody) clearReqPreview(reqGridDragCtx.previewTbody);
  }
  reqGridDragMode = null;
  reqGridDragCtx = null;
});

// 4. מחיקת בלוק ממתין - אם כבר נשמר כרשומה, מוחקת אותה מהאחסון (ומתרנדרת מחדש דרך
//    renderHadragRequestsList/renderShekemRequestsList); אם עדיין לא נשמר, רק מסירה מהזיכרון.
//    פונקציה משותפת לאייקון ה-✕ ולתפריט הקליק-הימני (ראו למטה).
async function deletePendingReqBlock(type, idx) {
  const stagedArr = type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
  const block = stagedArr[idx];
  if (!block) return;

  if (block.reqId) {
    if (type === 'hadrag') await deleteHadragRequest(block.reqId);
    else await deleteShekemRequest(block.reqId);
  } else {
    stagedArr.splice(idx, 1);
    await paintUnitRequestGrid(type);
  }
  if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
}

document.addEventListener('click', async function(e) {
  const del = e.target.closest('.req-delete-icon');
  if (!del) return;
  if (isReadOnlyMode()) return;
  const tbody = del.closest('tbody');
  if (!tbody) return;
  const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
  await deletePendingReqBlock(type, parseInt(del.dataset.stagedIdx, 10));
});

// 5. העתק/הדבק שיבוץ (תפריט קליק-ימני + Ctrl+C/Ctrl+V) - מקביל למנגנון ההעתקה-הדבקה של
//    המנהל (hadragClipboard/pasteOrMoveBlock), אך עצמאי ומצומצם לבלוק {text, span} בלבד -
//    שני הצדדים כותבים לזיכרון בלבד (hadragStagedBlocks/shekemStagedBlocks), לא ל-hadragData.
let reqClipboard = null;

/** מעתיקה בלוק "ממתין" מתא נתון (td.req-cell.pending-block) ל-reqClipboard. */
function reqCopyFromCell(cell) {
  if (!cell || cell.dataset.stagedIdx === undefined) return;
  const tbody = cell.closest('tbody');
  if (!tbody) return;
  const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
  const stagedArr = type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
  const block = stagedArr[parseInt(cell.dataset.stagedIdx, 10)];
  if (!block) return;
  reqClipboard = { text: block.text, span: block.span };
  cell.style.outline = '3px dashed #0284c7';
  cell.style.outlineOffset = '-3px';
  setTimeout(() => { cell.style.outline = ''; }, 600);
}

/** מדביקה את reqClipboard כבלוק "ממתין" חדש בתא ריק נתון (יום/שורה נגזרים מהתא). */
async function reqPasteToCell(cell) {
  if (!reqClipboard || !cell) return;
  if (cell.classList.contains('pending-block') || cell.classList.contains('approved-block')) {
    alert('אפשר להדביק רק על משבצת ריקה.');
    return;
  }
  const tbody = cell.closest('tbody');
  if (!tbody) return;
  const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
  const day = parseInt(cell.dataset.col, 10);
  const startRow = parseInt(cell.dataset.row, 10);
  const facility = tbody.id.replace('req-body-', '');
  const stagedArr = type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
  const endRow = Math.min(35, startRow + reqClipboard.span - 1);
  const span = endRow - startRow + 1;

  const conflict = await reqGridHasConflict(type, facility, day, startRow, endRow, stagedArr, -1);
  if (conflict) { alert('⛔ המשבצת תפוסה! יש לבחור מיקום פנוי.'); return; }

  const currentPage = window.location.pathname.split('/').pop();
  stagedArr.push({
    reqId: null,
    facility: type === 'hadrag' ? facility : null,
    day, startRow, span,
    text: reqClipboard.text,
    unitClass: PAGE_UNIT_MAP[currentPage] || 'bg-esuk',
    unitName: PAGE_UNIT_NAMES[currentPage] || 'בא"ח איסו"ק'
  });
  await paintUnitRequestGrid(type);
  if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
}

// 6. תפריט קליק-ימני - מקביל לתפריט הקליק-הימני של המנהל (#custom-context-menu), אך תפריט
//    נפרד עבור הגריד של היחידה (העתק/הדבק/מחק בלבד - אין צביעה-מחדש ליחידה אחרת, זו תמיד
//    היחידה של העמוד) - אין למחזר את התפריט של המנהל כי הוא מוגדר ל-td.platoon-cell בלבד.
//    ה-CSS (מיקום/עיצוב) ממוחזר מ-hadrag.css (.req-context-menu, בהשראת #custom-context-menu).
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('req-context-menu')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="req-context-menu" class="req-context-menu" style="display:none;">
      <button id="req-ctx-btn-copy">העתק שיבוץ</button>
      <button id="req-ctx-btn-paste">הדבק שיבוץ</button>
      <div class="ctx-divider"></div>
      <button id="req-ctx-btn-delete">מחק בקשה</button>
    </div>
  `);
  const menu = document.getElementById('req-context-menu');
  let ctxCell = null;

  document.addEventListener('contextmenu', function(e) {
    const cell = e.target.closest('td.req-cell');
    if (!cell || cell.classList.contains('approved-block') || isReadOnlyMode()) return;
    e.preventDefault();
    ctxCell = cell;
    reqSelectedCell = cell;
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    menu.style.display = 'flex';
  });

  document.addEventListener('click', () => { menu.style.display = 'none'; });

  document.getElementById('req-ctx-btn-copy').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.style.display = 'none';
    reqCopyFromCell(ctxCell);
  });

  document.getElementById('req-ctx-btn-paste').addEventListener('click', async (e) => {
    e.stopPropagation();
    menu.style.display = 'none';
    await reqPasteToCell(ctxCell);
  });

  document.getElementById('req-ctx-btn-delete').addEventListener('click', async (e) => {
    e.stopPropagation();
    menu.style.display = 'none';
    if (!ctxCell || ctxCell.dataset.stagedIdx === undefined) return;
    const tbody = ctxCell.closest('tbody');
    if (!tbody) return;
    const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
    await deletePendingReqBlock(type, parseInt(ctxCell.dataset.stagedIdx, 10));
  });
});

// 7. קיצורי מקלדת Ctrl+C / Ctrl+V - מקביל למנגנון של המנהל (script.js, "Copy and Paste"):
//    התא הרלוונטי נקבע מ-reqSelectedCell (נקבע בקליק ימני או בפוקוס על textarea של בלוק),
//    אחרת מ-document.activeElement (אם זה textarea/req-cell בתוך הגריד), ואחרת מה-:hover -
//    אותה שרשרת בדיוק שהמנהל כבר משתמש בה, כדי שההתנהגות תהיה "אותו דבר" כמבוקש.
let reqSelectedCell = null;

document.addEventListener('keydown', async function(e) {
  if (!e.ctrlKey || isReadOnlyMode()) return;

  let cell = reqSelectedCell;
  const activeElement = document.activeElement;
  if (!cell && activeElement && activeElement.tagName === 'TEXTAREA') {
    cell = activeElement.closest('td.req-cell');
  }
  if (!cell && activeElement && activeElement.classList && activeElement.classList.contains('req-cell')) {
    cell = activeElement;
  }
  if (!cell) {
    cell = document.querySelector('td.req-cell:hover');
  }
  if (!cell || cell.classList.contains('approved-block')) return;

  if (e.code === 'KeyC' || e.key.toLowerCase() === 'c' || e.key === 'ב') {
    e.preventDefault();
    reqCopyFromCell(cell);
  } else if (e.code === 'KeyV' || e.key.toLowerCase() === 'v' || e.key === 'ה') {
    e.preventDefault();
    await reqPasteToCell(cell);
  }
});

/**
 * ממירה כל בלוק "ממתין" בגריד הבקשות של חדר"ג לרשומת בקשה בפועל (יוצרת חדשה או מעדכנת
 * קיימת), לפי המיקום הנוכחי שלו - day/startTime/endTime/facility/text. אין כפתור "שמור
 * בקשות" ייעודי - זו נקראת כחלק מ-"שמור ומוכן לייבוא" (globalExportUnit), לפני שהוא ממשיך
 * לפרסום הרגיל, כדי שהפרסום יכלול גם בקשות שנוצרו/הוזזו בגריד ועדיין לא נכתבו לרשומה.
 * @returns {Promise<boolean>} false אם יש בלוק עם טקסט ריק (ומתריעה, בלי לשמור כלום);
 *   true אחרת - כולל כשאין בלוקים בכלל, זה לא מצב שגיאה.
 */
async function commitHadragStagedBlocks() {
  if (hadragStagedBlocks.length === 0) return true;
  if (hadragStagedBlocks.some(b => !b.text || !b.text.trim())) {
    alert('יש להזין טקסט לכל בקשת חדר"ג בגריד לפני השמירה.');
    return false;
  }

  const requests = await loadHadragRequests(currentWeek, currentYear);
  hadragStagedBlocks.forEach((block, i) => {
    const startTime = rowIndexToTime(block.startRow);
    const endTime = rowIndexToTime(block.startRow + block.span);
    if (block.reqId) {
      const existing = requests.find(r => r.id === block.reqId);
      if (existing) {
        existing.facility = block.facility;
        existing.day = block.day;
        existing.startTime = startTime;
        existing.endTime = endTime;
        existing.text = block.text.trim();
      }
    } else {
      requests.push({
        id: Date.now().toString(36) + i,
        facility: block.facility,
        text: block.text.trim(),
        day: block.day,
        startTime, endTime,
        unit: block.unitClass,
        unitName: block.unitName,
        status: 'pending'
      });
    }
  });

  await saveHadragRequests(requests, currentWeek, currentYear);
  if (typeof renderHadragRequestsList === 'function') await renderHadragRequestsList();
  return true;
}

/** מקבילה ל-commitHadragStagedBlocks עבור שק"ם (ללא שדה facility). */
async function commitShekemStagedBlocks() {
  if (shekemStagedBlocks.length === 0) return true;
  if (shekemStagedBlocks.some(b => !b.text || !b.text.trim())) {
    alert('יש להזין טקסט לכל בקשת שק"ם בגריד לפני השמירה.');
    return false;
  }

  const requests = await loadShekemRequests(currentWeek, currentYear);
  shekemStagedBlocks.forEach((block, i) => {
    const startTime = rowIndexToTime(block.startRow);
    const endTime = rowIndexToTime(block.startRow + block.span);
    if (block.reqId) {
      const existing = requests.find(r => r.id === block.reqId);
      if (existing) {
        existing.day = block.day;
        existing.startTime = startTime;
        existing.endTime = endTime;
        existing.text = block.text.trim();
      }
    } else {
      requests.push({
        id: Date.now().toString(36) + i,
        text: block.text.trim(),
        day: block.day,
        startTime, endTime,
        unit: block.unitClass,
        unitName: block.unitName,
        status: 'pending'
      });
    }
  });

  await saveShekemRequests(requests, currentWeek, currentYear);
  if (typeof renderShekemRequestsList === 'function') await renderShekemRequestsList();
  return true;
}

/**
 * מפיקה מפתח שמירה עבור בקשות חדר"ג.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 * @returns {string} מפתח שמירה
 */
function getHadragRequestsKey(week, year) { return `hadragRequests_week${week}_year${year}`; }

/**
 * טוענת את בקשות החדר"ג לשבוע ושנה נתונים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 * @returns {Promise<Array<Object>>} מערך בקשות חדר"ג
 */
async function loadHadragRequests(week, year) {
  const key = getHadragRequestsKey(week, year);
  if (typeof DataService !== 'undefined') {
    const data = await DataService.getItem(key);
    return data || [];
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

/**
 * שומרת את בקשות החדר"ג ב-DataService.
 * @param {Array<Object>} requests - מערך בקשות חדר"ג
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
async function saveHadragRequests(requests, week, year) {
  const key = getHadragRequestsKey(week, year);
  if (typeof DataService !== 'undefined') {
    await DataService.setItem(key, requests);
  } else {
    localStorage.setItem(key, JSON.stringify(requests));
  }
}

/**
 * בונה דינמית את שורות ועמודות השעות (06:00 עד 23:30) בטבלאות חדר"ג ושק"ם.
 * @param {string} tbodyId - מזהה גוף הטבלה (tbody)
 */
function generateTimeSlots(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (tbody.rows.length > 0) return;

  let html = '';
  for (let r = 0; r < 36; r++) {
    const hour = Math.floor(6 + r / 2).toString().padStart(2, '0');
    const minutes = r % 2 === 0 ? '00' : '30';
    const timeString = `${hour}:${minutes}`;
    
    let rowHtml = `<tr><td class="time-col">${timeString}</td>`;
    for (let c = 0; c < 7; c++) {
      rowHtml += `<td class="platoon-cell" data-row="${r}" data-col="${c}">
                    <textarea placeholder=""></textarea>
                  </td>`;
    }
    rowHtml += `</tr>`;
    html += rowHtml;
  }
  tbody.innerHTML = html;

  tbody.querySelectorAll('textarea').forEach(ta => {
    ta.addEventListener('input', () => {
      if (typeof saveHadragTables === 'function') saveHadragTables();
      if (typeof saveShekemTables === 'function') saveShekemTables();
    });
  });
}

const PAGE_UNIT_NAMES = {
  'esuk.html': 'בא"ח איסו"ק',
  'hirg.html': 'בא"ח חיר"ג',
  'pikud.html': 'גדוד הפיקוד',
  'tazam.html': 'ענף תצ"מ',
  'bahalag.html': 'מפח"ט'
};

/**
 * מוחקת בקשת חדר"ג ומעדכנת את הרשימות בתצוגה.
 * @param {string} id - מזהה הבקשה
 */
async function deleteHadragRequest(id) {
  const requests = (await loadHadragRequests(currentWeek, currentYear)).filter(req => req.id !== id);
  await saveHadragRequests(requests, currentWeek, currentYear);
  if(typeof renderHadragRequestsList === 'function') await renderHadragRequestsList();
  if(typeof renderHadragPendingRequests === 'function') await renderHadragPendingRequests();
}

/**
 * מרנדרת את רשימת בקשות החדר"ג שהוגשו עבור עמוד היחידה הנוכחי.
 */
async function renderHadragRequestsList() {
  const container = document.getElementById('hadragRequestsList');
  if (!container) return;

  await loadUnitRequestGridState('hadrag');

  const requests = await loadHadragRequests(currentWeek, currentYear);
  const currentPage = window.location.pathname.split('/').pop();
  const targetColor = PAGE_UNIT_MAP[currentPage];

  let filteredRequests = requests;
  if (targetColor) {
    filteredRequests = requests.filter(req => (req.unit || 'bg-esuk') === targetColor);
  }

  if (filteredRequests.length === 0) {
    container.innerHTML = '<p style="color:#666;">אין בקשות לשבוע זה.</p>';
    return;
  }

  container.innerHTML = filteredRequests.map((req) => {
    const styleObj = UNIT_BG_MAP[req.unit] || { bg: '#fff9c4', border: '#ffe082', text: '#856404' };

    return `
      <div class="hipok-entry-row" style="max-width: 700px; margin: 0 auto 10px auto; background-color: ${styleObj.bg}; border: 2px solid ${styleObj.border}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <span style="font-weight: bold; width: 90px; color: ${styleObj.text}; text-align: right;">${HADRAG_FACILITY_NAMES[req.facility] || 'חדר"ג'}</span>
        <span style="font-weight: bold; width: 80px; color: #333;">יום ${HADRAG_DAY_LABELS[req.day]}</span>
        <span style="flex:1; text-align:right; padding-right: 15px; color: #000;">${escapeHtml(req.text)}</span>
        <span style="direction: ltr; font-weight: bold; color: #333; margin-left: 14px;">${req.startTime} - ${req.endTime}</span>
        <button class="hipok-delete-btn" onclick="deleteHadragRequest('${req.id}')">✕</button>
      </div>
    `;
  }).join('');
}

/**
 * המירה מחרוזת שעה (HH:MM) לאינדקס שורה בטבלאות חדר"ג/שק"ם (0 עד 35).
 * @param {string} timeStr - מחרוזת שעה
 * @returns {number} אינדקס שורה
 */
function timeToRowIndex(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours - 6) * 2 + (minutes >= 30 ? 1 : 0);
}

/**
 * הופכת אינדקס שורה (0-35) בטבלאות חדר"ג/שק"ם למחרוזת שעה (HH:MM).
 * פונקציה הפוכה ל-timeToRowIndex.
 * @param {number} rowIndex
 * @returns {string}
 */
function rowIndexToTime(rowIndex) {
  const hour = Math.floor(6 + rowIndex / 2);
  const minutes = rowIndex % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minutes}`;
}

/**
 * מוחקת בקשת חדר"ג/שק"ם שהשיבוץ שלה בגריד נמחק או נדרס (לא מוחקת מהגריד עצמו).
 * מזהה אם התא שייך לטבלת חדר"ג או שק"ם ומנתבת למחיקה המתאימה.
 * @param {string} reqId
 * @param {HTMLElement} tbody
 */
async function removeGridRequestLink(reqId, tbody) {
  if (!reqId || !tbody) return;
  if (tbody.id === 'body-shekem') {
    if (typeof deleteShekemRequest === 'function') await deleteShekemRequest(reqId);
  } else {
    if (typeof deleteHadragRequest === 'function') await deleteHadragRequest(reqId);
  }
}

/**
 * מתייגת מחדש את התא (לאחר הזזה/שינוי גודל בגריד) ב-reqId, כדי שמחיקה עתידית
 * של השיבוץ עדיין תדע לנקות את הבקשה המקושרת.
 * חשוב: אינה נוגעת בשדות הבקשה המקורית (day/startTime/endTime/facility) בכוונה -
 * הבקשה היא תיעוד של מה שהיחידה ביקשה, והזיהוי/תצוגה של המיקום בפועל תמיד
 * נעשית לפי סריקת הגריד (צבע), ראו paintUnitRequestGrid. שינוי שדות הבקשה
 * כאן גרם לבאג: כתיבה ל-localStorage תוך כדי הזזה יכולה להתנגש עם מחזור ה"הפצה"
 * שרץ מיד אחרי (globalExportManager), ולגרום להקצאות לא להופיע בכלל.
 * @param {string} reqId
 * @param {HTMLElement} cell - התא החדש שאליו הועבר/הורחב השיבוץ
 */
function relinkGridRequestToCell(reqId, cell) {
  if (!reqId || !cell) return;
  cell.dataset.reqId = reqId;
}

const UNIT_BG_MAP = {
  'bg-esuk':   { bg: '#fff9c4', border: '#ffe082', text: '#856404' },
  'bg-hirg':   { bg: '#c8e6c9', border: '#81c784', text: '#1b5e20' },
  'bg-pikud':  { bg: '#bbdefb', border: '#64b5f6', text: '#0d47a1' },
  'bg-tazam':  { bg: '#e1bee7', border: '#ba68c8', text: '#4a148c' },
  'bg-maphat': { bg: '#ffe0b2', border: '#ffb74d', text: '#e65100' }
};

/**
 * מרנדרת את כרטיסי הבקשות הממתינות לאישור חדר"ג עבור עמוד ניהול החדר"ג.
 */
async function renderHadragPendingRequests() {
  const container = document.getElementById('hadragPendingList');
  if (!container) return;

  const allRequests = await loadHadragRequests(currentWeek, currentYear);
  // רק בקשות שהיחידה שמרה ופרסמה בפועל ("שמור ומוכן לייבוא") מוצגות למנהל - לא בקשה שהוקלדה
  // ועדיין לא נשמרה על ידי היחידה (אפיון QA).
  const publishedKey = getHadragRequestsKey(currentWeek, currentYear) + '_published';
  const publishedRequests = (await fetchTableData(publishedKey)) || [];
  const publishedIds = new Set(publishedRequests.map(r => r.id));
  const pendingRequests = allRequests.filter(req => req.status !== 'approved' && publishedIds.has(req.id));

  if (pendingRequests.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:13px; font-weight:700; margin:6px 0;">אין בקשות ממתינות לאישור.</p>';
    return;
  }

  container.innerHTML = pendingRequests.map(req => {
    const unitKey = req.unit || 'bg-esuk';
    const info = UNIT_BG_MAP[unitKey] || UNIT_BG_MAP['bg-esuk'];
    const unitName = req.unitName || 'בא"ח איסו"ק';
    const facilityName = HADRAG_FACILITY_NAMES[req.facility] || 'חדר"ג';
    const dayName = HADRAG_DAY_LABELS[req.day] !== undefined ? 'יום ' + HADRAG_DAY_LABELS[req.day] : '';

    return `
      <div class="request-card" style="background:#ffffff; border:1px solid #cbd5e1; border-right:4px solid ${info.border}; padding:6px 12px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:13px; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-bottom:4px;">
        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
          <span style="background:${info.bg}; border:1px solid ${info.border}; color:${info.text}; padding:2px 8px; border-radius:6px; font-weight:800; font-size:11.5px;">${escapeHtml(unitName)}</span>
          <span style="background:#0f172a; color:#ffffff; padding:2px 8px; border-radius:6px; font-weight:700; font-size:11.5px;">${facilityName} • ${dayName}</span>
        </div>

        <span style="color:#000000; font-weight:800; flex:1; text-align:right; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 4px;">${escapeHtml(req.text)}</span>

        <div style="direction:ltr; display:flex; align-items:center; gap:4px; flex-shrink:0; background:#f8fafc; padding:3px 6px; border-radius:6px; border:1px solid #e2e8f0;">
          <input type="time" id="editStart_${req.id}" value="${req.startTime}" step="1800" style="padding:2px 4px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px; font-weight:700; width:68px; text-align:center; color:#000000; background:#ffffff; outline:none;">
          <span style="font-weight:700; color:#64748b; font-size:12px;">-</span>
          <input type="time" id="editEnd_${req.id}" value="${req.endTime}" step="1800" style="padding:2px 4px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px; font-weight:700; width:68px; text-align:center; color:#000000; background:#ffffff; outline:none;">
        </div>

        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn-approve" style="background:linear-gradient(135deg, #16a34a, #15803d); color:#ffffff; border:none; padding:4px 12px; border-radius:6px; font-size:12.5px; font-weight:800; cursor:pointer; height:28px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 2px rgba(22,163,74,0.2);" onclick="approveHadragRequest('${req.id}')">שבץ</button>
          <button class="btn-reject" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:4px 10px; border-radius:6px; font-size:12.5px; font-weight:800; cursor:pointer; height:28px; display:flex; align-items:center; justify-content:center;" onclick="rejectHadragRequest('${req.id}')">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * מאשרת בקשת חדר"ג, מחשבת את מיזוג השורות הנדרש, ומשבצת אותה בטבלה.
 * @param {string} reqId - מזהה הבקשה
 */
async function approveHadragRequest(reqId) {
  const requests = await loadHadragRequests(currentWeek, currentYear);
  const reqIndex = requests.findIndex(r => r.id === reqId);
  if (reqIndex === -1) return;
  
  const req = requests[reqIndex];
  const tbodyId = 'body-' + req.facility;
  const tbody = document.getElementById(tbodyId);
  if (!tbody) { alert('הטבלה הרלוונטית לא נמצאה'); return; }

  const newStartInput = document.getElementById(`editStart_${reqId}`);
  const newEndInput = document.getElementById(`editEnd_${reqId}`);
  
  if (newStartInput && newEndInput) {
    if (newStartInput.value >= newEndInput.value) {
      alert('שגיאה: שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.');
      return;
    }
    req.startTime = newStartInput.value;
    req.endTime = newEndInput.value;
  }

  const startRow = timeToRowIndex(req.startTime);
  const endRow = Math.max(startRow, timeToRowIndex(req.endTime) - 1);
  const col = req.day;

  let hasConflict = false;
  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (!cell) continue;
    if (cell.style.display === 'none' || cell.rowSpan > 1 || cell.classList.contains('merged') || cell.classList.contains('imported')) {
      hasConflict = true;
    }
    const input = cell.querySelector('textarea');
    if (input && input.value.trim() !== '') hasConflict = true;
  }

  if (hasConflict) {
    alert('⚠️ אי אפשר לשבץ: השעות שבחרת תפוסות.');
    return;
  }

  const firstCell = tbody.querySelector(`td.platoon-cell[data-row="${startRow}"][data-col="${col}"]`);
  if (!firstCell) return;

  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (cell) {
      cell.style.display = (r === startRow) ? '' : 'none';
      cell.rowSpan = 1;
      cell.classList.remove('merged', ...ALL_COLOR_CLASSES);
    }
  }

  firstCell.rowSpan = (endRow - startRow + 1);
  const textarea = firstCell.querySelector('textarea');
  if (textarea) {
    textarea.style.height = '100%';
    textarea.value = req.text;
    const unitClass = req.unit || 'bg-esuk';
    firstCell.classList.add(unitClass, 'imported');
  }
  firstCell.dataset.reqId = reqId;

  req.status = 'approved';
  await saveHadragRequests(requests, currentWeek, currentYear);
  if (typeof saveHadragTables === 'function') saveHadragTables();
  if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
  await renderHadragPendingRequests();
}

/**
 * דוחה ומודקת בקשת חדר"ג לאחר אישור המשתמש.
 * @param {string} reqId - מזהה הבקשה
 */
async function rejectHadragRequest(reqId) {
  if (confirm('האם אתה בטוח שברצונך לדחות ולמחוק בקשה זו?')) {
    await deleteHadragRequest(reqId);
  }
}

/**
 * שומרת את מצב תאי הטבלאות ומיזוגי השורות בכל מתקני החדר"ג לשבוע הנוכחי.
 */
/**
 * משווה תאי גריד חדר"ג/שק"ם (drag-to-merge) מול הגרסה שהופצה לאחרונה,
 * ומסמנת בכתום (.conflict-overlap) תאים ששונו מאז - עד להפצת המנהל (אפיון 1.2).
 * @param {string[]} tableIds - מזהי ה-tbody של הטבלאות
 * @param {string} keyPrefix - קידומת מפתח השמירה (hadragData / shekemData)
 */
async function updatePlatoonGridConflictHighlight(tableIds, keyPrefix) {
  for (const tableId of tableIds) {
    const tbody = document.getElementById(tableId);
    if (!tbody) continue;
    const pubKey = `${keyPrefix}_${tableId}_week${currentWeek}_year${currentYear}_published`;
    let published;
    if (typeof DataService !== 'undefined') {
      published = await DataService.getItem(pubKey);
    } else {
      published = JSON.parse(localStorage.getItem(pubKey) || 'null');
    }
    const pub = published || {};
    for (let r = 0; r < 36; r++) {
      for (let c = 0; c < 7; c++) {
        const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
        if (!cell) continue;
        const textarea = cell.querySelector('textarea');
        const curVal = textarea ? textarea.value : '';
        const pubEntry = pub[`${r}_${c}`];
        const pubVal = pubEntry ? (pubEntry.val || '') : '';
        cell.classList.toggle('conflict-overlap', curVal !== pubVal);
      }
    }
  }
}

function saveHadragTables() {
  const TABLE_IDS = ['body-chadrag', 'body-anafit8', 'body-anafit-bah', 'body-tavor'];
  TABLE_IDS.forEach(tableId => {
    const tbody = document.getElementById(tableId);
    if (!tbody) return; 
    
    const tableData = {};
    for(let r = 0; r < 36; r++) {
      for(let c = 0; c < 7; c++) {
        const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
        if(!cell) continue;
        const textarea = cell.querySelector('textarea');
        const textVal = textarea ? textarea.value : '';
        if (cell.dataset.reqId && textVal.trim() === '') {
          // הטקסט נוקה ידנית (הקלדה) בלי לעבור דרך תפריט המחיקה - יש לנתק את הבקשה המקושרת
          if (typeof removeGridRequestLink === 'function') removeGridRequestLink(cell.dataset.reqId, tbody);
          delete cell.dataset.reqId;
        }
        tableData[`${r}_${c}`] = {
          val: textVal,
          span: cell.rowSpan,
          disp: cell.style.display,
          classes: Array.from(cell.classList).filter(cls => ['merged', ...PERSISTABLE_CELL_CLASSES].includes(cls)),
          reqId: cell.dataset.reqId || null
        };
      }
    }
    persist(`hadragData_${tableId}_week${currentWeek}_year${currentYear}`, tableData);
  });
  updatePlatoonGridConflictHighlight(TABLE_IDS, 'hadragData');
  if (typeof _recordUndoChange === 'function') _recordUndoChange();
}

/**
 * מאפסת את מבנה התאים והמיזוגים בטבלת חדר"ג או שק"ם למצב ברירת מחדל.
 * @param {HTMLTableSectionElement} tbody - גוף הטבלה
 */
function resetHadragOrShekemTable(tbody) {
  if (!tbody) return;
  for (let r = 0; r < 36; r++) {
    for (let c = 0; c < 7; c++) {
      const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
      if (!cell) continue;
      cell.rowSpan = 1;
      cell.style.display = '';
      cell.className = 'platoon-cell';
      const textarea = cell.querySelector('textarea');
      if (textarea) {
        textarea.value = '';
        textarea.style.height = '100%';
      }
    }
  }
}

/**
 * טוענת את מצב המשבצות והאירועים המשובצים בטבלאות החדר"ג עבור שבוע ושנה נתונים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
async function loadHadragTables(week, year) {
  const TABLE_IDS = ['body-chadrag', 'body-anafit8', 'body-anafit-bah', 'body-tavor'];
  if (typeof generateTimeSlots !== 'function') return;

  for (const tableId of TABLE_IDS) {
    const tbody = document.getElementById(tableId);
    if (!tbody) continue;
    
    tbody.innerHTML = '';
    generateTimeSlots(tableId); 
    resetHadragOrShekemTable(tbody);

    const hKey = `hadragData_${tableId}_week${week}_year${year}`;
    const tableData = (typeof DataService !== 'undefined')
      ? await DataService.getItem(hKey)
      : JSON.parse(localStorage.getItem(hKey) || 'null');
    if (!tableData) continue;

    for (let r = 0; r < 36; r++) {
      for (let c = 0; c < 7; c++) {
        const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
        if (!cell) continue;
        
        const data = tableData[`${r}_${c}`];
        if (data) {
          const textarea = cell.querySelector('textarea');
          if (textarea) {
            textarea.value = data.val || '';
            textarea.style.height = '100%';
          }
          cell.rowSpan = data.span || 1;
          cell.style.display = data.disp || '';
          if (data.classes) data.classes.forEach(cls => cell.classList.add(cls));
          if (data.reqId) cell.dataset.reqId = data.reqId; else delete cell.dataset.reqId;
        }
      }
    }
  }
  await updatePlatoonGridConflictHighlight(TABLE_IDS, 'hadragData');
}

/* =========================================================
   מערכת שק"ם
========================================================= */

/** מפיקה מפתח שמירה לבקשות שק"ם */
function getShekemRequestsKey(week, year) { return `shekemRequests_week${week}_year${year}`; }

/** טוענת את בקשות השק"ם לשבוע ושנה נתונים */
async function loadShekemRequests(week, year) {
  const key = getShekemRequestsKey(week, year);
  if (typeof DataService !== 'undefined') {
    const data = await DataService.getItem(key);
    return data || [];
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

/** שומרת את בקשות השק"ם ב-DataService */
async function saveShekemRequests(requests, week, year) {
  const key = getShekemRequestsKey(week, year);
  if (typeof DataService !== 'undefined') {
    await DataService.setItem(key, requests);
  } else {
    localStorage.setItem(key, JSON.stringify(requests));
  }
}

/**
 * מוחקת בקשת שק"ם ומעדכנת את התצוגות.
 * @param {string} id - מזהה הבקשה
 */
async function deleteShekemRequest(id) {
  const requests = (await loadShekemRequests(currentWeek, currentYear)).filter(req => req.id !== id);
  await saveShekemRequests(requests, currentWeek, currentYear);
  if(typeof renderShekemRequestsList === 'function') await renderShekemRequestsList();
  if(typeof renderShekemPendingRequests === 'function') await renderShekemPendingRequests();
}

/**
 * מרנדרת את רשימת בקשות השק"ם בעמוד היחידה.
 */
async function renderShekemRequestsList() {
  const container = document.getElementById('shekemRequestsList');
  if (!container) return;

  await loadUnitRequestGridState('shekem');

  const requests = await loadShekemRequests(currentWeek, currentYear);
  const currentPage = window.location.pathname.split('/').pop();
  const targetColor = PAGE_UNIT_MAP[currentPage];

  let filteredRequests = requests;
  if (targetColor) {
    filteredRequests = requests.filter(req => (req.unit || 'bg-esuk') === targetColor);
  }

  if (filteredRequests.length === 0) {
    container.innerHTML = '<p style="color:#666;">אין בקשות לשבוע זה.</p>';
    return;
  }

  container.innerHTML = filteredRequests.map((req) => {
    const styleObj = UNIT_BG_MAP[req.unit] || { bg: '#fff9c4', border: '#ffe082', text: '#856404' };

    return `
      <div class="hipok-entry-row" style="max-width: 700px; margin: 0 auto 10px auto; background-color: ${styleObj.bg}; border: 2px solid ${styleObj.border}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <span style="font-weight: bold; width: 80px; color: #333;">יום ${HADRAG_DAY_LABELS[req.day]}</span>
        <span style="flex:1; text-align:right; padding-right: 15px; color: #000;">${escapeHtml(req.text)}</span>
        <span style="direction: ltr; font-weight: bold; color: #333; margin-left: 14px;">${req.startTime} - ${req.endTime}</span>
        <button class="hipok-delete-btn" onclick="deleteShekemRequest('${req.id}')">✕</button>
      </div>
    `;
  }).join('');
}

/**
 * מרנדרת את כרטיסי הבקשות הממתינות לאישור שק"ם עבור עמוד ניהול השק"ם.
 */
async function renderShekemPendingRequests() {
  const container = document.getElementById('shekemPendingList');
  if (!container) return;

  const allRequests = await loadShekemRequests(currentWeek, currentYear);
  // רק בקשות שהיחידה שמרה ופרסמה בפועל ("שמור ומוכן לייבוא") מוצגות למנהל - לא בקשה שהוקלדה
  // ועדיין לא נשמרה על ידי היחידה (אפיון QA).
  const publishedKey = getShekemRequestsKey(currentWeek, currentYear) + '_published';
  const publishedRequests = (await fetchTableData(publishedKey)) || [];
  const publishedIds = new Set(publishedRequests.map(r => r.id));
  const pendingRequests = allRequests.filter(req => req.status !== 'approved' && publishedIds.has(req.id));

  if (pendingRequests.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:13px; font-weight:700; margin:6px 0;">אין בקשות לשעות שק"ם הממתינות לאישור.</p>';
    return;
  }

  container.innerHTML = pendingRequests.map(req => {
    const unitKey = req.unit || 'bg-esuk';
    const info = UNIT_BG_MAP[unitKey] || UNIT_BG_MAP['bg-esuk'];
    const unitName = req.unitName || 'בא"ח איסו"ק';
    const dayName = HADRAG_DAY_LABELS[req.day] !== undefined ? 'יום ' + HADRAG_DAY_LABELS[req.day] : '';

    return `
      <div class="request-card" style="background:#ffffff; border:1px solid #cbd5e1; border-right:4px solid ${info.border}; padding:6px 12px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:13px; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-bottom:4px;">
        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
          <span style="background:${info.bg}; border:1px solid ${info.border}; color:${info.text}; padding:2px 8px; border-radius:6px; font-weight:800; font-size:11.5px;">${escapeHtml(unitName)}</span>
          <span style="background:#0f172a; color:#ffffff; padding:2px 8px; border-radius:6px; font-weight:700; font-size:11.5px;">שק"ם • ${dayName}</span>
        </div>

        <span style="color:#000000; font-weight:800; flex:1; text-align:right; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 4px;">${escapeHtml(req.text)}</span>

        <div style="direction:ltr; display:flex; align-items:center; gap:4px; flex-shrink:0; background:#f8fafc; padding:3px 6px; border-radius:6px; border:1px solid #e2e8f0;">
          <input type="time" id="editShekemStart_${req.id}" value="${req.startTime}" step="1800" style="padding:2px 4px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px; font-weight:700; width:68px; text-align:center; color:#000000; background:#ffffff; outline:none;">
          <span style="font-weight:700; color:#64748b; font-size:12px;">-</span>
          <input type="time" id="editShekemEnd_${req.id}" value="${req.endTime}" step="1800" style="padding:2px 4px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px; font-weight:700; width:68px; text-align:center; color:#000000; background:#ffffff; outline:none;">
        </div>

        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn-approve" style="background:linear-gradient(135deg, #16a34a, #15803d); color:#ffffff; border:none; padding:4px 12px; border-radius:6px; font-size:12.5px; font-weight:800; cursor:pointer; height:28px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 2px rgba(22,163,74,0.2);" onclick="approveShekemRequest('${req.id}')">שבץ</button>
          <button class="btn-reject" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:4px 10px; border-radius:6px; font-size:12.5px; font-weight:800; cursor:pointer; height:28px; display:flex; align-items:center; justify-content:center;" onclick="rejectShekemRequest('${req.id}')">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * מאשרת ומשבצת בקשת שק"ם בטבלת השק"ם.
 * @param {string} reqId - מזהה הבקשה
 */
async function approveShekemRequest(reqId) {
  const requests = await loadShekemRequests(currentWeek, currentYear);
  const reqIndex = requests.findIndex(r => r.id === reqId);
  if (reqIndex === -1) return;
  
  const req = requests[reqIndex];
  const tbody = document.getElementById('body-shekem');
  if (!tbody) return;

  const newStartInput = document.getElementById(`editShekemStart_${reqId}`);
  const newEndInput = document.getElementById(`editShekemEnd_${reqId}`);
  
  if (newStartInput && newEndInput) {
    if (newStartInput.value >= newEndInput.value) {
      alert('שגיאה: שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.');
      return;
    }
    req.startTime = newStartInput.value;
    req.endTime = newEndInput.value;
  }

  const startRow = timeToRowIndex(req.startTime);
  const endRow = Math.max(startRow, timeToRowIndex(req.endTime) - 1);
  const col = req.day;

  let hasConflict = false;
  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (!cell) continue;
    if (cell.style.display === 'none' || cell.rowSpan > 1 || cell.classList.contains('merged') || cell.classList.contains('imported')) {
      hasConflict = true;
    }
    const input = cell.querySelector('textarea');
    if (input && input.value.trim() !== '') hasConflict = true;
  }

  if (hasConflict) {
    alert('⚠️ אי אפשר לשבץ: השעות שבחרת כבר תפוסות בטבלה.');
    return;
  }

  const firstCell = tbody.querySelector(`td.platoon-cell[data-row="${startRow}"][data-col="${col}"]`);
  if (!firstCell) return;

  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (cell) {
      cell.style.display = (r === startRow) ? '' : 'none';
      cell.rowSpan = 1;
      cell.classList.remove('merged', ...ALL_COLOR_CLASSES);
    }
  }

  firstCell.rowSpan = (endRow - startRow + 1);
  const textarea = firstCell.querySelector('textarea');
  if (textarea) {
    textarea.style.height = '100%';
    textarea.value = req.text;
    const unitClass = req.unit || 'bg-esuk';
    firstCell.classList.add(unitClass, 'imported');
  }
  firstCell.dataset.reqId = reqId;

  req.status = 'approved';
  await saveShekemRequests(requests, currentWeek, currentYear);
  if (typeof saveShekemTables === 'function') saveShekemTables();
  if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
  await renderShekemPendingRequests();
}

/**
 * דוחה בקשת שק"ם ומוחקת אותה.
 * @param {string} reqId - מזהה הבקשה
 */
async function rejectShekemRequest(reqId) {
  if (confirm('האם אתה בטוח שברצונך לדחות ולמחוק בקשה זו?')) {
    await deleteShekemRequest(reqId);
  }
}

/**
 * שומרת את מצב טבלת השק"ם ב-LocalStorage.
 */
function saveShekemTables() {
  const tbody = document.getElementById('body-shekem');
  if (!tbody) return; 
  
  const tableData = {};
  for(let r = 0; r < 36; r++) {
    for(let c = 0; c < 7; c++) {
      const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
      if(!cell) continue;
      const textarea = cell.querySelector('textarea');
      const textVal = textarea ? textarea.value : '';
      if (cell.dataset.reqId && textVal.trim() === '') {
        // הטקסט נוקה ידנית (הקלדה) בלי לעבור דרך תפריט המחיקה - יש לנתק את הבקשה המקושרת
        if (typeof removeGridRequestLink === 'function') removeGridRequestLink(cell.dataset.reqId, tbody);
        delete cell.dataset.reqId;
      }
      tableData[`${r}_${c}`] = {
        val: textVal,
        span: cell.rowSpan,
        disp: cell.style.display,
        classes: Array.from(cell.classList).filter(cls => ['merged', ...PERSISTABLE_CELL_CLASSES].includes(cls)),
        reqId: cell.dataset.reqId || null
      };
    }
  }
  persist(`shekemData_body-shekem_week${currentWeek}_year${currentYear}`, tableData);
  updatePlatoonGridConflictHighlight(['body-shekem'], 'shekemData');
  if (typeof _recordUndoChange === 'function') _recordUndoChange();
}

/**
 * טוענת את מצב טבלת השק"ם לשבוע ושנה נתונים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
async function loadShekemTables(week, year) {
  if (typeof generateTimeSlots !== 'function') return;
  const tbody = document.getElementById('body-shekem');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  generateTimeSlots('body-shekem'); 
  resetHadragOrShekemTable(tbody);

  const sKey = `shekemData_body-shekem_week${week}_year${year}`;
  const tableData = (typeof DataService !== 'undefined')
    ? await DataService.getItem(sKey)
    : JSON.parse(localStorage.getItem(sKey) || 'null');
  if (!tableData) { await updatePlatoonGridConflictHighlight(['body-shekem'], 'shekemData'); return; }

  for (let r = 0; r < 36; r++) {
    for (let c = 0; c < 7; c++) {
      const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
      if (!cell) continue;
      
      const data = tableData[`${r}_${c}`];
      if (data) {
        const textarea = cell.querySelector('textarea');
        if (textarea) {
          textarea.value = data.val || '';
          textarea.style.height = '100%';
        }
        cell.rowSpan = data.span || 1;
        cell.style.display = data.disp || '';
        if (data.classes) data.classes.forEach(cls => cell.classList.add(cls));
        if (data.reqId) cell.dataset.reqId = data.reqId; else delete cell.dataset.reqId;
      }
    }
  }
  await updatePlatoonGridConflictHighlight(['body-shekem'], 'shekemData');
}

/* =========================================================
   שיבוץ ישיר למנהל (חדר"ג + שק"ם)
========================================================= */

/**
 * מיועדת לשיבוץ ישיר של מנהל בטבלאות חדר"ג או שק"ם ללא הגשת בקשה מוקדמת.
 * @param {string} type - סוג הטבלה ('hadrag' / 'shekem')
 */
function addDirectEntry(type) {
  const unitClass = document.getElementById('directUnit').value;
  const text = document.getElementById('directText').value.trim();
  const day = parseInt(document.getElementById('directDay').value);
  const startTime = document.getElementById('directStart').value;
  const endTime = document.getElementById('directEnd').value;
  
  let tbodyId = '';
  if (type === 'hadrag') {
    const facility = document.getElementById('directFacility').value;
    tbodyId = 'body-' + facility;
  } else {
    tbodyId = 'body-shekem';
  }

  if (!text || !startTime || !endTime) { alert('יש למלא את כל השדות לשיבוץ הישיר.'); return; }
  if (startTime >= endTime) { alert('שעת הסיום צריכה להיות מאוחרת משעת ההתחלה.'); return; }

  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const startRow = timeToRowIndex(startTime);
  const endRow = Math.max(startRow, timeToRowIndex(endTime) - 1);

  let hasConflict = false;
  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${day}"]`);
    if (!cell) continue;
    if (cell.style.display === 'none' || cell.rowSpan > 1 || cell.classList.contains('merged') || ALL_COLOR_CLASSES.some(cls => cell.classList.contains(cls))) {
      hasConflict = true;
    }
    const input = cell.querySelector('textarea');
    if (input && input.value.trim() !== '') hasConflict = true;
  }

  if (hasConflict) {
    alert('⚠️ אי אפשר לשבץ: השעות המבוקשות כבר תפוסות בטבלה. פנה אותן תחילה (קליק ימני).');
    return;
  }

  const firstCell = tbody.querySelector(`td.platoon-cell[data-row="${startRow}"][data-col="${day}"]`);
  if (!firstCell) return;

  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${day}"]`);
    if (cell) {
      cell.style.display = (r === startRow) ? '' : 'none';
      cell.rowSpan = 1;
      cell.classList.remove('merged', ...ALL_COLOR_CLASSES);
    }
  }

  firstCell.rowSpan = (endRow - startRow + 1);
  const textarea = firstCell.querySelector('textarea');
  if (textarea) {
    textarea.style.height = '100%';
    textarea.value = text;
    firstCell.classList.add(unitClass); 
  }

  if (type === 'hadrag' && typeof saveHadragTables === 'function') saveHadragTables();
  if (type === 'shekem' && typeof saveShekemTables === 'function') saveShekemTables();
  if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
}

/* =========================================================
   מנגנון גרירה ומיזוג משבצות (Drag to Merge) - חדר"ג ושק"ם
========================================================= */
let isDragging = false;
let dragStartCell = null;
let dragStartRow = -1;
let dragCol = -1;

/**
 * מסימת את מצב הגרירה והמיזוג (Drag-to-Merge) ושומרת את שינויי הטבלאות.
 */
function stopDragging() {
  if (isDragging) {
    isDragging = false;
    dragStartCell = null;
    dragStartRow = -1;
    dragCol = -1;
    if (typeof saveHadragTables === 'function') saveHadragTables();
    if (typeof saveShekemTables === 'function') saveShekemTables();
    if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
  }
}

// 1. תחילת גרירה (לחיצה שמאלית)
document.addEventListener('mousedown', function(e) {
  if (e.button !== 0) return;
  if (isReadOnlyMode()) return;

  const cell = e.target.closest('td.platoon-cell');
  if (!cell) return;
  
  const ta = cell.querySelector('textarea');
  const hasContent = ta && ta.value.trim() !== '';
  const hasColor = ALL_COLOR_CLASSES.some(cls => cell.classList.contains(cls));

  if (!hasContent && !hasColor && cell.style.display !== 'none') {
    isDragging = true;
    dragStartCell = cell;
    dragStartRow = parseInt(cell.dataset.row);
    dragCol = parseInt(cell.dataset.col);
  }
});

// 2. מהלך הגרירה (הרחבת/צמצום הבלוק לפי מיקום העכבר בפועל - getRowIndexAtY, ולא mouseover
//    על תא ספציפי): mouseover לא נורה על כל שורה שהעכבר חולף מעליה בתזוזה מהירה אמיתית - הוא
//    יורה רק על התא שהעכבר נמצא מעליו *באירוע האחרון שנקלט*, מדלג על כל מה שבין לבין. הקוד
//    הישן הסתיר (display:none) רק את התא שקיבל את אירוע ה-mouseover האחרון וקבע rowSpan גדול
//    על תא ההתחלה שמכסה גם שורות שמעולם לא עברו עיבוד משלהן - נשארות `<td>` נפרדות, גלויות,
//    בתוך טווח שכבר "מכוסה" ע"י rowSpan של תא קודם, מבנה טבלה לא-חוקי שגורם לדפדפן לרנדר
//    תא רפאים/עמודה נוספת (דיווח משתמש + סרטון מסך - נראה כ"עמודה/שורה מיותרת נוספה").
//    getRowIndexAtY מודדת מול עמודת השעה (תמיד גלויה), ומעדכנת את כל טווח השורות בכל אירוע -
//    בלי תלות בכמה שורות העכבר "דילג" ביניהן.
function updateHadragDragExtent(clientY) {
  const tbody = dragStartCell.closest('tbody');
  let targetRow = getRowIndexAtY(tbody, clientY);
  if (targetRow === -1) return;
  if (targetRow < dragStartRow) targetRow = dragStartRow;

  const prevSpan = dragStartCell.rowSpan || 1;
  const prevEndRow = dragStartRow + prevSpan - 1;

  // קביעת הטווח התקף בפועל: עוצרים בשורה הראשונה שכבר תפוסה (שיבוץ אחר עם rowSpan>1, טקסט
  // או צבע) שעדיין לא הייתה חלק מהבלוק הזה בגרירה הנוכחית (r <= prevEndRow = כבר "שלנו").
  let maxValidRow = dragStartRow;
  for (let r = dragStartRow + 1; r <= targetRow; r++) {
    const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${dragCol}"]`);
    if (!c) break;
    if (r > prevEndRow) {
      const ta = c.querySelector('textarea');
      const hasContent = ta && ta.value.trim() !== '';
      const hasColor = ALL_COLOR_CLASSES.some(cls => c.classList.contains(cls));
      if (c.rowSpan > 1 || hasContent || hasColor) break;
    }
    maxValidRow = r;
  }

  // משחררים תאים שהיו חלק מהבלוק קודם בגרירה הזו אבל כבר לא בטווח החדש (למשל גררו למטה ואז חזרה למעלה)
  for (let r = prevEndRow; r > maxValidRow; r--) {
    const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${dragCol}"]`);
    if (c) { c.style.display = ''; c.rowSpan = 1; }
  }

  // מסתירים את כל התאים בטווח הסופי (אידמפוטנטי - לא משנה כמה שורות דולגו באירוע האחרון)
  for (let r = dragStartRow + 1; r <= maxValidRow; r++) {
    const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${dragCol}"]`);
    if (c) c.style.display = 'none';
  }

  const newSpan = maxValidRow - dragStartRow + 1;
  dragStartCell.rowSpan = newSpan;
  dragStartCell.classList.toggle('merged', newSpan > 1);

  const startTa = dragStartCell.querySelector('textarea');
  if (startTa) startTa.style.height = '100%';
}

document.addEventListener('mousemove', function(e) {
  if (!isDragging || !dragStartCell) return;
  updateHadragDragExtent(e.clientY);
});

// 3. סיום גרירה (עזיבת העכבר/פוקוס)
document.addEventListener('mouseup', stopDragging);
window.addEventListener('blur', stopDragging);

// *הערה: פונקציית הקליק הימני לביטול (contextmenu) כבר מובנית בקבצי ה-HTML של החדר"ג והשק"ם.
/* ================================
   אתחול (בעת עליית העמוד)
================================ */
window.onload = function () {
  // שומר כניסה: ללא סשן פעיל - הפניה למסך ההתחברות (אפיון חלק 3)
  if (typeof AUTH !== 'undefined' && !AUTH.requireAuth()) return;

  // חסימת גישה ישירה (הקלדת URL/מועדפים) לעמוד יחידה שאינה שייכת למשתמש הפלוגתי המחובר -
  // בעבר requireAuth בדק רק שקיים סשן כלשהו, בלי לבדוק שהעמוד הנוכחי מותר לתפקיד/יחידה שלו
  // (הסתרת הקישור בתפריט הצדדי/בעמוד הראשי לא מנעה גישה ישירה ל-URL). פרצת הרשאות (אפיון QA).
  if (typeof AUTH !== 'undefined' && !AUTH.canViewUnitPage()) {
    window.location.replace('index.html');
    return;
  }

  // משתמשים בשבוע שהמשתמש צפה בו לאחרונה (אם קיים באותה כרטיסייה/סשן) במקום לאפס תמיד
  // לשבוע הקלנדרי האמיתי - כדי שמעבר בין טבלאות ישמור על אותו שבוע (אפיון QA).
  const viewed = loadViewedWeek();
  const { week, year } = viewed || getCurrentWeekAndYear();
  currentWeek = week;
  currentYear = year;

  renderNavbars();
  // renderNavbars() בונה את סרגל הקטגוריות (קשר/אופטיקה/...) מחדש לפי שם הקובץ בלבד,
  // ולכן בעמודי יחידה (esuk/hirg/pikud/tazam/bahalag) היא תמיד מאבדת את סימון ה"active"
  // שנקבע קודם לכן (ב-DOMContentLoaded של העמוד) - כי היא לא מכירה את currentCategory
  // הפנימי של העמוד. לכן צריך להחיל שוב את הסימון אחרי שהניווט המשותף עלה מחדש.
  if (typeof updateCategoryView === 'function') updateCategoryView();
  applyPermissions();
  initTableListeners();
  initTopicExpansion();
  initDynamicRows();
  initWeekInput();

  Promise.resolve(updateUIForWeek()).then(() => {
    if (typeof resetUndoHistory === 'function') resetUndoHistory();
    applyPermissions();
  });

  if (typeof DataService !== 'undefined') {
    DataService.startAutoSync(async () => {
      // מרכז ההתראות (🔔) לא נוגע בשדות עריכה בכלל, אז מרעננים אותו תמיד בכל מחזור - גם
      // כשהמשתמש באמצע הקלדה בטבלה אחרת (בניגוד ל-updateUIForWeek למטה, שנדחית במקרה הזה).
      if (typeof refreshNotifications === 'function') await refreshNotifications();

      // מרעננים גם את מטמון הנתונים המפורסמים של טבלאות המשנה (ראו הערה ליד הפונקציה) - זה
      // רק מעדכן ערכים במפתח localStorage, לא בונה מחדש DOM, אז בטוח לבצע גם תוך כדי הקלדה.
      if (typeof refreshSubTablePublishedCache === 'function') {
        await refreshSubTablePublishedCache();
        if (document.getElementById('keshertable')) checkRequirementChanges('keshertable');
        if (document.getElementById('optictable')) checkRequirementChanges('optictable');
      }
      if (typeof refreshRowListsCache === 'function') await refreshRowListsCache();

      // updateUIForWeek בונה מחדש את ה-HTML של הטבלאות מאפס (innerHTML), כולל התא הממוקד -
      // כשזה קורה תוך כדי שהמשתמש מקליד (הריענון האוטומטי רץ כל כמה שניות, ראו
      // CONFIG.SYNC_INTERVAL_MS), הפוקוס וההקלדה שלו "נתקעים"/נקטעים באמצע משפט, במיוחד
      // בתאים שלוקח יותר זמן להקליד לתוכם (כמו "נושא שבוע"). לכן מדלגים על מחזור הריענון
      // הזה כל עוד יש פוקוס בתוך שדה עריכה כלשהו - הריענון הבא (בעוד כמה שניות) ישלים את
      // הסנכרון ברגע שהמשתמש יעזוב את השדה (אפיון QA).
      const active = document.activeElement;
      const isEditingField = active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
      if (isEditingField) return;

      // אותה בעיה בדיוק קיימת כשתפריט הקליק-הימני של חדר"ג/שק"ם פתוח (או שגרירה/שינוי-גודל
      // באמצע ביצוע): קליק ימני לא ממקד input, אז הבדיקה למעלה לא תופסת את המקרה הזה - אם
      // המשתמש פותח את התפריט ולוקח לו כמה שניות לבחור פעולה, הריענון האוטומטי היה יכול
      // לבנות מחדש את הגריד באמצע ולהשאיר את currentCtxCell/resizeStartCell/draggedSourceCell
      // מצביעים על תא שכבר לא קיים בפועל - הפעולה (מחיקה/צביעה/הדבקה) נכשלת בשקט (אפיון QA).
      const ctxMenu = document.getElementById('custom-context-menu');
      const reqCtxMenu = document.getElementById('req-context-menu');
      const isContextMenuOpen = (ctxMenu && ctxMenu.style.display !== 'none' && ctxMenu.style.display !== '')
        || (reqCtxMenu && reqCtxMenu.style.display !== 'none' && reqCtxMenu.style.display !== '');
      // אותה בעיה קיימת גם בגריד הבקשות של היחידה (esuk/hirg/pikud/tazam/bahalag.html): בלוק
      // "ממתין לאישור" שנוצר/הוזז אבל עדיין לא נשמר קיים רק בזיכרון (hadragStagedBlocks/
      // shekemStagedBlocks) - רענון אוטומטי באמצע היה קורא מחדש מהאחסון (loadUnitRequestGridState)
      // ומאבד אותו בשקט, גם אם אין באותו רגע פוקוס בתוך שדה עריכה (למשל בין הגרירה לבין
      // תחילת ההקלדה, או תוך כדי גרירת בלוק קיים מהידית).
      const hasUnsavedReqGridBlocks = (typeof hadragStagedBlocks !== 'undefined' && hadragStagedBlocks.some(b => !b.reqId))
        || (typeof shekemStagedBlocks !== 'undefined' && shekemStagedBlocks.some(b => !b.reqId));
      const isGridInteractionActive = (typeof isDragging !== 'undefined' && isDragging)
        || (typeof isResizing !== 'undefined' && isResizing)
        || (typeof draggedHadragData !== 'undefined' && draggedHadragData)
        || (typeof reqGridDragMode !== 'undefined' && reqGridDragMode)
        || hasUnsavedReqGridBlocks;
      if (isContextMenuOpen || isGridInteractionActive) return;

      await updateUIForWeek();
    });
    // קריאה מיידית אחת בטעינה - כדי שהתראות שנוצרו במכשיר אחר יופיעו כבר בטעינה הראשונה,
    // ולא רק אחרי מחזור הרענון התקופתי הראשון (SYNC_INTERVAL_MS).
    if (typeof refreshNotifications === 'function') refreshNotifications();
  }

  window.addEventListener('storage', () => {
    checkRequirementChanges('keshertable');
    checkRequirementChanges('optictable');
    // הרחבה: נותנת נדנוד חי גם לחדר"ג/שק"ם/סטטוס ההפצה כשטאב אחר (אותו דפדפן) שינה נתונים -
    // בלי לטעון מחדש את הגריד הניתן לעריכה (שעלול לדרוס עריכה פעילה באמצע), רק מרעננת
    // תצוגות קריאה-בלבד (רשימות ממתינות) וסממנים (כפתור הפצה, התראות).
    if (typeof renderHadragPendingRequests === 'function') renderHadragPendingRequests();
    if (typeof renderShekemPendingRequests === 'function') renderShekemPendingRequests();
    if (typeof updateGlobalExportButtonStatus === 'function') updateGlobalExportButtonStatus();
    if (typeof updateNotifBadge === 'function') updateNotifBadge();
  });
};

/* =========================================================
   מנגנון בטל / בצע שוב (Undo / Redo) - אפיון 1.4
   מבוסס צילומי-מצב (snapshots) של שדות העריכה בעמוד.
========================================================= */
let _undoStack = [];
let _redoStack = [];
let _undoCurrentState = null;
let _undoSuppressed = false;
let _undoRecordTimer = null;
const UNDO_LIMIT = 100;

/**
 * ממפה כל שדה עריכה למפתח יציב שלא תלוי במיקום הגלובלי בעמוד (table-id + אינדקס מקומי בטבלה),
 * כך שהוספת/הסרת שורות בטבלה אחת (למשל בעת הדבקת שורה בסוף טבלה דינמית) לא "מזיזה" ומשבשת
 * את שיוך הערכים של שדות בטבלאות אחרות, ומאפשרת לבטל/לשחזר גם כשמספר השדות הכולל בעמוד השתנה.
 */
function _getUndoFieldMap() {
  const map = new Map();
  const seenPerTable = new Map();
  document.querySelectorAll('.cell-input, .task-input, .time-input').forEach(el => {
    const table = el.closest('table');
    const tableKey = (table && table.id) ? table.id : '_free';
    const idx = seenPerTable.get(tableKey) || 0;
    seenPerTable.set(tableKey, idx + 1);
    map.set(`${tableKey}#${idx}`, el);
  });
  return map;
}

// גריד המיזוג של חדר"ג/שק"ם (גרירה/מיזוג/שינוי גודל/הדבקה/תפריט קליק ימני) לא היה מכוסה
// ע"י מנגנון הביטול/ביצוע-חוזר בכלל (רק שדות .cell-input/.task-input/.time-input) - כלומר
// מחיקה/הזזה בטעות בגריד לא הייתה ניתנת לשחזור. כל נתיבי העריכה בגריד עוברים בסופו של דבר
// דרך saveHadragTables/saveShekemTables, ולכן החיבור למנגנון הביטול נעשה שם (ראו למטה).
const UNDO_HADRAG_TABLE_IDS = ['body-chadrag', 'body-anafit8', 'body-anafit-bah', 'body-tavor'];
const UNDO_SHEKEM_TABLE_IDS = ['body-shekem'];

function _captureGridState(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return null;
  const cells = {};
  for (let r = 0; r < 36; r++) {
    for (let c = 0; c < 7; c++) {
      const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
      if (!cell) continue;
      const ta = cell.querySelector('textarea');
      cells[`${r}_${c}`] = {
        val: ta ? ta.value : '',
        span: cell.rowSpan,
        disp: cell.style.display,
        classes: Array.from(cell.classList).filter(cls => ['merged', ...PERSISTABLE_CELL_CLASSES].includes(cls)),
        reqId: cell.dataset.reqId || null
      };
    }
  }
  return cells;
}

function _applyGridState(tbodyId, cells) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody || !cells) return;
  for (let r = 0; r < 36; r++) {
    for (let c = 0; c < 7; c++) {
      const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
      if (!cell) continue;
      const data = cells[`${r}_${c}`] || { val: '', span: 1, disp: '', classes: [], reqId: null };
      const ta = cell.querySelector('textarea');
      if (ta) { ta.value = data.val || ''; ta.style.height = '100%'; }
      cell.rowSpan = data.span || 1;
      cell.style.display = data.disp || '';
      cell.className = 'platoon-cell';
      (data.classes || []).forEach(cls => cell.classList.add(cls));
      if (data.reqId) cell.dataset.reqId = data.reqId; else delete cell.dataset.reqId;
    }
  }
}

// שיבוץ מאושר בגריד חדר"ג/שק"ם מתויג ב-reqId המקשר אותו לרשומת בקשה נפרדת (hadragRequests/
// shekemRequests). ביטול/ביצוע-חוזר של הגריד לבדו (בלי הרשימות האלה) היה משאיר "רפאים": התא
// חוזר ויזואלית עם reqId שמצביע לרשומה שכבר נמחקה בפועל (למשל אחרי מחיקה+Ctrl+Z), כי המחיקה
// המקורית מסירה את הרשומה לצמיתות מהרשימה המשותפת - לכן חובה לתעד/לשחזר גם את הרשימות עצמן.
function _captureRequestsState() {
  const state = {};
  if (typeof getHadragRequestsKey === 'function') {
    const k = getHadragRequestsKey(currentWeek, currentYear);
    const raw = localStorage.getItem(k);
    if (raw !== null) state[k] = raw;
  }
  if (typeof getShekemRequestsKey === 'function') {
    const k = getShekemRequestsKey(currentWeek, currentYear);
    const raw = localStorage.getItem(k);
    if (raw !== null) state[k] = raw;
  }
  return state;
}

function _applyRequestsState(reqState) {
  let changed = false;
  Object.keys(reqState || {}).forEach(key => {
    if (localStorage.getItem(key) !== reqState[key]) {
      try {
        // עוברים דרך persist() (לא כתיבה ישירה ל-localStorage) כדי שהשחזור גם יתוזמן
        // לסנכרון מרוחק (SharePoint/רשת צבאית) במצב שרת, בדיוק כמו כל שמירה רגילה אחרת.
        persist(key, JSON.parse(reqState[key]));
      } catch (e) { /* ignore */ }
      changed = true;
    }
  });
  if (changed) {
    if (typeof renderHadragRequestsList === 'function') renderHadragRequestsList();
    if (typeof renderShekemRequestsList === 'function') renderShekemRequestsList();
    if (typeof renderHadragPendingRequests === 'function') renderHadragPendingRequests();
    if (typeof renderShekemPendingRequests === 'function') renderShekemPendingRequests();
  }
}

// צביעת תא חיפוקים (setCellColor ב-hipokim.html) היא מחלקת CSS על ה-wrapper, לא .value של
// שדה - לכן לא נתפסת ע"י _getUndoFieldMap/.task-input/.time-input, וללא הקוד הזה שינוי צבע
// בלבד לא היה ניתן לביטול (Ctrl+Z) בכלל.
function _captureHipokColorsState() {
  if (typeof ALL_HIPOK_COLORS === 'undefined') return null;
  const wrappers = document.querySelectorAll('#hipoktable .cell-wrapper');
  if (!wrappers.length) return null;
  const colors = {};
  wrappers.forEach((wrapper, i) => {
    colors[i] = ALL_HIPOK_COLORS.find(c => wrapper.classList.contains(c)) || '';
  });
  return colors;
}

function _applyHipokColorsState(colors) {
  if (!colors || typeof ALL_HIPOK_COLORS === 'undefined') return false;
  const wrappers = document.querySelectorAll('#hipoktable .cell-wrapper');
  if (!wrappers.length) return false;
  let changed = false;
  wrappers.forEach((wrapper, i) => {
    const target = colors[i] || '';
    const current = ALL_HIPOK_COLORS.find(c => wrapper.classList.contains(c)) || '';
    if (current !== target) {
      wrapper.classList.remove(...ALL_HIPOK_COLORS);
      if (target) wrapper.classList.add(target);
      changed = true;
    }
  });
  return changed;
}

// גריד הבקשות של היחידה (esuk/hirg/pikud/tazam/bahalag.html) שומר את הבלוקים ה"ממתינים" רק
// בזיכרון (hadragStagedBlocks/shekemStagedBlocks) עד שהם נשמרים כרשומה בפועל - לכן, בניגוד
// לגריד המיזוג של המנהל (_captureGridState, DOM-מבוסס) או לרשומות שכבר נשמרו (_captureRequestsState,
// localStorage-מבוסס), צריך תיעוד/שחזור ייעודי כאן שפשוט משכפל את מערכי הבלוקים עצמם.
function _captureReqGridState() {
  if (typeof hadragStagedBlocks === 'undefined') return null;
  return {
    hadrag: hadragStagedBlocks.map(b => ({ ...b })),
    shekem: shekemStagedBlocks.map(b => ({ ...b }))
  };
}

function _applyReqGridState(state) {
  if (!state || typeof hadragStagedBlocks === 'undefined') return false;
  const newHadrag = state.hadrag || [];
  const newShekem = state.shekem || [];
  const changed = JSON.stringify(hadragStagedBlocks) !== JSON.stringify(newHadrag)
    || JSON.stringify(shekemStagedBlocks) !== JSON.stringify(newShekem);
  if (changed) {
    hadragStagedBlocks = newHadrag.map(b => ({ ...b }));
    shekemStagedBlocks = newShekem.map(b => ({ ...b }));
    if (typeof paintUnitRequestGrid === 'function') {
      paintUnitRequestGrid('hadrag');
      paintUnitRequestGrid('shekem');
    }
  }
  return changed;
}

function _captureUndoState() {
  const state = { fields: {}, grid: {}, requests: {}, hipokColors: null, reqGrid: null };
  _getUndoFieldMap().forEach((el, key) => { state.fields[key] = el.value; });
  [...UNDO_HADRAG_TABLE_IDS, ...UNDO_SHEKEM_TABLE_IDS].forEach(tbodyId => {
    const g = _captureGridState(tbodyId);
    if (g) state.grid[tbodyId] = g;
  });
  state.requests = _captureRequestsState();
  state.hipokColors = _captureHipokColorsState();
  state.reqGrid = _captureReqGridState();
  return state;
}

function _applyUndoState(state) {
  const fieldMap = _getUndoFieldMap();
  _undoSuppressed = true;
  Object.keys(state.fields || {}).forEach(key => {
    const el = fieldMap.get(key);
    // אם השדה כבר לא קיים (השורה נמחקה בינתיים) - מדלגים עליו בלבד, לא נכשלים על כל הפעולה.
    if (el && el.value !== state.fields[key]) {
      el.value = state.fields[key];
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  const gridTables = Object.keys(state.grid || {});
  gridTables.forEach(tbodyId => _applyGridState(tbodyId, state.grid[tbodyId]));
  _applyRequestsState(state.requests);
  if (gridTables.length > 0) {
    if (typeof saveHadragTables === 'function') saveHadragTables();
    if (typeof saveShekemTables === 'function') saveShekemTables();
  }
  const hipokColorsChanged = _applyHipokColorsState(state.hipokColors);
  if (hipokColorsChanged) {
    if (typeof saveHipokData === 'function') saveHipokData();
    if (typeof updateHipokConflictHighlight === 'function' && typeof currentWeek !== 'undefined') {
      updateHipokConflictHighlight(currentWeek, currentYear);
    }
  }
  if (typeof _applyReqGridState === 'function') _applyReqGridState(state.reqGrid);
  _undoSuppressed = false;
  return true;
}

// מאפסת את ההיסטוריה ומגדירה את מצב הבסיס הנוכחי (נקרא בעת מעבר שבוע/טעינה).
function resetUndoHistory() {
  _undoStack = [];
  _redoStack = [];
  _undoCurrentState = _captureUndoState();
}

// רושמת שינוי (מדורג) - דוחפת את המצב הקודם למחסנית הביטול.
function _recordUndoChange() {
  if (_undoSuppressed) return;
  clearTimeout(_undoRecordTimer);
  _undoRecordTimer = setTimeout(() => {
    const newState = _captureUndoState();
    if (_undoCurrentState && JSON.stringify(newState) !== JSON.stringify(_undoCurrentState)) {
      _undoStack.push(_undoCurrentState);
      if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
      _redoStack = [];
    }
    _undoCurrentState = newState;
  }, 350);
}

// גרסה לא-מדורגת (ללא debounce) של _recordUndoChange - מיועדת לפעולות גריד בדידות ושלמות
// (גרירה, שינוי גודל, מחיקה, שינוי צבע, הדבקה, שיבוץ ישיר, אישור בקשה) בחדר"ג/שק"ם. בלי זה,
// כל הפעולות האלה עברו דרך אותו טיימר משותף של 350ms עם הקלדה בתיבות טקסט - כך שרצף טבעי של
// "גרור ליצירת בלוק ואז הקלד טקסט בתוכו" (נפוץ מאוד בשימוש בפועל) מתמזג לצעד ביטול אחד בלבד,
// וCtrl+Z נראה כאילו הוא "מבטל יותר מדי בבת אחת" או "לא עובד" (אפיון QA: תלונה על חדר"ג/שק"ם).
function _recordUndoChangeImmediate() {
  if (_undoSuppressed) return;
  clearTimeout(_undoRecordTimer);
  const newState = _captureUndoState();
  if (_undoCurrentState && JSON.stringify(newState) !== JSON.stringify(_undoCurrentState)) {
    _undoStack.push(_undoCurrentState);
    if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
    _redoStack = [];
  }
  _undoCurrentState = newState;
}

function doUndo() {
  if (isReadOnlyMode()) return;
  clearTimeout(_undoRecordTimer);
  // אם יש שינוי שטרם נרשם (בתוך זמן ההשהיה), נרשום אותו קודם.
  const live = _captureUndoState();
  if (_undoCurrentState && JSON.stringify(live) !== JSON.stringify(_undoCurrentState)) {
    _undoStack.push(_undoCurrentState);
    _undoCurrentState = live;
  }
  if (!_undoStack.length) return;
  const prev = _undoStack.pop();
  if (_applyUndoState(prev)) {
    _redoStack.push(_undoCurrentState);
    _undoCurrentState = prev;
    if (typeof saveCurrentWeek === 'function') saveCurrentWeek();
  }
}

function doRedo() {
  if (isReadOnlyMode()) return;
  clearTimeout(_undoRecordTimer);
  if (!_redoStack.length) return;
  const next = _redoStack.pop();
  if (_applyUndoState(next)) {
    _undoStack.push(_undoCurrentState);
    _undoCurrentState = next;
    if (typeof saveCurrentWeek === 'function') saveCurrentWeek();
  }
}

// רישום שינויים בעת הקלדה בשדות העריכה.
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el && el.classList && (el.classList.contains('cell-input') || el.classList.contains('task-input') || el.classList.contains('time-input'))) {
    _recordUndoChange();
  }
});

// קיצורי מקלדת: Ctrl+Z לביטול, Ctrl+Y או Ctrl+Shift+Z לביצוע חוזר.
document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;
  const key = e.key.toLowerCase();
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault();
    doUndo();
  } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
    e.preventDefault();
    doRedo();
  }
});

/* =========================================================
   בחירה מרובה + העתק/הדבק בלוק (אפיון 1.3)
   פועל על טבלאות גריד (.cell-input) בלבד - לא על טבלאות המיזוג (חדר"ג/שק"ם).
   משתמש באירועי copy/paste האמיתיים -> יציב, ומאפשר גם העתקה מ/אל Excel.
========================================================= */
let _msTable = null;
let _msAnchor = null;      // {r, c}
let _msFocus = null;       // {r, c}
let _msSelecting = false;
let _msRowMode = false;    // בחירת שורות שלמות (לחיצה על תא-השם)
let _blockClipboard = null;

function _isGridInput(el) {
  return el && el.classList && el.classList.contains('cell-input');
}
function _isMergeTable(table) {
  return !!(table && table.querySelector('td.platoon-cell'));
}
function _isGridTable(table) {
  return !!(table && table.querySelector('.cell-input') && !_isMergeTable(table));
}
function _cellCoord(input) {
  const tr = input.closest('tr');
  const tbody = tr.parentElement;
  const r = Array.from(tbody.rows).indexOf(tr);
  const inputs = Array.from(tr.querySelectorAll('.cell-input'));
  const c = inputs.indexOf(input);
  return { r, c, tbody };
}
function _inputAt(tbody, r, c) {
  const tr = tbody.rows[r];
  if (!tr) return null;
  const inputs = tr.querySelectorAll('.cell-input');
  return inputs[c] || null;
}
function _maxCols(tbody) {
  let m = 0;
  for (const tr of tbody.rows) {
    const n = tr.querySelectorAll('.cell-input').length;
    if (n > m) m = n;
  }
  return m;
}
function _clearRangeHighlight() {
  document.querySelectorAll('td.range-selected').forEach(td => td.classList.remove('range-selected'));
}
function _rangeBounds() {
  const tbody = _msTable.tBodies[0];
  const r1 = Math.min(_msAnchor.r, _msFocus.r), r2 = Math.max(_msAnchor.r, _msFocus.r);
  let c1, c2;
  if (_msRowMode) { c1 = 0; c2 = _maxCols(tbody) - 1; }
  else { c1 = Math.min(_msAnchor.c, _msFocus.c); c2 = Math.max(_msAnchor.c, _msFocus.c); }
  return { r1, r2, c1, c2 };
}
function _applyRangeHighlight() {
  _clearRangeHighlight();
  if (!_msTable || !_msAnchor || !_msFocus) return;
  const tbody = _msTable.tBodies[0];
  const { r1, r2, c1, c2 } = _rangeBounds();
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const inp = _inputAt(tbody, r, c);
      if (inp) inp.closest('td').classList.add('range-selected');
    }
    if (_msRowMode) {
      const nameCell = tbody.rows[r] && tbody.rows[r].querySelector('td.test');
      if (nameCell) nameCell.classList.add('range-selected');
    }
  }
}
function _hasSelection() {
  if (!_msTable || !_msAnchor || !_msFocus) return false;
  if (_msRowMode) return true;
  return _msAnchor.r !== _msFocus.r || _msAnchor.c !== _msFocus.c;
}

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest) return;

  // בחירת שורה שלמה: לחיצה על תא-השם (td.test) - למעט לחיצה על ידית הגרירה עצמה,
  // כדי לא לחסום את מנגנון גרירת השורות (dragstart) שמתחיל מאותו אלמנט (אפיון 1.6).
  if (e.target.closest('.row-drag-handle')) return;
  const nameCell = e.target.closest('td.test');
  if (nameCell) {
    const table = nameCell.closest('table');
    const tr = nameCell.closest('tr');
    if (table && _isGridTable(table) && tr) {
      const r = Array.from(table.tBodies[0].rows).indexOf(tr);
      _msTable = table; _msRowMode = true;
      if (e.shiftKey && _msAnchor) { _msFocus = { r, c: 0 }; }
      else { _msAnchor = { r, c: 0 }; _msFocus = { r, c: 0 }; }
      _msSelecting = true;
      _applyRangeHighlight();
      e.preventDefault();
      return;
    }
  }

  const inp = e.target.closest('.cell-input');
  if (!_isGridInput(inp)) return;
  const table = inp.closest('table');
  if (!table || _isMergeTable(table)) return;

  const coord = _cellCoord(inp);
  if (e.shiftKey && _msTable === table && _msAnchor) {
    _msRowMode = false;
    _msFocus = { r: coord.r, c: coord.c };
    _applyRangeHighlight();
    e.preventDefault();
    return;
  }
  _msTable = table;
  _msRowMode = false;
  _msAnchor = { r: coord.r, c: coord.c };
  _msFocus = { r: coord.r, c: coord.c };
  _msSelecting = true;
  _clearRangeHighlight();
});

document.addEventListener('mousemove', (e) => {
  if (!_msSelecting || !_msTable) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el || !el.closest) return;

  if (_msRowMode) {
    const nameCell = el.closest('td.test');
    if (!nameCell || nameCell.closest('table') !== _msTable) return;
    const tr = nameCell.closest('tr');
    const r = Array.from(_msTable.tBodies[0].rows).indexOf(tr);
    if (r !== _msFocus.r) {
      _msFocus = { r, c: 0 };
      e.preventDefault();
      window.getSelection && window.getSelection().removeAllRanges();
      _applyRangeHighlight();
    }
    return;
  }

  const inp = el.closest('.cell-input');
  if (!_isGridInput(inp) || inp.closest('table') !== _msTable) return;
  const coord = _cellCoord(inp);
  if (coord.r !== _msFocus.r || coord.c !== _msFocus.c) {
    _msFocus = { r: coord.r, c: coord.c };
    if (_hasSelection()) {
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      window.getSelection && window.getSelection().removeAllRanges();
      _applyRangeHighlight();
    }
  }
});

document.addEventListener('mouseup', () => {
  if (!_msSelecting) return;
  _msSelecting = false;
  if (!_hasSelection()) _clearRangeHighlight();
});

// בונה בלוק ערכים מהבחירה הנוכחית
function _selectionBlock() {
  const tbody = _msTable.tBodies[0];
  const { r1, r2, c1, c2 } = _rangeBounds();
  const block = [];
  for (let r = r1; r <= r2; r++) {
    const row = [];
    for (let c = c1; c <= c2; c++) {
      const inp = _inputAt(tbody, r, c);
      row.push(inp ? inp.value : '');
    }
    block.push(row);
  }
  return { block, startR: r1, startC: c1 };
}

// אירוע העתקה אמיתי - יציב יותר מיירוט keydown, ותומך בהעתקה ל-Excel
/**
 * עוטפת שדה TSV במרכאות (RFC4180-style) אם הוא מכיל טאב/ירידת שורה/מרכאה - כדי שהעתקה
 * של תוכן רב-שורתי (למשל textarea) תישאר ערך אחד תקין בהדבקה חוזרת (גם ל-Excel וגם חזרה
 * לתוך המערכת), במקום להישבר לכמה תאים/שורות.
 */
function _tsvEscapeField(val) {
  const s = val === undefined || val === null ? '' : String(val);
  if (/[\t\n"]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function _blockToTsv(block) {
  return block.map(row => row.map(_tsvEscapeField).join('\t')).join('\n');
}

document.addEventListener('copy', (e) => {
  if (!_hasSelection()) return;
  const { block } = _selectionBlock();
  _blockClipboard = block;
  const tsv = _blockToTsv(block);
  if (e.clipboardData) {
    e.clipboardData.setData('text/plain', tsv);
    e.preventDefault();
  }
});

document.addEventListener('cut', (e) => {
  if (isReadOnlyMode()) return;
  if (!_hasSelection()) return;
  const { block, startR, startC } = _selectionBlock();
  _blockClipboard = block;
  const tsv = _blockToTsv(block);
  if (e.clipboardData) { e.clipboardData.setData('text/plain', tsv); e.preventDefault(); }
  // ניקוי התאים שנגזרו
  const tbody = _msTable.tBodies[0];
  for (let i = 0; i < block.length; i++) {
    for (let j = 0; j < block[i].length; j++) {
      const inp = _inputAt(tbody, startR + i, startC + j);
      if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    }
  }
});

// אירוע הדבקה אמיתי - מפרק TSV (גם מ-Excel) או משתמש בבלוק הפנימי
/**
 * מפרשת טקסט TSV שהועתק (כולל מ-Excel) לבלוק דו-ממדי, עם תמיכה בשדות עטופים במרכאות
 * (RFC4180-style) שיכולים להכיל טאבים/ירידות שורה מוטבעות - כפי שאקסל עוטף תא שהתוכן שלו
 * כולל ירידת שורה. פיצול נאיבי לפי \t/\n (כפי שהיה קודם) היה מפצל תא כזה לכמה שורות/תאים
 * בטעות במקום לשמור אותו כערך אחד.
 * @param {string} text
 * @returns {string[][]}
 */
function parseTsvClipboard(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === '') { inQuotes = true; i++; continue; }
    if (ch === '\t') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  row.push(field);
  rows.push(row);
  while (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  return rows;
}

document.addEventListener('paste', (e) => {
  if (isReadOnlyMode()) { e.preventDefault(); return; }
  const active = document.activeElement;
  const inGrid = _isGridInput(active) && active.closest('table') && !_isMergeTable(active.closest('table'));
  if (!inGrid && !_hasSelection()) return;

  const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
  let block = null;
  if (text) {
    // יש טקסט בלוח (כולל מ-Excel): טקסט רב-תאי -> בלוק; ערך בודד -> הדבקה טבעית
    if (text.indexOf('\t') >= 0 || text.indexOf('\n') >= 0) {
      block = parseTsvClipboard(text);
    } else {
      return; // ערך בודד -> להשאיר להדבקה טבעית של הדפדפן
    }
  } else if (_blockClipboard && (_blockClipboard.length > 1 || (_blockClipboard[0] && _blockClipboard[0].length > 1))) {
    // גיבוי פנימי (למשל כשאין גישה ללוח המערכת)
    block = _blockClipboard;
  }
  if (!block) return;

  e.preventDefault();

  let tbody, startR, startC;
  if (inGrid) {
    const coord = _cellCoord(active);
    startR = coord.r; startC = coord.c;
    tbody = active.closest('table').tBodies[0];
  } else {
    const b = _rangeBounds();
    startR = b.r1; startC = b.c1;
    tbody = _msTable.tBodies[0];
  }

  for (let i = 0; i < block.length; i++) {
    for (let j = 0; j < block[i].length; j++) {
      const inp = _inputAt(tbody, startR + i, startC + j);
      if (inp) {
        inp.value = block[i][j];
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }
});

/* =========================================================
   חיווי מצב סנכרון נתונים (אפיון חלק 2)
========================================================= */
function updateSyncIndicator() {
  const chip = document.getElementById('sync-chip');
  if (!chip) return;
  if (typeof DataService === 'undefined' || typeof DataService.getSyncStatus !== 'function') {
    chip.style.display = 'none';
    return;
  }
  const s = DataService.getSyncStatus();
  chip.style.display = 'inline-flex';
  chip.classList.remove('sync-ok', 'sync-pending', 'sync-offline', 'sync-local', 'sync-disabled');

  if (!s.remote) { chip.classList.add('sync-local'); chip.textContent = '💾 מקומי'; return; }
  if (s.disabled) { chip.classList.add('sync-disabled'); chip.textContent = '⚪ שרת לא זמין'; return; }
  if (!s.online) { chip.classList.add('sync-offline'); chip.textContent = `🔴 לא מקוון${s.pending ? ` (${s.pending})` : ''}`; return; }
  if (s.pending > 0) { chip.classList.add('sync-pending'); chip.textContent = `🟡 מסנכרן… ${s.pending}`; return; }
  chip.classList.add('sync-ok'); chip.textContent = '🟢 מסונכרן';
}
if (typeof window !== 'undefined') window.updateSyncIndicator = updateSyncIndicator;

/* =========================================================
   מרכז התראות (Notification Center) - אפיון 1.8
========================================================= */
const NOTIF_KEY = 'pakadex_notifications';

function loadNotifications() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); }
  catch (e) { return []; }
}

// שמירה דרך persist() (DataService + סנכרון לשרת, ראו script.js:96) ולא localStorage ישיר -
// מרכז ההתראות הוא רשימה משותפת (הודעות כמו "המנהל הפיץ שינויים"/"פלוגה שמרה נתונים מוכנה
// לייבוא" מיועדות לכל המשתמשים, לא רק למכשיר שיצר אותן) ולכן חייבת להיות מסונכרנת בין
// מכשירים במצב שרת מרוחק (SharePoint/רשת צבאית), בדיוק כמו כל שאר נתוני האפליקציה.
function saveNotifications(list) {
  const trimmed = list.slice(-100);
  if (typeof persist === 'function') persist(NOTIF_KEY, trimmed);
  else localStorage.setItem(NOTIF_KEY, JSON.stringify(trimmed));
}

/**
 * מרעננת את מרכז ההתראות מהשרת (אם מוגדר) - כדי שהתראות שנוצרו במכשיר אחר (למשל "פלוגה
 * שמרה נתונים מוכנים לייבוא" שנוצרה בעמוד היחידה) יופיעו גם כאן. נקראת מהמחזור התקופתי
 * של DataService.startAutoSync (ראו window.onload), באותה תדירות שבה שאר הנתונים מתרעננים.
 */
async function refreshNotifications() {
  if (typeof fetchTableData !== 'function') return;
  const remote = await fetchTableData(NOTIF_KEY);
  if (!Array.isArray(remote)) return;
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(remote)); } catch (e) {}
  updateNotifBadge();
  const panel = document.getElementById('notif-panel');
  if (panel && panel.style.display !== 'none') renderNotifPanel();
}

/**
 * מוסיפה התראה חדשה למרכז ההתראות ומעדכנת את החיווי.
 */
function addNotification(message, type = 'info') {
  const list = loadNotifications();
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    message, type, ts: Date.now(), read: false
  });
  saveNotifications(list);
  updateNotifBadge();
}

function getUnreadCount() {
  return loadNotifications().filter(n => !n.read).length;
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const count = getUnreadCount();
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function _formatNotifTime(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const list = loadNotifications().slice().reverse();
  let body;
  if (list.length === 0) {
    body = '<div class="notif-empty">אין התראות</div>';
  } else {
    body = list.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}">
        <div class="notif-msg">${escapeHtml(n.message)}</div>
        <div class="notif-time">${_formatNotifTime(n.ts)}</div>
      </div>`).join('');
  }
  panel.innerHTML = `
    <div class="notif-header">
      <span>התראות</span>
      <button class="notif-clear" onclick="clearNotifications(event)">נקה הכל</button>
    </div>
    <div class="notif-list">${body}</div>`;
}

function toggleNotifPanel(e) {
  if (e) e.stopPropagation();
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
    return;
  }
  renderNotifPanel();
  panel.style.display = 'block';
  // סימון כל ההתראות כנקראו
  const list = loadNotifications();
  let changed = false;
  list.forEach(n => { if (!n.read) { n.read = true; changed = true; } });
  if (changed) { saveNotifications(list); }
  setTimeout(updateNotifBadge, 1500);
}

function clearNotifications(e) {
  if (e) e.stopPropagation();
  saveNotifications([]);
  renderNotifPanel();
  updateNotifBadge();
}

// סגירת הפאנל בלחיצה מחוץ אליו.
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notif-panel');
  if (!panel || panel.style.display === 'none') return;
  if (e.target.closest('.notif-wrap')) return;
  panel.style.display = 'none';
});

/* =========================================================
   הקצאות מתקדמות (חדר"ג, שק"ם, חיפוקים) לפי צבע יחידה
========================================================= */

function rowToTimeStr(r) {
  const hour = Math.floor(6 + r / 2).toString().padStart(2, '0');
  const minutes = r % 2 === 0 ? '00' : '30';
  return `${hour}:${minutes}`;
}

const DAYS_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HADRAG_TABLES_MAP = {
  'body-chadrag': 'חדר"ג',
  'body-anafit8': 'ענפית 1',
  'body-anafit-bah': 'ענפית בא"ח',
  'body-tavor': 'פיקוד 1'
};

async function getHadragAllocationsForUnit(unitColor, week, year) {
  const allocations = [];
  const tableIds = Object.keys(HADRAG_TABLES_MAP);

  for (const tableId of tableIds) {
    // הקצאות מוצגות ליחידה רק לאחר שהמנהל הפיץ בפועל - קוראים מה-published, לא מה-draft (אפיון QA)
    const key = `hadragData_${tableId}_week${week}_year${year}_published`;
    let data = null;
    if (typeof DataService !== 'undefined') {
      data = await DataService.getItem(key);
    } else {
      const saved = localStorage.getItem(key);
      if (saved) data = JSON.parse(saved);
    }

    if (!data) continue;

    for (let c = 0; c < 7; c++) {
      for (let r = 0; r < 36; r++) {
        const cellData = data[`${r}_${c}`];
        if (cellData && cellData.classes && cellData.classes.includes(unitColor)) {
          const span = cellData.span || 1;
          const startTime = rowToTimeStr(r);
          const endTime = rowToTimeStr(r + span);
          
          allocations.push({
            day: DAYS_NAMES[c],
            facility: HADRAG_TABLES_MAP[tableId],
            startTime: startTime,
            endTime: endTime,
            text: cellData.val || ''
          });
          
          r += (span - 1);
        }
      }
    }
  }
  return allocations;
}

async function getShekemAllocationsForUnit(unitColor, week, year) {
  const allocations = [];
  // הקצאות מוצגות ליחידה רק לאחר שהמנהל הפיץ בפועל - קוראים מה-published, לא מה-draft (אפיון QA)
  const key = `shekemData_body-shekem_week${week}_year${year}_published`;
  let data = null;
  if (typeof DataService !== 'undefined') {
    data = await DataService.getItem(key);
  } else {
    const saved = localStorage.getItem(key);
    if (saved) data = JSON.parse(saved);
  }

  if (!data) return allocations;

  for (let c = 0; c < 7; c++) {
    for (let r = 0; r < 36; r++) {
      const cellData = data[`${r}_${c}`];
      if (cellData && cellData.classes && cellData.classes.includes(unitColor)) {
        const span = cellData.span || 1;
        const startTime = rowToTimeStr(r);
        const endTime = rowToTimeStr(r + span);
        
        allocations.push({
          day: DAYS_NAMES[c],
          startTime: startTime,
          endTime: endTime,
          text: cellData.val || ''
        });
        
        r += (span - 1);
      }
    }
  }
  return allocations;
}

async function getHipokimAllocationsForUnit(unitColor, week, year) {
  const allocations = [];
  // הקצאות מוצגות ליחידה רק לאחר שהמנהל הפיץ בפועל - קוראים מה-published, לא מה-draft (אפיון QA)
  const key = getStorageKey('hipoktable', week, year) + '_published';
  let data = null;
  if (typeof DataService !== 'undefined') {
    data = await DataService.getItem(key);
  } else {
    const saved = localStorage.getItem(key);
    if (saved) data = JSON.parse(saved);
  }

  if (!data) return allocations;

  const DAY_LABELS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  // הטבלה ב-hipokim.html מכילה 12 שורות כפול 7 ימים = 84 תאים
  // אינדקסים 0-41 הם חיפוק יבש (6 שורות)
  // אינדקסים 42-83 הם חיפוק רטוב (6 שורות)
  for (let i = 0; i < 84; i++) {
    const taskColor = data[`color_${i}`] || '';
    if (taskColor === unitColor) {
      const typeText = i < 42 ? 'חיפוק יבש' : 'חיפוק רטוב';
      const dayIndex = i % 7;
      const dayText = DAY_LABELS[dayIndex] || '';
      
      const taskText = data[`task_${i}`] || '';
      const timeText = data[`time_${i}`] || '';
      
      const fullTask = typeText + (taskText ? ' - ' + taskText : '');
      
      allocations.push({
        task: fullTask,
        day: dayText,
        time: timeText
      });
    }
  }
  
  return allocations;
}

async function renderUnitHaktzaotExtra(tbodyId, type, unitColor) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';

  // צבע כותרת הטבלה לפי הקבוצה
  const colorInfo = (typeof UNIT_BG_MAP !== 'undefined' && UNIT_BG_MAP[unitColor]) || null;
  const theadThs = tbody.closest('table')?.querySelectorAll('thead th') || [];
  if (colorInfo) {
    theadThs.forEach(th => {
      th.style.backgroundColor = colorInfo.bg;
      th.style.color = colorInfo.text;
      th.style.borderColor = colorInfo.border;
    });
  }

  if (type === 'hadrag') {
    const allocations = await getHadragAllocationsForUnit(unitColor, currentWeek, currentYear);
    if (allocations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">אין נתונים לשבוע זה</td></tr>';
      return;
    }
    allocations.forEach(a => {
      tbody.innerHTML += `<tr>
        <td style="text-align:center; font-weight:bold;">${a.day}</td>
        <td style="text-align:center; font-weight:bold;">${a.facility}</td>
        <td style="text-align:center; font-weight:bold; direction:ltr;">${a.startTime} - ${a.endTime}</td>
        <td style="text-align:center;">${escapeHtml(a.text).replace(/\\n/g, '<br>')}</td>
      </tr>`;
    });
  } 
  else if (type === 'shekem') {
    const allocations = await getShekemAllocationsForUnit(unitColor, currentWeek, currentYear);
    if (allocations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">אין נתונים לשבוע זה</td></tr>';
      return;
    }
    allocations.forEach(a => {
      tbody.innerHTML += `<tr>
        <td style="text-align:center; font-weight:bold;">${a.day}</td>
        <td style="text-align:center; font-weight:bold; direction:ltr;">${a.startTime} - ${a.endTime}</td>
        <td style="text-align:center;">${escapeHtml(a.text).replace(/\\n/g, '<br>')}</td>
      </tr>`;
    });
  }
  else if (type === 'hipokim') {
    const allocations = await getHipokimAllocationsForUnit(unitColor, currentWeek, currentYear);
    if (allocations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">אין נתונים לשבוע זה</td></tr>';
      return;
    }
    allocations.forEach(a => {
      tbody.innerHTML += `<tr>
        <td style="text-align:center; font-weight:bold;">${a.day}</td>
        <td style="text-align:center; font-weight:bold;">${escapeHtml(a.task)}</td>
        <td style="text-align:center; font-weight:bold;">${escapeHtml(a.time)}</td>
      </tr>`;
    });
  }
}

/* =========================================================
   Excel-like Features: Drag & Drop, Copy & Paste
========================================================= */
let hadragClipboard = null;

function isHadragCell(cell) {
  return cell && cell.classList && cell.classList.contains('platoon-cell');
}

function clearHadragCellData(cell) {
  const tbody = cell.closest('tbody');
  const startRow = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);
  const span = cell.rowSpan || 1;
  const reqId = cell.dataset.reqId || null;

  cell.rowSpan = 1;
  cell.className = 'platoon-cell';
  delete cell.dataset.reqId;
  const ta = cell.querySelector('textarea');
  if (ta) {
    ta.value = '';
    ta.style.height = '100%';
  }

  for (let i = startRow + 1; i < startRow + span; i++) {
    const hiddenCell = tbody ? tbody.querySelector(`td.platoon-cell[data-row="${i}"][data-col="${col}"]`) : null;
    if (hiddenCell) {
      hiddenCell.style.display = '';
      hiddenCell.rowSpan = 1;
      hiddenCell.className = 'platoon-cell';
      delete hiddenCell.dataset.reqId;
      const hiddenTa = hiddenCell.querySelector('textarea');
      if (hiddenTa) hiddenTa.value = '';
    }
  }
  return reqId;
}

function pasteOrMoveBlock(targetCell, dataObj, preventOverwrite = false) {
  const tbody = targetCell.closest('tbody');
  const startRow = parseInt(targetCell.dataset.row);
  const col = parseInt(targetCell.dataset.col);
  const endRow = Math.min(35, startRow + dataObj.rowSpan - 1);
  const actualSpan = endRow - startRow + 1;
  
  if (preventOverwrite) {
    let hasConflict = false;
    for (let r = startRow; r <= endRow; r++) {
      const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
      if (!c) continue;
      if (c.style.display === 'none') { hasConflict = true; break; }
      const ta = c.querySelector('textarea');
      if (ta && ta.value.trim() !== '') { hasConflict = true; break; }
      if (typeof ALL_COLOR_CLASSES !== 'undefined' && ALL_COLOR_CLASSES.some(cls => c.classList.contains(cls))) { hasConflict = true; break; }
    }
    if (hasConflict) {
      alert('לא ניתן לבצע: השטח חופף לשיבוץ קיים. נא לפנות את השעות תחילה.');
      return false;
    }
  }
  
  // 1. Clear target space
  for (let r = startRow; r <= endRow; r++) {
    const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (c && c.style.display !== 'none') {
       const displacedReqId = clearHadragCellData(c);
       if (displacedReqId && typeof removeGridRequestLink === 'function') removeGridRequestLink(displacedReqId, tbody);
    }
  }
  
  // 2. Hide cells for merge
  for (let r = startRow + 1; r <= endRow; r++) {
    const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (c) {
      c.style.display = 'none';
      c.rowSpan = 1;
      c.className = 'platoon-cell';
    }
  }
  
  // 3. Apply data
  targetCell.rowSpan = actualSpan;
  targetCell.className = 'platoon-cell';
  targetCell.classList.add('merged');
  if (dataObj.cellClass) {
    dataObj.cellClass.forEach(cls => {
      if(cls !== 'merged' && cls !== 'platoon-cell') {
        targetCell.classList.add(cls);
      }
    });
  }
  
  const ta = targetCell.querySelector('textarea');
  if (ta) {
    ta.value = dataObj.text;
    ta.style.height = '100%';
  }

  if (typeof saveHadragTables === 'function') saveHadragTables();
  if (typeof saveShekemTables === 'function') saveShekemTables();
  if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
}

// 1. Copy and Paste (Ctrl+C, Ctrl+V)
document.addEventListener('keydown', function(e) {
  if (!e.ctrlKey) return;
  const activeElement = document.activeElement;
  let cell = null;
  
  if (typeof activeSelectedCell !== 'undefined' && activeSelectedCell) {
    cell = activeSelectedCell;
  } else if (activeElement && activeElement.tagName === 'TEXTAREA') {
    cell = activeElement.closest('td.platoon-cell');
  } else if (activeElement && isHadragCell(activeElement)) {
    cell = activeElement;
  }
  
  if (!cell) {
    const hoverEl = document.querySelector('td.platoon-cell:hover');
    if (hoverEl) cell = hoverEl;
  }
  if (!cell) return;
  
  if (e.code === 'KeyC' || e.key.toLowerCase() === 'c' || e.key === 'ב') {
    e.preventDefault();
    const ta = cell.querySelector('textarea');
    hadragClipboard = {
      text: ta ? ta.value : '',
      rowSpan: cell.rowSpan || 1,
      cellClass: Array.from(cell.classList).filter(c => c !== 'selected-cell' && c !== 'resize-handle' && c !== 'conflict-overlap')
    };
    cell.style.outline = '3px dashed #0284c7';
    cell.style.outlineOffset = '-3px';
    setTimeout(() => cell.style.outline = '', 600);
  } else if (e.code === 'KeyV' || e.key.toLowerCase() === 'v' || e.key === 'ה') {
    e.preventDefault();
    if (!hadragClipboard) return;
    pasteOrMoveBlock(cell, hadragClipboard, true);
    if (typeof selectCell === 'function') selectCell(cell);
  }
});

// 2. HTML5 Drag & Drop
let draggedHadragData = null;
let draggedSourceCell = null;
let dragPreviewElement = null;

document.addEventListener('mouseover', function(e) {
  const cell = e.target.closest('td.platoon-cell');
  if (cell && typeof isDragging !== 'undefined' && !isDragging) {
    const ta = cell.querySelector('textarea');
    const hasContent = ta && ta.value.trim() !== '';
    const hasColor = typeof ALL_COLOR_CLASSES !== 'undefined' && ALL_COLOR_CLASSES.some(cls => cell.classList.contains(cls));
    if (hasContent || hasColor) {
      cell.setAttribute('draggable', 'true');
    } else {
      cell.removeAttribute('draggable');
    }
  }
});

/**
 * מוצאת את אינדקס השורה (data-row) שבה נמצא Y נתון בתוך ה-tbody, לפי גבולות תא עמודת השעה
 * של כל שורה - מדויק יותר מ-e.target.closest, שעלול "לפספס" עקב תאים ממוזגים (rowSpan)
 * שמכסים חזותית כמה שורות עם td.platoon-cell בודד.
 */
function getRowIndexAtY(tbody, clientY) {
  if (!tbody) return -1;
  for (let i = 0; i < tbody.rows.length; i++) {
    const timeCell = tbody.rows[i].firstElementChild;
    if (timeCell) {
      const rect = timeCell.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return i;
    }
  }
  return -1;
}

document.addEventListener('dragstart', function(e) {
  const cell = e.target.closest('td.platoon-cell');
  if (!cell) return;

  // שומרים את השורה הספציפית (בתוך הבלוק המרובה-שורות) שבה המשתמש בפועל תפס את הגרירה -
  // כדי שבזמן ההטלה נשמור על אותו יחס, ולא תמיד "יקפוץ" ראש הבלוק למקום העכבר (אפיון QA:
  // "המשבצת תנחת בדיוק איפה שאני שם אותה").
  const tbody = cell.closest('tbody');
  const startRow = parseInt(cell.dataset.row);
  const grabbedRow = getRowIndexAtY(tbody, e.clientY);
  const grabOffset = grabbedRow !== -1 ? Math.max(0, grabbedRow - startRow) : 0;

  const ta = cell.querySelector('textarea');
  draggedHadragData = {
    text: ta ? ta.value : '',
    rowSpan: cell.rowSpan || 1,
    cellClass: Array.from(cell.classList),
    grabOffset: grabOffset
  };
  draggedSourceCell = cell;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'hadrag-cell');
  setTimeout(() => cell.style.opacity = '0.5', 0);
});

/**
 * מחשבת את שורת/עמודת ההתחלה שבהן ינחת הבלוק הנגרר אם ישוחרר עכשיו - לפי מיקום העכבר
 * בפועל בתוך ה-tbody, בהפחתת האופסט שבו נתפס הבלוק (grabOffset).
 */
function computeDragTarget(e) {
  const cell = e.target.closest('td.platoon-cell');
  if (!cell || !draggedHadragData) return null;
  const tbody = cell.closest('tbody');
  if (!tbody) return null;

  const col = parseInt(cell.dataset.col);
  const hoverRow = getRowIndexAtY(tbody, e.clientY);
  const baseRow = hoverRow !== -1 ? hoverRow : parseInt(cell.dataset.row);
  const startRow = Math.max(0, baseRow - (draggedHadragData.grabOffset || 0));
  const maxStartRow = tbody.rows.length - draggedHadragData.rowSpan;
  const clampedStartRow = Math.min(startRow, Math.max(0, maxStartRow));
  const endRow = Math.min(tbody.rows.length - 1, clampedStartRow + draggedHadragData.rowSpan - 1);

  return { tbody, col, startRow: clampedStartRow, endRow };
}

document.addEventListener('dragover', function(e) {
  const target = computeDragTarget(e);
  if (!target) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  // תצוגה מקדימה חיה (מסגרת ירוקה מקווקוות) של המקום המדויק שבו הבלוק ינחת - זהה בסגנון
  // לתצוגה המקדימה של גרירת ידית שינוי הגודל, כדי שהמשתמש יראה בבירור לפני השחרור.
  const startDom = target.tbody.querySelector(`td.platoon-cell[data-row="${target.startRow}"][data-col="${target.col}"]`);
  const endTr = target.tbody.rows[target.endRow];
  if (!startDom || !endTr) return;
  const startRect = startDom.getBoundingClientRect();
  const timeCellEnd = endTr.firstElementChild;
  if (!timeCellEnd) return;
  const endRect = timeCellEnd.getBoundingClientRect();

  if (!dragPreviewElement) {
    dragPreviewElement = document.createElement('div');
    dragPreviewElement.style.position = 'absolute';
    dragPreviewElement.style.border = '2px dashed #22c55e';
    dragPreviewElement.style.pointerEvents = 'none';
    dragPreviewElement.style.zIndex = '100';
    dragPreviewElement.style.background = 'rgba(34, 197, 94, 0.15)';
    document.body.appendChild(dragPreviewElement);
  }
  dragPreviewElement.style.top = startRect.top + window.scrollY + 'px';
  dragPreviewElement.style.left = startRect.left + window.scrollX + 'px';
  dragPreviewElement.style.width = startRect.width + 'px';
  dragPreviewElement.style.height = (endRect.bottom - startRect.top) + 'px';
});

document.addEventListener('dragend', function(e) {
  if (draggedSourceCell) draggedSourceCell.style.opacity = '1';
  if (dragPreviewElement) { dragPreviewElement.remove(); dragPreviewElement = null; }
  draggedHadragData = null;
  draggedSourceCell = null;
});

document.addEventListener('drop', function(e) {
  const target = computeDragTarget(e);
  if (!target || !draggedHadragData || !draggedSourceCell) return;
  e.preventDefault();
  if (dragPreviewElement) { dragPreviewElement.remove(); dragPreviewElement = null; }

  const targetCell = target.tbody.querySelector(`td.platoon-cell[data-row="${target.startRow}"][data-col="${target.col}"]`);
  if (!targetCell || targetCell === draggedSourceCell) return;

  const { startRow, endRow, col } = target;
  const srcStart = parseInt(draggedSourceCell.dataset.row);
  const srcEnd = srcStart + (draggedSourceCell.rowSpan || 1) - 1;
  const srcCol = parseInt(draggedSourceCell.dataset.col);

  let hasConflict = false;
  for (let r = startRow; r <= endRow; r++) {
    if (col === srcCol && r >= srcStart && r <= srcEnd) continue;

    const c = target.tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (!c) continue;
    if (c.style.display === 'none') { hasConflict = true; break; }
    const ta = c.querySelector('textarea');
    if (ta && ta.value.trim() !== '') { hasConflict = true; break; }
    if (typeof ALL_COLOR_CLASSES !== 'undefined' && ALL_COLOR_CLASSES.some(cls => c.classList.contains(cls))) { hasConflict = true; break; }
  }

  if (hasConflict) {
    alert('לא ניתן להזיז: השטח חופף לשיבוץ קיים.');
    return;
  }

  const movedReqId = clearHadragCellData(draggedSourceCell);
  pasteOrMoveBlock(targetCell, draggedHadragData, false);
  if (movedReqId && typeof relinkGridRequestToCell === 'function') relinkGridRequestToCell(movedReqId, targetCell);
  if (typeof saveHadragTables === 'function') saveHadragTables();
  if (typeof saveShekemTables === 'function') saveShekemTables();
});

/* =========================================================
   Excel-like Selection and Resizing Handle
========================================================= */
let activeSelectedCell = null;
let isResizing = false;
let resizeStartCell = null;
let resizeCurrentRow = -1;
let _resizePreviewCells = [];

function clearSelection() {
  if (activeSelectedCell) {
    activeSelectedCell.classList.remove('selected-cell');
    const handle = activeSelectedCell.querySelector('.resize-handle');
    if (handle) handle.remove();
    activeSelectedCell = null;
  }
}

function selectCell(cell) {
  if (!cell || cell === activeSelectedCell) return;
  clearSelection();
  
  activeSelectedCell = cell;
  cell.classList.add('selected-cell');
  
  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  handle.addEventListener('mousedown', startResize);
  handle.addEventListener('click', e => e.stopPropagation());
  
  cell.appendChild(handle);
}

document.addEventListener('mousedown', function(e) {
  if (e.target.classList.contains('resize-handle')) return;
  
  const cell = e.target.closest('td.platoon-cell');
  if (cell) {
    selectCell(cell);
  } else {
    clearSelection();
  }
});

function startResize(e) {
  if (isReadOnlyMode()) return;
  e.preventDefault();
  e.stopPropagation();

  if (!activeSelectedCell) return;

  isResizing = true;
  resizeStartCell = activeSelectedCell;

  updateResizePreview(e);
}

document.addEventListener('mousemove', function(e) {
  if (!isResizing || !resizeStartCell) return;
  
  const tbody = resizeStartCell.closest('tbody');
  
  for (let i = 0; i < tbody.rows.length; i++) {
    const tr = tbody.rows[i];
    const timeCell = tr.firstElementChild;
    if (timeCell) {
      const rect = timeCell.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        resizeCurrentRow = i;
        break;
      }
    }
  }
  
  const startRow = parseInt(resizeStartCell.dataset.row);
  if (resizeCurrentRow < startRow && resizeCurrentRow !== -1) {
    resizeCurrentRow = startRow;
  }
  
  updateResizePreview(e);
});

/**
 * מציגה תצוגה מקדימה של טווח שינוי-הגודל, ע"י סימון (outline) על תאי הטבלה האמיתיים
 * בטווח - במקום אלמנט ריחוף (position:absolute) שממוקם ידנית לפי getBoundingClientRect().
 * הגישה הקודמת חישבה מיקום/גודל פעם אחת בכל mousemove ע"פ קואורדינטות מסך, וכשהקונטיינר
 * המכיל את הטבלאות זז (גלילה אופקית פנימית + zoom:70% יחד) המיקום המחושב לא תמיד הספיק
 * להתעדכן בזמן, מה שגרם ל"תיבת תצוגה מקדימה רפאים" שנראתה כאילו שורה/עמודה נוספת נוצרה
 * בטבלה סמוכה (דיווח משתמש + סרטון מסך). סימון ישיר על התאים האמיתיים דרך outline (לא
 * border, כדי לא לשנות את מידות התא/הטבלה) חסין לחלוטין לבעיה הזו - אין חישוב מיקום ידני,
 * רק CSS class על אלמנטים שכבר ממוקמים נכון ע"י מנוע הטבלה של הדפדפן.
 */
function updateResizePreview(e) {
  if (!resizeStartCell) return;

  _resizePreviewCells.forEach(c => c.classList.remove('resize-preview-cell'));
  _resizePreviewCells = [];

  const startRow = parseInt(resizeStartCell.dataset.row);
  let endRow = resizeCurrentRow !== -1 ? resizeCurrentRow : (startRow + resizeStartCell.rowSpan - 1);
  if (endRow < startRow) endRow = startRow;

  const tbody = resizeStartCell.closest('tbody');
  const col = parseInt(resizeStartCell.dataset.col);

  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (!cell) continue;
    cell.classList.add('resize-preview-cell');
    _resizePreviewCells.push(cell);
  }
}

function clearResizePreview() {
  _resizePreviewCells.forEach(c => c.classList.remove('resize-preview-cell'));
  _resizePreviewCells = [];
}

document.addEventListener('mouseup', function(e) {
  if (!isResizing || !resizeStartCell) return;

  clearResizePreview();

  isResizing = false;

  const startRow = parseInt(resizeStartCell.dataset.row);
  let newEndRow = resizeCurrentRow !== -1 ? resizeCurrentRow : (startRow + resizeStartCell.rowSpan - 1);
  if (newEndRow < startRow) newEndRow = startRow;
  
  const oldSpan = resizeStartCell.rowSpan || 1;
  const newSpan = newEndRow - startRow + 1;
  
  if (newSpan !== oldSpan) {
    const tbody = resizeStartCell.closest('tbody');
    const col = parseInt(resizeStartCell.dataset.col);

    // בהגדלת הבלוק (לא בהקטנה) - יש לבדוק שהשורות הנוספות פנויות, אחרת שינוי הגודל
    // עלול לדרוס בשקט שיבוץ קיים של יחידה אחרת (בשונה מהעברה בגרירה, שכבר בודקת זאת).
    let hasConflict = false;
    if (newSpan > oldSpan) {
      for (let r = startRow + oldSpan; r <= newEndRow; r++) {
        const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
        if (!c) continue;
        if (c.style.display === 'none') { hasConflict = true; break; }
        const taCheck = c.querySelector('textarea');
        if (taCheck && taCheck.value.trim() !== '') { hasConflict = true; break; }
        if (typeof ALL_COLOR_CLASSES !== 'undefined' && ALL_COLOR_CLASSES.some(cls => c.classList.contains(cls))) { hasConflict = true; break; }
      }
    }

    if (hasConflict) {
      alert('לא ניתן לשנות גודל: השטח חופף לשיבוץ קיים. נא לפנות את השעות תחילה.');
    } else {
      const ta = resizeStartCell.querySelector('textarea');
      const dataObj = {
        text: ta ? ta.value : '',
        rowSpan: newSpan,
        cellClass: Array.from(resizeStartCell.classList).filter(c => c !== 'platoon-cell' && c !== 'selected-cell' && c !== 'dragging' && c !== 'conflict-overlap')
      };

      const resizedReqId = clearHadragCellData(resizeStartCell);

      const targetCell = tbody.querySelector(`td.platoon-cell[data-row="${startRow}"][data-col="${col}"]`);
      if (targetCell) {
        pasteOrMoveBlock(targetCell, dataObj);
        selectCell(targetCell);
        if (resizedReqId && typeof relinkGridRequestToCell === 'function') relinkGridRequestToCell(resizedReqId, targetCell);

        if (typeof saveHadragTables === 'function') saveHadragTables();
        if (typeof saveShekemTables === 'function') saveShekemTables();
      }
    }
  }
  
  resizeStartCell = null;
  resizeCurrentRow = -1;
});

/* =========================================================
   Custom Context Menu
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const menuHTML = `
    <div id="custom-context-menu" style="display: none;">
      <button id="ctx-btn-copy">העתק שיבוץ</button>
      <button id="ctx-btn-paste">הדבק שיבוץ</button>
      <div class="ctx-divider"></div>
      <div class="ctx-colors-title">שנה יחידה:</div>
      <div class="ctx-colors-row">
        <div class="ctx-color-dot bg-esuk" data-color="bg-esuk" title="איסו&quot;ק"></div>
        <div class="ctx-color-dot bg-hirg" data-color="bg-hirg" title="חיר&quot;ג"></div>
        <div class="ctx-color-dot bg-pikud" data-color="bg-pikud" title="פיקוד"></div>
        <div class="ctx-color-dot bg-tazam" data-color="bg-tazam" title="תצ&quot;מ"></div>
        <div class="ctx-color-dot bg-maphat" data-color="bg-maphat" title="מפח&quot;ט"></div>
      </div>
      <div class="ctx-divider"></div>
      <button id="ctx-btn-delete">מחק שיבוץ</button>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', menuHTML);
  
  const ctxMenu = document.getElementById('custom-context-menu');
  let currentCtxCell = null;
  
  document.addEventListener('contextmenu', function(e) {
    if (isReadOnlyMode()) return;
    const cell = e.target.closest('td.platoon-cell');
    if (cell) {
      e.preventDefault();
      
      currentCtxCell = cell;
      selectCell(cell);
      
      ctxMenu.style.display = 'flex';
      
      let x = e.pageX;
      let y = e.pageY;
      
      if (x + ctxMenu.offsetWidth > window.innerWidth) {
        x -= ctxMenu.offsetWidth;
      }
      if (y + ctxMenu.offsetHeight > window.innerHeight) {
        y -= ctxMenu.offsetHeight;
      }
      
      ctxMenu.style.left = x + 'px';
      ctxMenu.style.top = y + 'px';
    } else {
      ctxMenu.style.display = 'none';
    }
  });
  
  document.addEventListener('click', function(e) {
    if (e.target.closest('#custom-context-menu')) return;
    if (ctxMenu) ctxMenu.style.display = 'none';
  });
  
  document.getElementById('ctx-btn-copy')?.addEventListener('click', function() {
    if (currentCtxCell) {
      const ta = currentCtxCell.querySelector('textarea');
      hadragClipboard = {
        text: ta ? ta.value : '',
        rowSpan: currentCtxCell.rowSpan || 1,
        cellClass: Array.from(currentCtxCell.classList).filter(c => c !== 'selected-cell' && c !== 'resize-handle' && c !== 'dragging' && c !== 'conflict-overlap')
      };
      currentCtxCell.style.outline = '3px dashed #0284c7';
      currentCtxCell.style.outlineOffset = '-3px';
      setTimeout(() => currentCtxCell.style.outline = '', 600);
    }
    ctxMenu.style.display = 'none';
  });

  document.getElementById('ctx-btn-paste')?.addEventListener('click', function() {
    if (currentCtxCell && typeof hadragClipboard !== 'undefined' && hadragClipboard) {
      pasteOrMoveBlock(currentCtxCell, hadragClipboard, true);
      if (typeof selectCell === 'function') selectCell(currentCtxCell);
    }
    ctxMenu.style.display = 'none';
  });
  
  document.getElementById('ctx-btn-delete')?.addEventListener('click', async function(e) {
    e.stopPropagation();
    if (currentCtxCell) {
      const tbodyForDelete = currentCtxCell.closest('tbody');
      const deletedReqId = clearHadragCellData(currentCtxCell);
      clearSelection();
      if (typeof saveHadragTables === 'function') saveHadragTables();
      if (typeof saveShekemTables === 'function') saveShekemTables();
      if (deletedReqId && typeof removeGridRequestLink === 'function') await removeGridRequestLink(deletedReqId, tbodyForDelete);
      if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
    }
    ctxMenu.style.display = 'none';
  });
  
  document.querySelectorAll('.ctx-color-dot').forEach(dot => {
    dot.addEventListener('click', function(e) {
      e.stopPropagation();
      if (currentCtxCell) {
        const colors = ['bg-esuk', 'bg-hirg', 'bg-pikud', 'bg-tazam', 'bg-maphat', 'imported', 'conflict-overlap'];
        colors.forEach(c => currentCtxCell.classList.remove(c));
        currentCtxCell.classList.add(this.dataset.color);
        
        clearSelection();

        if (typeof saveHadragTables === 'function') saveHadragTables();
        if (typeof saveShekemTables === 'function') saveShekemTables();
        if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
      }
      ctxMenu.style.display = 'none';
    });
  });
  // Track manual edits in manager tables and highlight orange if different from published
  document.addEventListener('input', async function(e) {
    if (e.target && e.target.classList.contains('cell-input')) {
      const table = e.target.closest('table');
      if (!table) return;
      const tableId = table.id;
      // בטבלאות המשולבות (קשר/אופטיקה) הקלדה ישירה של המנהל לא אמורה לסמן/לבטל סימון כתום על
      // תא ספציפי - הסימון שם נקבע אך ורק ע"י פעולת ייבוא מתת-טבלת יחידה (importFromSubTable),
      // כדי שהכתום ישקף "יש דרישה מיובאת שטרם הופצה" ולא "המנהל הקליד משהו" (אפיון QA).
      // כן מעדכנים את סטטוס כפתור "הפץ שינויים" (אדום/ירוק) - זהו סממן גלובלי ל"האם יש בכלל
      // משהו שלא הופץ", וצריך לשקף גם עריכה ישירה של המנהל, לא רק ייבוא (אפיון QA).
      if (MASTER_COMBINED_TABLES.includes(tableId)) {
        if (typeof updateGlobalExportButtonStatus === 'function') await updateGlobalExportButtonStatus();
        return;
      }
      if (MANAGER_TRACKED_TABLES.includes(tableId)) {
        const td = e.target.closest('td');
        if (!td) return;

        // אינדקס לפי סדר המסמך בפועל בתוך .cell-input (זהה למנגנון readTableData/הפרסום) -
        // ולא חישוב שורה*עמודה, שמתפספס בטבלאות עם תא נוסף שאינו קלט (כמו עמודת סה"כ).
        const globalIndex = Array.from(table.querySelectorAll('.cell-input')).indexOf(e.target);
        if (globalIndex < 0) return;

        const managerPublishedKey = getStorageKey(tableId, currentWeek, currentYear) + '_published';
        let managerPublishedData = {};
        if (typeof fetchTableData === 'function') {
          managerPublishedData = await fetchTableData(managerPublishedKey) || {};
        } else {
          managerPublishedData = JSON.parse(localStorage.getItem(managerPublishedKey) || '{}');
        }
        
        const publishedVal = managerPublishedData[globalIndex] || '';
        if (e.target.value !== publishedVal) {
          td.classList.add('conflict-overlap');
        } else {
          td.classList.remove('conflict-overlap');
        }
      }
    }
  });
});
