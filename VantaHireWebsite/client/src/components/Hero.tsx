import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import rocketGif from "../assets/3d-rocket.gif";

const Hero = () => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    // Add a slight delay for the fade-in effect
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Function to open Calendly in a new window/tab
  const openCalendly = () => {
    window.open('https://calendly.com/vantahire/30min', '_blank');
  };
  
  const scrollToContact = () => {
    const contactSection = document.getElementById("contact");
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="hero" className="container mx-auto px-4 pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
      <div className={`flex flex-col md:flex-row items-center transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="md:w-1/2 mb-10 md:mb-0 relative">
          {/* Background decoration */}
          <div className="absolute -z-10 w-64 h-64 rounded-full bg-purple-500/10 blur-2xl -left-10 -top-10 animate-pulse-slow"></div>
          <div className="absolute -z-10 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl left-40 top-40 animate-pulse-slow" 
              style={{animationDelay: '1.2s'}}></div>
          
          {/* Premium line accent */}
          <div className="w-20 h-1.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] rounded-full mb-6 animate-slide-right"
               style={{animationDelay: '0.3s'}}></div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 relative">
            <div className="animate-fade-in" style={{animationDelay: '0.5s'}}>
              <span className="animate-gradient-text font-extrabold leading-tight block">AI + Human Expertise.</span>
              <span className="text-white leading-tight mt-2 block">Faster, Fairer Hiring.</span>
            </div>
          </h1>

          <p className="text-base sm:text-lg mb-6 max-w-2xl text-white/90 leading-relaxed animate-slide-up"
             style={{animationDelay: '0.8s'}}>
            VantaHire combines AI-powered candidate matching with a trusted network of specialist recruiters to help startups and enterprises scale faster across <span className="text-[#FF5BA8] font-semibold">IT, Telecom, Automotive, Fintech, and Healthcare</span>.
          </p>

          {/* Key metrics badges */}
          <div className="flex flex-wrap gap-3 mb-8 animate-fade-in" style={{animationDelay: '1s'}}>
            <div className="bg-white/10 backdrop-blur-lg px-3 py-2 sm:px-4 rounded-full border border-white/20 flex items-center gap-2 hover:bg-white/15 transition-all duration-300">
              <div className="w-2 h-2 bg-[#2D81FF] rounded-full animate-pulse-slow flex-shrink-0"></div>
              <span className="text-xs sm:text-sm font-semibold text-white whitespace-nowrap">≈40% Faster Hiring</span>
            </div>
            <div className="bg-white/10 backdrop-blur-lg px-3 py-2 sm:px-4 rounded-full border border-white/20 flex items-center gap-2 hover:bg-white/15 transition-all duration-300">
              <div className="w-2 h-2 bg-[#FF5BA8] rounded-full animate-pulse-slow flex-shrink-0"></div>
              <span className="text-xs sm:text-sm font-semibold text-white whitespace-nowrap">60% Fewer Mis-Hires</span>
            </div>
            <div className="bg-white/10 backdrop-blur-lg px-3 py-2 sm:px-4 rounded-full border border-white/20 flex items-center gap-2 hover:bg-white/15 transition-all duration-300">
              <div className="w-2 h-2 bg-[#7B38FB] rounded-full animate-pulse-slow flex-shrink-0"></div>
              <span className="text-xs sm:text-sm font-semibold text-white whitespace-nowrap">Bias-Aware AI</span>
            </div>
          </div>

          <p className="text-sm mb-8 max-w-lg text-white/70 leading-relaxed animate-slide-up italic"
             style={{animationDelay: '1.1s'}}>
            Our unique approach consistently delivers better outcomes, powered by responsible, bias-aware AI that puts fairness first.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{animationDelay: '1.2s'}}>
            <Button
              variant="gradient"
              size="xl"
              className="rounded-full premium-card hover:scale-105 transform transition-all duration-300 group shadow-lg"
              onClick={openCalendly}
            >
              <span className="group-hover:tracking-wide transition-all duration-300">Book Your Free Strategy Call</span>
            </Button>
            <Button
              variant="outline"
              size="xl"
              className="rounded-full border-white/30 text-white hover:bg-white/10 hover:border-white/50 transition-all duration-300"
              onClick={scrollToContact}
            >
              Contact Us
            </Button>
          </div>
          
          {/* Extra premium decorative element */}
          <div className="absolute -bottom-4 left-10 w-24 h-1 bg-gradient-to-r from-[#7B38FB]/0 via-[#7B38FB] to-[#7B38FB]/0 rounded-full animate-shine"></div>
        </div>
        
        <div className="md:w-1/2 flex justify-center relative opacity-50 md:opacity-80 mt-8 md:mt-0">
          {/* Background glows */}
          <div className="absolute w-48 h-48 md:w-72 md:h-72 bg-blue-500/10 rounded-full blur-2xl animate-pulse-slow"></div>
          <div className="absolute w-32 h-32 md:w-48 md:h-48 bg-pink-500/10 rounded-full blur-2xl translate-x-20 -translate-y-10 animate-pulse-slow"
               style={{animationDelay: '1s'}}></div>

          {/* Stars/particles around rocket - reduced, hidden on mobile */}
          <div className="hidden md:block absolute w-2 h-2 bg-white/60 rounded-full top-10 left-1/4 animate-pulse-slow"></div>
          <div className="hidden md:block absolute w-2 h-2 bg-white/60 rounded-full bottom-10 right-1/3 animate-pulse-slow"
              style={{animationDelay: '0.5s'}}></div>

          {/* 3D Rocket GIF - smaller on mobile, larger on desktop */}
          <div className="relative z-10 w-48 h-48 md:w-72 md:h-72 flex items-center justify-center animate-float-path animate-fade-in"
               style={{animationDelay: '0.4s'}}>
            <div className="absolute inset-0 bg-gradient-to-r from-[#2D81FF]/0 via-[#2D81FF]/10 to-[#2D81FF]/0 rounded-full blur-3xl animate-pulse-slow"></div>
            <img
              src={rocketGif}
              alt="AI-powered recruitment visualization"
              className="w-40 h-40 md:w-64 md:h-64 object-contain drop-shadow-2xl opacity-90"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
