
export default async function handler(request, response) {
  // Google Calendar ICS URL
  const ICS_URL = "https://calendar.google.com/calendar/ical/4d2df36446bbb6be7a4ab1a774e82f2c963325f325743b716fb9429ba39c2961%40group.calendar.google.com/public/basic.ics";

  try {
    const fetchResponse = await fetch(ICS_URL);
    
    if (!fetchResponse.ok) {
      throw new Error(`Google Calendar returned status: ${fetchResponse.status}`);
    }

    const data = await fetchResponse.text();

    // Set Cache-Control Headers for Vercel CDN
    // s-maxage=600: Cache this response at the Edge (CDN) for 600 seconds (10 minutes).
    // stale-while-revalidate=30: If cache is slightly old, serve it anyway while updating in background.
    response.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=30');
    response.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    
    response.status(200).send(data);
  } catch (error) {
    console.error("API Error:", error);
    response.status(500).json({ error: 'Failed to fetch calendar data' });
  }
}
