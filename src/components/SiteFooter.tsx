import { Archivo } from "next/font/google";

// Heavy display face, matching the site's other oversized wordmarks.
const footerWordmarkFont = Archivo({
  subsets: ["latin"],
  weight: ["800"],
  display: "swap",
});

/**
 * The site's only footer: a single oversized "MANIK RANA" wordmark rendered as
 * a faded light-gray watermark. It is clipped to roughly its upper half so the
 * bottom of the letters bleeds off the edge of the viewport. No links, no other
 * content.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span className={`site-footer__word ${footerWordmarkFont.className}`}>Manik Rana</span>
    </footer>
  );
}

export default SiteFooter;
