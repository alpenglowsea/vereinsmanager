import React, { useState, useMemo } from 'react';
import { ClubDocument, DocumentCategory, DocumentFolder, Member, Transaction } from '../types';
import {
  FileText,
  Upload,
  Camera,
  Search,
  Filter,
  Download,
  Trash2,
  FolderInput,
  Edit3,
  Eye,
  Plus,
  Calendar,
  Tag,
  CheckSquare,
  Square,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  HardDrive,
  User,
  Receipt,
  LayoutGrid,
  List,
  ArrowUpDown,
  Folder,
  FolderPlus,
  Check,
  AlertTriangle,
  FolderArchive,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  FolderTree,
  MoreVertical,
  CornerDownRight,
  ArrowRight
} from 'lucide-react';
import { CATEGORY_CONFIG } from './DocumentViewerModal';
import { FolderModal } from './FolderModal';
import { MoveToFolderModal } from './MoveToFolderModal';
import { DeleteFolderModal } from './DeleteFolderModal';

interface DocumentsViewProps {
  documents: ClubDocument[];
  folders?: DocumentFolder[];
  members: Member[];
  transactions: Transaction[];
  onOpenUpload: (category?: DocumentCategory, folderId?: string | null) => void;
  onOpenScanner: () => void;
  onOpenViewer: (doc: ClubDocument) => void;
  onOpenEdit: (doc: ClubDocument) => void;
  onDeleteDoc: (id: string) => Promise<void>;
  onBatchDelete: (ids: string[]) => Promise<void>;
  onBatchMove: (ids: string[], targetCategory: DocumentCategory) => Promise<void>;
  onSaveFolder?: (folder: DocumentFolder) => Promise<void>;
  onDeleteFolder?: (folderId: string) => Promise<void>;
  onBatchMoveToFolder?: (docIds: string[], folderId: string | null, targetCategory?: DocumentCategory) => Promise<void>;
  onSyncReceipts?: () => Promise<void>;
}

