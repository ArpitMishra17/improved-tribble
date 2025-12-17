import { useEffect } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import Stats from "@/components/Stats";
import Cta from "@/components/Cta";
import Footer from "@/components/Footer";

// Circuit Background Animation Component (landing-specific visual)
const CircuitBackground = () => (
  <div className="circuit-bg">
    {/* Animated circuit lines */}
    <div className="circuit-line"></div>
    <div className="circuit-line"></div>
    <div className="circuit-line"></div>
    <div className="circuit-line"></div>
    <div className="circuit-line"></div>
    {/* Glowing circuit dots */}
    <div className="circuit-dot"></div>
    <div className="circuit-dot"></div>
    <div className="circuit-dot"></div>
    <div className="circuit-dot"></div>
  </div>
);

const Home = () => {
  useEffect(() => {
    document.title = "VantaHire - AI + Human Expertise for Faster, Fairer Hiring";
  }, []);

  return (
    <div className="public-theme min-h-screen bg-background text-foreground">
      <CircuitBackground />
      <div className="relative z-10">
        <Header />
        <Hero />
        <Services />
        <Stats />
        <Cta />
        <Footer />
      </div>
    </div>
  );
};

export default Home;
