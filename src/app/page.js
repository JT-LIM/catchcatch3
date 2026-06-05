"use client";

import dynamic from "next/dynamic";

const GameClient = dynamic(() => import("@/components/GameClient"), {
  ssr: false,
  loading: () => (
    <div style={{ 
      minHeight: "100vh", 
      background: "#0a0e1a", 
      display: "flex", 
      flexDirection: "column",
      justifyContent: "center", 
      alignItems: "center",
      gap: "1.5rem"
    }}>
      <div className="spinner" />
      <style jsx>{`
        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-top-color: #8b5cf6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
});

export default function Home() {
  return <GameClient />;
}
