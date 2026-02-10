"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

type RadarProps = React.HTMLAttributes<HTMLDivElement>;

export function Radar({ className, ...props }: RadarProps) {
  return (
    <div className={cn("relative", className)} {...props}>
      <svg
        viewBox="0 0 400 400"
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(46, 230, 193, 0.8)" />
            <stop offset="100%" stopColor="rgba(46, 230, 193, 0.1)" />
          </linearGradient>
          <radialGradient id="dotGlow">
            <stop offset="0%" stopColor="rgba(46, 230, 193, 1)" />
            <stop offset="100%" stopColor="rgba(46, 230, 193, 0)" />
          </radialGradient>
        </defs>

        {/* Outer circle */}
        <circle
          cx="200"
          cy="200"
          r="180"
          fill="none"
          stroke="rgba(46, 230, 193, 0.15)"
          strokeWidth="1.5"
        />

        {/* Middle circle */}
        <circle
          cx="200"
          cy="200"
          r="120"
          fill="none"
          stroke="rgba(46, 230, 193, 0.2)"
          strokeWidth="1.5"
        />

        {/* Inner circle */}
        <circle
          cx="200"
          cy="200"
          r="60"
          fill="none"
          stroke="rgba(46, 230, 193, 0.25)"
          strokeWidth="1.5"
        />

        {/* Center dot */}
        <circle cx="200" cy="200" r="4" fill="rgba(46, 230, 193, 0.8)" />

        {/* Scanning line - animated */}
        <g className="radar-sweep" style={{ transformOrigin: "200px 200px" }}>
          <path
            d="M 200 200 L 200 20 A 180 180 0 0 1 380 200 Z"
            fill="url(#radarGradient)"
            opacity="0.3"
          />
        </g>

        {/* Random dots */}
        <circle
          cx="280"
          cy="140"
          r="3"
          fill="rgba(46, 230, 193, 0.6)"
          className="radar-dot"
        >
          <animate
            attributeName="opacity"
            values="0.3;1;0.3"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
        
        <circle
          cx="240"
          cy="180"
          r="2.5"
          fill="rgba(46, 230, 193, 0.5)"
          className="radar-dot"
        >
          <animate
            attributeName="opacity"
            values="0.4;0.9;0.4"
            dur="1.5s"
            repeatCount="indefinite"
            begin="0.5s"
          />
        </circle>
      </svg>

      <style jsx>{`
        @keyframes radarSweep {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .radar-sweep {
          animation: radarSweep 4s linear infinite;
        }
      `}</style>
    </div>
  );
}
