
import React from "react";
import { cn } from "../../lib/utils";

interface BoxLoaderProps {
  className?: string;
  size?: number;
  color?: string; 
}

const BoxLoader: React.FC<BoxLoaderProps> = ({ 
  className, 
  size = 64,
  color
}) => {
  // محاسبه اندازه هر مکعب
  const boxSize = Math.max(6, Math.floor(size / 3));

  return (
    <div 
      className={cn("relative flex items-center justify-center pointer-events-none", className)} 
      aria-label="Loading"
      style={{ 
        "--box-size": `${boxSize}px`,
        "--base-color": color || "rgb(var(--foreground))", // استفاده از رنگ تم (سفید در دارک، تیره در لایت)
      } as React.CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .boxes {
            --duration: 800ms;
            height: calc(var(--box-size) * 2);
            width: calc(var(--box-size) * 3);
            position: relative;
            transform-style: preserve-3d;
            transform-origin: 50% 50%;
            margin-top: calc(var(--box-size) * 1.5 * -1);
            /* زاویه دوربین ایزومتریک استاندارد */
            transform: rotateX(60deg) rotateZ(45deg) rotateY(0deg) translateZ(0px);
        }
        
        .boxes .box {
            width: var(--box-size);
            height: var(--box-size);
            top: 0;
            left: 0;
            position: absolute;
            transform-style: preserve-3d;
        }

        /* انیمیشن حرکت مکعب‌ها */
        .boxes .box:nth-child(1) { transform: translate(100%, 0); animation: box1 var(--duration) linear infinite; }
        .boxes .box:nth-child(2) { transform: translate(0, 100%); animation: box2 var(--duration) linear infinite; }
        .boxes .box:nth-child(3) { transform: translate(100%, 100%); animation: box3 var(--duration) linear infinite; }
        .boxes .box:nth-child(4) { transform: translate(200%, 0); animation: box4 var(--duration) linear infinite; }
        
        /* استایل سطوح مکعب */
        .boxes .box > .face {
            position: absolute;
            width: 100%;
            height: 100%;
            backface-visibility: hidden; 
        }

        /* 1. سطح بالا (Top) - روشن‌ترین سطح */
        .boxes .box > .face.face-top { 
            transform: rotateX(90deg) translateZ(calc(var(--box-size) / 2)); 
            background: var(--base-color);
            opacity: 1; 
        }
        
        /* 2. سطح پایین (Bottom) */
        .boxes .box > .face.face-bottom { 
            transform: rotateX(-90deg) translateZ(calc(var(--box-size) / 2)); 
            background: var(--base-color);
            filter: brightness(0.3);
        }

        /* 3. سطح راست (Right) - سایه متوسط */
        .boxes .box > .face.face-right { 
            transform: rotateY(90deg) translateZ(calc(var(--box-size) / 2)); 
            background: var(--base-color);
            filter: brightness(0.75); 
        }
        
        /* 4. سطح چپ (Left) */
        .boxes .box > .face.face-left { 
            transform: rotateY(-90deg) translateZ(calc(var(--box-size) / 2)); 
            background: var(--base-color);
            filter: brightness(0.75); 
        }

        /* 5. سطح روبرو (Front) - تیره‌ترین سطح */
        .boxes .box > .face.face-front { 
            transform: translateZ(calc(var(--box-size) / 2)); 
            background: var(--base-color);
            filter: brightness(0.5); 
        }
        
        /* 6. سطح پشت (Back) */
        .boxes .box > .face.face-back { 
            transform: rotateY(180deg) translateZ(calc(var(--box-size) / 2)); 
            background: var(--base-color);
            filter: brightness(0.5); 
        }
        
        @keyframes box1 {
            0%, 50% { transform: translate(100%, 0); }
            100% { transform: translate(200%, 0); }
        }
        @keyframes box2 {
            0% { transform: translate(0, 100%); }
            50% { transform: translate(0, 0); }
            100% { transform: translate(100%, 0); }
        }
        @keyframes box3 {
            0%, 50% { transform: translate(100%, 100%); }
            100% { transform: translate(0, 100%); }
        }
        @keyframes box4 {
            0% { transform: translate(200%, 0); }
            50% { transform: translate(200%, 100%); }
            100% { transform: translate(100%, 100%); }
        }
      `}} />
      
      <div className="boxes">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`box box-${i}`}>
                <div className="face face-top" />
                <div className="face face-bottom" />
                <div className="face face-right" />
                <div className="face face-left" />
                <div className="face face-front" />
                <div className="face face-back" />
            </div>
        ))}
      </div>
    </div>
  )
}

export default BoxLoader;
