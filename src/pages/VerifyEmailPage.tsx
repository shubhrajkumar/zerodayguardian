import { Link } from "react-router-dom";

const VerifyEmailPage = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[var(--theme-surface)] p-6">
        <h1 className="text-2xl font-bold text-[var(--theme-text)]">Email Verification Not Required</h1>
        <p className="mt-3 text-sm text-[var(--theme-text-muted)]">
          The authentication system uses app-managed email and password login, so there is no separate email verification step here.
        </p>
        <Link
          to="/auth"
          className="mt-6 inline-flex rounded-lg border border-[var(--theme-border)] bg-[var(--theme-overlay)] px-4 py-2 text-sm text-[var(--theme-text)] hover:bg-[var(--theme-overlay-hover)]"
        >
          Go to Auth
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
