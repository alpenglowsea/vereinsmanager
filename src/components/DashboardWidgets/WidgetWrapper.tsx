import React, { useState } from 'react';
import { WidgetColSpan } from '../../types/dashboard';
import {
  X,
  GripVertical,
  Columns
} from 'lucide-react';

interface WidgetWrapperProps {
  id: string;
  title: string;
  categoryLabel?: string;
  colSpan: WidgetColSpan;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent, id: string) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, id: string) => void;
  onRemove?: () => void;
  onChangeColSpan?: (newSpan: WidgetColSpan) => void;
  onNavigate?: () => void;
  children: React.ReactNode;
  customHeader?: boolean;
}

export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({
  id,
  title,
  categoryLabel,
  colSpan,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onRemove,
  onChangeColSpan,
  onNavigate,
  children,
  customHeader = false
}) => {
  const [isLocalDragOver, setIsLocalDragOver] = useState(false);

  const colSpanClasses = {
    1: 'col-span-1',
    2: 'col-span-1 md:col-span-2',
    3: 'col-span-1 md:col-span-2 lg:col-span-3',
    4: 'col-span-1 md:col-span-2 lg:col-span-4'
  }[colSpan] || 'col-span-1';

  return (
    <div
      id={`dashboard-widget-${id}`}
      draggable
      onDragStart={(e) => onDragStart?.(e, id)}
      onDragEnd={(e) => {
        setIsLocalDragOver(false);
        onDragEnd?.(e);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver?.(e);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsLocalDragOver(true);
        onDragEnter?.(e, id);
      }}
      onDragLeave={(e) => {
        // Only reset if leaving this container
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsLocalDragOver(false);
          onDragLeave?.(e);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsLocalDragOver(false);
        onDrop?.(e, id);
      }}
      className={`${colSpanClasses} group/widget relative transition-all duration-200 h-full flex flex-col ${
        isDragging
          ? 'opacity-30 scale-[0.98] border-2 border-dashed border-blue-400 dark:border-blue-500 rounded-2xl'
          : ''
      } ${
        isLocalDragOver || isDragOver
          ? 'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 scale-[1.01] rounded-2xl transition-all shadow-md z-10'
          : ''
      }`}
    >
      {/* Tile Hover Controls Overlay */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover/widget:opacity-100 focus-within:opacity-100 transition-opacity bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs p-1 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-700/80">
        {/* Drag Handle */}
        <div
          className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg cursor-grab active:cursor-grabbing flex items-center gap-0.5 text-2xs font-semibold px-1.5 transition-colors"
          title="Kachel anfassen und an neue Position ziehen (Drag & Drop)"
        >
          <GripVertical className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ziehen</span>
        </div>

        {/* Change Size / ColSpan Cycle */}
        {onChangeColSpan && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const nextSpan: WidgetColSpan = colSpan === 1 ? 2 : colSpan === 2 ? 4 : 1;
              onChangeColSpan(nextSpan);
            }}
            className="p-1 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-bold px-1.5"
            title={`Breite anpassen (Aktuell: ${colSpan} Spalte${colSpan > 1 ? 'n' : ''})`}
          >
            <Columns className="w-3 h-3" />
            <span>{colSpan}x</span>
          </button>
        )}

        {/* 1-Click Remove Tile */}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
            title="Kachel vom Dashboard entfernen"
            aria-label="Kachel entfernen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="h-full flex flex-col flex-1">
        {children}
      </div>
    </div>
  );
};
