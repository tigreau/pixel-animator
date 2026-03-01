import React from 'react';
import { useEditor } from '../../contexts/editorContextShared';

export const SelectionTools: React.FC = () => {
    const {
        flipSelectionHorizontal,
        flipSelectionVertical,
        rotateSelectionLeft,
        rotateSelectionRight,
        stamp,
        isStamping
    } = useEditor();

    return (
        <div className="palette-section">
            <h3>Selection Tools</h3>
            <div className="transform-controls">
                <button className="action-btn" title="Flip Horizontal (H)" onClick={flipSelectionHorizontal}>Flip H</button>
                <button className="action-btn" title="Flip Vertical (V)" onClick={flipSelectionVertical}>Flip V</button>
                <button className="action-btn" title="Rotate Left (Q)" onClick={rotateSelectionLeft}>Rotate L</button>
                <button className="action-btn" title="Rotate Right (E)" onClick={rotateSelectionRight}>Rotate R</button>
            </div>
            <div className="transform-controls">
                <button
                    className={`action-btn ${isStamping ? 'active' : ''}`}
                    title="Stamp (Enter)"
                    onClick={stamp}
                    style={{ gridColumn: 'span 2', marginTop: '8px', fontSize: '0.85rem' }}
                >
                    Stamp
                </button>
            </div>
        </div>
    );
};
