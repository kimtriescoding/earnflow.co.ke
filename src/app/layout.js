import { Geist_Mono, Nunito, Poppins } from "next/font/google";
import "./globals.css";
import { AppToaster } from "@/components/ui/AppToaster";

const appSans = Nunito({
  variable: "--font-app-sans",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const appDisplay = Poppins({
  variable: "--font-app-display",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Earnflow Agencies",
  description: "Earn from videos, paid chat, academic writing, and more on Earnflow Agencies.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${appSans.variable} ${appDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