type FormatFilter = 'all' | 'pdf' | 'images' | 'office' | 'text';
type SortOption = 'date_desc' | 'date_asc' | 'title_asc' | 'size_desc';

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  folders = [],
  members,
  transactions,
  onOpenUpload,
  onOpenScanner,
  onOpenViewer,
  onOpenEdit,
  onDeleteDoc,
  onBatchDelete,
  onBatchMove,
  onSaveFolder,
  onDeleteFolder,
  onBatchMoveToFolder,
  onSyncReceipts
}) => {
  // Navigation & Filtering State
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Sidebar tree toggle state (expanded folder ids)
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => {
    // Default expand root level folders
    return new Set(folders.filter(f => !f.parentId).map(f => f.id));
  });

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<ClubDocument | null>(null);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);

  // Folder modals state
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderModalParentId, setFolderModalParentId] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<DocumentFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<DocumentFolder | null>(null);

  // Move documents modal state
  const [moveModalDocs, setMoveModalDocs] = useState<ClubDocument[]>([]);
  const [moveModalOpen, setMoveModalOpen] = useState(false);

  // Currently active folder object (if any)
  const activeFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    return folders.find(f => f.id === selectedFolderId) || null;
  }, [folders, selectedFolderId]);

  // Compute breadcrumb path for the active folder
  const folderBreadcrumbs = useMemo(() => {
    if (!activeFolder) return [];
    const crumbs: DocumentFolder[] = [];
    let curr: DocumentFolder | undefined = activeFolder;
    const visited = new Set<string>();

    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      crumbs.unshift(curr);
      if (curr.parentId) {
        curr = folders.find(f => f.id === curr!.parentId);
      } else {
        break;
      }
    }
    return crumbs;
  }, [folders, activeFolder]);

  // Subfolders of the currently active view
  const currentSubfolders = useMemo(() => {
    if (selectedFolderId) {
      return folders.filter(f => f.parentId === selectedFolderId);
    }
    // When no folder is selected, if a category is selected show root folders of that category, else all root folders
    if (selectedCategory !== 'all') {
      return folders.filter(f => !f.parentId && (f.category === selectedCategory || f.category === 'all'));
    }
    return folders.filter(f => !f.parentId);
  }, [folders, selectedFolderId, selectedCategory]);

  // Helper to count documents recursively in a folder
  const getFolderDocCount = (folderId: string): number => {
    const getDescendants = (id: string): Set<string> => {
      const set = new Set<string>([id]);
      let added = true;
      while (added) {
        added = false;
        for (const f of folders) {
          if (f.parentId && set.has(f.parentId) && !set.has(f.id)) {
            set.add(f.id);
            added = true;
          }
        }
      }
      return set;
    };

    const allIds = getDescendants(folderId);
    return documents.filter(d => d.folderId && allIds.has(d.folderId)).length;
  };

  // Toggle folder expanded in tree
  const toggleFolderExpanded = (fId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(fId)) {
        next.delete(fId);
      } else {
        next.add(fId);
      }
      return next;
    });
  };

  // Available Years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    documents.forEach(d => {
      if (d.date) {
        const y = d.date.split('-')[0];
        if (y) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [documents]);

  // Filtered and Sorted Documents
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Folder filter
      if (selectedFolderId) {
        // Collect active folder + all descendant subfolder IDs
        const subIds = new Set<string>([selectedFolderId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const f of folders) {
            if (f.parentId && subIds.has(f.parentId) && !subIds.has(f.id)) {
              subIds.add(f.id);
              changed = true;
            }
          }
        }
        if (!doc.folderId || !subIds.has(doc.folderId)) {
          return false;
        }
      } else if (selectedCategory !== 'all') {
        // Category filter (only applied if not inside a specific folder)
        if (doc.category !== selectedCategory) {
          return false;
        }
      }

      // Format filter
      if (formatFilter === 'pdf') {
        const isPdf = doc.fileType.includes('pdf') || doc.fileName.toLowerCase().endsWith('.pdf');
        if (!isPdf) return false;
      } else if (formatFilter === 'images') {
        const isImage = doc.fileType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(doc.fileName);
        if (!isImage) return false;
      } else if (formatFilter === 'office') {
        const isOffice = /\.(docx?|xlsx?|pptx?|odt|ods)$/i.test(doc.fileName) || doc.fileType.includes('officedocument') || doc.fileType.includes('excel') || doc.fileType.includes('msword');
        if (!isOffice) return false;
      } else if (formatFilter === 'text') {
        const isText = doc.fileType.includes('text') || doc.fileType.includes('csv') || /\.(txt|csv|log|md)$/i.test(doc.fileName);
        if (!isText) return false;
      }

      // Year filter
      if (yearFilter !== 'all') {
        if (!doc.date || !doc.date.startsWith(yearFilter)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = doc.title.toLowerCase().includes(q);
        const inFileName = doc.fileName.toLowerCase().includes(q);
        const inNotes = doc.notes ? doc.notes.toLowerCase().includes(q) : false;
        const inTags = doc.tags ? doc.tags.some(t => t.toLowerCase().includes(q)) : false;
        const inMember = doc.memberName ? doc.memberName.toLowerCase().includes(q) : false;
        const inTxDoc = doc.transactionDocNumber ? doc.transactionDocNumber.toLowerCase().includes(q) : false;
        if (!inTitle && !inFileName && !inNotes && !inTags && !inMember && !inTxDoc) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'date_desc') {
        return (b.date || '').localeCompare(a.date || '');
      }
      if (sortBy === 'date_asc') {
        return (a.date || '').localeCompare(b.date || '');
      }
      if (sortBy === 'title_asc') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'size_desc') {
        return (b.fileSize || 0) - (a.fileSize || 0);
      }
      return 0;
    });
  }, [documents, folders, selectedFolderId, selectedCategory, formatFilter, yearFilter, searchQuery, sortBy]);

  // Selection Handlers
  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (selectedIds.size === filteredDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocuments.map(d => d.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Trigger Move for batch or single
  const handleOpenMoveModal = (docs: ClubDocument[]) => {
    setMoveModalDocs(docs);
    setMoveModalOpen(true);
  };

  // Download Single File
  const handleSingleDownload = (doc: ClubDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const link = document.createElement('a');
    link.href = doc.dataUrl;
    link.download = doc.fileName || `${doc.title}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Multiple Files
  const handleBatchDownload = () => {
    const docsToDownload = documents.filter(d => selectedIds.has(d.id));
    docsToDownload.forEach(doc => {
      const link = document.createElement('a');
      link.href = doc.dataUrl;
      link.download = doc.fileName || `${doc.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  // Format File Size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Document Icon Component
  const getDocIcon = (doc: ClubDocument) => {
    const isPdf = doc.fileType.includes('pdf') || doc.fileName.toLowerCase().endsWith('.pdf');
    const isImg = doc.fileType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(doc.fileName);
    const isSheet = /\.(xlsx?|ods|csv)$/i.test(doc.fileName) || doc.fileType.includes('spreadsheet') || doc.fileType.includes('excel');

    if (isPdf) return <FileText className="w-5 h-5 text-rose-500" />;
    if (isImg) return <ImageIcon className="w-5 h-5 text-indigo-500" />;
    if (isSheet) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    return <FileCode className="w-5 h-5 text-blue-500" />;
  };

  // Recursive Tree Node Renderer for Sidebar
  const renderSidebarFolderNode = (folder: DocumentFolder, depth: number = 0) => {
    const childFolders = folders.filter(f => f.parentId === folder.id);
    const hasChildren = childFolders.length > 0;
    const isExpanded = expandedFolderIds.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const docCount = getFolderDocCount(folder.id);

    return (
      <div key={folder.id} className="space-y-0.5">
        <div
          onClick={() => {
            setSelectedFolderId(folder.id);
            setSelectedCategory('all');
          }}
          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-all ${
            isSelected
              ? 'bg-blue-600 text-white font-semibold shadow-xs'
              : 'text-slate-700 hover:bg-slate-100/90'
          }`}
          style={{ paddingLeft: `${Math.max(10, depth * 14 + 10)}px` }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleFolderExpanded(folder.id, e)}
                className={`p-0.5 rounded hover:bg-black/10 transition-colors ${
                  isSelected ? 'text-white' : 'text-slate-400'
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-3.5 inline-block" />
            )}

            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: folder.color || '#3b82f6' }}
            />

            <span className="truncate" title={folder.name}>
              {folder.name}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isSelected
                  ? 'bg-blue-700 text-blue-100'
                  : 'bg-slate-200/70 text-slate-600'
              }`}
            >
              {docCount}
            </span>

            {/* Hover Actions Menu */}
            <div
              className={`hidden group-hover:flex items-center gap-0.5 ${
                isSelected ? 'text-white' : 'text-slate-400'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                title="Unterordner erstellen"
                onClick={() => {
                  setFolderModalParentId(folder.id);
                  setEditingFolder(null);
                  setFolderModalOpen(true);
                }}
                className="p-1 hover:bg-black/10 rounded transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                title="Ordner bearbeiten"
                onClick={() => {
                  setEditingFolder(folder);
                  setFolderModalOpen(true);
                }}
                className="p-1 hover:bg-black/10 rounded transition-colors"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                type="button"
                title="Ordner löschen"
                onClick={() => setDeletingFolder(folder)}
                className="p-1 hover:bg-rose-500 hover:text-white rounded transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Recursive Children */}
        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {childFolders.map(child => renderSidebarFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = folders.filter(f => !f.parentId);

  return (
    <div id="documents-view-container" className="flex flex-col lg:flex-row h-full w-full gap-6">
      {/* 1. LEFT SIDEBAR: Hierarchical Explorer & Categories */}
      <div className="w-full lg:w-72 shrink-0 space-y-4">
        {/* Main Action Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5">
          <button
            id="btn-upload-new-doc"
            type="button"
            onClick={() => onOpenUpload(undefined, selectedFolderId)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Dokument hochladen</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn-create-root-folder"
              type="button"
              onClick={() => {
                setFolderModalParentId(selectedFolderId || null);
                setEditingFolder(null);
                setFolderModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium transition-colors border border-slate-200"
            >
              <FolderPlus className="w-3.5 h-3.5 text-blue-600" />
              <span>{selectedFolderId ? '+ Unterordner' : '+ Neuer Ordner'}</span>
            </button>

            <button
              id="btn-scan-doc-camera"
              type="button"
              onClick={onOpenScanner}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium transition-colors border border-slate-200"
            >
              <Camera className="w-3.5 h-3.5 text-indigo-600" />
              <span>Beleg scannen</span>
            </button>
          </div>
        </div>

        {/* Eigene Ordner & Hierarchische Struktur */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-900 tracking-tight">
                Ordnerstruktur
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setFolderModalParentId(null);
                setEditingFolder(null);
                setFolderModalOpen(true);
              }}
              title="Hauptordner anlegen"
              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Neu</span>
            </button>
          </div>

          {/* Root All Documents Button */}
          <button
            type="button"
            onClick={() => {
              setSelectedFolderId(null);
              setSelectedCategory('all');
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
              selectedFolderId === null && selectedCategory === 'all'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FolderArchive className="w-4 h-4" />
              <span>Alle Dokumente</span>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedFolderId === null && selectedCategory === 'all'
                  ? 'bg-blue-700 text-blue-100'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {documents.length}
            </span>
          </button>

          {/* Folder Hierarchy List */}
          <div className="space-y-0.5 max-h-[320px] overflow-y-auto pr-1">
            {rootFolders.map(folder => renderSidebarFolderNode(folder, 0))}
            {rootFolders.length === 0 && (
              <div className="text-center py-4 px-2 text-slate-400 text-xs">
                Keine Ordner angelegt. Erstellen Sie Ihren ersten Ordner mit „+ Neu“.
              </div>
            )}
          </div>
        </div>

        {/* Standard-Kategorien (Schnellfilter) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
            Standard-Kategorien
          </div>

          <div className="space-y-1">
            {[
              { id: 'belege', label: 'Buchhaltungsbelege', icon: '🧾' },
              { id: 'vertraege', label: 'Verträge & Pacht', icon: '📜' },
              { id: 'satzung', label: 'Satzung & Ordnungen', icon: '⚖️' },
              { id: 'protokolle', label: 'Protokolle & JHV', icon: '📝' },
              { id: 'mitglieder', label: 'Mitglieder & Anträge', icon: '👥' },
              { id: 'bescheide', label: 'Finanzamt & Freistellung', icon: '🏛️' },
              { id: 'sonstiges', label: 'Sonstige Dokumente', icon: '📂' }
            ].map(cat => {
              const count = documents.filter(d => d.category === cat.id).length;
              const isSelected = selectedFolderId === null && selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedFolderId(null);
                    setSelectedCategory(cat.id as DocumentCategory);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                    isSelected
                      ? 'bg-slate-800 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. MAIN DOCUMENT CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 space-y-4">
        {/* SUBFOLDER TILES GRID (If current view has subfolders) */}
        {currentSubfolders.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {selectedFolderId ? 'Unterordner' : 'Enthaltene Ordner'} ({currentSubfolders.length})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentSubfolders.map(sub => {
                const subDocCount = getFolderDocCount(sub.id);
                const subChildCount = folders.filter(f => f.parentId === sub.id).length;

                return (
                  <div
                    key={sub.id}
                    onClick={() => setSelectedFolderId(sub.id)}
                    className="group bg-white rounded-2xl p-4 border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                        style={{ backgroundColor: sub.color || '#3b82f6' }}
                      >
                        <Folder className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-slate-900 text-xs truncate group-hover:text-blue-600 transition-colors">
                          {sub.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          {subDocCount} {subDocCount === 1 ? 'Dokument' : 'Dokumente'}
                          {subChildCount > 0 && ` • ${subChildCount} Unterordner`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setFolderModalParentId(sub.id);
                          setEditingFolder(null);
                          setFolderModalOpen(true);
                        }}
                        title="Unterordner anlegen"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFolder(sub);
                          setFolderModalOpen(true);
                        }}
                        title="Bearbeiten"
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SEARCH, FILTERS & CONTROLS TOOLBAR */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Dokumente durchsuchen..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Format Filter */}
            <select
              value={formatFilter}
              onChange={e => setFormatFilter(e.target.value as FormatFilter)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">Alle Dateiformate</option>
              <option value="pdf">📄 Nur PDFs</option>
              <option value="images">🖼️ Bilder & Scans</option>
              <option value="office">📊 Office & Tabellen</option>
              <option value="text">📝 Textdateien & CSV</option>
            </select>

            {/* Year Filter */}
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">Alle Jahre</option>
              {availableYears.map(y => (
                <option key={y} value={y}>
                  Jahr {y}
                </option>
              ))}
            </select>

            {/* Sorting */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="date_desc">Neueste zuerst</option>
              <option value="date_asc">Älteste zuerst</option>
              <option value="title_asc">Titel (A-Z)</option>
              <option value="size_desc">Dateigröße (absteigend)</option>
            </select>
          </div>

          {/* View Mode & Selection Indicator Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="font-semibold text-slate-800">{filteredDocuments.length}</span>{' '}
              {filteredDocuments.length === 1 ? 'Dokument gefunden' : 'Dokumente gefunden'}
              {selectedFolderId && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-[11px] font-medium border border-blue-200">
                  in {activeFolder?.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg border transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                title="Kachelansicht"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg border transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                title="Listenansicht"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* BATCH ACTION BAR (Shown when documents are selected) */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-900 text-white rounded-2xl p-3.5 px-5 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold bg-blue-800 px-2.5 py-1 rounded-lg">
                {selectedIds.size} {selectedIds.size === 1 ? 'Dokument' : 'Dokumente'} markiert
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-blue-200 hover:text-white underline"
              >
                Auswahl aufheben
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenMoveModal(documents.filter(d => selectedIds.has(d.id)))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                <FolderInput className="w-3.5 h-3.5" />
                <span>In Ordner verschieben</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Herunterladen</span>
              </button>

              <button
                type="button"
                onClick={() => setBatchDeleteConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Löschen</span>
              </button>
            </div>
          </div>
        )}

        {/* DOCUMENT LIST / GRID */}
        {filteredDocuments.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FolderArchive className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-sm font-bold text-slate-800">
                Keine Dokumente in dieser Ansicht
              </h3>
              <p className="text-xs text-slate-500">
                {selectedFolderId
                  ? `In „${activeFolder?.name}“ befinden sich derzeit keine Dokumente.`
                  : 'Laden Sie neue Vereinsdokumente hoch oder scannen Sie Belege.'}
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenUpload(undefined, selectedFolderId)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors inline-flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Dokument hier ablegen</span>
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map(doc => {
              const isSelected = selectedIds.has(doc.id);
              const categoryInfo = CATEGORY_CONFIG[doc.category] || CATEGORY_CONFIG.sonstiges;
              const assignedFolder = doc.folderId ? folders.find(f => f.id === doc.folderId) : null;

              return (
                <div
                  key={doc.id}
                  onClick={() => onOpenViewer(doc)}
                  className={`group bg-white rounded-2xl border transition-all duration-200 p-4.5 cursor-pointer flex flex-col justify-between relative shadow-xs hover:shadow-md ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Top Row: Checkbox, Doc Icon & Action Buttons */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => toggleSelect(doc.id, e)}
                          className="p-0.5 text-slate-400 hover:text-blue-600 rounded-md transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                          )}
                        </button>
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 shrink-0">
                          {getDocIcon(doc)}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleSingleDownload(doc, e)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Herunterladen"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenMoveModal([doc])}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="In Ordner verschieben"
                        >
                          <FolderInput className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEdit(doc)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmDoc(doc)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title & File Name */}
                    <h4 className="font-bold text-slate-900 text-xs mb-1 line-clamp-2 leading-snug" title={doc.title}>
                      {doc.title}
                    </h4>
                    <p className="text-[11px] font-mono text-slate-400 truncate mb-2.5" title={doc.fileName}>
                      {doc.fileName}
                    </p>

                    {/* Badges: Category & Folder */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${categoryInfo.bg} ${categoryInfo.color}`}>
                        {categoryInfo.label}
                      </span>

                      {assignedFolder && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-md font-medium flex items-center gap-1 text-slate-700 bg-slate-100 border border-slate-200"
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: assignedFolder.color || '#3b82f6' }}
                          />
                          <span>{assignedFolder.name}</span>
                        </span>
                      )}

                      {doc.transactionDocNumber && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Receipt className="w-2.5 h-2.5" />
                          {doc.transactionDocNumber}
                        </span>
                      )}

                      {doc.memberName && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                          <User className="w-2.5 h-2.5" />
                          {doc.memberName}
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {doc.tags.slice(0, 3).map((t, idx) => (
                          <span key={idx} className="text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded">
                            #{t}
                          </span>
                        ))}
                        {doc.tags.length > 3 && (
                          <span className="text-[9px] text-slate-400">+{doc.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Metadata: Date & Size */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {doc.date ? new Date(doc.date).toLocaleDateString('de-DE') : '-'}
                    </span>
                    <span className="font-mono text-slate-500">{formatFileSize(doc.fileSize)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="text-slate-400 hover:text-blue-600"
                    >
                      {selectedIds.size > 0 && selectedIds.size === filteredDocuments.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3">Dokument & Dateiname</th>
                  <th className="py-3 px-3">Ordner / Kategorie</th>
                  <th className="py-3 px-3">Verknüpfung</th>
                  <th className="py-3 px-3">Datum</th>
                  <th className="py-3 px-3 text-right">Größe</th>
                  <th className="py-3 px-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredDocuments.map(doc => {
                  const isSelected = selectedIds.has(doc.id);
                  const categoryInfo = CATEGORY_CONFIG[doc.category] || CATEGORY_CONFIG.sonstiges;
                  const assignedFolder = doc.folderId ? folders.find(f => f.id === doc.folderId) : null;

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => onOpenViewer(doc)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleSelect(doc.id)}
                          className="text-slate-400 hover:text-blue-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-slate-100 shrink-0">
                            {getDocIcon(doc)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate max-w-xs md:max-w-sm">
                              {doc.title}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400 truncate">
                              {doc.fileName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          {assignedFolder ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1.5 text-slate-700 bg-slate-100 border border-slate-200 w-fit">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: assignedFolder.color || '#3b82f6' }}
                              />
                              <span>{assignedFolder.name}</span>
                            </span>
                          ) : (
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border w-fit ${categoryInfo.bg} ${categoryInfo.color}`}>
                              {categoryInfo.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {doc.transactionDocNumber ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            {doc.transactionDocNumber}
                          </span>
                        ) : doc.memberName ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">
                            {doc.memberName}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {doc.date ? new Date(doc.date).toLocaleDateString('de-DE') : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                        {formatFileSize(doc.fileSize)}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleSingleDownload(doc, e)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Herunterladen"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenMoveModal([doc])}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="In Ordner verschieben"
                          >
                            <FolderInput className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEdit(doc)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Bearbeiten"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmDoc(doc)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. MODALS & POPUPS */}

      {/* Folder Create / Edit Modal */}
      {folderModalOpen && (
        <FolderModal
          isOpen={folderModalOpen}
          onClose={() => {
            setFolderModalOpen(false);
            setEditingFolder(null);
            setFolderModalParentId(null);
          }}
          onSave={async (folderData) => {
            if (onSaveFolder) {
              await onSaveFolder(folderData);
            }
            setFolderModalOpen(false);
            setEditingFolder(null);
            setFolderModalParentId(null);
          }}
          allFolders={folders}
          folderToEdit={editingFolder}
          initialParentId={folderModalParentId}
        />
      )}

      {/* Folder Delete Confirmation Modal */}
      {deletingFolder && (
        <DeleteFolderModal
          isOpen={!!deletingFolder}
          onClose={() => setDeletingFolder(null)}
          onConfirm={async (folderId) => {
            if (onDeleteFolder) {
              await onDeleteFolder(folderId);
            }
            if (selectedFolderId === folderId) {
              setSelectedFolderId(null);
            }
            setDeletingFolder(null);
          }}
          folder={deletingFolder}
          allFolders={folders}
          documents={documents}
        />
      )}

      {/* Move Document(s) to Folder Modal */}
      {moveModalOpen && moveModalDocs.length > 0 && (
        <MoveToFolderModal
          isOpen={moveModalOpen}
          onClose={() => {
            setMoveModalOpen(false);
            setMoveModalDocs([]);
          }}
          onMove={async (docIds, targetFolderId, targetCategory) => {
            if (onBatchMoveToFolder) {
              await onBatchMoveToFolder(docIds, targetFolderId, targetCategory);
            }
            setMoveModalOpen(false);
            setMoveModalDocs([]);
            clearSelection();
          }}
          documentsToMove={moveModalDocs}
          allFolders={folders}
        />
      )}

      {/* Batch Delete Confirmation Dialog */}
      {batchDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {selectedIds.size} Dokumente endgültig löschen?
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Möchten Sie die ausgewählten {selectedIds.size} Dokumente wirklich unwiderruflich aus dem Archiv entfernen?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setBatchDeleteConfirmOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onBatchDelete(Array.from(selectedIds));
                  setBatchDeleteConfirmOpen(false);
                  clearSelection();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                Ausgewählte löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Dialog */}
      {deleteConfirmDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Dokument löschen?
            </h3>
            <p className="text-xs text-slate-500 mb-1 leading-relaxed">
              Möchten Sie das folgende Dokument unwiderruflich löschen?
            </p>
            <p className="text-xs font-semibold text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200 mb-6 truncate">
              {deleteConfirmDoc.title} ({deleteConfirmDoc.fileName})
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmDoc(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteDoc(deleteConfirmDoc.id);
                  setDeleteConfirmDoc(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                Dokument löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
