export interface User {
  email: string;
  name?: string;
  picture?: string;
  role?: string;
  region?: string;
}
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  assumptions?: string[];
  confidence?: { score: number; level: 'HIGH' | 'MEDIUM' | 'LOW' };
}
export interface Suggestion {
  
  text: string;
  from: string;
  to: string;
  
}
export interface ErrorState {
  error?: string; 
  status?: number;
  detail?: string;
  retry_after?: number;
}