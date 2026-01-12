export interface AlumniEvent {
  id: string;
  title: string;
  posterUrl: string;
  description: string;
  date: string;
  time: string;
  location: string;
  registerLink: string;
  createdAt: number;
}

export interface User {
  email: string;
  isAdmin: boolean;
  isRoot: boolean;
}

export interface AdminUser {
  email: string;
  addedBy: string;
  dateAdded: number;
}