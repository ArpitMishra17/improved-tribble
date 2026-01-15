import { Brain, ListChecks, Layers, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: <Brain className="w-7 h-7" />,
    iconBg: "bg-primary/20",
    iconColor: "text-primary",
    title: "Smart Matching",
    description: "Our AI learns what great looks like—for your company.",
    features: [
      "AI-powered candidate scoring",
      "Culture fit analysis",
      "Skills-based matching",
      "Bias detection built-in"
    ]
  },
  {
    icon: <ListChecks className="w-7 h-7" />,
    iconBg: "bg-warning/20",
    iconColor: "text-warning",
    title: "Automated Shortlists",
    description: "Top candidates ranked instantly, so you only talk to the best.",
    features: [
      "48-72 hour shortlists",
      "Pre-vetted candidates only",
      "Resume parsing & analysis",
      "One-click screening"
    ]
  },
  {
    icon: <Layers className="w-7 h-7" />,
    iconBg: "bg-gradient-to-br from-purple-500/15 to-amber-500/15",
    iconColor: "text-primary",
    title: "One Platform",
    description: "From sourcing to interviews to offers—all in one place.",
    features: [
      "Kanban pipeline management",
      "Email templates & scheduling",
      "Team collaboration",
      "Analytics & reporting"
    ]
  }
];

const Services = () => {
  return (
    <section id="features" className="py-24 relative z-10">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Why Teams Love VantaHire
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
            Powerful AI features that make hiring feel effortless.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {services.map((service, index) => (
            <div key={index} className="service-card">
              {/* Icon */}
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-6 ${service.iconBg}`}>
                <span className={service.iconColor}>{service.icon}</span>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-white mb-3">{service.title}</h3>

              {/* Description */}
              <p className="text-[var(--text-secondary)] text-sm mb-6 leading-relaxed min-h-[40px]">
                {service.description}
              </p>

              {/* Features */}
              <ul className="space-y-3">
                {service.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-[var(--text-muted)] text-sm">
                    <span className="text-warning font-bold">→</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA Links */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
          <Button
            variant="outlinePurple"
            onClick={() => window.location.href = '/features'}
            className="rounded-full px-6 py-5"
          >
            See All Features
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.location.href = '/product'}
            className="text-white/70 hover:text-white"
          >
            Learn More About the Product
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Services;
