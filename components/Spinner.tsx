
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center space-x-2 space-x-reverse">
      <div className="spinner-dot" style={{ animationDelay: '0s' }}></div>
      <div className="spinner-dot" style={{ animationDelay: '0.2s' }}></div>
      <div className="spinner-dot" style={{ animationDelay: '0.4s' }}></div>
    </div>
  );
};

export default Spinner;