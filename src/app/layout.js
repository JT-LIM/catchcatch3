import "./globals.css";

export const metadata = {
  title: "덕소중학교 캐치마인드 - 실시간 그림 맞추기 게임",
  description: "덕소중학교 학생들이 실시간으로 함께 그림을 그리고 단어를 맞추는 멀티플레이어 캐치마인드 게임입니다. Vercel 배포 최적화.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
