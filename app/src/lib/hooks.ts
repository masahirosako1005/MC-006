// フック登録(00 第 5.8)。globalThis に key で登録し、HMR の二重登録を防ぐ。
export type HookName = "beforeRequest" | "afterClockChange" | "afterReset";

const g = globalThis as unknown as { __groupsHooks?: Record<HookName, Map<string, () => void>> };

function hooks(): Record<HookName, Map<string, () => void>> {
  return (g.__groupsHooks ??= { beforeRequest: new Map(), afterClockChange: new Map(), afterReset: new Map() });
}

export function registerHook(name: HookName, key: string, fn: () => void): void {
  hooks()[name].set(key, fn);
}

export function runHooks(name: HookName): void {
  let first: unknown;
  let failed = false;
  for (const fn of hooks()[name].values()) {
    try {
      fn();
    } catch (e) {
      if (!failed) { failed = true; first = e; }
    }
  }
  if (failed) throw first;
}
