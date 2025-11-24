
import React from 'react';
import { Calculator, Sigma } from './icons';

interface MathKeyboardProps {
    onInsert: (text: string, cursorOffset?: number) => void;
    className?: string;
}

const MathKeyboard: React.FC<MathKeyboardProps> = ({ onInsert, className }) => {
    const buttons = [
        { label: 'x²', insert: '^{2}', offset: 0 },
        { label: 'xⁿ', insert: '^{}', offset: -1 },
        { label: '√', insert: '\\sqrt{}', offset: -1 },
        { label: '∛', insert: '\\sqrt[3]{}', offset: -1 },
        { label: '½', insert: '\\frac{صورت}{مخرج}', offset: 0 }, // Simplified insertion
        { label: '∞', insert: '\\infty', offset: 0 },
        { label: 'π', insert: '\\pi', offset: 0 },
        { label: 'θ', insert: '\\theta', offset: 0 },
        { label: 'α', insert: '\\alpha', offset: 0 },
        { label: 'β', insert: '\\beta', offset: 0 },
        { label: 'Σ', insert: '\\sum_{i=0}^{n}', offset: 0 },
        { label: '∫', insert: '\\int_{a}^{b}', offset: 0 },
        { label: '≠', insert: '\\neq', offset: 0 },
        { label: '≤', insert: '\\leq', offset: 0 },
        { label: '≥', insert: '\\geq', offset: 0 },
        { label: '±', insert: '\\pm', offset: 0 },
        { label: '→', insert: '\\rightarrow', offset: 0 },
        { label: '×', insert: '\\times', offset: 0 },
        { label: '÷', insert: '\\div', offset: 0 },
        { label: '...', insert: '\\dots', offset: 0 },
    ];

    return (
        <div className={`bg-secondary/30 border border-border rounded-xl p-2 ${className}`}>
            <div className="flex items-center gap-2 mb-2 px-1">
                <Calculator className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-bold">کیبورد ریاضی (LaTeX)</span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
                {buttons.map((btn, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => onInsert(btn.insert, btn.offset)}
                        className="h-8 bg-background hover:bg-primary/10 hover:text-primary border border-border rounded-md text-xs font-serif transition-colors flex items-center justify-center"
                        title={btn.insert}
                    >
                        {btn.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MathKeyboard;
