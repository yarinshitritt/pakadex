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
      try { localStorage.setItem(this.USERS_KEY, JSON.stringify(list)); } catch (e) {
        if (typeof window !== 'undefined' && typeof window._handleStorageWriteFailure === 'function') window._handleStorageWriteFailure(e);
      }
    }
  },

  /** רענון רשימת המשתמשים מהשרת (אם מוגדר) */
  async refreshUsers() {
    if (typeof DataService === 'undefined') return this.loadUsers();
    const remote = await DataService.getItem(this.USERS_KEY);
    if (Array.isArray(remote)) {
      try { localStorage.setItem(this.USERS_KEY, JSON.stringify(remote)); } catch (e) {
        if (typeof window !== 'undefined' && typeof window._handleStorageWriteFailure === 'function') window._handleStorageWriteFailure(e);
      }
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

    // תמיכה בהרשאה לכמה יחידות בו-זמנית (למשל גם מפח"ט וגם גדוד הפיקוד).
    const units = Array.isArray(user.unit) ? user.unit : (user.unit ? [user.unit] : []);
    const validUnits = units.filter(u => this.UNITS[u]);
    if (user.role === 'unit' && validUnits.length === 0) {
      return { ok: false, error: 'למשתמש פלוגתי יש לבחור לפחות יחידה אחת.' };
    }

    const record = {
      pn,
      name: (user.name || '').trim(),
      role: user.role,
      unit: user.role === 'unit' ? validUnits : []
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

  /**
   * ניסיון התחברות אוטומטית לפי זהות ה-Windows/AD המאומתת של המשתמש דרך SharePoint
   * (מפל"ז מבצע Smart Card Logon ל-Windows; SharePoint מאמת את הסשן אוטומטית מולו
   * דרך Windows Integrated Authentication - אין צורך בהזנת סיסמה נוספת בדפדפן).
   * פועל רק כאשר CONFIG.DATA_SOURCE === 'sharepoint' וכן CONFIG.SHAREPOINT.AUTO_LOGIN === true.
   * בכל מקרה כשל (לא בתוך SharePoint, שדה לא מוגדר, המספר לא נמצא ברשימת המשתמשים וכו')
   * מחזירה {ok:false} כדי לאפשר נפילה חזרה להזנה ידנית/קורא כרטיסים - לעולם לא "מנחשת" משתמש.
   * @returns {Promise<{ok:boolean, user?:object, error?:string}>}
   */
  async tryAutoLoginFromSharePoint() {
    if (typeof CONFIG === 'undefined' || CONFIG.DATA_SOURCE !== 'sharepoint') {
      return { ok: false, error: 'not-sharepoint' };
    }
    if (!CONFIG.SHAREPOINT.AUTO_LOGIN) {
      return { ok: false, error: 'auto-login-disabled' };
    }
    const propKey = CONFIG.SHAREPOINT.PN_PROFILE_KEY;
    if (!propKey) {
      console.warn('[AUTH] AUTO_LOGIN מופעל אך CONFIG.SHAREPOINT.PN_PROFILE_KEY אינו מוגדר.');
      return { ok: false, error: 'no-profile-key-configured' };
    }

    try {
      const url = `${CONFIG.SHAREPOINT.SITE_URL}/_api/SP.UserProfiles.PeopleManager/GetMyProperties?$select=UserProfileProperties`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json;odata=verbose' },
        credentials: 'same-origin'
      });
      if (!res.ok) {
        return { ok: false, error: `http-${res.status}` };
      }

      const data = await res.json();
      const props = (data && data.d && data.d.UserProfileProperties && data.d.UserProfileProperties.results) || [];
      const entry = props.find(p => p.Key === propKey);
      const pn = this.normalizePn(entry ? entry.Value : '');
      if (!pn) {
        return { ok: false, error: 'pn-not-found-in-profile' };
      }

      // login() בודק מול רשימת המשתמשים המורשית - אם המספר לא רשום, מוחזר ok:false כרגיל
      // (ולא נוצר "מנהל" חדש אוטומטית - bootstrap הראשוני חל רק בזרימת הכניסה הידנית).
      const user = this.findUser(pn);
      if (!user) {
        return { ok: false, error: 'pn-not-authorized' };
      }
      this.setSession(user);
      return { ok: true, user };
    } catch (e) {
      return { ok: false, error: 'network-error' };
    }
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
      // פלוגה עורכת אך ורק את עמודי היחידות שהוקצו לה (ייתכן יותר מיחידה אחת)
      const units = Array.isArray(s.unit) ? s.unit : (s.unit ? [s.unit] : []);
      return units.includes(this.PAGE_UNIT[p]);
    }
    return false;
  },

  /** תיאור התפקיד לתצוגה (כולל שמות היחידות לפלוגתי) */
  roleLabel(user) {
    const u = user || this.getSession();
    if (!u) return '';
    if (u.role === 'unit') {
      const units = Array.isArray(u.unit) ? u.unit : (u.unit ? [u.unit] : []);
      const names = units.map(x => this.UNITS[x]).filter(Boolean).join(', ');
      return `${this.ROLES.unit} – ${names}`;
    }
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
