import React from 'react';

const LightbulbIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
        <path d="M9 18h6M12 22V18M12 14a4 4 0 003.8-5.2A4.7 4.7 0 0012 2a4.7 4.7 0 00-3.8 6.8A4 4 0 0012 14z"></path>
    </svg>
);

export default LightbulbIcon;