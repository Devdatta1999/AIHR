import { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router";
import { employeeApi, EmployeeMe } from "../../api/portal";

export function EmployeeHome() {
  const [me, setMe] = useState<EmployeeMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    employeeApi.me().then(setMe).catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
        {error}
      </div>
    );
  }
  if (!me) return <div className="text-sm text-gray-500">Loading…</div>;

  const name = me.identity.name || me.identity.email;
  const appl = me.applicant;
  const emp = me.employee;
  const jobTitle = emp?.job_title || appl?.job_title;
  const department = emp?.department || appl?.department;
  const location = emp?.location || appl?.location;
  const status = appl?.status || "—";

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white rounded-3xl p-8 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/80 text-sm mb-1">Welcome back,</p>
            <h1 className="text-3xl font-semibold">{name}</h1>
            <p className="text-white/90 mt-2 max-w-lg">
              Here's everything you need — your offer, onboarding steps, and
              interview kits assigned to you.
            </p>
          </div>
          <div className="hidden md:flex w-24 h-24 bg-white/20 rounded-2xl items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-6">
          <Badge label={jobTitle || "Role pending"} icon={Briefcase} />
          <Badge label={department || "Department TBD"} icon={Building2} />
          <Badge label={location || "Location TBD"} icon={MapPin} />
          <Badge label={`Status: ${status}`} icon={CheckCircle2} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Tile
          to="/employee/offer"
          icon={FileText}
          title="Your Offer Letter"
          blurb="Review and respond to the offer HR sent you."
          gradient="from-blue-500 to-indigo-600"
        />
        <Tile
          to="/employee/onboarding"
          icon={ClipboardCheck}
          title="Onboarding"
          blurb="Complete paperwork and confirm your start."
          gradient="from-emerald-500 to-teal-600"
        />
        <Tile
          to="/employee/interviews/upcoming"
          icon={Sparkles}
          title="Interviews"
          blurb="Upcoming interviews and kits HR has shared with you."
          gradient="from-amber-500 to-orange-600"
        />
      </div>

      {appl && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Your profile
          </h3>
          <dl className="grid md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Row k="Email" v={appl.email} />
            <Row k="Country" v={appl.country} />
            <Row k="City" v={appl.city} />
            <Row k="Phone" v={appl.phone} />
            <Row
              k="Experience"
              v={
                appl.total_years_experience != null
                  ? `${appl.total_years_experience} yrs`
                  : "—"
              }
            />
            <Row k="Applicant ID" v={appl.applicant_id?.toString()} />
          </dl>
        </div>
      )}
    </div>
  );
}

function Badge({
  label,
  icon: Icon,
}: {
  label: string;
  icon: React.ComponentType<any>;
}) {
  return (
    <span className="inline-flex items-center gap-1 bg-white/15 text-white text-xs px-3 py-1.5 rounded-full">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function Tile({
  to,
  icon: Icon,
  title,
  blurb,
  gradient,
}: {
  to: string;
  icon: React.ComponentType<any>;
  title: string;
  blurb: string;
  gradient: string;
}) {
  return (
    <Link
      to={to}
      className="group bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-400 hover:shadow-md transition-all"
    >
      <div
        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-3`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{blurb}</p>
      <p className="text-xs text-indigo-600 font-medium mt-3 group-hover:underline">
        Open →
      </p>
    </Link>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex gap-3">
      <dt className="text-gray-500 w-32">{k}</dt>
      <dd className="text-gray-900">{v || "—"}</dd>
    </div>
  );
}
