import React from 'react';

const NoiseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
        <path d="M17 10c.6-3.2-1.4-6.4-4.8-7 -3.4.6-5.4 3.8-4.8 7 .3 1.5.9 2.9 1.8 4M9 14c-.6 3.2 1.4 6.4 4.8 7 3.4-.6 5.4-3.8 4.8-7 -.3-1.5-.9-2.9-1.8-4"></path>
        <path d="M2 2l20 20"></path>
    </svg>
);

export default NoiseIcon;
