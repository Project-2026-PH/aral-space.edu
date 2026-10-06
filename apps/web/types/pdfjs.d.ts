declare module 'pdfjs-dist/legacy/build/pdf.js' {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(options: {
    data: Uint8Array;
    disableWorker?: boolean;
    useSystemFonts?: boolean;
    isEvalSupported?: boolean;
  }): {
    promise: Promise<any>;
    destroy: () => Promise<void>;
  };
}
