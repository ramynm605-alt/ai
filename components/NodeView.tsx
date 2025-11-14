

import React from 'react';
import { MindMapNode, NodeContent } from '../types';
import { ArrowRight } from './icons';

interface NodeViewProps {
    node: MindMapNode;
    content: NodeContent;
    onBack: () => void;
    onStartQuiz: () => void;
    onNavigate: (nodeId: string) => void;
    prevNode: MindMapNode | null;
    nextNode: MindMapNode | null;
}

const Section: React.FC<{ title: string; content: string }> = ({ title, content }) => (
    <div className="mb-6">
        <h3 className="pb-2 mb-3 text-xl font-semibold border-b-2 text-primary border-primary/30">{title}</h3>
        <div className="node-content-section leading-relaxed text-card-foreground/90" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
);

const NodeView: React.FC<NodeViewProps> = ({ node, content, onBack, onStartQuiz, onNavigate, prevNode, nextNode }) => {
    return (
        <div className="max-w-4xl p-4 mx-auto sm:p-6 md:p-8">
            <button onClick={onBack} className="flex items-center gap-2 mb-6 text-sm font-medium text-primary hover:underline">
                <ArrowRight className="w-4 h-4 transform rotate-180" />
                <span>بازگشت به نقشه ذهنی</span>
            </button>
            <div className="p-6 border rounded-lg shadow-lg sm:p-8 bg-card border-border">
                <h2 className="mb-8 text-3xl font-bold text-center text-card-foreground">{node.title}</h2>
                <Section title="مقدمه" content={content.introduction} />
                <Section title="تئوری" content={content.theory} />
                <Section title="مثال" content={content.example} />
                <Section title="ارتباط با سایر مفاهیم" content={content.connection} />
                <Section title="نتیجه‌گیری" content={content.conclusion} />
                <div className="flex flex-col items-center gap-4 pt-6 mt-8 border-t sm:flex-row sm:justify-between border-border">
                    <button 
                        onClick={() => prevNode && onNavigate(prevNode.id)} 
                        disabled={!prevNode}
                        className="w-full px-6 py-2 font-semibold rounded-md sm:w-auto text-secondary-foreground bg-secondary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed">
                        درس قبلی
                    </button>
                    <button onClick={onStartQuiz} className="order-first w-full px-8 py-3 font-bold text-white transition-transform duration-200 rounded-lg sm:order-none sm:w-auto bg-primary hover:bg-primary-hover active:scale-95">
                        آماده‌ام، برویم برای آزمون!
                    </button>
                    <button 
                        onClick={() => nextNode && onNavigate(nextNode.id)} 
                        disabled={!nextNode || nextNode.locked}
                        className="w-full px-6 py-2 font-semibold rounded-md sm:w-auto text-secondary-foreground bg-secondary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                        title={nextNode?.locked ? 'ابتدا باید درس فعلی را کامل کنید' : ''}
                        >
                        درس بعدی
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NodeView;