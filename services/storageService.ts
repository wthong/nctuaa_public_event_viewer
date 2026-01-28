import { AlumniEvent } from '../types';
import { INITIAL_EVENTS, ICS_URL } from '../constants';
import ICAL from 'ical.js';

const EVENTS_KEY = 'nctuaa_events';
const LAST_SYNC_KEY = 'nctuaa_last_sync';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

// --- Helpers ---

const extractUrl = (text: string): string => {
  if (!text) return '#';
  const match = text.match(/https?:\/\/[^\s<"]+/);
  return match ? match[0] : '#';
};

// --- Proxy Fetch Helper ---
const fetchIcsContent = async (targetUrl: string): Promise<string> => {
    // 1. First, try our own Vercel API Route (which handles caching server-side).
    //    We append a timestamp only if we really need to bypass browser cache, 
    //    but let's rely on the API's Cache-Control headers generally.
    try {
        // Use a relative path so it works on the deployed domain
        const apiResponse = await fetch('/api/calendar');
        if (apiResponse.ok) {
            const text = await apiResponse.text();
            if (text.includes("BEGIN:VCALENDAR")) {
                return text;
            }
        }
    } catch (e) {
        console.warn("Vercel API fetch failed, falling back to CORS proxies.", e);
    }

    // 2. Fallback: If API fails (e.g. local dev without api), use CORS proxies
    const cacheBuster = `t=${Date.now()}`;
    const urlWithCacheBuster = targetUrl.includes('?') 
        ? `${targetUrl}&${cacheBuster}` 
        : `${targetUrl}?${cacheBuster}`;

    // List of CORS proxies to try in order of reliability/preference
    const proxies = [
        // AllOrigins
        (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        // CodeTabs
        (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
        // Corsproxy.io
        (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    ];

    let lastError;
    for (const createProxyUrl of proxies) {
        try {
            const proxyUrl = createProxyUrl(urlWithCacheBuster);
            const response = await fetch(proxyUrl);
            
            if (response.ok) {
                const text = await response.text();
                if (text.includes("BEGIN:VCALENDAR")) {
                    return text;
                }
            } else {
                lastError = new Error(`Status ${response.status}`);
            }
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error("All proxies failed to fetch valid ICS data");
};

// --- Helper to convert ICAL event to our type ---
const convertToAlumniEvent = (event: any, time: any): AlumniEvent => {
    // event is ICAL.Event
    // time is an ICAL.Time object from the iterator (Start Time)
    const jsDate = time.toJSDate();
    
    // Format Date: YYYY-MM-DD
    const y = jsDate.getFullYear();
    const m = String(jsDate.getMonth() + 1).padStart(2, '0');
    const d = String(jsDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // Format Time: HH:mm - HH:mm or '全天'
    let timeStr = '全天';
    
    if (!time.isDate) { 
         const startStr = `${String(jsDate.getHours()).padStart(2, '0')}:${String(jsDate.getMinutes()).padStart(2, '0')}`;
         let endStr = '';

         try {
             if (event.duration) {
                 const endTime = time.clone();
                 endTime.addDuration(event.duration);
                 const endJsDate = endTime.toJSDate();
                 
                 if (endJsDate.getDate() === jsDate.getDate()) {
                     endStr = `${String(endJsDate.getHours()).padStart(2, '0')}:${String(endJsDate.getMinutes()).padStart(2, '0')}`;
                 }
             } else if (event.endDate) {
                 const endJsDate = event.endDate.toJSDate();
                 if (endJsDate.getDate() === jsDate.getDate() && endJsDate > jsDate) {
                     endStr = `${String(endJsDate.getHours()).padStart(2, '0')}:${String(endJsDate.getMinutes()).padStart(2, '0')}`;
                 }
             }
         } catch (e) {
             console.warn("Error calculating end time", e);
         }

         timeStr = endStr ? `${startStr} - ${endStr}` : startStr;
    }

    const summary = event.summary || '無標題';
    const location = event.location || '待定';
    const description = event.description || '';
    
    let link = extractUrl(description);
    if (link === '#' && event.component && event.component.getFirstPropertyValue('url')) {
        link = event.component.getFirstPropertyValue('url');
    }

    const uniqueId = `${event.uid}_${dateStr}`;

    return {
        id: uniqueId,
        title: summary,
        posterUrl: '',
        description: description,
        date: dateStr,
        time: timeStr,
        location: location,
        registerLink: link,
        createdAt: Date.now()
    };
};

// --- Main Sync Logic ---

export const syncEventsFromSheet = async (force: boolean = false): Promise<AlumniEvent[]> => {
  // 1. Check Client-Side Cache Cooldown
  // If not forced, and last sync was less than 10 mins ago, return stored data immediately.
  if (!force) {
    const lastSyncStr = localStorage.getItem(LAST_SYNC_KEY);
    const lastSyncTime = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
    const now = Date.now();

    if (now - lastSyncTime < CACHE_DURATION) {
      console.log("Using local cache (synced < 10 mins ago)");
      return getEvents();
    }
  }

  try {
    const icsData = await fetchIcsContent(ICS_URL);
    
    // Parse ICS using ical.js
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');
    
    const calendarEvents: AlumniEvent[] = [];
    
    const startWindow = new Date();
    startWindow.setDate(startWindow.getDate() - 1);
    
    const endWindow = new Date();
    endWindow.setMonth(endWindow.getMonth() + 6); 

    vevents.forEach(vevent => {
        try {
            const event = new ICAL.Event(vevent);
            if (event.isRecurring()) {
                const iterator = event.iterator();
                let next;
                while ((next = iterator.next())) {
                    const nextJsDate = next.toJSDate();
                    if (nextJsDate < startWindow) continue;
                    if (nextJsDate > endWindow) break;
                    calendarEvents.push(convertToAlumniEvent(event, next));
                }
            } else {
                const startTime = event.startDate;
                const startJsDate = startTime.toJSDate();
                if (startJsDate >= startWindow && startJsDate <= endWindow) {
                    calendarEvents.push(convertToAlumniEvent(event, startTime));
                }
            }
        } catch (err) {
            console.warn("Error parsing individual event:", err);
        }
    });

    const mergedEvents = [...calendarEvents];
    
    mergedEvents.sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        return a.time.localeCompare(b.time); 
    });

    localStorage.setItem(EVENTS_KEY, JSON.stringify(mergedEvents));
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString()); // Update sync time
    
    return mergedEvents;

  } catch (error) {
    console.error("Error syncing ICS:", error);
    return getEvents();
  }
};

// Events
export const getEvents = (): AlumniEvent[] => {
  const stored = localStorage.getItem(EVENTS_KEY);
  if (!stored) {
    // If no events but we have defaults, set them.
    // However, for this app, we prefer empty until loaded or default empty array.
    localStorage.setItem(EVENTS_KEY, JSON.stringify(INITIAL_EVENTS));
    return INITIAL_EVENTS;
  }
  return JSON.parse(stored);
};