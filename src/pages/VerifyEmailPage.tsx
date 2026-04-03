import { Link } from "react-router-dom";

const VerifyEmailPage = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-slate-950/70 p-6">
        <h1 className="text-2xl font-bold text-white">Email Verification Not Required</h1>
        <p className="mt-3 text-sm text-slate-300">
          The authentication system uses app-managed email and password login, so there is no separate email verification step here.
        </p>
        <Link
          to="/auth"
          className="mt-6 inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:bg-white/10"
        >
          Go to Auth
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
