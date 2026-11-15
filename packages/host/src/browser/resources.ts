/** Per-instance handles: no globals, owner credentials or document-wide lookup. */
export class Resources {
  private next = 1;
  private objects = new Map<
    number,
    { kind: string; value: unknown; release: () => void }
  >();
  constructor(private signal: AbortSignal) {
    signal.addEventListener(
      "abort",
      () => {
        for (const id of [...this.objects.keys()].reverse()) this.remove(id);
      },
      { once: true },
    );
  }
  add<T>(kind: string, value: T, release: () => void = () => {}): number {
    if (this.signal.aborted) {
      release();
      this.signal.throwIfAborted();
    }
    const id = this.next++;
    this.objects.set(id, { kind, value, release });
    return id;
  }
  get<T>(id: number, kind: string): T {
    this.signal.throwIfAborted();
    const item = this.objects.get(id);
    if (!item || item.kind !== kind)
      throw new Error(`Invalid ${kind} handle: ${id}`);
    return item.value as T;
  }
  remove(id: number) {
    const item = this.objects.get(id);
    if (!item) throw new Error(`Invalid handle: ${id}`);
    this.objects.delete(id);
    item.release();
  }
}

export function dimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  )
    throw new Error("Width and height must be positive integers");
}

/** WIT result<T,string> expects a thrown string, not a JavaScript Error. */
export function imports<T extends object>(
  implementation: T,
  signal: AbortSignal,
): T {
  const failure = (error: unknown): never => {
    throw error instanceof Error ? error.message : String(error);
  };
  return Object.fromEntries(
    Object.entries(implementation).map(([name, fn]) => [
      name,
      (...args: unknown[]) => {
        try {
          signal.throwIfAborted();
          const result = fn(...args);
          return result instanceof Promise ? result.catch(failure) : result;
        } catch (error) {
          return failure(error);
        }
      },
    ]),
  ) as T;
}
