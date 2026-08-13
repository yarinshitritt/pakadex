/* =========================================================
   SHAREPOINTSERVICE.JS - שכבת ניהול הנתונים והסנכרון של PAKADEX
   ========================================================= */

const DataService = {
  // מטמון מקומי בזיכרון לגישה מהירה
  _cache: {},
  // דגל לביטול ניסיונות SharePoint חוזרים בריצה מקומית שאינה מאומתת
  _sharePointDisabled: false,

  // --- מנגנון סנכרון היברידי (אפיון חלק 2) ---
  _syncQueue: {},                       // מפתח -> נתונים שממתינים לסנכרון לשרת
  _syncQueueKey: 'pakadex_sync_queue',  // התור נשמר גם ב-localStorage לשרידות רענון
  _lastSyncTs: null,
  _syncing: false,

  /** האם מוגדר שרת מרכזי (SharePoint / רשת צבאית) */
  _isRemote() {
    return CONFIG.DATA_SOURCE === 'sharepoint' || CONFIG.DATA_SOURCE === 'military_net';
  },

  /** שמירה בפועל מול השרת המרכזי המתאים */
  async _remoteSave(key, data) {
    if (CONFIG.DATA_SOURCE === 'sharepoint') return await this._saveToSharePoint(key, data);
    if (CONFIG.DATA_SOURCE === 'military_net') return await this._saveToMilitaryNet(key, data);
    return true;
  },

  /**
   * טעינת נתונים לפי מפתח (Key)
   */
  async getItem(key) {
    if (CONFIG.DATA_SOURCE === 'sharepoint') {
      return await this._loadFromSharePoint(key);
    } else if (CONFIG.DATA_SOURCE === 'military_net') {
      return await this._loadFromMilitaryNet(key);
    } else {
      // ברירת מחדל: LocalStorage
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    }
  },

  /**
   * שמירת נתונים לפי מפתח (Key) - מנגנון היברידי (אפיון חלק 2):
   * 1. שמירה מקומית מיידית ב-localStorage (גיבוי + מהירות תגובה).
   * 2. במצב שרת: ניסיון סנכרון אסינכרוני; כשל -> הכנסה לתור לניסיון חוזר.
   */
  async setItem(key, data) {
    // מעדכנים קודם כל במטמון וב-localStorage לגיבוי (סינכרוני, לפני כל await)
    this._cache[key] = data;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }

    if (!this._isRemote()) return true;

    let ok = false;
    if (navigator.onLine) {
      ok = await this._remoteSave(key, data);
    }
    if (ok) {
      this._lastSyncTs = Date.now();
      this._dequeue(key);
    } else {
      this._enqueue(key, data);
    }
    this._notifyStatus();
    return ok;
  },

  /* ---------- תור סנכרון (Offline Queue) ---------- */
  _loadQueue() {
    try { return JSON.parse(localStorage.getItem(this._syncQueueKey) || '{}'); }
    catch (e) { return {}; }
  },
  _persistQueue() {
    try { localStorage.setItem(this._syncQueueKey, JSON.stringify(this._syncQueue)); } catch (e) {}
  },
  _enqueue(key, data) {
    this._syncQueue[key] = data;
    this._persistQueue();
  },
  _dequeue(key) {
    if (Object.prototype.hasOwnProperty.call(this._syncQueue, key)) {
      delete this._syncQueue[key];
      this._persistQueue();
    }
  },
  pendingCount() { return Object.keys(this._syncQueue).length; },

  /** מנסה לשלוח את כל הפריטים הממתינים בתור לשרת */
  async flushQueue() {
    if (this._syncing || !this._isRemote() || !navigator.onLine || this._sharePointDisabled) return;
    this._syncing = true;
    try {
      const keys = Object.keys(this._syncQueue);
      for (const key of keys) {
        const ok = await this._remoteSave(key, this._syncQueue[key]);
        if (ok) { this._dequeue(key); this._lastSyncTs = Date.now(); }
        else break; // כנראה מנותקים - נעצור וננסה שוב בסבב הבא
      }
    } finally {
      this._syncing = false;
      this._notifyStatus();
    }
  },

  /** מחזיר את מצב הסנכרון הנוכחי (לחיווי בממשק) */
  getSyncStatus() {
    return {
      remote: this._isRemote(),
      online: navigator.onLine,
      pending: this.pendingCount(),
      lastSync: this._lastSyncTs,
      disabled: this._sharePointDisabled
    };
  },

  _notifyStatus() {
    if (typeof window !== 'undefined' && typeof window.updateSyncIndicator === 'function') {
      try { window.updateSyncIndicator(); } catch (e) {}
    }
  },

  /**
   * טעינה מ-SharePoint REST API
   */
  async _loadFromSharePoint(key) {
    if (this._sharePointDisabled) {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    }

    const fileName = `${key}.json`;
    const pathsToTry = [
      CONFIG.SHAREPOINT.FOLDER_PATH,
      '/sites/PakadexData/PakadexData',
      '/sites/PakadexData/Shared Documents/PakadexData'
    ];

    // הסרת כפילויות במערך
    const uniquePaths = [...new Set(pathsToTry.filter(Boolean))];

    for (const folderPath of uniquePaths) {
      const url = `${CONFIG.SHAREPOINT.SITE_URL}/_api/web/GetFileByServerRelativeUrl('${folderPath}/${fileName}')/$value`;

      try {
        const headers = { 'Accept': 'application/json;odata=verbose' };

        const response = await fetch(url, { 
          method: 'GET', 
          headers,
          credentials: 'same-origin'
        });

        if (response.ok) {
          const data = await response.json();
          this._cache[key] = data;
          return data;
        }

        if (response.status === 401) {
          if (!this._sharePointDisabled) {
            const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
            const msg = isLocal 
              ? `[SharePoint] 401: הרצה מקומית ב-${location.hostname} (מעבר שקט ל-localStorage cache).`
              : `[SharePoint] 401 Unauthorized: שגיאת הרשאה מול SharePoint במיקום ${location.hostname} (מעבר שקט ל-localStorage cache).`;
            console.info(msg);
            this._sharePointDisabled = true;
          }
          break;
        }
      } catch (error) {
        // ממשיכים לנתיב הבא
      }
    }

    // אם לא נמצא ב-SharePoint, חוזרים ל-cache ב-localStorage
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  },

  /**
   * משיכת FormDigestValue מ-SharePoint לאימות בקשות POST
   */
  async getFormDigest() {
    const elem = document.getElementById('__REQUESTDIGEST');
    if (elem && elem.value) return elem.value;
    try {
      const res = await fetch(`${CONFIG.SHAREPOINT.SITE_URL}/_api/contextinfo`, {
        method: 'POST',
        headers: { 'Accept': 'application/json;odata=verbose' },
        credentials: 'same-origin'
      });
      if (res.ok) {
        const data = await res.json();
        return data.d?.GetContextWebInformation?.FormDigestValue || '';
      }
    } catch (e) {
      console.warn('[SharePoint] Could not fetch FormDigest:', e);
    }
    return '';
  },

  /**
   * שמירה ל-SharePoint REST API (File Upload / Overwrite)
   */
  async _saveToSharePoint(key, data) {
    if (this._sharePointDisabled) {
      return false;
    }

    const fileName = `${key}.json`;
    const pathsToTry = [
      CONFIG.SHAREPOINT.FOLDER_PATH,
      '/sites/PakadexData/PakadexData',
      '/sites/PakadexData/Shared Documents/PakadexData'
    ];

    const uniquePaths = [...new Set(pathsToTry.filter(Boolean))];
    const digest = await this.getFormDigest();

    for (const folderPath of uniquePaths) {
      const url = `${CONFIG.SHAREPOINT.SITE_URL}/_api/web/GetFolderByServerRelativeUrl('${folderPath}')/Files/add(url='${fileName}',overwrite=true)`;

      try {
        const headers = {
          'Accept': 'application/json;odata=verbose',
          'Content-Type': 'application/json;charset=utf-8'
        };
        if (digest) {
          headers['X-RequestDigest'] = digest;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: headers,
          credentials: 'same-origin',
          body: JSON.stringify(data)
        });

        if (response.ok) {
          return true;
        }

        if (response.status === 401) {
          if (!this._sharePointDisabled) {
            const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
            const msg = isLocal 
              ? `[SharePoint] 401: הרצה מקומית ב-${location.hostname} (שמירה ב-localStorage).`
              : `[SharePoint] 401 Unauthorized: שגיאת הרשאה מול SharePoint במיקום ${location.hostname} (שמירה ב-localStorage).`;
            console.info(msg);
            this._sharePointDisabled = true;
          }
          break;
        }
      } catch (error) {
        // ממשיכים לנתיב הבא
      }
    }

    console.error(`[SharePoint] Failed to save ${key} to SharePoint folders.`);
    return false;
  },

  /**
   * טעינה משרת API ברשת הצבאית
   */
  async _loadFromMilitaryNet(key) {
    const url = `${CONFIG.MILITARY_NET.BASE_URL}/data/${key}`;
    try {
      const headers = { 'Accept': 'application/json' };
      if (CONFIG.MILITARY_NET.API_KEY) {
        headers['X-API-Key'] = CONFIG.MILITARY_NET.API_KEY;
      }
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error(`[MilitaryNet] GET error for ${key}:`, error);
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    }
  },

  /**
   * שמירה לשרת API ברשת הצבאית
   */
  async _saveToMilitaryNet(key, data) {
    const url = `${CONFIG.MILITARY_NET.BASE_URL}/data/${key}`;
    try {
      const headers = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (CONFIG.MILITARY_NET.API_KEY) {
        headers['X-API-Key'] = CONFIG.MILITARY_NET.API_KEY;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      });
      return response.ok;
    } catch (error) {
      console.error(`[MilitaryNet] POST error for ${key}:`, error);
      return false;
    }
  },

  /**
   * הפעלת סנכרון אוטומטי ברקע (Live Polling + Push Queue).
   * טוענת את התור השמור, מנסה לרוקן אותו בכל סבב וכאשר החיבור חוזר,
   * ומריצה את ה-callback לרענון הנתונים.
   */
  startAutoSync(callback) {
    // שחזור תור הסנכרון מרענון קודם
    this._syncQueue = this._loadQueue();

    if (this._isRemote() && typeof window !== 'undefined') {
      // כאשר החיבור חוזר - מנסים מיד לרוקן את התור
      window.addEventListener('online', () => { this.flushQueue(); this._notifyStatus(); });
      window.addEventListener('offline', () => { this._notifyStatus(); });
    }
    this._notifyStatus();

    if (!CONFIG.SYNC_INTERVAL_MS || CONFIG.SYNC_INTERVAL_MS <= 0) return;
    setInterval(async () => {
      await this.flushQueue();               // דחיפת שינויים ממתינים לשרת
      if (typeof callback === 'function') {
        await callback();                    // משיכה/רענון נתונים
      }
    }, CONFIG.SYNC_INTERVAL_MS);
  }
};
