"use client";

import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { useConsent } from "@/components/providers/consent-provider";

/** Third-party scripts that are only injected after the visitor opts in. */
export function ConsentScripts() {
  const { consent } = useConsent();
  const plausible = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const vercel = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS !== "false";
  const chat = process.env.NEXT_PUBLIC_CHAT_PROVIDER;
  const crispId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
  const tawk = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID;

  return (
    <>
      {consent?.analytics && vercel && <Analytics />}
      {consent?.analytics && plausible && (
        <Script src="https://plausible.io/js/script.js" data-domain={plausible} strategy="afterInteractive" />
      )}
      {consent?.functional && chat === "crisp" && crispId && (
        <Script id="crisp" strategy="lazyOnload">
          {`window.$crisp=[];window.CRISP_WEBSITE_ID=${JSON.stringify(crispId)};(function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`}
        </Script>
      )}
      {consent?.functional && chat === "tawk" && tawk && (
        <Script id="tawk" strategy="lazyOnload">
          {`var Tawk_API=Tawk_API||{};(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src="https://embed.tawk.to/${tawk}";s1.charset="UTF-8";s1.setAttribute("crossorigin","*");s0.parentNode.insertBefore(s1,s0);})();`}
        </Script>
      )}
    </>
  );
}
