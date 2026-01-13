import { Quote } from "lucide-react";

const SocialProof = () => {
  return (
    <section className="py-20 relative z-10 bg-[var(--bg-secondary)]/50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          {/* Quote Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Quote className="w-8 h-8 text-primary" />
            </div>
          </div>

          {/* Testimonial */}
          <blockquote className="text-2xl md:text-3xl font-medium text-white mb-6 leading-relaxed">
            "We cut our time-to-hire significantly. VantaHire just works."
          </blockquote>

          {/* Attribution */}
          <p className="text-[var(--text-secondary)] text-lg">
            — Hiring Manager, Technology Company
          </p>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
