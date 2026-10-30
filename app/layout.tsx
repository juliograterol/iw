import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import Footer from "@/components/footer/footer";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import IWBg from "@/components/backgrounds/background";
import AppLoader from "@/components/AppLoader";
import { ScrollAlert } from "@/components/scroll-alert/alert";
import NavbarComponent from "@/components/navbar";
import { PageTransitionProvider } from "@/components/PagetransitionContext";
import { PageTransitionOutlet } from "@/components/page-transition-outlet";
import { ThemeProvider } from "@/components/ThemeContext";
import InteractiveCursor from "@/components/interactive-cursor";
import { interactiveElements } from "./content/interactive-elemets";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

// Runs before first paint: applies the saved/system theme and flags repeat
// visits so AppLoader is hidden without waiting for hydration. The 10s timer is
// a failsafe for when the JS bundle fails and AppLoader's own timeout never runs.
const themeInitScript = `(function(){try{var s=localStorage.getItem("theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}try{if(sessionStorage.getItem("loaded")==="true")document.documentElement.setAttribute("data-loaded","");}catch(e){}setTimeout(function(){document.documentElement.setAttribute("data-loaded","");},10000);})();`;

export const metadata: Metadata = {
  title: "InteractiveWorkers",
  description:
    "We are a group of remote workers that fill positions for companies all over the world, we cover any requirement, anywhere.",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${poppins.className} scroll-smooth  bg-white text-black transition-color duration-500`}
      >
        <ThemeProvider>
          <AppLoader>
            <InteractiveCursor interactiveElements={interactiveElements} />
            <PageTransitionProvider type="fade">
              <IWBg />
              <PageTransitionOutlet>
                <NavbarComponent />
                <ScrollAlert />
                <div className="-z-10">{children}</div>
              </PageTransitionOutlet>
              <PageTransitionOutlet>
                <Footer />
              </PageTransitionOutlet>
            </PageTransitionProvider>
          </AppLoader>
        </ThemeProvider>
        <Analytics />
        <Script id="tawk" strategy="lazyOnload">
          {`var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
            (function(){
              var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
              s1.async=true;
              s1.src='https://embed.tawk.to/63694982daff0e1306d63318/1gh9ke9gs';
              s1.charset='UTF-8';
              s1.setAttribute('crossorigin','*');
              s0.parentNode.insertBefore(s1,s0);
              })();`}
        </Script>
      </body>
    </html>
  );
}
