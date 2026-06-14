export function register() {
  if (typeof localStorage !== "undefined" && typeof localStorage.getItem !== "function") {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (key) => store.get(String(key)) ?? null,
      setItem: (key, value) => store.set(String(key), String(value)),
      removeItem: (key) => store.delete(String(key)),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (index) => [...store.keys()][index] ?? null,
    };
  }
}
