/* =========================================================
   SHAREPOINTSERVICE.JS - שכבת ניהול הנתונים והסנכרון של PAKADEX
   ========================================================= */

const DataService = {
  // מטמון מקומי בזיכרון לגישה מהירה
  _cache: {},
  // דגל לביטול ניסיונות SharePoint חוזרים בריצה מקומית שאינה מאומתת
  _sharePointDisabled: false,

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
   * שמירת נתונים לפי מפתח (Key)
   */
  async setItem(key, data) {
    // מעדכנים קודם כל במטמון וב-localStorage לגיבוי
    this._cache[key] = data;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }

    if (CONFIG.DATA_SOURCE === 'sharepoint') {
      return await this._saveToSharePoint(key, data);
    } else if (CONFIG.DATA_SOURCE === 'military_net') {
      return await this._saveToMilitaryNet(key, data);
    }
    return true;
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
   * הפעלת סנכרון אוטומטי ברקע (Live Polling)
   */
  startAutoSync(callback) {
    if (!CONFIG.SYNC_INTERVAL_MS || CONFIG.SYNC_INTERVAL_MS <= 0) return;
    setInterval(async () => {
      if (typeof callback === 'function') {
        await callback();
      }
    }, CONFIG.SYNC_INTERVAL_MS);
  }
};
