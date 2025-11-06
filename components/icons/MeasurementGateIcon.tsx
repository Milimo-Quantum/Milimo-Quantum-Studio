import React from 'react';

const MeasurementGateIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg {...props} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 23C6 24.1046 6.89543 25 8 25H26V18H6V23Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M16 18V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M16 9L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M16 9L13 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M10 21H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
);

export default MeasurementGateIcon;
