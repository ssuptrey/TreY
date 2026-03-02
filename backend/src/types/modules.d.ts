// Type declarations for modules without types

declare module 'pdfkit' {
  import { Readable } from 'stream';
  
  interface PDFDocumentOptions {
    size?: string | [number, number];
    margin?: number;
    margins?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    layout?: 'portrait' | 'landscape';
    info?: {
      Title?: string;
      Author?: string;
      Subject?: string;
      Keywords?: string;
    };
  }
  
  interface TextOptions {
    align?: 'left' | 'center' | 'right' | 'justify' | string;
    underline?: boolean;
    width?: number;
    height?: number;
    ellipsis?: boolean | string;
    columns?: number;
    columnGap?: number;
    indent?: number;
    paragraphGap?: number;
    lineGap?: number;
    wordSpacing?: number;
    characterSpacing?: number;
    fill?: boolean;
    stroke?: boolean;
    link?: string;
    goTo?: string;
    destination?: string;
    continued?: boolean;
    features?: string[];
    listType?: 'bullet' | 'numbered' | 'lettered';
    bulletRadius?: number;
    bulletIndent?: number;
    textIndent?: number;
  }
  
  class PDFDocument extends Readable {
    constructor(options?: PDFDocumentOptions);
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
    font(name: string): this;
    fontSize(size: number): this;
    text(text: string, options?: TextOptions): this;
    text(text: string, x?: number, y?: number, options?: TextOptions): this;
    moveDown(lines?: number): this;
    end(): void;
    addPage(options?: PDFDocumentOptions): this;
    fillColor(color: string): this;
    strokeColor(color: string): this;
    lineWidth(width: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    stroke(): this;
    rect(x: number, y: number, w: number, h: number): this;
    fill(color?: string): this;
    save(): this;
    restore(): this;
    rotate(angle: number, options?: { origin?: [number, number] }): this;
    scale(xFactor: number, yFactor?: number, options?: { origin?: [number, number] }): this;
    translate(x: number, y: number): this;
    y: number;
    x: number;
    page: {
      width: number;
      height: number;
      margins: {
        top: number;
        bottom: number;
        left: number;
        right: number;
      };
    };
  }
  
  export = PDFDocument;
}

declare module 'archiver' {
  import { Transform } from 'stream';
  
  interface ArchiverOptions {
    zlib?: {
      level: number;
    };
  }
  
  interface EntryData {
    name: string;
    prefix?: string;
    date?: Date;
    mode?: number;
    stats?: any;
  }
  
  interface Archiver extends Transform {
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
    append(source: NodeJS.ReadableStream | Buffer | string, data: EntryData): this;
    file(filepath: string, data: EntryData): this;
    directory(dirpath: string, destpath: string | false, data?: EntryData): this;
    glob(pattern: string, options?: any, data?: EntryData): this;
    finalize(): Promise<void>;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'warning', listener: (err: Error) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'progress', listener: (progress: { entries: { total: number; processed: number }; fs: { totalBytes: number; processedBytes: number } }) => void): this;
    pointer(): number;
    abort(): this;
    setFormat(format: string): this;
    setModule(module: any): this;
  }
  
  function archiver(format: 'zip' | 'tar' | 'json', options?: ArchiverOptions): Archiver;
  
  export = archiver;
}
