import { Zap, CheckCircle, Sparkles } from "lucide-react";

const services = [
  {
    icon: <Zap className="w-7 h-7" />,
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
    title: "Contract Staffing",
    description: "On-demand tech & non-tech specialists for short-term, long-term, and project-based needs.",
    features: [
      "IT | Telecom | Cloud | DevOps",
      "Sales | Ops | HR | Finance",
      "Deploy in 3-5 days",
      "Flexible monthly billing"
    ]
  },
  {
    icon: <CheckCircle className="w-7 h-7" />,
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-400",
    title: "Permanent Hiring",
    description: "AI-assisted resume screening with expert recruiter validation for high-quality, long-term hires.",
    features: [
      "48-72 hour shortlist",
      "Pre-vetted candidates only",
      "AI JD matching + scoring",
      "3-month replacement guarantee"
    ]
  },
  {
    icon: <Sparkles className="w-7 h-7" />,
    iconBg: "bg-gradient-to-br from-purple-500/15 to-amber-500/15",
    iconColor: "text-purple-400",
    title: "VantaHire ATS",
    description: "Easy job posting, AI resume analysis, candidate scoring, and pipeline automation.",
    features: [
      "Unlimited job posts",
      "AI resume screening & scoring",
      "Automated follow-ups",
      "Starting ₹999/month"
    ]
  }
];

const Services = () => {
  return (
    <section id="services" className="py-24 relative z-10">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            One Platform for All Your Hiring Needs
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-2xl mx-auto">
            Whether you need contract talent, permanent hires, or an ATS to manage it all — we've got you covered.
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
              <p className="text-[var(--text-secondary)] text-sm mb-6 leading-relaxed">
                {service.description}
              </p>

              {/* Features */}
              <ul className="space-y-3">
                {service.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-[var(--text-muted)] text-sm">
                    <span className="text-amber-500 font-bold">→</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
