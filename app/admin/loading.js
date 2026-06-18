export default function Loading() {
  return (
    <div 
      className="admin-root" 
      style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        height: "100vh",
        background: "var(--bg)",
        color: "var(--text-3)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "0.875rem"
      }}
    >
      Loading Admin Console…
    </div>
  );
}
