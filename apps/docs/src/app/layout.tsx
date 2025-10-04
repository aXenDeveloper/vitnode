import "./global.css";

export const experimental_ppr = true;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
