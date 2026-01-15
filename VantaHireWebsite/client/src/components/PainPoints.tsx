import { Clock, UserMinus, Banknote, ArrowRight } from "lucide-react";

const painPoints = [
  {
    icon: <Clock className="w-6 h-6 text-red-400" />,
    text: "Spending hours scrolling through unqualified resumes"
  },
  {
    icon: <UserMinus className="w-6 h-6 text-red-400" />,
    text: "Losing great candidates because you moved too slow"
  },
  {
    icon: <Banknote className="w-6 h-6 text-red-400" />,
    text: "Paying agencies 20% for hires you could've made yourself"
  }
];

const PainPoints = () => {
  return (
    <section className="pt-20 pb-8 relative z-10">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-12 text-center">
            Recruiting Shouldn't Feel Like This
          </h2>

          {/* Pain Points List */}
          <div className="max-w-xl mx-auto">
            <div className="space-y-5 mb-8">
              {painPoints.map((point, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 text-lg text-[var(--text-secondary)]"
                >
                  <span className="flex-shrink-0">{point.icon}</span>
                  <span>{point.text}</span>
                </div>
              ))}
            </div>

            {/* Contrast */}
            <a
              href="/product"
              className="inline-flex items-center gap-3 text-xl font-semibold group cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(e) => { e.preventDefault(); window.location.href = '/product'; }}
            >
              <ArrowRight className="w-6 h-6 text-primary" />
              <span className="gradient-text-purple">VantaHire fixes all of this.</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PainPoints;
