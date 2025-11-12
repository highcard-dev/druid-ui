import hyperid from "hyperid";

let cb: (id: string, result: { tag: "ok" | "err"; val: any }) => void;

export const setCb = (
  callback: (id: string, result: { tag: "ok" | "err"; val: any }) => void
) => {
  cb = callback;
};

export const PromiseToResult = <T>(
  promiseFn: (...args: any[]) => Promise<T>
) => {
  return (...args: any[]) => {
    const id = hyperid().uuid;
    promiseFn(...args)
      .then((result) => {
        cb(id, {
          tag: "ok",
          val: result,
        });
      })
      .catch((error) => {
        cb(id, {
          tag: "err",
          val: error.message,
        });
      });
    return id;
  };
};
