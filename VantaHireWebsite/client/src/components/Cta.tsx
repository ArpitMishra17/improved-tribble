import { Button } from "@/components/ui/button";

const Cta = () => {
  const openCalendar = () => {
    window.open('https://cal.com/vantahire/quick-connect', '_blank');
  };

  return (
    <section className="py-32 relative z-10 cta-glow">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
          Ready to Stop Wasting Time on Bad Hires?
        </h2>
        <p className="text-[var(--text-secondary)] text-lg md:text-xl mb-10 max-w-xl mx-auto">
          Start free. Scale when you're ready.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="gold"
            onClick={() => window.location.href = '/recruiter-auth'}
            className="rounded-lg px-8 py-6 text-base font-semibold"
          >
            Get Started Free
          </Button>
          <Button
            variant="outlinePurple"
            onClick={openCalendar}
            className="rounded-lg px-8 py-6 text-base"
          >
            Book a Demo
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Cta;
