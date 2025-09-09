// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  grade: number;
  isAdmin: boolean;
  createdAt: Date;
  stickers: Sticker[];
  completedBooks: string[];
  currentBooks: BookProgress[];
}

// Book Types
export interface Book {
  id: string;
  title: string;
  coverUrl?: string;
  pages: BookPage[];
  gradeLevel: number;
  category: 'intensive' | 'extensive';
  qnaSet?: QNASet;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookPage {
  pageNumber: number;
  imageUrl: string;
  content?: string;
}

export interface BookProgress {
  bookId: string;
  userId: string;
  currentPage: number;
  totalPages: number;
  isCompleted: boolean;
  isSubmitted: boolean;
  startedAt: Date;
  completedAt?: Date;
  pageTimers: { [pageNumber: number]: PageTimer };
  penaltyCount: number;
}

export interface PageTimer {
  pageNumber: number;
  startTime: Date;
  totalTime: number; // in seconds
  exceedanceCount: number;
  isCompleted: boolean;
}

// Audio Types
export interface AudioRecording {
  id: string;
  userId: string;
  bookId: string;
  pageNumber: number;
  rawAudioUrl: string; // WAV file
  processedAudioUrl?: string; // MP3 file
  duration: number;
  recordedAt: Date;
  isProcessed: boolean;
}

// Q&A Types
export interface QNASet {
  id: string;
  bookId: string;
  questions: Question[];
  passingScore: number;
  createdAt: Date;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

// Sticker & Rewards Types
export interface Sticker {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
  earnedAt?: Date;
}

export interface UserAnswer {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
}

export interface QuizResult {
  userId: string;
  bookId: string;
  score: number;
  totalQuestions: number;
  passed: boolean;
  answers: UserAnswer[];
  completedAt: Date;
  stickerEarned?: Sticker;
}

// Navigation Types
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  GradeSelection: undefined;
  MainTabs: undefined;
  BookReader: { bookId: string; startPage?: number };
  Quiz: { bookId: string };
  Profile: undefined;
  AdminDashboard: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  IntensiveReading: undefined;
  ExtensiveReading: undefined;
  Profile: undefined;
};

// App State Types
export interface AppState {
  user: User | null;
  isLoading: boolean;
  currentBook?: BookProgress;
  audioRecording: {
    isRecording: boolean;
    currentPageAudio?: string;
  };
}

// Timer Configuration
export interface TimerConfig {
  maxTimePerPage: number; // in minutes
  penaltyThreshold: number; // in minutes
  maxPenalties: number;
}

// Constants
export const TIMER_CONFIGS = {
  intensive: {
    maxTimePerPage: 10, // 10 minutes max for intensive reading
    penaltyThreshold: 7, // penalty after 7 minutes
    maxPenalties: 0, // no penalties in intensive
  },
  extensive: {
    maxTimePerPage: Infinity, // no max time
    penaltyThreshold: 7, // penalty after 7 minutes
    maxPenalties: 3, // max 3 penalties per book (dynamic based on book length)
  },
};

export const GRADE_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8];

