import { Link } from "wouter";
import vantahireLogo from "@/assets/vantahire-logo.png";

interface FooterProps {
  minimal?: boolean;
}

const Footer = ({ minimal = false }: FooterProps) => {
  // Minimal footer for ATS pages
  if (minimal) {
    return (
      <footer className="bg-[#0d0d1a] border-t border-purple-500/20 py-6 relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/50 text-sm">
              © 2025 VantaHire. All rights reserved.
            </p>
            <div className="flex flex-wrap gap-6 justify-center">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('cookie-consent:open', { detail: { reset: true } }));
                }}
                className="text-white/50 text-sm hover:text-amber-400 transition-colors"
              >
                Cookie Preferences
              </button>
              <Link
                href="/privacy-policy"
                className="text-white/50 text-sm hover:text-amber-400 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms-of-service"
                className="text-white/50 text-sm hover:text-amber-400 transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/cookie-policy"
                className="text-white/50 text-sm hover:text-amber-400 transition-colors"
              >
                Cookie Policy
              </Link>
              <a
                href="mailto:hello@vantahire.com"
                className="text-white/70 text-sm hover:text-amber-400 transition-colors"
              >
                hello@vantahire.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] py-16 relative z-10">
      <div className="container mx-auto px-4">
        {/* Footer Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12 max-w-6xl mx-auto">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <img src={vantahireLogo} alt="VantaHire" className="h-9 w-auto" />
              <span className="text-xl font-bold gradient-text-mixed">VantaHire</span>
            </Link>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-xs">
              AI + Human Expertise for Faster, Fairer Hiring. Serving startups and enterprises across India and APAC.
            </p>
          </div>

          {/* Services Column */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-5">
              Services
            </h4>
            <ul className="space-y-3">
              <li>
                <a href="/#services" className="text-[var(--text-muted)] text-sm hover:text-purple-400 transition-colors">
                  Contract Staffing
                </a>
              </li>
              <li>
                <a href="/#services" className="text-[var(--text-muted)] text-sm hover:text-purple-400 transition-colors">
                  Permanent Hiring
                </a>
              </li>
              <li>
                <a href="/#services" className="text-[var(--text-muted)] text-sm hover:text-purple-400 transition-colors">
                  VantaHire ATS
                </a>
              </li>
              <li>
                <a href="/#contact" className="text-[var(--text-muted)] text-sm hover:text-purple-400 transition-colors">
                  Pricing
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-5">
              Company
            </h4>
            <ul className="space-y-3">
              <li>
                <a href="/#about" className="text-[var(--text-muted)] text-sm hover:text-purple-400 transition-colors">
                  Why VantaHire
                </a>
              </li>
              <li>
                <Link href="/jobs" className="text-[var(--text-muted)] text-sm hover:text-purple-400 transition-colors">
                  Jobs
                </Link>
              </li>
              <li>
                <a href="/#contact" className="text-[var(--text-muted)] text-sm hover:text-purple-400 transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Industries Column */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-5">
              Industries
            </h4>
            <ul className="space-y-3">
              <li>
                <a href="/#industries" className="text-[var(--text-muted)] text-sm hover:text-purple-400 transition-colors">
                  Technology & SaaS
                </a>
              </li>
              <li>
                <a href="/#industries" className="text-[var(--text-muted)] text-sm hover:text-purple-400 transition-colors">
                  Telecom
                </a>
              </li>
              <li>
                <a href="/#industries" className="text-[var(--text-muted)] text-sm hover:text-purple-400 transition-colors">
                  FinTech
                </a>
              </li>
              <li>
                <a href="/#industries" className="text-[var(--text-muted)] text-sm hover:text-purple-400 transition-colors">
                  Healthcare
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="border-t border-[var(--border-subtle)] pt-8 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[var(--text-muted)] text-sm">
              © 2025 VantaHire. All rights reserved.
            </p>
            <div className="flex flex-wrap gap-6 justify-center">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('cookie-consent:open', { detail: { reset: true } }));
                }}
                className="text-[var(--text-muted)] text-sm hover:text-amber-400 transition-colors"
              >
                Cookie Preferences
              </button>
              <Link
                href="/privacy-policy"
                className="text-[var(--text-muted)] text-sm hover:text-amber-400 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms-of-service"
                className="text-[var(--text-muted)] text-sm hover:text-amber-400 transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/cookie-policy"
                className="text-[var(--text-muted)] text-sm hover:text-amber-400 transition-colors"
              >
                Cookie Policy
              </Link>
              <a
                href="mailto:hello@vantahire.com"
                className="text-[var(--text-secondary)] text-sm hover:text-amber-400 transition-colors"
              >
                hello@vantahire.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
