
import React from 'react';
import { Weakness } from '../types';
import { CheckCircle, XCircle } from './icons';

interface WeaknessTrackerProps {
    weaknesses: Weakness[];
}

const WeaknessTracker: React.FC<WeaknessTrackerProps> = ({ weaknesses }) => {
    if (weaknesses.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center rounded-lg bg-card text-muted-foreground">
                <CheckCircle className="w-16 h-16 mb-4 text-success" />
                <h3 className="text-xl font-semibold">عالی!</h3>
                <p>تا اینجا هیچ نقطه ضعفی ثبت نشده است. به یادگیری ادامه دهید.</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            <h2 className="pb-2 text-xl font-bold border-b text-foreground border-border">نقاط ضعف برای مرور</h2>
            {weaknesses.map((weakness, index) => (
                <div key={index} className="p-4 border rounded-lg shadow-sm bg-card border-destructive/30">
                    <p className="mb-3 font-semibold text-card-foreground/90">{weakness.question}</p>
                    <div className="flex items-center p-2 mb-2 rounded-md text-destructive bg-destructive/20">
                        <XCircle className="w-5 h-5 ml-2" />
                        <span>پاسخ شما: {weakness.incorrectAnswer}</span>
                    </div>
                    <div className="flex items-center p-2 rounded-md text-success bg-success/20">
                        <CheckCircle className="w-5 h-5 ml-2" />
                        <span>پاسخ صحیح: {weakness.correctAnswer}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default WeaknessTracker;