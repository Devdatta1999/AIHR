import { Sparkles, Plus, Users, Zap, Clock, CheckCircle } from "lucide-react";
import { useState } from "react";

const availableEmployees = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "Senior Developer",
    skills: ["React", "Node.js", "AWS"],
    availability: 80,
    projects: 2,
  },
  {
    id: 2,
    name: "Michael Roberts",
    role: "Product Manager",
    skills: ["Strategy", "Agile", "Analytics"],
    availability: 60,
    projects: 3,
  },
  {
    id: 3,
    name: "Emily Zhang",
    role: "UX Designer",
    skills: ["Figma", "Research", "Prototyping"],
    availability: 100,
    projects: 1,
  },
  {
    id: 4,
    name: "Alex Johnson",
    role: "DevOps Engineer",
    skills: ["Docker", "K8s", "CI/CD"],
    availability: 90,
    projects: 1,
  },
  {
    id: 5,
    name: "Lisa Martinez",
    role: "Data Scientist",
    skills: ["Python", "ML", "SQL"],
    availability: 70,
    projects: 2,
  },
  {
    id: 6,
    name: "David Kim",
    role: "Frontend Developer",
    skills: ["Vue.js", "TypeScript", "CSS"],
    availability: 85,
    projects: 2,
  },
];

const aiRecommendations = [
  {
    name: "Sarah Chen",
    role: "Senior Developer",
    matchScore: 96,
    reason: "Strong React/Node.js expertise matches project requirements",
  },
  {
    name: "Alex Johnson",
    role: "DevOps Engineer",
    matchScore: 92,
    reason: "High availability and relevant CI/CD experience",
  },
  {
    name: "Emily Zhang",
    role: "UX Designer",
    matchScore: 88,
    reason: "100% availability and excellent design portfolio",
  },
];

const skillMatrix = [
  { skill: "Frontend", employees: 8, demand: "High" },
  { skill: "Backend", employees: 12, demand: "Medium" },
  { skill: "Design", employees: 5, demand: "High" },
  { skill: "DevOps", employees: 4, demand: "Medium" },
  { skill: "Data Science", employees: 6, demand: "Low" },
];

export function TeamFormation() {
  const [selectedTeam, setSelectedTeam] = useState<number[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectRequirements, setProjectRequirements] = useState("");

  const toggleTeamMember = (id: number) => {
    setSelectedTeam((prev) =>
      prev.includes(id) ? prev.filter((memberId) => memberId !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Team Formation</h1>
        <p className="text-sm text-gray-600 mt-1">
          AI-powered team recommendations based on skills and availability
        </p>
      </div>

      {/* Project Requirements Panel */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Project Requirements</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Phoenix Platform Redesign"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Required Skills
            </label>
            <input
              type="text"
              placeholder="e.g., React, Node.js, AWS"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Project Description
          </label>
          <textarea
            value={projectRequirements}
            onChange={(e) => setProjectRequirements(e.target.value)}
            placeholder="Describe the project requirements, timeline, and expected deliverables..."
            rows={3}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Sparkles className="w-4 h-4" />
          Generate AI Recommendations
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Recommendations */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">
                AI-Generated Team Recommendations
              </h2>
            </div>
            <div className="space-y-3">
              {aiRecommendations.map((rec, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg p-4 border border-blue-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{rec.name}</h3>
                      <p className="text-sm text-gray-600">{rec.role}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-700">
                        {rec.matchScore}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">{rec.reason}</p>
                  <button
                    onClick={() => {
                      const employee = availableEmployees.find(
                        (e) => e.name === rec.name
                      );
                      if (employee) toggleTeamMember(employee.id);
                    }}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Add to Team
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Available Employees */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-4">
              Available Employees
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedTeam.includes(employee.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => toggleTeamMember(employee.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 text-sm">
                        {employee.name}
                      </h3>
                      <p className="text-xs text-gray-600">{employee.role}</p>
                    </div>
                    {selectedTeam.includes(employee.id) && (
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {employee.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Availability</span>
                      <span className="font-medium">{employee.availability}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          employee.availability >= 80
                            ? "bg-green-500"
                            : employee.availability >= 60
                            ? "bg-yellow-500"
                            : "bg-orange-500"
                        }`}
                        style={{ width: `${employee.availability}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Active projects: {employee.projects}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Selected Team */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-gray-700" />
              <h2 className="font-semibold text-gray-900">Selected Team</h2>
            </div>
            {selectedTeam.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No team members selected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedTeam.map((id) => {
                  const employee = availableEmployees.find((e) => e.id === id);
                  if (!employee) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {employee.name}
                        </p>
                        <p className="text-xs text-gray-600">{employee.role}</p>
                      </div>
                      <button
                        onClick={() => toggleTeamMember(id)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {selectedTeam.length > 0 && (
              <button className="w-full mt-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                Create Team
              </button>
            )}
          </div>

          {/* Skill Matrix */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-4">Skill Matrix</h2>
            <div className="space-y-3">
              {skillMatrix.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">{item.skill}</span>
                    <span className="text-gray-500">{item.employees}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(item.employees / 15) * 100}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.demand === "High"
                          ? "bg-orange-100 text-orange-700"
                          : item.demand === "Medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {item.demand}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
