import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Sparkles, Zap } from "lucide-react";

// AI Orb Component with animated rings
const AiOrb = () => (
  <div className="ai-orb">
    <div className="orb-ring"></div>
    <div className="orb-ring"></div>
    <div className="orb-ring"></div>
    <div className="orb-center">
      <div className="text-center">
        <span className="text-purple-400 font-bold text-lg block">AI + Human</span>
        <span className="text-purple-300 font-semibold text-sm">Expertise</span>
      </div>
    </div>
  </div>
);

const Hero = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Function to open Cal.com in a new window/tab
  const openCalendar = () => {
    window.open('https://cal.com/vantahire/quick-connect', '_blank');
  };

  const scrollToContact = () => {
    const contactSection = document.getElementById("contact");
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="hero" className="container mx-auto px-4 pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
      <div className={`flex flex-col lg:flex-row items-center gap-12 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        {/* Left Content */}
        <div className="lg:w-1/2 text-center lg:text-left">
          {/* AI Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6 animate-fade-in-up">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-purple-300">AI-Powered Recruitment</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 animate-fade-in-up-delay-1">
            <span className="gradient-text-purple">AI + Human Expertise.</span>
            <br />
            <span className="text-white">Faster, Fairer</span>{" "}
            <span className="gradient-text-gold">Hiring.</span>
          </h1>

          <p className="text-lg text-gray-300 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-in-up-delay-2">
            VantaHire combines AI-powered candidate matching with specialist recruiters to help startups and enterprises scale faster across{" "}
            <span className="text-purple-400 font-semibold">IT, Telecom, Automotive, Fintech, and Healthcare</span>.
          </p>

          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 animate-fade-in-up-delay-2">
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="stat-number text-lg">~40%</span>
              <span className="text-gray-400 text-sm">Faster Hiring</span>
            </div>
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span className="stat-number text-lg">60%</span>
              <span className="text-gray-400 text-sm">Fewer Mis-Hires</span>
            </div>
            <div className="flex items-center justify-center lg:justify-start gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="stat-number text-lg">96%</span>
              <span className="text-gray-400 text-sm">Satisfaction</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up-delay-3">
            <Button
              variant="gold"
              onClick={openCalendar}
              className="rounded-full px-8 py-6 text-lg font-semibold"
            >
              <Zap className="w-5 h-5 mr-2" />
              Book Free Strategy Call
            </Button>
            <Button
              variant="outlinePurple"
              onClick={scrollToContact}
              className="rounded-full px-8 py-6 text-lg"
            >
              Contact Us
            </Button>
          </div>
        </div>

        {/* Right - AI Orb */}
        <div className="lg:w-1/2 flex justify-center animate-fade-in-up-delay-2">
          <AiOrb />
        </div>
      </div>
    </section>
  );
};

export default Hero;
