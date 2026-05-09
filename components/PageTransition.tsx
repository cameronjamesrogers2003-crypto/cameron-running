"use client";

import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    startTransition(() => setVisible(false));
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 150ms ease-in-out",
      }}
    >
      {children}
    </div>
  );
}
