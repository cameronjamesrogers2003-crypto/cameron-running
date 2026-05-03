interface LogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

const SIZE_HEIGHT: Record<"sm" | "md" | "lg", string> = {
  sm: "h-8",
  md: "h-16",
  lg: "h-[120px]",
};

const WORDMARK_SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "text-sm",
  md: "text-xl",
  lg: "text-[32px]",
};

// Runner icon with GPS track. viewBox="0 0 220 130"
// GPS track: #1D9E75, always explicit colour. Runner: white fill, black stroke.
function RunnerSVG() {
  return (
    <svg
      viewBox="0 0 220 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* ── GPS Track (back layer) ── */}
      <circle cx="13" cy="100" r="5" fill="#1D9E75" />
      <path
        d="M 13,100 C 30,94 40,87 56,91 C 69,95 75,105 89,102 C 97,100 100,108 104,116 C 108,124 119,127 131,120 C 143,113 151,101 167,95 C 179,90 193,84 210,77"
        stroke="#1D9E75"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="207" y1="73" x2="215" y2="81" stroke="#1D9E75" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="215" y1="73" x2="207" y2="81" stroke="#1D9E75" strokeWidth="4.5" strokeLinecap="round" />

      {/* ── Runner: trailing arm (swept back left) ── */}
      <path
        d="M 84,62 C 75,64 66,70 59,78 C 53,84 47,87 41,85 C 37,83 34,85 33,88 C 32,91 34,93 37,92 C 41,90 45,88 49,85 C 54,82 58,77 64,71 C 70,65 79,59 90,57"
        fill="white"
        stroke="black"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* trailing fingers */}
      <path d="M 33,88 C 29,86 27,83 29,80 C 30,78 33,79 34,82" fill="white" stroke="black" strokeWidth="2" strokeLinecap="round" />
      <path d="M 33,88 C 30,91 29,95 31,96 C 33,97 35,95 35,91" fill="white" stroke="black" strokeWidth="2" strokeLinecap="round" />
      <path d="M 35,84 C 32,82 31,79 33,77 C 34,76 36,77 36,80" fill="white" stroke="black" strokeWidth="2" strokeLinecap="round" />

      {/* ── Runner: torso ── */}
      <path
        d="M 85,56 C 89,50 97,46 108,46 C 119,46 127,50 131,56 L 133,80 C 133,87 129,93 118,95 C 107,97 94,95 88,91 C 83,87 82,81 84,73 Z"
        fill="white"
        stroke="black"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* ── Runner: shorts ── */}
      <path
        d="M 88,91 C 86,95 84,102 86,111 L 97,111 C 99,105 101,99 104,95 L 112,95 C 115,99 118,105 120,111 L 131,111 C 133,101 131,95 129,91 Z"
        fill="white"
        stroke="black"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* ── Runner: leading leg (forward, down) ── */}
      <path
        d="M 86,111 C 82,115 76,123 72,128 L 56,128 C 52,128 50,130 52,131 C 54,132 67,132 76,131 C 84,130 93,126 97,120 C 100,115 99,111 97,111"
        fill="white"
        stroke="black"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Runner: trailing leg (kicked up back) ── */}
      <path
        d="M 120,111 C 125,109 131,101 137,93 C 143,84 147,73 147,63 C 147,57 144,53 141,53 L 137,57 C 137,63 136,73 132,83 C 128,92 123,103 121,111"
        fill="white"
        stroke="black"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Runner: trailing foot / shoe ── */}
      <path
        d="M 141,53 C 139,47 134,43 128,42 C 122,41 116,44 115,48 C 114,52 117,57 121,57 C 125,57 132,55 137,53"
        fill="white"
        stroke="black"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Runner: neck ── */}
      <path
        d="M 102,46 L 100,38 L 109,38 L 108,46"
        fill="white"
        stroke="black"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* ── Runner: head ── */}
      <ellipse cx="102" cy="26" rx="21" ry="22" fill="white" stroke="black" strokeWidth="2.5" />

      {/* ── Runner: spiky hair ── */}
      <path
        d="M 83,16 L 78,4 L 87,15 L 90,12 L 87,1 L 95,12 L 99,9 L 97,0 L 104,10 L 107,10 L 109,1 L 114,12 L 113,14 L 118,5 L 121,16"
        fill="white"
        stroke="black"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Runner: ear ── */}
      <path d="M 82,23 C 79,21 78,25 80,28 C 81,30 84,29 84,26" fill="white" stroke="black" strokeWidth="2" />

      {/* ── Runner: eyes ── */}
      <circle cx="93" cy="23" r="8.5" fill="white" stroke="black" strokeWidth="2.5" />
      <circle cx="110" cy="21" r="8.5" fill="white" stroke="black" strokeWidth="2.5" />
      {/* inner iris ring */}
      <circle cx="93" cy="24" r="5" fill="white" stroke="black" strokeWidth="1.5" />
      <circle cx="110" cy="22" r="5" fill="white" stroke="black" strokeWidth="1.5" />
      {/* pupils */}
      <circle cx="93" cy="24" r="2.5" fill="black" />
      <circle cx="110" cy="22" r="2.5" fill="black" />

      {/* ── Runner: nose ── */}
      <path d="M 107,30 C 109,33 111,33 113,31" stroke="black" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* ── Runner: open mouth ── */}
      <path
        d="M 97,37 C 100,42 108,43 112,38"
        fill="black"
        stroke="black"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="100" y1="38" x2="100" y2="41" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="104" y1="37" x2="104" y2="42" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="108" y1="38" x2="108" y2="42" stroke="white" strokeWidth="2.5" strokeLinecap="round" />

      {/* ── Runner: leading arm + fist ── */}
      <path
        d="M 131,63 C 139,63 149,60 158,56 C 164,53 169,49 169,45 C 169,42 166,40 163,40 C 160,40 157,42 155,45 C 153,48 150,50 146,51 C 142,52 139,51 138,48 C 137,45 138,43 140,42 C 142,41 144,42 145,44"
        fill="white"
        stroke="black"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* fist knuckle lines */}
      <path d="M 155,45 C 157,43 160,42 163,43" stroke="black" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M 151,49 C 153,47 156,47 158,48" stroke="black" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function Logo({ size = "md", showWordmark = false, className = "" }: LogoProps) {
  const heightClass = SIZE_HEIGHT[size];
  const textClass   = WORDMARK_SIZE[size];

  return (
    <div className={`flex items-center gap-[10px] ${className}`}>
      <div className={`${heightClass} w-auto`} style={{ aspectRatio: "220 / 130" }}>
        <RunnerSVG />
      </div>
      {showWordmark && (
        <span
          className={`font-bold leading-none text-white ${textClass}`}
          style={{ fontStretch: "condensed", letterSpacing: "-0.02em" }}
        >
          Cameron&apos;s Running
        </span>
      )}
    </div>
  );
}
