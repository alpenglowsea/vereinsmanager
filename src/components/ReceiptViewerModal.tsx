import React from 'react';
import { ReceiptAttachment } from '../types';
import { X, Download, FileText, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ReceiptViewerModalProps {
  receipt: ReceiptAttachment | null;
  documentNumber: string;
  bookingText: string;
  onClose: () => void;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  receipt,
  documentNumber,
  bookingText,
  onClose
}) => {
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);

  if (!receipt) return null;

  const isPdf = receipt.type === 'application/pdf' || receipt.dataUrl.startsWith('data:application/pdf');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = receipt.dataUrl;
    link.download = receipt.name || `Beleg_${documentNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">
                Belegarchiv: {documentNumber}
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-md">
                {receipt.name} ({Math.round(receipt.size / 1024)} KB) • {bookingText}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isPdf && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Verkleinern"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-500 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                  className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Vergrößern"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Drehen"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <div className="h-5 w-px bg-slate-200 mx-1" />
              </>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Herunterladen
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 bg-slate-100 p-4 overflow-auto flex items-center justify-center min-h-[420px]">
          {isPdf ? (
            <iframe
              src={receipt.dataUrl}
              title={`Beleg ${documentNumber}`}
              className="w-full h-full min-h-[550px] rounded-lg border border-slate-300 shadow-inner bg-white"
            />
          ) : (
            <div className="flex items-center justify-center p-4">
              <img
                src={receipt.dataUrl}
                alt={`Beleg ${documentNumber}`}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-out'
                }}
                className="max-h-[540px] max-w-full object-contain rounded-lg shadow-md border border-slate-300 bg-white"
              />
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>DSGVO-konform verschlüsselt in der lokalen Browserdatenbank (IndexedDB) gespeichert.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium text-xs transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
