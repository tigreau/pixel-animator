import React from 'react';
import { useEditor } from '../../contexts/editorContextShared';

const MAX_SLOTS = 8;

export const RecentColors: React.FC = () => {
    const { recentColors, setCurrentColor, currentTool, setTool, currentColor } = useEditor();

    if (recentColors.length === 0) return null;

    // If user has 3 or fewer recent colors, show 4 slots (1 clear + 3 colors).
    // If they have 4 or more, expand to show all 8 slots.
    const displaySlots = recentColors.length >= 4 ? MAX_SLOTS : 4;
    const slots = Array.from({ length: displaySlots });

    return (
        <div className="recent-colors-section">
            <h3>Recent</h3>
            <div className="recent-colors-grid">
                {slots.map((_, index) => {
                    if (index === 0) {
                        return (
                            <div
                                key="clear"
                                className={`palette-color clear-swatch ${currentTool === 'eraser' || (currentTool === 'fill' && currentColor === null) ? 'active' : ''}`}
                                onClick={() => {
                                    if (currentTool === 'fill') {
                                        setCurrentColor(null);
                                    } else {
                                        setTool('eraser');
                                    }
                                }}
                                title="Transparent / Eraser"
                            />
                        );
                    }

                    const colorIndex = index - 1;
                    const color = recentColors[colorIndex];

                    if (color) {
                        return (
                            <div
                                key={color}
                                className={`palette-color ${color === currentColor && currentTool !== 'eraser' && currentTool !== 'select' ? 'active' : ''}`}
                                style={{ backgroundColor: color }}
                                onClick={() => setCurrentColor(color)}
                                title={color}
                            />
                        );
                    }

                    // Empty slot
                    return <div key={`empty-${index}`} className="palette-color empty" style={{ opacity: 0.1, background: '#333' }} />;
                })}
            </div>
        </div>
    );
};
