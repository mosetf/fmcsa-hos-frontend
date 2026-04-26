import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata = {
  title: "FMCSA HOS Trip Planner",
  description: "Trip planning frontend for FMCSA hours-of-service simulation and log output.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
