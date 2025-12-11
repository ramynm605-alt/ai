
import React from 'react';
import { Download, XCircle, FileText, CheckCircle } from './icons';
import { marked } from 'marked';

interface HandoutViewerProps {
    content: string;
    onClose: () => void;
}

const HandoutViewer: React.FC<HandoutViewerProps> = ({ content, onClose }) => {
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[500] bg-background flex flex-col animate-slide-up overflow-hidden">
            {/* Toolbar */}
            <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg">جزوه هوشمند</h2>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-success" />
                            آماده چاپ
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handlePrint}
                        className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover flex items-center gap-2 transition-colors print:hidden"
                    >
                        <Download className="w-4 h-4" />
                        <span>دانلود PDF / چاپ</span>
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full transition-colors print:hidden"
                    >
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Document Viewer */}
            <div className="flex-grow overflow-y-auto bg-secondary/30 p-4 md:p-8 custom-scrollbar">
                <div className="max-w-[21cm] mx-auto bg-white text-black min-h-[29.7cm] p-[2cm] shadow-xl rounded-sm print:shadow-none print:w-full print:max-w-none print:p-0 print:m-0">
                    <article className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-black prose-p:leading-relaxed prose-li:marker:text-black" dir="rtl">
                        <div dangerouslySetInnerHTML={{ __html: marked.parse(content) }} />
                    </article>
                </div>
                <div className="h-20 print:hidden"></div>
            </div>

            <style>{`
                @media print {
                    @page { margin: 2cm; }
                    body { background: white; }
                    .print\\:hidden { display: none !important; }
                    .prose { font-size: 12pt; }
                }
            `}</style>
        </div>
    );
};

export default HandoutViewer;
