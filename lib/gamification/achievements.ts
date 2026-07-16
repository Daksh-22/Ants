import { Achievement } from './types';

export const ACHIEVEMENT_DEFINITIONS: Record<string, Omit<Achievement, 'unlockedAt'>> = {
  first_scan: {
    id: 'first_scan',
    name: 'Portfolio Analyst',
    description: 'Complete your first portfolio analysis',
    icon: '📊',
  },
  habit_former_10: {
    id: 'habit_former_10',
    name: 'Habit Former',
    description: 'Maintain a 10-day check-in streak',
    icon: '🔥',
    progress: 0,
    maxProgress: 10,
  },
  discipline_master_50: {
    id: 'discipline_master_50',
    name: 'Discipline Master',
    description: 'Maintain a 50-day check-in streak',
    icon: '💪',
    progress: 0,
    maxProgress: 50,
  },
  century_club: {
    id: 'century_club',
    name: 'Century Club',
    description: 'Maintain a 100-day check-in streak',
    icon: '💯',
    progress: 0,
    maxProgress: 100,
  },
  problem_solver_5: {
    id: 'problem_solver_5',
    name: 'Problem Solver',
    description: 'Complete 5 portfolio fixes',
    icon: '🛠️',
    progress: 0,
    maxProgress: 5,
  },
  portfolio_surgeon_20: {
    id: 'portfolio_surgeon_20',
    name: 'Portfolio Surgeon',
    description: 'Complete 20 portfolio fixes',
    icon: '🏥',
    progress: 0,
    maxProgress: 20,
  },
  strong_portfolio: {
    id: 'strong_portfolio',
    name: 'Strong Portfolio',
    description: 'Achieve an 80+ health score',
    icon: '💎',
  },
  diversifier: {
    id: 'diversifier',
    name: 'Diversifier',
    description: 'Hold 10+ unique stocks',
    icon: '🌈',
  },
  balanced_mind: {
    id: 'balanced_mind',
    name: 'Balanced Mind',
    description: 'Reduce concentration to <30%',
    icon: '⚖️',
  },
  first_investor: {
    id: 'first_investor',
    name: 'First Investor',
    description: 'Make your first purchase via Ants',
    icon: '🚀',
  },
  social_butterfly: {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Compare your portfolio with a peer',
    icon: '🦋',
  },
  ask_ants_master: {
    id: 'ask_ants_master',
    name: 'Ask Ants Master',
    description: 'Ask 10 questions via Ask Ants',
    icon: '🐜',
    progress: 0,
    maxProgress: 10,
  },
  risk_manager: {
    id: 'risk_manager',
    name: 'Risk Manager',
    description: 'Achieve a Sharpe ratio > 1.0',
    icon: '📊',
  },
  volatility_tamer: {
    id: 'volatility_tamer',
    name: 'Volatility Tamer',
    description: 'Reduce portfolio volatility below sector median',
    icon: '🎯',
  },
  benchmark_beater: {
    id: 'benchmark_beater',
    name: 'Benchmark Beater',
    description: 'Outperform Nifty 50 for 30 consecutive days',
    icon: '🚀',
    progress: 0,
    maxProgress: 30,
  },
  market_sage: {
    id: 'market_sage',
    name: 'Market Sage',
    description: 'Outperform all three benchmarks simultaneously',
    icon: '🧠',
  },
  diversified_investor: {
    id: 'diversified_investor',
    name: 'Diversified Investor',
    description: 'Own at least 5 different sectors',
    icon: '🌈',
  },
  researcher: {
    id: 'researcher',
    name: 'Researcher',
    description: 'Research 5 different stocks',
    icon: '🔍',
    progress: 0,
    maxProgress: 5,
  },
  market_watcher: {
    id: 'market_watcher',
    name: 'Market Watcher',
    description: 'Read 10 market insights',
    icon: '📰',
    progress: 0,
    maxProgress: 10,
  },
  target_spotter: {
    id: 'target_spotter',
    name: 'Target Spotter',
    description: 'Hit your first price target',
    icon: '🎯',
  },
  hawkeye: {
    id: 'hawkeye',
    name: 'Hawkeye',
    description: 'Hit 5 price targets',
    icon: '🦅',
    progress: 0,
    maxProgress: 5,
  },
};

