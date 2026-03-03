export {};

declare global {
  interface Window {
    electronAPI?: {
      openDirectory: () => Promise<string | null>;
      openFile: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
    };
  }
}
