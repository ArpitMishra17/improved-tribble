import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Brain, ListChecks, Kanban, Users, ArrowRight, Check } from "lucide-react";

const features = [
  {
    icon: <Brain className="w-8 h-8" />,
    title: "AI-Powered Matching",
    description: "Our algorithms learn what 'great' looks like for your company—then find more people like that."
  },
  {
    icon: <ListChecks className="w-8 h-8" />,
    title: "Automated Screening",
    description: "Resume parsing, skill scoring, and bias detection—all running in the background while you focus on high-value work."
  },
  {
    icon: <Kanban className="w-8 h-8" />,
    title: "Pipeline Management",
    description: "Kanban boards, stage automation, and bulk actions. Move candidates through your process without the busywork."
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: "Team Collaboration",
    description: "Shared notes, interview feedback, and role-based access. Keep everyone aligned without endless email threads."
  }
];

const steps = [
  {
    number: "01",
    title: "Post Your Job",
    description: "Create a job posting in minutes. Our AI helps you write compelling descriptions that attract the right candidates."
  },
  {
    number: "02",
    title: "Get Matched Candidates",
    description: "Our AI scans and scores applications instantly. You get a ranked shortlist of the best fits—no manual screening required."
  },
  {
    number: "03",
    title: "Hire with Confidence",
    description: "Move candidates through your pipeline, schedule interviews, and make offers—all from one platform."
  }
];

export default function ProductPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Layout>
      <Helmet>
        <title>Product | VantaHire - The Recruiting Platform That Works</title>
        <meta name="description" content="Post jobs, screen candidates, and make hires—without the chaos. See how VantaHire's AI-powered platform simplifies recruiting." />
        <link rel="canonical" href={`${window.location.origin}/product`} />
        <meta property="og:title" content="Product | VantaHire" />
        <meta property="og:description" content="The recruiting platform that gets out of your way. AI-powered matching, automated screening, and seamless pipeline management." />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="public-theme min-h-screen bg-background text-foreground">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-10"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '1.2s' }}></div>

        <div className={`container mx-auto px-4 py-16 relative z-10 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          {/* Hero Section */}
          <div className="text-center mb-20 pt-8">
            <div className="w-20 h-1.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] rounded-full mx-auto mb-6"></div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              <span className="text-white">The Recruiting Platform That</span>
              <br />
              <span className="gradient-text-purple">Gets Out of Your Way</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Post jobs, screen candidates, and make hires—without the chaos.
            </p>
            <Button
              variant="gold"
              size="lg"
              onClick={() => window.location.href = '/recruiter-auth'}
              className="rounded-full px-8 py-6 text-lg font-semibold"
            >
              See It in Action
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>

          {/* Platform Features */}
          <div className="mb-24">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Everything You Need, Nothing You Don't
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-[hsl(var(--vanta-dark))]/90 to-[hsl(var(--vanta-dark))]/70 p-8 rounded-2xl border border-white/5 hover:border-primary/30 transition-all duration-300"
                >
                  <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center mb-6 text-primary">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                  <p className="text-white/70 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div className="mb-24">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Three simple steps to better hiring.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {steps.map((step, index) => (
                <div key={index} className="relative">
                  <div className="text-6xl font-bold text-primary/20 mb-4">{step.number}</div>
                  <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                  <p className="text-white/70">{step.description}</p>
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-12 right-0 transform translate-x-1/2">
                      <ArrowRight className="w-6 h-6 text-primary/40" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div className="max-w-4xl mx-auto mb-24">
            <div className="bg-gradient-to-br from-[hsl(var(--vanta-dark))]/90 to-[hsl(var(--vanta-dark))]/70 p-8 md:p-12 rounded-2xl border border-white/5">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">Why Teams Choose VantaHire</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  "Save 10+ hours per week on manual screening",
                  "Reduce time-to-hire by up to 40%",
                  "Built-in bias detection for fairer hiring",
                  "Unlimited job postings on all paid plans",
                  "No per-seat pricing—invite your whole team",
                  "Dedicated support when you need it"
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-white/80">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center py-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Ready to Simplify Your Hiring?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Start free. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="gold"
                size="lg"
                onClick={() => window.location.href = '/recruiter-auth'}
                className="rounded-full px-8 py-6 text-lg font-semibold"
              >
                Get Started Free
              </Button>
              <Button
                variant="outlinePurple"
                size="lg"
                onClick={() => window.open('https://cal.com/vantahire/quick-connect', '_blank')}
                className="rounded-full px-8 py-6 text-lg"
              >
                Book a Demo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
