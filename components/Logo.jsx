export default function Logo({ className = "", size = 200, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect width="200" height="200" rx="48" fill="#000000" />
      {/* AI Path (Electric Blue) */}
      <path
        d="M60 150V60C60 54.4772 64.4772 50 70 50H110C132.091 50 150 67.9086 150 90V90C150 112.091 132.091 130 110 130H85"
        stroke="url(#gradient_ai)"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Human Escalation Path (Purple) */}
      <path
        d="M95 100L140 150"
        stroke="url(#gradient_human)"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Spark/Node */}
      <circle cx="110" cy="90" r="10" fill="#FFFFFF">
        <animate
          attributeName="opacity"
          values="0.6;1;0.6"
          dur="3s"
          repeatCount="indefinite"
        />
      </circle>
      <defs>
        <linearGradient
          id="gradient_ai"
          x1="60"
          y1="50"
          x2="150"
          y2="130"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0070FF" />
          <stop offset="1" stopColor="#00C2FF" />
        </linearGradient>
        <linearGradient
          id="gradient_human"
          x1="95"
          y1="100"
          x2="140"
          y2="150"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#D946EF" />
        </linearGradient>
      </defs>
    </svg>
  );
}