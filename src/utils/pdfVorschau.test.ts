import { describe, it, expect } from 'vitest';
import { dataUrlAlsBlob } from './pdfVorschau';

describe('PDF-Vorschau über Blob-Adresse (T-261)', () => {
  it('liest Base64- und Text-Data-URLs, sonst null', async () => {
    const pdf = dataUrlAlsBlob('data:application/pdf;filename=generated.pdf;base64,JVBERi0xLjQK');
    expect(pdf?.type).toBe('application/pdf');
    expect(await pdf?.text()).toBe('%PDF-1.4\n');
    expect(await dataUrlAlsBlob('data:text/plain,Hallo%20Welt')?.text()).toBe('Hallo Welt');
    expect(dataUrlAlsBlob('keine-adresse')).toBeNull();
    expect(dataUrlAlsBlob('data:application/pdf;base64,!!!')).toBeNull();
  });
});
