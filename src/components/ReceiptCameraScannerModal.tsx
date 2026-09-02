import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Camera,
  RotateCw,
  RotateCcw,
  Sparkles,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  Plus,
  RefreshCw,
  Sun,
  Layers,
  Search,
  Link as LinkIcon,
  Maximize2,
  Sliders,
  AlertCircle,
  UploadCloud,
  ChevronRight,
  Zap,
  ZapOff
} from 'lucide-react';
import { Transaction, FinancialAccount, ClubSettings, ReceiptAttachment, ClubDocument, DocumentCategory } from '../types';
import {
  ScannedPage,
  ScannerFilterType,
  ReceiptScanMetadata,
  processScannedImage,
  generatePdfFromScannedPages,
  generateImageReceipt
} from '../services/receiptScannerService';

interface ReceiptCameraScannerModalProps {
  onClose: () => void;
  // If provided, saves scanned document directly to the documents archive
  onSaveAsDocument?: (doc: ClubDocument) => void;
  // If provided, the scanner will attach the receipt directly to this active transaction / form
  onAttachReceipt?: (receipt: ReceiptAttachment) => void;
  // If standalone, allows creating a new transaction with this receipt or linking to an existing one
  onLinkToTransaction?: (transactionId: string, receipt: ReceiptAttachment) => void;
  onCreateTransactionWithReceipt?: (receipt: ReceiptAttachment) => void;
  // Context data
  existingTransactions?: Transaction[];
  accounts?: FinancialAccount[];
  settings?: ClubSettings;
  prefillDocumentNumber?: string;
  prefillPartner?: string;
  prefillBookingText?: string;
}

