export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or icon name
  unlockedAt?: string; // ISO date string
  progress?: number; // for multi-step achievements (e.g., 100-day streak)
  maxProgress?: number; // for progress-based achievements
}

export interface DailyStreak {
  current: number;
  longest: number;
  lastCheckInDate: string; // ISO date string
}

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  type: 'portfolio-check' | 'learn' | 'action' | 'insight' | 'social';
  xpReward: number;
  completed: boolean;
}

export interface GamificationState {
  level: number; // 1-100 (Rookie → Pro → Whale)
  xp: number; // current XP toward next level
  totalXpEarned: number; // all-time for stats
  achievements: Achievement[]; // unlocked badges
  dailyStreak: DailyStreak;
  lastCheckInDate: string; // ISO date string
}

export interface LevelBand {
  level: number;
  minXp: number;
  maxXp: number;
  name: string;
  description: string;
}
