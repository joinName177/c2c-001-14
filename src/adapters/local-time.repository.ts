import type { TimeRepository } from '../ports/time-repository.port';
import type { TimeSnapshot } from '../core/models';
import { defaultTargets, sampleSnapshot } from '../core/time-engine';

const KEY = 'c2c-001-time-investment';
export class LocalTimeRepository implements TimeRepository {
  load(): TimeSnapshot {
    try {
      const value = localStorage.getItem(KEY);
      if (value) {
        const parsed = JSON.parse(value) as Partial<TimeSnapshot>;
        if (parsed.account && parsed.records) {
          return { account: parsed.account, records: parsed.records, targets: { ...defaultTargets(), ...(parsed.targets ?? {}) } };
        }
      }
    } catch { /* use seed */ }
    return sampleSnapshot();
  }
  save(snapshot: TimeSnapshot) { localStorage.setItem(KEY, JSON.stringify(snapshot)); }
}