export const ReceiptCameraScannerModal: React.FC<ReceiptCameraScannerModalProps> = ({
  onClose,
  onSaveAsDocument,
  onAttachReceipt,
  onLinkToTransaction,
  onCreateTransactionWithReceipt,
  existingTransactions = [],
  accounts = [],
  settings,
  prefillDocumentNumber = '',
  prefillPartner = '',
  prefillBookingText = ''
}) => {
  // Mode: 'camera' (taking photo) vs 'review' (editing / filtering / adding pages) vs 'link' (selecting existing transaction)
  const [viewMode, setViewMode] = useState<'camera' | 'review' | 'link'>('camera');
  
  // Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [shutterAnimation, setShutterAnimation] = useState(false);

  // Scanned pages state
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [uploadedPdf, setUploadedPdf] = useState<{ name: string; dataUrl: string; size: number } | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'image'>('pdf');
  const [isProcessing, setIsProcessing] = useState(false);

  // Metadata for PDF header / Beleg
  const [docNumber, setDocNumber] = useState<string>(
    prefillDocumentNumber || `BE-${new Date().getFullYear()}-${String(existingTransactions.length + 1).padStart(3, '0')}`
  );
  const [docPartner, setDocPartner] = useState<string>(prefillPartner || '');
  const [docText, setDocText] = useState<string>(prefillBookingText || '');

  // Linking state
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkFilterMissingOnly, setLinkFilterMissingOnly] = useState(true);

  // 1. Initialize and manage camera stream
  const startCamera = async (deviceId?: string) => {
    try {
      setCameraLoading(true);
      setCameraError(null);

      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check available video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setAvailableDevices(videoDevices);

      // Check torch support on the active track
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        // @ts-ignore
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        // @ts-ignore
        if (capabilities.torch) {
          setTorchAvailable(true);
        } else {
          setTorchAvailable(false);
        }
      }

      setCameraLoading(false);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraLoading(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Kamerazugriff wurde im Browser blockiert. Bitte Berechtigung erteilen oder Datei auswählen.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Keine Kamera am Gerät gefunden. Sie können ein Foto hochladen.');
      } else {
        setCameraError('Kamerastream konnte nicht gestartet werden. Bitte Dateiupload nutzen.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
  };

  useEffect(() => {
    if (viewMode === 'camera') {
      startCamera(selectedDeviceId);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [viewMode, selectedDeviceId]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const newTorch = !torchOn;
        // @ts-ignore
        await track.applyConstraints({ advanced: [{ torch: newTorch }] });
        setTorchOn(newTorch);
      } catch (e) {
        console.error('Failed to toggle torch:', e);
      }
    }
  };

  // 2. Capture a photo from the live video stream
  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Trigger shutter visual animation
    setShutterAnimation(true);
    setTimeout(() => setShutterAnimation(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Initial default filter is "document" for crisp receipt readability
    const processed = await processScannedImage(rawDataUrl, 'document', 0);

    const newPage: ScannedPage = {
      id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      originalDataUrl: rawDataUrl,
      processedDataUrl: processed,
      filter: 'document',
      rotation: 0,
      timestamp: new Date().toISOString()
    };

    setUploadedPdf(null);
    setPages(prev => [...prev, newPage]);
    setSelectedPageIndex(pages.length); // select the newly captured page
    setViewMode('review');
  };

  // Handle fallback file / gallery / PDF capture
  const handleFallbackCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = () => {
        const rawDataUrl = reader.result as string;
        setUploadedPdf({
          name: file.name,
          dataUrl: rawDataUrl,
          size: file.size
        });
        setPages([]);
        setExportFormat('pdf');
        setViewMode('review');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const rawDataUrl = reader.result as string;
      const processed = await processScannedImage(rawDataUrl, 'document', 0);
      const newPage: ScannedPage = {
        id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        originalDataUrl: rawDataUrl,
        processedDataUrl: processed,
        filter: 'document',
        rotation: 0,
        timestamp: new Date().toISOString()
      };
      setUploadedPdf(null);
      setPages(prev => [...prev, newPage]);
      setSelectedPageIndex(pages.length);
      setViewMode('review');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 3. Image manipulation in Review Mode
  const activePage = pages[selectedPageIndex] || pages[0];

  const handleFilterChange = async (filter: ScannerFilterType) => {
    if (!activePage) return;
    setIsProcessing(true);
    try {
      const updatedDataUrl = await processScannedImage(
        activePage.originalDataUrl,
        filter,
        activePage.rotation
      );
      setPages(prev =>
        prev.map((p, idx) =>
          idx === selectedPageIndex
            ? { ...p, filter, processedDataUrl: updatedDataUrl }
            : p
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRotate = async (deltaDegrees: number) => {
    if (!activePage) return;
    setIsProcessing(true);
    try {
      const newRotation = (activePage.rotation + deltaDegrees + 360) % 360;
      const updatedDataUrl = await processScannedImage(
        activePage.originalDataUrl,
        activePage.filter,
        newRotation
      );
      setPages(prev =>
        prev.map((p, idx) =>
          idx === selectedPageIndex
            ? { ...p, rotation: newRotation, processedDataUrl: updatedDataUrl }
            : p
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePage = (index: number) => {
    const updated = pages.filter((_, idx) => idx !== index);
    setPages(updated);
    if (updated.length === 0) {
      setViewMode('camera');
    } else {
      setSelectedPageIndex(Math.min(selectedPageIndex, updated.length - 1));
    }
  };

  const handleDeleteUploadedPdf = () => {
    setUploadedPdf(null);
    setViewMode('camera');
  };

  // 4. Generate final ReceiptAttachment (PDF or JPEG)
  const createFinalReceiptAttachment = async (): Promise<ReceiptAttachment> => {
    if (uploadedPdf) {
      return {
        name: uploadedPdf.name || `Beleg_${docNumber || 'Scan'}.pdf`,
        type: 'application/pdf',
        dataUrl: uploadedPdf.dataUrl,
        size: uploadedPdf.size,
        uploadedAt: new Date().toISOString()
      };
    }

    const metadata: ReceiptScanMetadata = {
      documentNumber: docNumber,
      partner: docPartner,
      bookingText: docText,
      clubName: settings?.clubName || 'TSV Musterstadt 1890 e.V.',
      date: new Date().toISOString()
    };

    if (exportFormat === 'pdf' || pages.length > 1) {
      return await generatePdfFromScannedPages(pages, metadata);
    } else {
      return generateImageReceipt(pages[0], metadata);
    }
  };

  const hasScannedContent = pages.length > 0 || uploadedPdf !== null;

  // 5. Completion Handlers
  const handleConfirmAttachDirect = async () => {
    if (!hasScannedContent) return;
    setIsProcessing(true);
    try {
      const receipt = await createFinalReceiptAttachment();
      if (onAttachReceipt) {
        onAttachReceipt(receipt);
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateNewTransaction = async () => {
    if (!hasScannedContent) return;
    setIsProcessing(true);
    try {
      const receipt = await createFinalReceiptAttachment();
      if (onCreateTransactionWithReceipt) {
        onCreateTransactionWithReceipt(receipt);
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveDirectToArchive = async () => {
    if (!hasScannedContent) return;
    setIsProcessing(true);
    try {
      const receipt = await createFinalReceiptAttachment();
      if (onSaveAsDocument) {
        const newDoc: ClubDocument = {
          id: `doc-scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: docText || docPartner || `Scan-Dokument ${docNumber || new Date().toLocaleDateString('de-DE')}`,
          fileName: receipt.name,
          fileType: receipt.type,
          fileSize: receipt.size,
          dataUrl: receipt.dataUrl,
          category: 'belege',
          date: new Date().toISOString().split('T')[0],
          uploadDate: new Date().toISOString(),
          tags: ['scan', 'digitalisiert', uploadedPdf ? 'pdf' : 'foto'],
          notes: `Eingescannt/Hochgeladen über Beleg-Scanner am ${new Date().toLocaleString('de-DE')}`,
          transactionDocNumber: docNumber || undefined,
          isReceipt: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        onSaveAsDocument(newDoc);
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLinkToExisting = async (targetTxId: string) => {
    if (!hasScannedContent) return;
    setIsProcessing(true);
    try {
      const receipt = await createFinalReceiptAttachment();
      if (onLinkToTransaction) {
        onLinkToTransaction(targetTxId, receipt);
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter existing transactions for linking mode
  const filteredTransactionsToLink = useMemo(() => {
    return existingTransactions.filter(tx => {
      if (linkFilterMissingOnly && tx.receipt) return false;
      if (!linkSearchQuery.trim()) return true;
      const q = linkSearchQuery.toLowerCase();
      return (
        tx.documentNumber.toLowerCase().includes(q) ||
        tx.partner.toLowerCase().includes(q) ||
        tx.bookingText.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q)
      );
    });
  }, [existingTransactions, linkFilterMissingOnly, linkSearchQuery]);

  const accMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-800">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-base">
                  Beleg-Kamerascanner & Digitalisierung
                </h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold rounded-full uppercase tracking-wider">
                  GoBD & DSGVO
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Physische Rechnungen und Kassenbelege via Smartphone / Webcam scannen & als PDF archivieren
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            {pages.length > 0 && (
              <div className="bg-slate-800 p-1 rounded-xl flex items-center border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('camera')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    viewMode === 'camera' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Kamera</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('review')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    viewMode === 'review' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Vorschau ({pages.length})</span>
                </button>
                {!onAttachReceipt && (
                  <button
                    type="button"
                    onClick={() => setViewMode('link')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                      viewMode === 'link' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Verknüpfen</span>
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto bg-slate-950 flex flex-col">
          
          {/* ================= MODE 1: LIVE CAMERA VIEWFINDER ================= */}
          {viewMode === 'camera' && (
            <div className="flex-1 flex flex-col p-4 space-y-4">
              {/* Camera Stream / Viewfinder Container */}
              <div className="relative flex-1 min-h-[380px] sm:min-h-[440px] bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
                {/* Shutter White Flash Animation */}
                {shutterAnimation && (
                  <div className="absolute inset-0 bg-white z-40 animate-out fade-out duration-200 pointer-events-none" />
                )}

                {/* Video Element */}
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover max-h-[550px]"
                />

                {/* Loading Indicator */}
                {cameraLoading && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
                    <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin mb-3" />
                    <p className="font-semibold text-slate-200 text-sm">Starte Gerätekamera...</p>
                    <p className="text-xs text-slate-400 mt-1">Bitte Zugriff im Browser bestätigen</p>
                  </div>
                )}

                {/* Camera Error / Fallback Card */}
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-30">
                    <div className="p-3 bg-amber-500/20 text-amber-400 rounded-full mb-3 border border-amber-500/30">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-slate-100 text-base mb-1">Kamerazugriff nicht verfügbar</h4>
                    <p className="text-xs text-slate-400 max-w-md mb-5 leading-relaxed">
                      {cameraError}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => startCamera(selectedDeviceId)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Erneut versuchen
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 shadow-md"
                      >
                        <UploadCloud className="w-4 h-4" />
                        Foto aus Galerie / Kamera-App laden
                      </button>
                    </div>
                  </div>
                )}

                {/* Scanner Target Guide Overlay (when streaming successfully) */}
                {!cameraLoading && !cameraError && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 sm:p-10">
                    {/* Document Guideline Box */}
                    <div className="relative w-full max-w-sm sm:max-w-md h-[80%] border-2 border-dashed border-emerald-400/60 rounded-2xl flex flex-col justify-between p-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                      {/* Top Corner Brackets */}
                      <div className="flex justify-between -mt-5 -mx-5">
                        <div className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                        <div className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                      </div>

                      {/* Center helper text */}
                      <div className="text-center bg-black/60 backdrop-blur-xs px-3 py-1.5 rounded-full self-center border border-white/10 text-2xs font-medium text-emerald-300">
                        📄 Rechnung oder Kassenbon im Rahmen platzieren
                      </div>

                      {/* Bottom Corner Brackets */}
                      <div className="flex justify-between -mb-5 -mx-5">
                        <div className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                        <div className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Top Viewfinder Controls (Torch, Camera Switch, Resolution) */}
                {!cameraLoading && !cameraError && (
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                      {availableDevices.length > 1 && (
                        <select
                          value={selectedDeviceId}
                          onChange={e => setSelectedDeviceId(e.target.value)}
                          className="px-2.5 py-1 bg-black/70 backdrop-blur-md border border-white/20 rounded-lg text-2xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {availableDevices.map((dev, idx) => (
                            <option key={dev.deviceId} value={dev.deviceId}>
                              {dev.label || `Kamera ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      )}

                      {torchAvailable && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          className={`p-2 rounded-lg backdrop-blur-md text-xs font-semibold transition-colors flex items-center gap-1 ${
                            torchOn ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-black/70 text-slate-200 border border-white/20 hover:bg-black/90'
                          }`}
                          title="Blitz / Taschenlampe"
                        >
                          {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-black/70 backdrop-blur-md border border-white/20 rounded text-[10px] font-mono text-emerald-400 font-bold">
                        FullHD HD-Scan
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Viewfinder Bottom Toolbar with Large Shutter Button */}
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 rounded-2xl border border-slate-800">
                {/* Left: Alternate File / Gallery / PDF Picker */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,.pdf"
                    onChange={handleFallbackCapture}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition-colors flex items-center gap-2"
                    title="Foto aus der Galerie auswählen oder PDF-Beleg hochladen"
                  >
                    <UploadCloud className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Foto / PDF hochladen</span>
                  </button>
                </div>

                {/* Center: Large Shutter Trigger Button */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={cameraLoading || !!cameraError}
                    className="group relative p-1 rounded-full bg-white/20 hover:bg-white/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                    title="Beleg fotografieren"
                  >
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white group-hover:bg-emerald-400 flex items-center justify-center shadow-lg transition-colors border-4 border-slate-950">
                      <Camera className="w-7 h-7 text-slate-950" />
                    </div>
                  </button>
                  <span className="text-[11px] text-slate-400 font-medium mt-1">Auslöser (Klick)</span>
                </div>

                {/* Right: Thumbnails of Scanned Pages & Review Button */}
                <div>
                  {pages.length > 0 || uploadedPdf ? (
                    <button
                      type="button"
                      onClick={() => setViewMode('review')}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <span>Vorschau {uploadedPdf ? '(PDF)' : `(${pages.length})`}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="w-24 text-right text-2xs text-slate-500">
                      Noch kein Beleg erfasst
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= MODE 2: SCAN REVIEW & ENHANCEMENT ================= */}
          {viewMode === 'review' && (activePage || uploadedPdf) && (
            <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 min-h-[460px]">
              
              {/* Left Side: Large Document Preview (Image or PDF) */}
              <div className="flex-1 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
                {uploadedPdf ? (
                  <>
                    {/* PDF Toolbar */}
                    <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-2xs font-bold uppercase tracking-wider">
                          PDF Dokument
                        </span>
                        <span className="font-bold text-slate-200 truncate max-w-xs">
                          {uploadedPdf.name}
                        </span>
                        <span className="text-2xs text-slate-400">
                          ({Math.round(uploadedPdf.size / 1024)} KB)
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-xs flex items-center gap-1"
                          title="Andere Datei wählen"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Ersetzen</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteUploadedPdf}
                          className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-colors"
                          title="PDF löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* PDF Embed / iframe */}
                    <div className="flex-1 p-2 flex items-center justify-center bg-slate-950 min-h-[380px]">
                      <iframe
                        src={uploadedPdf.dataUrl}
                        title="PDF Beleg-Vorschau"
                        className="w-full h-full min-h-[400px] rounded-lg border border-slate-800 bg-white"
                      />
                    </div>
                  </>
                ) : activePage ? (
                  <>
                    {/* Page Toolbar (Rotation, Delete, Page Indicator) */}
                    <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">
                          Seite {selectedPageIndex + 1} von {pages.length}
                        </span>
                        <span className="text-2xs text-slate-400">
                          ({activePage.filter.toUpperCase()})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRotate(-90)}
                          disabled={isProcessing}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                          title="90° nach links drehen"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotate(90)}
                          disabled={isProcessing}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                          title="90° nach rechts drehen"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>
                        <div className="h-4 w-px bg-slate-700 mx-1" />
                        <button
                          type="button"
                          onClick={() => handleDeletePage(selectedPageIndex)}
                          className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-colors"
                          title="Diese Seite löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Main Image View */}
                    <div className="flex-1 p-4 flex items-center justify-center bg-slate-950 overflow-auto min-h-[300px]">
                      <img
                        src={activePage.processedDataUrl}
                        alt={`Scann Seite ${selectedPageIndex + 1}`}
                        className="max-h-[420px] max-w-full object-contain rounded-lg shadow-xl border border-slate-800 bg-white transition-all"
                      />
                    </div>

                    {/* Thumbnails strip for multi-page documents */}
                    <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
                      {pages.map((p, idx) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPageIndex(idx)}
                          className={`relative shrink-0 w-14 h-18 rounded-lg overflow-hidden border-2 transition-all ${
                            idx === selectedPageIndex
                              ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                              : 'border-slate-700 hover:border-slate-500 opacity-70'
                          }`}
                        >
                          <img src={p.processedDataUrl} alt={`Seite ${idx + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] font-bold text-center text-white py-0.5">
                            S. {idx + 1}
                          </span>
                        </button>
                      ))}

                      {/* Add Page Button */}
                      <button
                        type="button"
                        onClick={() => setViewMode('camera')}
                        className="shrink-0 w-14 h-18 rounded-lg border-2 border-dashed border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 flex flex-col items-center justify-center gap-1 transition-all"
                        title="Weitere Seite scannen"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="text-[9px] font-semibold">+ Seite</span>
                      </button>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Right Side: Filters, Digital Document Settings & Export */}
              <div className="w-full md:w-80 flex flex-col space-y-4">
                
                {/* 1. Scanner Filters (for scanned photos) */}
                {activePage && !uploadedPdf && (
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Dokumenten-Filter (Lesbarkeit)
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleFilterChange('document')}
                        className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                          activePage.filter === 'document'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-xs'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>Dokument B/W</span>
                          {activePage.filter === 'document' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">Weißer Hintergrund & scharfe Schrift</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFilterChange('original')}
                        className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                          activePage.filter === 'original'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-xs'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>Farbe (Original)</span>
                          {activePage.filter === 'original' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">Unveränderte Echtfarben</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFilterChange('grayscale')}
                        className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                          activePage.filter === 'grayscale'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-xs'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>Graustufen</span>
                          {activePage.filter === 'grayscale' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">Gleichmäßige Grauabstufung</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFilterChange('contrast')}
                        className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                          activePage.filter === 'contrast'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-xs'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>Aufhellen</span>
                          {activePage.filter === 'contrast' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">Thermodruck & Quittungen</p>
                      </button>
                    </div>
                  </div>
                )}

                {/* PDF Info box */}
                {uploadedPdf && (
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span>PDF-Beleg bereit zur Übernahme</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Die Datei wird direkt als vollwertiger Beleg an die Buchung angehängt oder im Vereinsarchiv abgelegt.
                    </p>
                  </div>
                )}

                {/* 2. Format Selection (PDF vs JPEG) */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    Archiv-Format
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportFormat('pdf')}
                      className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                        exportFormat === 'pdf'
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold shadow-xs'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                        <span>DIN A4 PDF</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                        {pages.length > 1 ? `${pages.length} Seiten gebündelt` : 'Inkl. GoBD-Kopfzeile'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportFormat('image')}
                      disabled={pages.length > 1}
                      className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                        exportFormat === 'image'
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold shadow-xs'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                      title={pages.length > 1 ? 'Mehrseitige Belege werden als PDF gespeichert' : 'Als JPEG Bild'}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                        <span>JPEG Bild</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5">Komprimierte Bilddatei</p>
                    </button>
                  </div>

                  {/* Document Number / Metadata */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Belegnummer / Referenz
                      </label>
                      <input
                        type="text"
                        value={docNumber}
                        onChange={e => setDocNumber(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="z.B. BE-2025-010"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Action Buttons */}
                <div className="space-y-2 pt-2">
                  {onSaveAsDocument ? (
                    // Called from Document Management or Header New Document
                    <>
                      <button
                        type="button"
                        onClick={handleSaveDirectToArchive}
                        disabled={isProcessing}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Im Vereinsarchiv speichern</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateNewTransaction}
                        disabled={isProcessing}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Als Buchung mit Beleg anlegen</span>
                      </button>
                    </>
                  ) : onAttachReceipt ? (
                    // Called from inside TransactionFormModal
                    <button
                      type="button"
                      onClick={handleConfirmAttachDirect}
                      disabled={isProcessing}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Digitalisierten Beleg übernehmen</span>
                    </button>
                  ) : (
                    // Called standalone from FinanceView
                    <>
                      <button
                        type="button"
                        onClick={handleCreateNewTransaction}
                        disabled={isProcessing}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Neue Buchung mit Beleg erstellen</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewMode('link')}
                        disabled={isProcessing}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <LinkIcon className="w-4 h-4 text-emerald-400" />
                        <span>Mit bestehender Buchung verknüpfen</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= MODE 3: LINK TO EXISTING TRANSACTION ================= */}
          {viewMode === 'link' && (
            <div className="flex-1 p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">Buchung zum Verknüpfen auswählen</h4>
                  <p className="text-xs text-slate-400">
                    Der digitalisierte {exportFormat === 'pdf' ? 'PDF-Beleg' : 'Bildbeleg'} wird fest mit der gewählten Buchung verknüpft.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                    <input
                      type="checkbox"
                      checked={linkFilterMissingOnly}
                      onChange={e => setLinkFilterMissingOnly(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Nur Buchungen ohne Beleg anzeigen</span>
                  </label>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={linkSearchQuery}
                  onChange={e => setLinkSearchQuery(e.target.value)}
                  placeholder="Buchungsjournal nach Belegnummer, Partner oder Betrag durchsuchen..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Transaction List */}
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
                {filteredTransactionsToLink.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Keine passenden Buchungen gefunden.
                  </div>
                ) : (
                  filteredTransactionsToLink.slice(0, 30).map(tx => {
                    const acc = accMap.get(tx.accountId);
                    const isIncome = tx.amount >= 0;
                    return (
                      <div
                        key={tx.id}
                        onClick={() => handleLinkToExisting(tx.id)}
                        className="p-3.5 hover:bg-slate-800/80 transition-colors flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 bg-slate-800 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 rounded-lg transition-colors shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>

                          <div className="overflow-hidden">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-slate-200">
                                {tx.documentNumber}
                              </span>
                              <span className="text-2xs font-medium text-slate-400">
                                {new Date(tx.date).toLocaleDateString('de-DE')}
                              </span>
                              {!tx.receipt && (
                                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-semibold rounded">
                                  Beleg fehlt
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-slate-100 truncate max-w-sm">
                              {tx.partner} — {tx.bookingText}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {tx.category} • {acc?.name || tx.accountId}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right font-mono font-bold text-xs">
                            <span className={isIncome ? 'text-emerald-400' : 'text-rose-400'}>
                              {isIncome ? '+' : ''}{tx.amount.toFixed(2)} €
                            </span>
                          </div>

                          <button
                            type="button"
                            className="px-3 py-1.5 bg-emerald-600 group-hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                            <span>Verknüpfen</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-5 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Kameradigitalisierung lokal & verschlüsselt im Browser (IndexedDB)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium text-xs transition-colors"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
