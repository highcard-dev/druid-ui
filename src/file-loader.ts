type FileLoader = (path: string) => Promise<string>;

export const httpFileLoader: FileLoader = async (path: string) => {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load file: ${path}, status: ${res.status}`);
  }
  return res.text();
};

export const fileLoaders = {
  http: httpFileLoader,
};
