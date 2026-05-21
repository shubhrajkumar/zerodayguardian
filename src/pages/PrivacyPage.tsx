import { Link } from "react-router-dom";

const privacySections = [
  {
    title: "Intel We Collect",
    body:
      "We collect account details, authentication state, mission progress, lab activity, notification preferences, and the minimum telemetry required to keep the platform stable and secure.",
  },
  {
    title: "Why We Collect It",
    body:
      "Data is used to deploy your workspace, sync achievements, protect accounts, troubleshoot failures, and improve real security training flows. We do not use fake engagement loops or fabricate results.",
  },
  {
    title: "Storage And Retention",
    body:
      "Platform records may be stored in Firebase, backend databases, and security logs for operational continuity, fraud defense, and mission history. Retention windows vary by feature and security need.",
  },
  {
    title: "Sharing And Disclosure",
    body:
      "We only disclose data to infrastructure providers and security processors required to operate the service, or when legally required. Public portfolio content is only public if you deliberately enable it.",
  },
];

const PrivacyPage = () => {
  return (
    <div className="page-shell">
      <section className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="cyber-card rounded-[28px] p-6 md:p-8">
            <p className="shell-command-chip">Trust Layer / Privacy</p>
            <h1 className="mt-4 glow-text">Privacy Command</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              ZeroDay Guardian is built for real cyber growth. This privacy layer explains what operational data we use,
              why we use it, and how we protect it while you deploy labs, missions, and AI-guided workflows.
            </p>
          </div>

          <div className="grid gap-4">
            {privacySections.map((section) => (
              <article key={section.title} className="cyber-card rounded-[24px] p-5 md:p-6">
                <h2 className="text-white">{section.title}</h2>
                <p className="mt-3 text-base leading-7 text-slate-300">{section.body}</p>
              </article>
            ))}
          </div>

          <div className="cyber-card rounded-[24px] p-5 md:p-6">
            <h2 className="text-white">Need A Data Request?</h2>
            <p className="mt-3 text-base leading-7 text-slate-300">
              For data export, correction, deletion, or security/privacy concerns, contact the support command channel.
            </p>
            <div className="mt-5">
              <Link to="/contact" className="cyber-btn cta-focus-ring">
                Deploy Privacy Request
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPage;
