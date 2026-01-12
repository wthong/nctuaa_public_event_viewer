import { AlumniEvent } from '../types';
import { INITIAL_EVENTS, ICS_URL } from '../constants';
import ICAL from 'ical.js';

const EVENTS_KEY = 'nctuaa_events';

// --- Helpers ---

const extractUrl = (text: string): string => {
  if (!text) return '#';
  const match = text.match(/https?:\/\/[^\s<"]+/);
  return match ? match[0] : '#';
};

// --- Proxy Fetch Helper ---
const fetchIcsContent = async (targetUrl: string): Promise<string> => {
    // 1. Browser Cache Busting: Add explicit cache control headers to fetch
    // 2. Proxy/Server Cache Busting: Append a random timestamp to the target URL.
    //    This forces the proxy to fetch a "new" URL from Google, and Google to serve a fresh request (hopefully).
    
    const cacheBuster = `t=${Date.now()}`;
    const urlWithCacheBuster = targetUrl.includes('?') 
        ? `${targetUrl}&${cacheBuster}` 
        : `${targetUrl}?${cacheBuster}`;

    let urlToEncode = urlWithCacheBuster;

    // List of CORS proxies to try
    const proxies = [
        // Corsproxy.io
        (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
        // AllOrigins
        (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    ];

    let lastError;
    for (const createProxyUrl of proxies) {
        try {
            const proxyUrl = createProxyUrl(urlToEncode);
            
            // Add 'cache: no-store' to ensure the browser doesn't return a cached proxy response
            const response = await fetch(proxyUrl, {
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            });
            
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
    
    if (!time.isDate) { // isDate is true if it's a date-only (all day) value
         const startStr = `${String(jsDate.getHours()).padStart(2, '0')}:${String(jsDate.getMinutes()).padStart(2, '0')}`;
         let endStr = '';

         try {
             // Calculate End Time
             // Most reliable way for both recurring and single events is using duration if available
             if (event.duration) {
                 // Clone the start time and add duration
                 const endTime = time.clone();
                 endTime.addDuration(event.duration);
                 const endJsDate = endTime.toJSDate();
                 
                 // Only show end time if it ends on the same day (simplify display)
                 if (endJsDate.getDate() === jsDate.getDate()) {
                     endStr = `${String(endJsDate.getHours()).padStart(2, '0')}:${String(endJsDate.getMinutes()).padStart(2, '0')}`;
                 }
             } else if (event.endDate) {
                 // Fallback to endDate property if duration is missing
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
    // Look back 1 day to be safe.
    const startWindow = new Date();
    startWindow.setDate(startWindow.getDate() - 1);
    
    const endWindow = new Date();
    endWindow.setMonth(endWindow.getMonth() + 6); // Look ahead 6 months only

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

    // In view-only mode, we just treat ICS as source of truth.
    // Manual events support is removed as per request to remove backend.
    
    const mergedEvents = [...calendarEvents];
    
    // Sort by Date
    mergedEvents.sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        return a.time.localeCompare(b.time); // String compare works for HH:mm roughly
    });

    localStorage.setItem(EVENTS_KEY, JSON.stringify(mergedEvents));
    return mergedEvents;

  } catch (error) {
    console.error("Error syncing ICS:", error);
    // If sync fails, do NOT fallback to stale data silently if this was an explicit sync request,
    // but current logic returns whatever is there.
    // We stick to returning stored data if net fails to avoid white screen.
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