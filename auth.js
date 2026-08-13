/* =========================================================
   AUTH.JS - התחברות, משתמשים והרשאות (אפיון חלק 3)
   -----------------------------------------------------------
   כניסה למערכת מבוססת מספר אישי (מותאם לקורא כרטיסים המדמה מקלדת).
   מודל ההרשאות לפי האפיון:
     admin    - מנהל: צפייה ועריכה בכל הטבלאות + מסך ניהול הרשאות
     editor   - צפייה ועריכה: כמו מנהל, אך חסום ממסך ניהול ההרשאות
     readonly - צפייה בלבד: ללא עריכה, שמירה או שינוי
     unit     - פלוגתי: עורך אך ורק את עמוד היחידה שלו,
                וצופה בטבלאות המרכזיות בקריאה בלבד
   רשימת המשתמשים נשמרת דרך DataService (localStorage + סנכרון לשרת).
========================================================= */

const AUTH = {
  USERS_KEY: 'pakadex_users',
  SESSION_KEY: 'pakadex_session',

  /** שמות התפקידים לתצוגה */
  ROLES: {
    admin:    'מנהל',
    editor:   'צפייה ועריכה',
    readonly: 'צפייה בלבד',
    unit:     'פלוגתי / יחידתי'
  },

  /** היחידות במערכת (למשתמש פלוגתי) */
  UNITS: {
    esuk:    'בא"ח איסו"ק',
    hirg:    'בא"ח חיר"ג',
    pikud:   'גדוד הפיקוד',
    tazam:   'ענף תצ"מ',
    bahalag: 'מפח"ט'
  },

  /** מיפוי עמוד יחידה -> מזהה יחידה */
  PAGE_UNIT: {
    'esuk.html':    'esuk',
    'hirg.html':    'hirg',
    'pikud.html':   'pikud',
    'tazam.html':   'tazam',
    'bahalag.html': 'bahalag'
  },

  /* =========================================================
     מאגר המשתמשים
  ========================================================= */

  /** קריאה מיידית (סינכרונית) מהמטמון המקומי */
  loadUsers() {
    try {
      const raw = localStorage.getItem(this.USERS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  },

  /** שמירה דרך שכבת הסנכרון (מקומי + שרת) */
  saveUsers(list) {
    if (typeof DataService !== 'undefined') {
      DataService.setItem(this.USERS_KEY, list);
    } else {
      try { localStorage.setItem(this.USERS_KEY, JSON.stringify(list)); } catch (e) {}
    }
  },

  /** רענון רשימת המשתמשים מהשרת (אם מוגדר) */
  async refreshUsers() {
    if (typeof DataService === 'undefined') return this.loadUsers();
    const remote = await DataService.getItem(this.USERS_KEY);
    if (Array.isArray(remote)) {
      try { localStorage.setItem(this.USERS_KEY, JSON.stringify(remote)); } catch (e) {}
      return remote;
    }
    return this.loadUsers();
  },

  /** נרמול מספר אישי (ספרות בלבד) - קורא הכרטיסים עלול להוסיף תווים */
  normalizePn(pn) {
    return String(pn == null ? '' : pn).replace(/\D/g, '');
  },

  findUser(pn) {
    const clean = this.normalizePn(pn);
    if (!clean) return null;
    return this.loadUsers().find(u => this.normalizePn(u.pn) === clean) || null;
  },

  /**
   * הוספה או עדכון של משתמש.
   * @returns {{ok:boolean, error?:string}}
   */
  saveUser(user) {
    const pn = this.normalizePn(user.pn);
    if (!pn) return { ok: false, error: 'מספר אישי חייב להכיל ספרות.' };
    if (!this.ROLES[user.role]) return { ok: false, error: 'תפקיד לא חוקי.' };
    if (user.role === 'unit' && !this.UNITS[user.unit]) {
      return { ok: false, error: 'למשתמש פלוגתי יש לבחור יחידה.' };
    }

    const record = {
      pn,
      name: (user.name || '').trim(),
      role: user.role,
      unit: user.role === 'unit' ? user.unit : ''
    };

    const list = this.loadUsers();
    const idx = list.findIndex(u => this.normalizePn(u.pn) === pn);
    if (idx >= 0) list[idx] = record; else list.push(record);
    this.saveUsers(list);
    return { ok: true, user: record };
  },

  /**
   * הסרת משתמש. לא ניתן להסיר את המנהל האחרון (כדי לא לנעול את המערכת).
   */
  removeUser(pn) {
    const clean = this.normalizePn(pn);
    const list = this.loadUsers();
    const target = list.find(u => this.normalizePn(u.pn) === clean);
    if (!target) return { ok: false, error: 'משתמש לא נמצא.' };

    if (target.role === 'admin' && list.filter(u => u.role === 'admin').length <= 1) {
      return { ok: false, error: 'לא ניתן להסיר את המנהל האחרון במערכת.' };
    }

    this.saveUsers(list.filter(u => this.normalizePn(u.pn) !== clean));
    return { ok: true };
  },

  /* =========================================================
     סשן
  ========================================================= */

  getSession() {
    try {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  setSession(user) {
    try { sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user)); } catch (e) {}
  },

  clearSession() {
    try { sessionStorage.removeItem(this.SESSION_KEY); } catch (e) {}
  },

  /**
   * התחברות לפי מספר אישי.
   * אתחול ראשוני: אם מאגר המשתמשים ריק, המשתמש הראשון שנכנס מוגדר כמנהל.
   * @returns {{ok:boolean, error?:string, user?:object, bootstrapped?:boolean}}
   */
  login(pn) {
    const clean = this.normalizePn(pn);
    if (!clean) return { ok: false, error: 'יש להזין מספר אישי.' };

    const users = this.loadUsers();

    if (users.length === 0) {
      const admin = { pn: clean, name: 'מנהל ראשי', role: 'admin', unit: '' };
      this.saveUsers([admin]);
      this.setSession(admin);
      return { ok: true, user: admin, bootstrapped: true };
    }

    const user = this.findUser(clean);
    if (!user) {
      return { ok: false, error: 'המספר האישי אינו מורשה לגישה. יש לפנות למנהל המערכת.' };
    }

    this.setSession(user);
    return { ok: true, user };
  },

  logout() {
    this.clearSession();
    window.location.href = 'login.html';
  },

  /* =========================================================
     בדיקות הרשאה
  ========================================================= */

  currentPage() {
    const raw = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return raw.split('?')[0].split('#')[0] || 'index.html';
  },

  role() {
    const s = this.getSession();
    return s ? s.role : null;
  },

  isAdmin() { return this.role() === 'admin'; },

  /** גישה למסך ניהול ההרשאות - מנהל בלבד */
  canManageUsers() { return this.isAdmin(); },

  /**
   * האם למשתמש המחובר יש הרשאת עריכה בעמוד הנתון.
   * @param {string} [page] - שם קובץ העמוד; ברירת מחדל: העמוד הנוכחי
   */
  canEditPage(page) {
    const s = this.getSession();
    if (!s) return false;
    const p = (page || this.currentPage()).toLowerCase();

    if (s.role === 'admin' || s.role === 'editor') return true;
    if (s.role === 'readonly') return false;

    if (s.role === 'unit') {
      // פלוגה עורכת אך ורק את עמוד היחידה שלה
      return this.PAGE_UNIT[p] === s.unit;
    }
    return false;
  },

  /** תיאור התפקיד לתצוגה (כולל שם היחידה לפלוגתי) */
  roleLabel(user) {
    const u = user || this.getSession();
    if (!u) return '';
    if (u.role === 'unit') return `${this.ROLES.unit} – ${this.UNITS[u.unit] || ''}`;
    return this.ROLES[u.role] || '';
  },

  /**
   * שומר כניסה: מפנה למסך ההתחברות אם אין סשן פעיל.
   * @returns {object|null} המשתמש המחובר, או null אם הופנה להתחברות
   */
  requireAuth() {
    const s = this.getSession();
    if (!s) {
      if (this.currentPage() !== 'login.html') {
        window.location.replace('login.html');
      }
      return null;
    }
    return s;
  }
};
