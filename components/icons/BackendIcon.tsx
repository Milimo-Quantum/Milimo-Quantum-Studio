import React from 'react';

const BackendIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
        <rect x="3" y="14" width="18" height="7" rx="1"></rect>
        <rect x="3" y="3" width="18" height="7" rx="1"></rect>
        <line x1="6" y1="7" x2="6.01" y2="7"></line>
        <line x1="6" y1="18" x2="6.01" y2="18"></line>
    </svg>
);

export default BackendIcon;
