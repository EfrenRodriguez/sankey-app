"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PLAYERS = [
  { name: "Messi",   href: "/messi"   },
  { name: "Ronaldo", href: "/ronaldo" },
  { name: "Haaland", href: "/haaland" },
  { name: "Mbappé",  href: "/mbappe"  },
  { name: "Kane",    href: "/kane"    },
  { name: "Jiménez", href: "/jimenez" },
  { name: "Dembélé", href: "/dembele" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: "#ffffff",
      borderBottom: "1px solid #e2e8f0",
      height: 48,
    }}>
      {/* Fade hint — signals more content is scrollable on mobile */}
      <div style={{
        position: "absolute", top: 0, right: 0, width: 40, height: "100%",
        background: "linear-gradient(to right, transparent, rgba(255,255,255,0.95))",
        pointerEvents: "none", zIndex: 1,
      }}/>
      <nav style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "0 20px", height: "100%",
        fontFamily: "'Inter','Helvetica Neue',sans-serif",
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch",
      }}>
        {/* Logo */}
        <span style={{
          fontSize: 15, fontWeight: 800, color: "#1a202c",
          marginRight: 16, flexShrink: 0, letterSpacing: -0.5,
        }}>
          sankey.
        </span>

        {/* Player links */}
        {PLAYERS.map(p => {
          const active = pathname === p.href;
          return (
            <Link
              key={p.href}
              href={p.href}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: active ? "#1a202c" : "#718096",
                padding: "6px 12px",
                borderRadius: 6,
                textDecoration: "none",
                flexShrink: 0,
                whiteSpace: "nowrap",
                borderBottom: active ? "2px solid #1a202c" : "2px solid transparent",
                transition: "color 0.12s, border-color 0.12s",
              }}
            >
              {p.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
