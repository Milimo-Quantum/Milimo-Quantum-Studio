import React from 'react';

const LogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M12 2L8 4V10L12 12L16 10V4L12 2Z"
      strokeOpacity="0.8"
    />
    <path
      d="M12 12L8 14V20L12 22L16 20V14L12 12Z"
      strokeOpacity="0.8"
    />
    <path
      d="M20 7L16 10V14L20 17V7Z"
      strokeOpacity="0.5"
    />
    <path
      d="M4 7L8 10V14L4 17V7Z"
      strokeOpacity="0.5"
    />
  </svg>
);

export default LogoIcon;
