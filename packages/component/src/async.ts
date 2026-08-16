export type AsyncResult = { tag: "ok" | "err"; val: unknown };

type PendingOperation = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

export const createAsyncBridge = (
  onSettled: () => void = () => undefined,
  trace: (message: string) => void = () => undefined,
) => {
  const pending = new Map<string, PendingOperation>();
  const early = new Map<string, AsyncResult>();

  const settle = (operation: PendingOperation, result: AsyncResult) => {
    if (result.tag === "ok") operation.resolve(result.val);
    else operation.reject(new Error(String(result.val)));
    onSettled();
  };

  const complete = (id: string, result: AsyncResult) => {
    trace(`Async callback received for id: ${id} with result: ${result.tag}`);
    const operation = pending.get(id);
    if (!operation) {
      early.set(id, result);
      return;
    }
    pending.delete(id);
    settle(operation, result);
  };

  const wrap =
    <T>(fn: (...args: any[]) => string) =>
    (...args: any[]): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const id = fn(...args);
        const operation: PendingOperation = {
          resolve: (value) => resolve(value as T),
          reject,
        };
        const earlyResult = early.get(id);
        if (earlyResult) {
          early.delete(id);
          settle(operation, earlyResult);
          return;
        }
        pending.set(id, operation);
      });

  return { complete, wrap };
};
