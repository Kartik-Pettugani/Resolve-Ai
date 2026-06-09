import "./globals.css";

export const metadata = {
  title: "Resolve",
  description: "AI-powered customer support agent with RAG and escalation"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
