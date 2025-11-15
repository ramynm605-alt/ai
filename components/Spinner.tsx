import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="brain-spinner">
      <svg viewBox="0 0 100 100" className="brain-svg">
        {/* Neural network paths */}
        <g className="neural-paths">
          <path d="M50 25 Q 40 32, 30 40" />
          <path d="M50 25 Q 60 32, 70 40" />
          <path d="M30 40 Q 38 48, 45 55" />
          <path d="M70 40 Q 62 48, 55 55" />
          <path d="M45 55 Q 35 60, 28 65" />
          <path d="M55 55 Q 65 60, 72 65" />
          <path d="M28 65 Q 35 70, 40 75" />
          <path d="M72 65 Q 65 70, 60 75" />
          <path d="M40 75 Q 45 80, 50 85" />
          <path d="M60 75 Q 55 80, 50 85" />
          <path d="M45 55 Q 50 55, 55 55" />
          <path d="M30 40 Q 40 60, 28 65" />
          <path d="M70 40 Q 60 60, 72 65" />
        </g>
        {/* Neural nodes */}
        <g className="neural-nodes">
          <circle cx="50" cy="25" r="3" />
          <circle cx="30" cy="40" r="3" />
          <circle cx="70" cy="40" r="3" />
          <circle cx="45" cy="55" r="3" />
          <circle cx="55" cy="55" r="3" />
          <circle cx="28" cy="65" r="3" />
          <circle cx="72" cy="65" r="3" />
          <circle cx="40" cy="75" r="3" />
          <circle cx="60" cy="75" r="3" />
          <circle cx="50" cy="85" r="3" />
        </g>
      </svg>
    </div>
  );
};

export default Spinner;