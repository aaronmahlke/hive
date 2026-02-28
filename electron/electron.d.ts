export {};

declare global {
  interface Window {
    electronAPI?: {
      openDirectory: () => Promise<string | null>;
    };
  }
}
