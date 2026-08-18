import React from 'react'

interface ViteLogoProps {
  className?: string
}

export const ViteLogo: React.FC<ViteLogoProps> = ({ className = 'w-auto h-12' }) => (
  <svg viewBox="0 0 87 15" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M74.9427 14.6539C74.73 14.9246 74.295 14.7741 74.295 14.4301V11.127C74.295 10.7264 73.9704 10.4019 73.5698 10.4019H69.9228C69.6279 10.4019 69.4559 10.0683 69.6279 9.82865L72.0256 6.47163C72.3689 5.99166 72.0256 5.32454 71.4352 5.32454H67.0215C66.7266 5.32454 66.5547 4.99098 66.7266 4.75134L69.835 0.399156C69.9034 0.303852 70.0132 0.247223 70.1299 0.247223H79.393C79.6879 0.247223 79.8598 0.580784 79.6879 0.820424L77.2901 4.17745C76.9469 4.65742 77.2901 5.32454 77.8806 5.32454H81.5277C81.8301 5.32454 82 5.67329 81.8129 5.91155L74.9434 14.6546L74.9427 14.6539Z"
      fill="#863BFF"
    />
    <mask id="mask0_vite" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="66" y="0" width="16" height="15">
      <path
        d="M74.9095 14.6538C74.6968 14.9246 74.2618 14.774 74.2618 14.4301V11.1269C74.2618 10.7264 73.9372 10.4018 73.5366 10.4018H69.8896C69.5947 10.4018 69.4227 10.0682 69.5947 9.82859L71.9924 6.47157C72.3357 5.9916 71.9924 5.32448 71.402 5.32448H66.9883C66.6934 5.32448 66.5215 4.99092 66.6934 4.75128L69.8018 0.399095C69.8702 0.303791 69.98 0.247162 70.0967 0.247162H79.3598C79.6547 0.247162 79.8266 0.580723 79.6547 0.820363L77.2569 4.17739C76.9137 4.65735 77.2569 5.32448 77.8474 5.32448H81.4945C81.7969 5.32448 81.9668 5.67323 81.7797 5.91149L74.9102 14.6545L74.9095 14.6538Z"
        fill="black"
      />
    </mask>
    <g mask="url(#mask0_vite)">
      <g filter="url(#f0_vite)">
        <ellipse cx="1.766" cy="4.714" rx="1.766" ry="4.714" transform="matrix(0.003 1 1 -0.003 65.19 10.35)" fill="#EDE6FF" />
      </g>
      <g filter="url(#f1_vite)">
        <ellipse cx="3.334" cy="9.57" rx="3.334" ry="9.57" transform="matrix(0.003 1 1 -0.003 54.02 2.77)" fill="#EDE6FF" />
      </g>
      <g filter="url(#f2_vite)">
        <ellipse cx="1.766" cy="9.774" rx="1.766" ry="9.774" transform="matrix(0.003 1 1 -0.003 53.65 3.88)" fill="#7E14FF" />
      </g>
      <g filter="url(#f3_vite)">
        <ellipse cx="1.766" cy="9.81" rx="1.766" ry="9.81" transform="matrix(0.003 1 1 -0.003 55.13 9.65)" fill="#7E14FF" />
      </g>
      <g filter="url(#f4_vite)">
        <ellipse cx="1.766" cy="9.81" rx="1.766" ry="9.81" transform="matrix(0.003 1 1 -0.003 55.62 10.02)" fill="#7E14FF" />
      </g>
      <g filter="url(#f5_vite)">
        <ellipse cx="4.511" cy="7.078" rx="4.511" ry="7.078" transform="matrix(0.058 -0.998 -0.998 -0.058 90.46 8.86)" fill="#EDE6FF" />
      </g>
      <g filter="url(#f6_vite)">
        <ellipse cx="1.113" cy="6.893" rx="1.113" ry="6.893" transform="matrix(-0.017 -1 -1 0.017 90.92 6.04)" fill="#7E14FF" />
      </g>
      <g filter="url(#f7_vite)">
        <ellipse cx="66.749" cy="3.123" rx="1.413" ry="9.332" transform="rotate(39.51 66.749 3.123)" fill="#7E14FF" />
      </g>
      <g filter="url(#f8_vite)">
        <ellipse cx="81.86" cy="-1.706" rx="1.413" ry="9.332" transform="rotate(37.89 81.86 -1.706)" fill="#7E14FF" />
      </g>
      <g filter="url(#f9_vite)">
        <ellipse cx="79.902" cy="2.278" rx="1.914" ry="3.099" transform="rotate(37.89 79.902 2.278)" fill="#47BFFF" />
      </g>
      <g filter="url(#f10_vite)">
        <ellipse cx="66.022" cy="12.536" rx="1.413" ry="9.332" transform="rotate(37.89 66.022 12.536)" fill="#7E14FF" />
      </g>
      <g filter="url(#f11_vite)">
        <ellipse cx="78.055" cy="9.835" rx="1.413" ry="9.332" transform="rotate(37.89 78.055 9.835)" fill="#7E14FF" />
      </g>
      <g filter="url(#f12_vite)">
        <ellipse cx="78.941" cy="10.634" rx="1.914" ry="4.904" transform="rotate(37.89 78.941 10.634)" fill="#47BFFF" />
      </g>
    </g>
    <path d="M64.29 0C61.34 4.22 61.32 10.76 64.29 15H66.28C63.32 10.76 63.33 4.22 66.28 0H64.29Z" fill="currentColor" />
    <path d="M84.3 0H82.31C85.26 4.22 85.28 10.76 82.31 15H84.3C87.27 10.76 87.25 4.22 84.3 0Z" fill="currentColor" />
    <path
      d="M9.14 10.69L12.91 0.25H18.07L12.35 14.75H5.72L0 0.25H5.3L9.14 10.69ZM24.76 14.75H19.79V0.25H24.76V14.75ZM42.82 3.81H37.24V14.75H32.27V3.81H26.7V0.25H42.82V3.81ZM59.07 3.77H49.73V5.72H58.93V9.14H49.73V11.23H59.34V14.75H44.76V0.25H59.07V3.77Z"
      fill="currentColor"
    />
    <defs>
      <filter id="f0_vite" x="60.29" y="5.42" width="19.25" height="13.35" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="2.46" result="blur" />
      </filter>
      <filter id="f1_vite" x="49.12" y="-2.17" width="28.96" height="16.49" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="2.46" result="blur" />
      </filter>
      <filter id="f2_vite" x="50.71" y="0.9" width="25.44" height="9.43" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="1.47" result="blur" />
      </filter>
      <filter id="f3_vite" x="52.18" y="6.67" width="25.51" height="9.43" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="1.47" result="blur" />
      </filter>
      <filter id="f4_vite" x="52.68" y="7.04" width="25.51" height="9.43" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="1.47" result="blur" />
      </filter>
      <filter id="f5_vite" x="71.68" y="-5.49" width="23.96" height="18.87" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="2.46" result="blur" />
      </filter>
      <filter id="f6_vite" x="74.17" y="0.98" width="19.68" height="8.13" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="1.47" result="blur" />
      </filter>
      <filter id="f7_vite" x="57.77" y="-7.08" width="17.97" height="20.41" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="1.47" result="blur" />
      </filter>
      <filter id="f8_vite" x="73.07" y="-12.07" width="17.57" height="20.72" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="1.47" result="blur" />
      </filter>
      <filter id="f9_vite" x="74.53" y="-3.38" width="10.75" height="11.32" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="1.47" result="blur" />
      </filter>
      <filter id="f10_vite" x="57.24" y="2.17" width="17.57" height="20.72" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="1.47" result="blur" />
      </filter>
      <filter id="f11_vite" x="69.27" y="-0.53" width="17.57" height="20.72" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="1.47" result="blur" />
      </filter>
      <filter id="f12_vite" x="72.62" y="3.64" width="12.63" height="13.99" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="bg" />
        <feBlend in="SourceGraphic" in2="bg" result="shape" />
        <feGaussianBlur stdDeviation="1.47" result="blur" />
      </filter>
    </defs>
  </svg>
)
