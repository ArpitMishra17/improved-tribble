declare module 'word-extractor' {
  class WordExtractor {
    extract(filePath: string | Buffer): Promise<WordExtractorDocument>;
  }

  interface WordExtractorDocument {
    getBody(): string;
    getFootnotes(): string;
    getHeaders(): string;
    getFooters(): string;
    getAnnotations(): string;
    getEndNotes(): string;
  }

  export = WordExtractor;
}
