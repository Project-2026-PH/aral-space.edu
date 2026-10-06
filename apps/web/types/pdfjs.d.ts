declare module 'pdfjs-dist/build/pdf.mjs' {
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(options: {
    data: Uint8Array;
  }): {
    promise: Promise<any>;
    destroy: () => Promise<void>;
  };
}
