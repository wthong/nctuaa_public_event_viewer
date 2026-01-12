import { AlumniEvent, AdminUser } from '../types';
import { INITIAL_EVENTS, INITIAL_ADMINS, ROOT_ADMIN_EMAIL, ICS_URL } from '../constants';
import ICAL from 'ical.js';

const EVENTS_KEY = 'nctuaa_events';
const ADMINS_KEY = 'nctuaa_admins';

// --- Helpers ---

const extractUrl = (text: string): string => {
  if (!text) return '#';
  const match = text.match(/https?:\/\/[^\s<"]+/);
  return match ? match[0] : '#';
};

// --- Proxy Fetch Helper ---
const fetchIcsContent = async (targetUrl: string): Promise<string> => {
    // Normalize URL
    let url = targetUrl;
    try {
        url = decodeURIComponent(targetUrl);
    } catch (e) {
        // ignore
    }

    // List of CORS proxies to try
    const proxies = [
        (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
        (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    ];

    let lastError;
    for (const createProxyUrl of proxies) {
        try {
            const proxyUrl = createProxyUrl(url);
            const response = await fetch(proxyUrl);
            if (response.ok) {
                return await response.text();
            }
            lastError = new Error(`Status ${response.status}`);
        } catch (error) {
            lastError = error;
            console.warn("Proxy attempt failed:", error);
        }
    }
    throw lastError || new Error("All proxies failed");
};

// --- Helper to convert ICAL event to our type ---
const convertToAlumniEvent = (event: any, time: any): AlumniEvent => {
    // time is an ICAL.Time object from the iterator
    const jsDate = time.toJSDate();
    
    // Format Date: YYYY-MM-DD
    const y = jsDate.getFullYear();
    const m = String(jsDate.getMonth() + 1).padStart(2, '0');
    const d = String(jsDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // Format Time: HH:mm or '全天'
    let timeStr = '全天';
    if (!time.isDate) { // isDate is true if it's a date-only (all day) value
         const hours = String(jsDate.getHours()).padStart(2, '0');
         const minutes = String(jsDate.getMinutes()).padStart(2, '0');
         timeStr = `${hours}:${minutes}`;
    }

    const summary = event.summary || '無標題';
    const location = event.location || '待定';
    const description = event.description || '';
    
    // Extract Link
    let link = extractUrl(description);
    // Try to get URL property directly if not found in description
    if (link === '#' && event.component && event.component.getFirstPropertyValue('url')) {
        link = event.component.getFirstPropertyValue('url');
    }

    // Create a unique ID for this instance: Original UID + Date
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

export const syncEventsFromSheet = async (): Promise<AlumniEvent[]> => {
  try {
    const icsData = await fetchIcsContent(ICS_URL);
    
    // Parse ICS using ical.js
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');
    
    const calendarEvents: AlumniEvent[] = [];
    
    // Define the window of interest
    const now = new Date();
    // Normalize 'now' to start of day to ensure we include today's events even if they started earlier in the day?
    // Actually, simple comparison is usually enough. Let's look back 1 day to be safe.
    const startWindow = new Date();
    startWindow.setDate(startWindow.getDate() - 1);
    
    const endWindow = new Date();
    endWindow.setFullYear(endWindow.getFullYear() + 1); // Look ahead 1 year

    vevents.forEach(vevent => {
        try {
            const event = new ICAL.Event(vevent);
            
            // Check if it's an expanded recurring event or a single event
            if (event.isRecurring()) {
                const iterator = event.iterator();
                let next;
                
                // Iterate through occurrences
                while ((next = iterator.next())) {
                    const nextJsDate = next.toJSDate();
                    
                    if (nextJsDate < startWindow) continue;
                    if (nextJsDate > endWindow) break;
                    
                    calendarEvents.push(convertToAlumniEvent(event, next));
                }
            } else {
                // Single event
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

    // Merge with Local Overrides
    // We prioritize local manual edits/adds, but we also want to keep the synced recurring events.
    // Since syncing regenerates IDs based on date for recurring events, we simply re-sync completely
    // and append manual *extra* events if any. 
    
    // Strategy: 
    // 1. Get current local events.
    // 2. Identify which are "Manually Created" (not from ICS).
    //    We can identify ICS events by their ID format usually, or we just trust the sync to overwrite ICS events.
    //    However, previously we used `ics_` prefix. Now we use `${uid}_${date}`.
    //    Let's assume users only "Add" completely new events in Admin panel, 
    //    or "Delete" events they don't want.
    
    //    For simplicity in this version: We fully replace the "Synced" portion.
    //    But we need to preserve "Manually Added" events that are stored in localStorage.
    
    const currentLocalEvents = getEvents();
    
    // Basic Heuristic: If ID looks like a UUID or `evt_` (from AdminPanel), keep it. 
    // If ID looks like `uid_date` or `ics_`, it's likely from sync (discard and replace).
    // The previous code used `ics_` + random.
    // AdminPanel uses `evt_` + timestamp.
    
    const manualEvents = currentLocalEvents.filter(e => e.id.startsWith('evt_'));
    
    const mergedEvents = [...calendarEvents, ...manualEvents];
    
    // Sort by Date
    mergedEvents.sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        return a.time.localeCompare(b.time);
    });

    localStorage.setItem(EVENTS_KEY, JSON.stringify(mergedEvents));
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
    localStorage.setItem(EVENTS_KEY, JSON.stringify(INITIAL_EVENTS));
    return INITIAL_EVENTS;
  }
  return JSON.parse(stored);
};

export const saveEvent = (event: AlumniEvent) => {
  const events = getEvents();
  const index = events.findIndex(e => e.id === event.id);
  if (index >= 0) {
    events[index] = event;
  } else {
    events.push(event);
  }
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  return events;
};

export const deleteEvent = (id: string) => {
  const events = getEvents();
  const newEvents = events.filter(e => e.id !== id);
  localStorage.setItem(EVENTS_KEY, JSON.stringify(newEvents));
  return newEvents;
};

// Admins
export const getAdmins = (): AdminUser[] => {
  const stored = localStorage.getItem(ADMINS_KEY);
  if (!stored) {
    localStorage.setItem(ADMINS_KEY, JSON.stringify(INITIAL_ADMINS));
    return INITIAL_ADMINS;
  }
  return JSON.parse(stored);
};

export const addAdmin = (email: string, addedBy: string): AdminUser[] => {
  const admins = getAdmins();
  if (admins.find(a => a.email === email)) return admins;
  
  const newAdmins = [...admins, { email, addedBy, dateAdded: Date.now() }];
  localStorage.setItem(ADMINS_KEY, JSON.stringify(newAdmins));
  return newAdmins;
};

export const removeAdmin = (email: string): AdminUser[] => {
  if (email === ROOT_ADMIN_EMAIL) throw new Error("無法刪除主要管理員");
  
  const admins = getAdmins();
  const newAdmins = admins.filter(a => a.email !== email);
  localStorage.setItem(ADMINS_KEY, JSON.stringify(newAdmins));
  return newAdmins;
};

export const isAdmin = (email: string): boolean => {
  const admins = getAdmins();
  return admins.some(a => a.email.toLowerCase() === email.toLowerCase());
};
