import type { CategoryMetric, InvestmentRecord, TargetProgress, TimeAccount, TimeCategory, WeeklyGoals } from './models';
import { CATEGORIES, CATEGORY_META } from './models';

export function totalInvested(records: InvestmentRecord[]): number {
  return records.reduce((sum, item) => sum + item.hours, 0);
}

export function metricsFor(records: InvestmentRecord[]): CategoryMetric[] {
  const total = totalInvested(records);
  return CATEGORIES.map((category) => {
    const hours = records.filter((item) => item.category === category).reduce((sum, item) => sum + item.hours, 0);
    const meta = CATEGORY_META[category];
    return { category, hours, share: total ? hours / total : 0, roi: meta.roi, color: meta.color, icon: meta.icon };
  });
}

/** 新建账户时的初始周目标，合计与默认周预算 56h 持平 */
export function defaultWeeklyGoals(): WeeklyGoals {
  return { 健康: 10, 学习: 10, 关系: 7, 事业: 14, 娱乐: 6, 休息: 9 };
}

/** 读取历史快照时兜底非法/缺失的目标值 */
export function normalizeGoals(goals?: Partial<WeeklyGoals> | null): WeeklyGoals {
  const fallback = defaultWeeklyGoals();
  return CATEGORIES.reduce((acc, category) => {
    const value = Number(goals?.[category]);
    acc[category] = Number.isFinite(value) && value >= 0 ? value : fallback[category];
    return acc;
  }, {} as WeeklyGoals);
}

export function totalGoals(goals: WeeklyGoals): number {
  return CATEGORIES.reduce((sum, category) => sum + (Number(goals[category]) || 0), 0);
}

/** 把每类实际小时换算成对周目标的差距与达成进度 */
export function targetProgress(metrics: CategoryMetric[], goals: WeeklyGoals): TargetProgress[] {
  return metrics.map((item) => {
    const target = Number(goals[item.category]) || 0;
    const actual = item.hours;
    const gap = target > 0 ? Math.round((target - actual) * 10) / 10 : 0;
    return {
      category: item.category,
      actual,
      target,
      gap,
      progress: target > 0 ? Math.min(1, actual / target) : 0,
      achieved: target > 0 && actual >= target,
      color: item.color,
      icon: item.icon,
    };
  });
}

export function portfolioScore(metrics: CategoryMetric[], account: TimeAccount): number {
  const invested = metrics.reduce((sum, item) => sum + item.hours * item.roi, 0);
  const available = Math.max(account.weeklyHours, 1);
  return Math.round((invested / available) * 10) / 10;
}

export function balanceSheet(metrics: CategoryMetric[], account: TimeAccount) {
  const assets = metrics.reduce((sum, item) => sum + item.hours * item.roi, 0);
  const invested = metrics.reduce((sum, item) => sum + item.hours, 0);
  return { assets: Math.round(assets * 10) / 10, liabilities: Math.max(0, Math.round((account.weeklyHours - invested) * 10) / 10), equity: Math.round((assets - Math.max(0, account.weeklyHours - invested)) * 10) / 10 };
}

/**
 * 再平衡建议：缺口最大的类别永远排第一，随后是其余缺口类别、超额提醒与预算提醒。
 * 每条建议附带 kind，方便界面高亮优先级。
 */
export function suggestions(metrics: CategoryMetric[], account: TimeAccount, goals: WeeklyGoals): Array<{ kind: 'gap' | 'over' | 'budget' | 'ok' | 'idle'; text: string; category?: TimeCategory }> {
  const progress = targetProgress(metrics, goals);
  const gaps = progress.filter((item) => item.target > 0 && item.gap > 0).sort((a, b) => b.gap - a.gap);
  const overs = progress.filter((item) => item.achieved && item.actual - item.target > 0.05);
  const result: Array<{ kind: 'gap' | 'over' | 'budget' | 'ok' | 'idle'; text: string; category?: TimeCategory }> = [];

  gaps.forEach((item, index) => {
    result.push({
      kind: 'gap',
      category: item.category,
      text: index === 0
        ? `「${item.category}」缺口最大：本周目标 ${item.target}h，实际 ${item.actual.toFixed(1)}h，还差 ${item.gap.toFixed(1)}h，建议优先补仓。`
        : `「${item.category}」距离周目标还差 ${item.gap.toFixed(1)}h（目标 ${item.target}h / 实际 ${item.actual.toFixed(1)}h）。`,
    });
  });

  overs.forEach((item) => {
    result.push({ kind: 'over', category: item.category, text: `「${item.category}」已投入 ${item.actual.toFixed(1)}h，超出周目标 ${(item.actual - item.target).toFixed(1)}h，可留意是否挤占其他资产。` });
  });

  const goalTotal = totalGoals(goals);
  if (goalTotal > account.weeklyHours) {
    result.push({ kind: 'budget', text: `六类目标合计 ${goalTotal}h，已超过周预算 ${account.weeklyHours}h（超出 ${(goalTotal - account.weeklyHours).toFixed(1)}h），请回到组合页下调目标。` });
  }

  const investedHours = metrics.reduce((sum, item) => sum + item.hours, 0);
  if (investedHours && account.weeklyHours - investedHours > 4) {
    result.push({ kind: 'idle', text: `还有 ${Math.round(account.weeklyHours - investedHours)} 小时未被配置，可以先建立一笔“探索基金”。` });
  }

  if (!result.length) result.push({ kind: 'ok', text: '六类资产均已达到周目标，时间组合状态很好，继续用每周复盘保持动态平衡。' });
  return result;
}

export function record(category: TimeCategory, hours: number, note: string, date = new Date().toISOString()): InvestmentRecord {
  return { id: `time-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, category, hours: Math.max(0.5, Number(hours) || 0.5), note: note.trim() || '未命名投资', date };
}

export function sampleSnapshot() {
  const account: TimeAccount = { dailyHours: 8, weeklyHours: 56, updatedAt: new Date().toISOString() };
  const seed: Array<[TimeCategory, number, string]> = [
    ['事业', 16, '产品策略与交付'], ['学习', 10, '阅读与课程'], ['健康', 7, '力量训练与散步'],
    ['关系', 8, '家人和朋友'], ['休息', 9, '睡眠与留白'], ['娱乐', 4, '电影与游戏'],
  ];
  return { account, records: seed.map(([category, hours, note], index) => record(category, hours, note, new Date(Date.now() - index * 86400000).toISOString())), goals: defaultWeeklyGoals() };
}
