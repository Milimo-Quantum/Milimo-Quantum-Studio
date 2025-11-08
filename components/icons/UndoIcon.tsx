import React from 'react';

const UndoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    {...props} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M21 9H6.5A4.5 4.5 0 0 0 2 13.5V13.5A4.5 4.5 0 0 0 6.5 18H14"></path>
    <polyline points="10 14 6 9 10 4"></polyline>
  </svg>
);

export default UndoIcon;