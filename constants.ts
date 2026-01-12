import { AlumniEvent, AdminUser } from './types';

export const ROOT_ADMIN_EMAIL = "nctuaa.tp@gmail.com";

// Public ICS URL provided by user
export const ICS_URL = "https://calendar.google.com/calendar/ical/4d2df36446bbb6be7a4ab1a774e82f2c963325f325743b716fb9429ba39c2961%40group.calendar.google.com/public/basic.ics";

export const INITIAL_ADMINS: AdminUser[] = [
  {
    email: ROOT_ADMIN_EMAIL,
    addedBy: "System",
    dateAdded: Date.now(),
  }
];

export const INITIAL_EVENTS: AlumniEvent[] = []; // Default to empty, wait for sync