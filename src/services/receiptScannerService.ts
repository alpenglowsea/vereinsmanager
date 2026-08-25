import jsPDF from 'jspdf';
import { ReceiptAttachment } from '../types';

export type ScannerFilterType = 'original' | 'document' | 'grayscale' | 'contrast';

export interface ScannedPage {
  id: string;
  originalDataUrl: string;
  processedDataUrl: string;
  filter: ScannerFilterType;
  rotation: number; // 0, 90, 180, 270
  timestamp: string;
}

export interface ReceiptScanMetadata {
  documentNumber?: string;
  bookingText?: string;
  partner?: string;
  amount?: number;
  date?: string;
  clubName?: string;
}

/**
 * Applies rotation and image filters on an image data URL via an offscreen HTML Canvas
 */
export async function processScannedImage(
  dataUrl: string,
  filter: ScannerFilterType = 'original',
  rotation: number = 0
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const isRotated90or270 = rotation === 90 || rotation === 270;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Set dimensions taking rotation into account
        canvas.width = isRotated90or270 ? img.height : img.width;
        canvas.height = isRotated90or270 ? img.width : img.height;

        // Perform rotation transformation
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();

        if (filter === 'original') {
          // Output high quality JPEG
          resolve(canvas.toDataURL('image/jpeg', 0.92));
          return;
        }

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        if (filter === 'grayscale') {
          for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }
        } else if (filter === 'contrast') {
          // Increase contrast & brightness slightly
          const factor = 1.35;
          const brightness = 10;
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128 + brightness));
            data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128 + brightness));
            data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128 + brightness));
          }
        } else if (filter === 'document') {
          // Document filter: high-contrast thresholding with adaptive background whitening
          for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            let enhanced = gray;
            if (gray > 145) {
              // Whiten paper background
              enhanced = Math.min(255, gray * 1.25 + 30);
            } else {
              // Darken text & ink
              enhanced = Math.max(0, gray * 0.75 - 20);
            }
            data[i] = enhanced;
            data[i + 1] = enhanced;
            data[i + 2] = enhanced;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        console.error('Error processing image in canvas:', err);
        resolve(dataUrl);
      }
    };
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}

/**
 * Calculates byte size of a base64 data URL
 */
export function getBase64Size(dataUrl: string): number {
  const head = dataUrl.indexOf(',') + 1;
  const base64Str = dataUrl.substring(head);
  const padding = (base64Str.endsWith('==') ? 2 : base64Str.endsWith('=') ? 1 : 0);
  return Math.round((base64Str.length * 3) / 4 - padding);
}

/**
 * Compiles one or more scanned pages into a standard DIN A4 PDF document
 */
export async function generatePdfFromScannedPages(
  pages: ScannedPage[],
  metadata: ReceiptScanMetadata = {}
): Promise<ReceiptAttachment> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const headerHeight = 22;

  for (let index = 0; index < pages.length; index++) {
    if (index > 0) {
      doc.addPage('a4', 'portrait');
    }

    const page = pages[index];

    // 1. Draw top archival header bar
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, margin, pageWidth - 2 * margin, headerHeight, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(margin, margin, pageWidth - 2 * margin, headerHeight, 'D');

    // Club Name & Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(metadata.clubName || 'VereinsManager Lokal • Digitales Belegarchiv', margin + 4, margin + 6);

    // Belegnummer & Date
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const docInfo = [
      metadata.documentNumber ? `Beleg-Nr.: ${metadata.documentNumber}` : '',
      metadata.date ? `Datum: ${new Date(metadata.date).toLocaleDateString('de-DE')}` : `Erfasst am: ${new Date().toLocaleDateString('de-DE')}`,
      metadata.partner ? `Partner: ${metadata.partner}` : '',
      metadata.amount !== undefined ? `Betrag: ${metadata.amount.toFixed(2)} €` : ''
    ].filter(Boolean).join('  |  ');

    doc.text(docInfo, margin + 4, margin + 12);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Seite ${index + 1} von ${pages.length}  •  Kameradigitalisierung gem. GoBD / DSGVO  •  Filter: ${page.filter.toUpperCase()}`,
      margin + 4,
      margin + 18
    );

    // 2. Add Scanned Image
    const availableWidth = pageWidth - 2 * margin;
    const availableHeight = pageHeight - 2 * margin - headerHeight - 4;
    const startY = margin + headerHeight + 3;

    // Load image to compute exact aspect ratio
    const imgDims = await new Promise<{ w: number; h: number }>((resolve) => {
      const i = new Image();
      i.onload = () => resolve({ w: i.width, h: i.height });
      i.onerror = () => resolve({ w: 1000, h: 1400 });
      i.src = page.processedDataUrl;
    });

    const imgAspect = imgDims.w / imgDims.h;
    const containerAspect = availableWidth / availableHeight;

    let renderW = availableWidth;
    let renderH = availableHeight;
    let renderX = margin;
    let renderY = startY;

    if (imgAspect > containerAspect) {
      renderW = availableWidth;
      renderH = availableWidth / imgAspect;
      renderY = startY + (availableHeight - renderH) / 2;
    } else {
      renderH = availableHeight;
      renderW = availableHeight * imgAspect;
      renderX = margin + (availableWidth - renderW) / 2;
    }

    doc.addImage(page.processedDataUrl, 'JPEG', renderX, renderY, renderW, renderH, undefined, 'FAST');
  }

  const pdfDataUrl = doc.output('datauristring');
  const size = getBase64Size(pdfDataUrl);
  const docNumClean = (metadata.documentNumber || 'BELEG').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Beleg_${docNumClean}_${new Date().toISOString().split('T')[0]}.pdf`;

  return {
    name: filename,
    type: 'application/pdf',
    size,
    dataUrl: pdfDataUrl,
    uploadedAt: new Date().toISOString()
  };
}

/**
 * Creates an image ReceiptAttachment from a processed page
 */
export function generateImageReceipt(
  page: ScannedPage,
  metadata: ReceiptScanMetadata = {}
): ReceiptAttachment {
  const size = getBase64Size(page.processedDataUrl);
  const docNumClean = (metadata.documentNumber || 'BELEG').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Beleg_${docNumClean}_${new Date().toISOString().split('T')[0]}.jpg`;

  return {
    name: filename,
    type: 'image/jpeg',
    size,
    dataUrl: page.processedDataUrl,
    uploadedAt: new Date().toISOString()
  };
}
