type Callback = (id: string, result: { tag: "ok" | "err"; val: any }) => void;

let cb: Callback | undefined;

const pending: Array<{ id: string; result: Parameters<Callback>[1] }> = [];

const dispatch = (id: string, result: Parameters<Callback>[1]) => {
  if (cb) {
    cb(id, result);
    return;
  }

  pending.push({ id, result });
};
export const setCb = (
  callback: (id: string, result: { tag: "ok" | "err"; val: any }) => void,
) => {
  cb = callback;

  if (pending.length === 0) {
    return;
  }

  // Flush any results that arrived before the callback was registered.
  while (pending.length > 0) {
    const { id, result } = pending.shift()!;
    cb(id, result);
  }
};

export const PromiseToResult = <T>(
  promiseFn: (...args: any[]) => Promise<T>,
) => {
  return (...args: any[]) => {
    const id = crypto.randomUUID();
    promiseFn(...args)
      .then((result) => {
        dispatch(id, {
          tag: "ok",
          val: result,
        });
      })
      .catch((error) => {
        dispatch(id, {
          tag: "err",
          val: error instanceof Error ? error.message : String(error),
        });
      });
    return id;
  };
};
