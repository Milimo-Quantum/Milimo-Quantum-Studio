import React from 'react';

const RedoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M3 9H17.5A4.5 4.5 0 0 1 22 13.5V13.5A4.5 4.5 0 0 1 17.5 18H10"></path>
    <polyline points="14 14 18 9 14 4"></polyline>
  </svg>
);

export default RedoIcon;