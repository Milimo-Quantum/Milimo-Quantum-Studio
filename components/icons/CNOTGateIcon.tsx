import React from 'react';

const CNOTGateIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" stroke="none" fill="currentColor" />
    <path d="M12 2V22" stroke="white" strokeWidth="2.5" />
    <path d="M2 12H22" stroke="white" strokeWidth="2.5" />
  </svg>
);

export default CNOTGateIcon;
