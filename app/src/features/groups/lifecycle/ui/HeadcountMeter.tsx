// LCY-UI-02(スタブ)。
export interface HeadcountMeterProps { minMembers: number; capacity: number; currentCount: number }

export function HeadcountMeter({ minMembers, capacity, currentCount }: HeadcountMeterProps) {
  return <span>{`最少 ${minMembers} / 定員 ${capacity} / 現在 ${currentCount}`}</span>;
}
