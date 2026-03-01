import type { Sprite } from '../types';
import type { LayerExportMode } from './export';

export const getTimestamp = (): string => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}`;
};

export const compressPixelData = (pixelData: (string | null)[], palette: string[]): (number | null)[] => {
    return pixelData.map(color => {
        if (color === null) return null;
        const index = palette.indexOf(color);
        return index !== -1 ? index : null; // If color not in palette (which shouldn't happen), return null or perhaps add it? For now, assume it's in palette.
    });
};

export const decompressPixelData = (indices: (number | null)[], palette: string[]): (string | null)[] => {
    return indices.map(index => {
        if (index === null || index < 0 || index >= palette.length) return null;
        return palette[index];
    });
};

export interface ProjectJSON {
    type: 'project';
    version: string;
    name: string;
    width: number;
    height: number;
    fps: number;
    palette: string[];
    frames: {
        id: number;
        name: string;
        pixelData: (number | null)[];
        overlayPixelData: (number | null)[];
    }[];
}

export const saveProjectJSON = (projectName: string, sprites: Sprite[], fps: number, palette: string[], gridSize: number) => {
    const projectData: ProjectJSON = {
        type: 'project',
        version: '1.0',
        name: projectName,
        width: gridSize,
        height: gridSize,
        fps: fps,
        palette: palette,
        frames: sprites.map(sprite => ({
            id: sprite.id,
            name: sprite.name,
            pixelData: compressPixelData(sprite.pixelData, palette),
            overlayPixelData: compressPixelData(sprite.overlayPixelData, palette)
        }))
    };

    const jsonString = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    downloadAnchorNode.setAttribute("download", `${projectName}_${getTimestamp()}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
};

export const loadProjectJSON = (file: File): Promise<ProjectJSON> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                if (data.type !== 'project') {
                    throw new Error('Invalid file type. Expected a project file.');
                }
                resolve(data as ProjectJSON);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('File reading failed'));
        reader.readAsText(file);
    });
};

export const exportSpritesToJSON = (
    projectName: string,
    sprites: Sprite[],
    layerMode: LayerExportMode,
    frameIndex?: number
) => {
    // We export a subset of data representing individual frames
    const exportData = sprites.map(sprite => {
        let pixelsToExport = sprite.pixelData;
        let overlayPixelsToExport = sprite.overlayPixelData;

        // Apply layer mode logic
        if (layerMode === 'top') {
            pixelsToExport = new Array(sprite.pixelData.length).fill(null);
        } else if (layerMode === 'base') {
            overlayPixelsToExport = new Array(sprite.overlayPixelData.length).fill(null);
        }

        return {
            name: sprite.name,
            pixels: pixelsToExport,
            overlayPixels: overlayPixelsToExport
        };
    });

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);

    // Choose suffix based on number of sprites
    let suffix = `_selected_frames`;
    if (sprites.length === 1 && frameIndex !== undefined) {
        const formattedIndex = String(frameIndex + 1).padStart(2, '0');
        suffix = `_frame_${formattedIndex}`;
    }

    downloadAnchorNode.setAttribute("download", `${projectName}${suffix}_${layerMode}_${getTimestamp()}.json`);

    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
};