export function checkAchievementUnlock(
  achievementId: string,
  streakDays?: number,
  fixesCompleted?: number,
  healthScore?: number,
  holdingsCount?: number,
  concentration?: number,
  chatQueries?: number,
  sharpeRatio?: number,
  volatility?: number,
  portfolioPerformanceVsNifty?: number,
  benchmarkDaysBeating?: number,
  researchedStocks?: number,
  insightsRead?: number,
  priceTargetsHit?: number,
  sectorCount?: number
): boolean {
  switch (achievementId) {
    case 'first_scan':
      return true; // triggered manually on first analysis
    case 'habit_former_10':
      return streakDays ? streakDays >= 10 : false;
    case 'discipline_master_50':
      return streakDays ? streakDays >= 50 : false;
    case 'century_club':
      return streakDays ? streakDays >= 100 : false;
    case 'problem_solver_5':
      return fixesCompleted ? fixesCompleted >= 5 : false;
    case 'portfolio_surgeon_20':
      return fixesCompleted ? fixesCompleted >= 20 : false;
    case 'strong_portfolio':
      return healthScore ? healthScore >= 80 : false;
    case 'diversifier':
      return holdingsCount ? holdingsCount >= 10 : false;
    case 'balanced_mind':
      return concentration ? concentration < 30 : false;
    case 'ask_ants_master':
      return chatQueries ? chatQueries >= 10 : false;
    case 'risk_manager':
      return sharpeRatio ? sharpeRatio > 1.0 : false;
    case 'volatility_tamer':
      // Lower volatility than typical (assume 20% is median)
      return volatility ? volatility < 20 : false;
    case 'benchmark_beater':
      return benchmarkDaysBeating ? benchmarkDaysBeating >= 30 : false;
    case 'market_sage':
      // Outperforming all three benchmarks
      return portfolioPerformanceVsNifty ? portfolioPerformanceVsNifty > 0 : false;
    case 'diversified_investor':
      return sectorCount ? sectorCount >= 5 : false;
    case 'researcher':
      return researchedStocks ? researchedStocks >= 5 : false;
    case 'market_watcher':
      return insightsRead ? insightsRead >= 10 : false;
    case 'target_spotter':
      return priceTargetsHit ? priceTargetsHit >= 1 : false;
    case 'hawkeye':
      return priceTargetsHit ? priceTargetsHit >= 5 : false;
    default:
      return false;
  }
}

export function getProgressForAchievement(
  achievementId: string,
  streakDays?: number,
  fixesCompleted?: number,
  chatQueries?: number,
  benchmarkDaysBeating?: number,
  researchedStocks?: number,
  insightsRead?: number,
  priceTargetsHit?: number
): { progress: number; maxProgress: number } {
  switch (achievementId) {
    case 'habit_former_10':
      return { progress: streakDays || 0, maxProgress: 10 };
    case 'discipline_master_50':
      return { progress: streakDays || 0, maxProgress: 50 };
    case 'century_club':
      return { progress: streakDays || 0, maxProgress: 100 };
    case 'problem_solver_5':
      return { progress: fixesCompleted || 0, maxProgress: 5 };
    case 'portfolio_surgeon_20':
      return { progress: fixesCompleted || 0, maxProgress: 20 };
    case 'ask_ants_master':
      return { progress: chatQueries || 0, maxProgress: 10 };
    case 'benchmark_beater':
      return { progress: benchmarkDaysBeating || 0, maxProgress: 30 };
    case 'researcher':
      return { progress: researchedStocks || 0, maxProgress: 5 };
    case 'market_watcher':
      return { progress: insightsRead || 0, maxProgress: 10 };
    case 'hawkeye':
      return { progress: priceTargetsHit || 0, maxProgress: 5 };
    default:
      return { progress: 0, maxProgress: 1 };
  }
}
