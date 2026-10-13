// pdfjs-dist legacy yapısı kendi tip dosyasını sunmaz; ana paketle aynı tipleri kullanır.
declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export * from 'pdfjs-dist'
}
