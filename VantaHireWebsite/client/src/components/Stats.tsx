const stats = [
  { number: "60%", label: "Faster Shortlisting" },
  { number: "48hr", label: "First Shortlist" },
  { number: "3-5", label: "Days to Deploy" },
  { number: "∞", label: "Job Posts" }
];

const Stats = () => {
  return (
    <section className="py-16 bg-[var(--bg-secondary)] border-y border-[var(--border-subtle)] relative z-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
          {stats.map((stat, index) => (
            <div key={index} className="py-4">
              <div className="stat-number text-4xl md:text-5xl font-bold mb-2">
                {stat.number}
              </div>
              <div className="text-[var(--text-secondary)] text-sm">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
