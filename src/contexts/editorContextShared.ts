import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Sprite, Tool } from '../types';
import type { LayerExportMode } from '../utils/export';

export type Layer = 'base' | 'top';

export interface EditorContextType {
    sprites: Sprite[];
    activeSpriteId: number;
    activeSprite: Sprite | undefined;
    currentColor: string | null;
    currentTool: Tool;
    isDrawing: boolean;
    recentColors: string[];
    setIsDrawing: (drawing: boolean) => void;
    updatePixel: (pixelIndex: number, maskConstraint?: 'inside' | 'outside' | null) => void;
    fill: (pixelIndex: number) => void;
    selectedPixels: Set<number>;
    setSelectedPixels: (pixels: Set<number>) => void;
    addToSelection: (index: number) => void;
    clearSelection: () => void;
    liftSelection: (pixelsOverride?: Set<number>) => void;
    floatingLayer: Map<number, string>;
    flipSelectionHorizontal: () => void;
    flipSelectionVertical: () => void;
    rotateSelectionLeft: () => void;
    rotateSelectionRight: () => void;
    nudgeSelection: (dx: number, dy: number) => void;
    setActiveSpriteId: (id: number) => void;
    setCurrentColor: (color: string | null) => void;
    setTool: (tool: Tool) => void;
    undo: () => void;
    redo: () => void;
    clearCanvas: () => void;
    canUndo: boolean;
    canRedo: boolean;
    canClear: boolean;
    addSprite: () => void;
    duplicateSprite: () => void;
    deleteSprite: (id?: number) => void;
    moveSprite: (oldIndex: number, newIndex: number) => void;
    moveSprites: (indices: number[], insertAtIndex: number) => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    isOnionSkinning: boolean;
    setIsOnionSkinning: (on: boolean) => void;
    importMultipleFromJSON: (files: { name: string; pixels: (string | null)[]; overlayPixels?: (string | null)[] }[]) => number[];
    stamp: () => void;
    isStamping: boolean;
    fps: number;
    setFps: Dispatch<SetStateAction<number>>;
    brushSize: 1 | 2;
    setBrushSize: (size: 1 | 2) => void;
    addSelectionBatch: (indices: number[]) => void;
    cancelStroke: () => void;
    activeLayer: Layer;
    setActiveLayer: (layer: Layer) => void;
    isOverlayStacked: boolean;
    setIsOverlayStacked: (stacked: boolean) => void;
    loadProject: (file: File) => Promise<void>;
    saveProject: (projectName: string) => void;
    exportFrame: (projectName: string, layerMode: LayerExportMode) => void;
    exportFrameJSON: (projectName: string, layerMode: LayerExportMode) => void;
    exportSpriteSheet: (projectName: string, layerMode: LayerExportMode, spritesToExport?: Sprite[]) => void;
    exportSelectedJSON: (projectName: string, layerMode: LayerExportMode, spritesToExport: Sprite[]) => void;
    exportSelectedPNG: (projectName: string, layerMode: LayerExportMode, spritesToExport: Sprite[]) => void;
    exportGIF: (projectName: string, layerMode: LayerExportMode) => void;
    layerExportMode: LayerExportMode;
    setLayerExportMode: (mode: LayerExportMode) => void;
    projectName: string;
    setProjectName: (name: string) => void;
}

export const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error('useEditor must be used within an EditorProvider');
    }
    return context;
};
