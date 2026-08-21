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

// checkAchievementUnlock() was removed: nothing imported it, and it had two
// bugs waiting for whoever did. Its truthiness guards meant a real measured zero
// read as "not achieved" (`concentration ? concentration < 30 : false` fails a
// perfectly diversified 0% concentration), and `market_sage` — described as
// beating all three benchmarks — checked only vs_nifty. Unlocks are driven
// directly from the call sites in Results/PriceAlerts/InsightsFeed instead.

/**
 * Counters behind the progress bars. A named object rather than eleven optional
 * positionals: the caller used to pass just the first two, so every badge
 * measured by any other counter silently rendered "0/5" or "0/10" no matter what
 * the user had done — a user with 4 researched tickers saw "Researcher 0/5".
 * With named fields, a missing counter is visible at the call site.
 */
export interface AchievementProgressInputs {
  streakDays?: number;
  fixesCompleted?: number;
  chatQueries?: number;
  benchmarkDaysBeating?: number;
  researchedStocks?: number;
  insightsRead?: number;
  priceTargetsHit?: number;
}

/**
 * Progress toward a locked achievement, or null when it genuinely cannot be
 * measured yet — the UI then omits the bar instead of asserting zero progress.
 */
export function getProgressForAchievement(
  achievementId: string,
  inputs: AchievementProgressInputs = {}
): { progress: number; maxProgress: number } | null {
  const bar = (value: number | undefined, maxProgress: number) =>
    value === undefined ? null : { progress: value, maxProgress };

  switch (achievementId) {
    case 'habit_former_10':
      return bar(inputs.streakDays, 10);
    case 'discipline_master_50':
      return bar(inputs.streakDays, 50);
    case 'century_club':
      return bar(inputs.streakDays, 100);
    case 'problem_solver_5':
      return bar(inputs.fixesCompleted, 5);
    case 'portfolio_surgeon_20':
      return bar(inputs.fixesCompleted, 20);
    case 'ask_ants_master':
      return bar(inputs.chatQueries, 10);
    case 'benchmark_beater':
      return bar(inputs.benchmarkDaysBeating, 30);
    case 'researcher':
      return bar(inputs.researchedStocks, 5);
    case 'market_watcher':
      return bar(inputs.insightsRead, 10);
    case 'hawkeye':
      return bar(inputs.priceTargetsHit, 5);
    default:
      return null;
  }
}
