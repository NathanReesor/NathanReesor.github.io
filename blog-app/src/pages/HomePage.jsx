const email = "nathanreesor01@gmail.com";
const linkedin = "https://www.linkedin.com/in/nathan-reesor";
const github = "https://github.com/NathanReesor";
const resume = "/assets/Nathan-Reesor-Resume.pdf";

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
            <a style={styles.link} href={resume}>Resume</a>
            <a style={styles.link} href={`mailto:${email}`}>Email</a>
          </div>
        </nav>

        <section>
          <div style={styles.eyebrow}>Finance | Research | Data tools</div>
          <h1 style={styles.h1}>Practical market research, built for real portfolio questions.</h1>
          <p style={styles.lead}>
            I am a finance graduate focused on investment research, market structure, and data-driven portfolio work.
            This site is being kept lean while the research tools are refreshed behind the scenes.
          </p>

          <div style={styles.chips}>
            <span style={styles.chip}>BBA Finance</span>
            <span style={styles.chip}>CFA Level II Candidate</span>
            <span style={styles.chip}>Capital-markets research</span>
            <span style={styles.chip}>Python | Excel | Power Query</span>
          </div>

          <div style={styles.ctas}>
            <a style={styles.primary} href={resume}>Resume</a>
            <a style={styles.secondary} href={`mailto:${email}`}>Contact: {email}</a>
            <a style={styles.secondary} href={linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
            <a style={styles.secondary} href={github} target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </section>

        <footer style={styles.footer}>
          Email link: <a style={styles.link} href={`mailto:${email}`}>{email}</a>
        </footer>
      </div>
    </main>
  );
}
