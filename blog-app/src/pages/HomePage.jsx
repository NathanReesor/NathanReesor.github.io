const email = "nathanreesor01@gmail.com";
const linkedin = "https://www.linkedin.com/in/nathan-reesor";
const github = "https://github.com/NathanReesor";

const projects = [
  {
    title: "OPEX + market regime dashboard",
    href: `${import.meta.env.BASE_URL}opex`,
    description:
      "A work-in-progress tool for tracking options-expiration weeks, broad market prices, and risk-regime signals. The goal is to turn it into a clean dashboard that answers one question: what kind of market setup are we heading into around OPEX?",
    tag: "Current build",
  },
  {
    title: "BTC correlation regime monitor",
    href: null,
    description:
      "A planned research page comparing BTC against equities, bonds, and gold using short-term and one-year rolling correlations. The goal is to test whether BTC is trading like risk-on tech, a diversifier, or something independent across regimes.",
    tag: "Next project",
  },
];

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8f7f3",
    color: "#1f2933",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  wrap: {
    maxWidth: 1040,
    margin: "0 auto",
    padding: "56px 24px 72px",
  },
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    marginBottom: 72,
  },
  navName: {
    fontWeight: 800,
    letterSpacing: "-0.03em",
    fontSize: 18,
  },
  navLinks: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    fontSize: 14,
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 650,
  },
  eyebrow: {
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 14,
  },
  h1: {
    fontSize: "clamp(38px, 7vw, 76px)",
    lineHeight: 0.95,
    letterSpacing: "-0.07em",
    margin: "0 0 22px",
    maxWidth: 900,
  },
  lead: {
    fontSize: 20,
    lineHeight: 1.55,
    color: "#475569",
    maxWidth: 760,
    marginBottom: 26,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 42,
  },
  chip: {
    border: "1px solid #d8d4cc",
    background: "#fffaf0",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 650,
  },
  ctas: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 68,
  },
  primary: {
    background: "#111827",
    color: "#ffffff",
    borderRadius: 10,
    padding: "12px 16px",
    textDecoration: "none",
    fontWeight: 750,
  },
  secondary: {
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #d8d4cc",
    borderRadius: 10,
    padding: "12px 16px",
    textDecoration: "none",
    fontWeight: 750,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#64748b",
    fontWeight: 850,
    marginBottom: 16,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #dedad1",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 18px 44px rgba(15, 23, 42, 0.06)",
  },
  tag: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 800,
    color: "#92400e",
    background: "#fef3c7",
    borderRadius: 999,
    padding: "5px 9px",
    marginBottom: 14,
  },
  h3: {
    fontSize: 21,
    margin: "0 0 10px",
    letterSpacing: "-0.03em",
  },
  body: {
    color: "#475569",
    lineHeight: 1.55,
    fontSize: 15,
    marginBottom: 16,
  },
  footer: {
    marginTop: 54,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  },
};

export default function HomePage() {
  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <nav style={styles.nav}>
          <div style={styles.navName}>Nathan Reesor</div>
          <div style={styles.navLinks}>
            <a style={styles.link} href={`${import.meta.env.BASE_URL}opex`}>OPEX dashboard</a>
            <a style={styles.link} href={`mailto:${email}`}>Email</a>
          </div>
        </nav>

        <section>
          <div style={styles.eyebrow}>Finance · Research · Data tools</div>
          <h1 style={styles.h1}>Practical market research tools, built for real portfolio questions.</h1>
          <p style={styles.lead}>
            I am a finance graduate focused on investment research, market structure, and data-driven portfolio tools.
            This site is being rebuilt around fewer, better projects instead of a pile of stale dashboards.
          </p>

          <div style={styles.chips}>
            <span style={styles.chip}>BBA Finance</span>
            <span style={styles.chip}>CFA Level II Candidate</span>
            <span style={styles.chip}>Capital-markets research</span>
            <span style={styles.chip}>Python · Excel · Power Query</span>
          </div>

          <div style={styles.ctas}>
            <a style={styles.primary} href={`${import.meta.env.BASE_URL}opex`}>View current build</a>
            <a style={styles.secondary} href={`mailto:${email}`}>Contact: {email}</a>
            <a style={styles.secondary} href={linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
            <a style={styles.secondary} href={github} target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </section>

        <section>
          <div style={styles.sectionTitle}>Current focus</div>
          <div style={styles.grid}>
            {projects.map((project) => (
              <article key={project.title} style={styles.card}>
                <span style={styles.tag}>{project.tag}</span>
                <h3 style={styles.h3}>{project.title}</h3>
                <p style={styles.body}>{project.description}</p>
                {project.href ? (
                  <a style={styles.link} href={project.href}>Open project →</a>
                ) : (
                  <span style={{ color: "#64748b", fontWeight: 650 }}>In development</span>
                )}
              </article>
            ))}
          </div>
        </section>

        <footer style={styles.footer}>
          Current priority: turn the OPEX dashboard into a cleaner market-regime tool with scheduled data updates, then build the BTC correlation monitor from scratch.
        </footer>
      </div>
    </main>
  );
}
