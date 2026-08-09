export {};

declare global {
  interface Window {
    pywebview?: {
      api?: {
        save_data?: (payload: string) => Promise<string> | string;
        load_data?: () => Promise<string>;
        list_exports?: (folder: string) => Promise<string[]>;
        read_export?: (path: string) => Promise<string>;
        select_folder?: () => Promise<string>;
        save_pdf?: (dataUrl: string, filename: string) => Promise<string>;
        save_image?: (dataUrl: string, filename: string) => Promise<string>;
      };
    };
  }
}
