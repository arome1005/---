export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  stats: {
    chatsCount: number;
    wordsCount: number;
    writingCount: number;
    lastActive: any;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: any;
  type?: 'text' | 'image' | 'file';
  mediaUrl?: string;
}

export interface Word {
  id: string;
  word: string;
  translation: string;
  phonetic: string;
  example: string;
  mastery: 'new' | 'learning' | 'mastered';
  timestamp: any;
}

export interface WritingTask {
  id: string;
  topic: string;
  content: string;
  feedback: string;
  score: number;
  timestamp: any;
}

export interface PronunciationAttempt {
  id: string;
  text: string;
  score: number;
  feedback: string;
  timestamp: any;
}

export interface Book {
  key: string;
  name: string;
  level: string;
  cover: string;
  path: string;
}

export interface Unit {
  id: number;
  title: string;
  audio: string;
  lrc: string;
}
