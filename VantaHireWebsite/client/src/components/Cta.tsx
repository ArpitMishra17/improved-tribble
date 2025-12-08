import { Button } from "@/components/ui/button";

const Cta = () => {
  const openCalendar = () => {
    window.open('https://cal.com/vantahire/quick-connect', '_blank');
  };

  return (
    <section className="py-32 relative z-10 cta-glow">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
          Ready to Hire Faster?
        </h2>
        <p className="text-[var(--text-secondary)] text-lg md:text-xl mb-10 max-w-xl mx-auto">
          Join startups and agencies across India using VantaHire to build winning teams.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="gold"
            onClick={openCalendar}
            className="rounded-lg px-8 py-6 text-base font-semibold"
          >
            Book Your Free Strategy Call
          </Button>
          <Button
            variant="outlinePurple"
            className="rounded-lg px-8 py-6 text-base"
          >
            Start Your ATS Free Trial
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Cta;
