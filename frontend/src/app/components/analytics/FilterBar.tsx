import { Filter, RefreshCcw } from "lucide-react";
import { DashboardFilters, FilterOptions } from "../../api/analytics";

type Props = {
  options: FilterOptions | null;
  filters: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  onReset: () => void;
};

export function FilterBar({ options, filters, onChange, onReset }: Props) {
  const set = (key: keyof DashboardFilters) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value || undefined;
    onChange({ ...filters, [key]: v });
  };

  const isFiltered = Object.values(filters).some(Boolean);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mr-2">
        <Filter className="w-4 h-4 text-gray-500" />
        Filters
      </div>

      <Select
        label="Department"
        value={filters.department || ""}
        onChange={set("department")}
        options={options?.departments || []}
      />
      <Select
        label="Location"
        value={filters.location || ""}
        onChange={set("location")}
        options={options?.locations || []}
      />
      <Select
        label="Employment"
        value={filters.employment_type || ""}
        onChange={set("employment_type")}
        options={options?.employment_types || []}
      />
      <Select
        label="Work mode"
        value={filters.work_mode || ""}
        onChange={set("work_mode")}
        options={options?.work_modes || []}
      />

      {isFiltered && (
        <button
          onClick={onReset}
          className="ml-auto inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-600">
      <span className="text-gray-500">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="text-sm bg-white border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[120px]"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
