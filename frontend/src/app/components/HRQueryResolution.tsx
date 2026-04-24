import {
  MessageCircleQuestion,
  Sparkles,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
  Filter,
  Search,
  Send,
  Bot,
  UserCircle,
} from "lucide-react";
import { useState } from "react";

type TicketStatus = "open" | "in-progress" | "resolved";
type TicketPriority = "high" | "medium" | "low";

interface Ticket {
  id: string;
  employeeName: string;
  employeeRole: string;
  question: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  aiSuggestion?: string;
}

const tickets: Ticket[] = [
  {
    id: "TKT-001",
    employeeName: "John Martinez",
    employeeRole: "Software Engineer",
    question: "What is the company policy on remote work and flexible hours?",
    category: "Work Policy",
    priority: "medium",
    status: "open",
    createdAt: "2026-03-20 09:30 AM",
    aiSuggestion: "According to HR Policy Section 4.2, employees can work remotely up to 3 days per week with manager approval. Flexible hours are available between 7 AM - 10 AM start times.",
  },
  {
    id: "TKT-002",
    employeeName: "Emma Chen",
    employeeRole: "Product Manager",
    question: "How many sick leaves am I entitled to per year?",
    category: "Leave Policy",
    priority: "high",
    status: "open",
    createdAt: "2026-03-20 08:15 AM",
    aiSuggestion: "Per HR Policy Section 6.1, full-time employees receive 12 sick days per calendar year. Unused sick days can be carried over up to 5 days to the next year.",
  },
  {
    id: "TKT-003",
    employeeName: "Michael Roberts",
    employeeRole: "UX Designer",
    question: "Can I take parental leave? What's the duration and is it paid?",
    category: "Benefits",
    priority: "high",
    status: "in-progress",
    createdAt: "2026-03-19 04:20 PM",
    aiSuggestion: "According to Policy Section 7.3, eligible employees receive 16 weeks of paid parental leave. Additional 8 weeks unpaid leave available upon request. Must notify HR 30 days in advance.",
  },
  {
    id: "TKT-004",
    employeeName: "Sarah Williams",
    employeeRole: "Data Analyst",
    question: "What are the reimbursement policies for professional development courses?",
    category: "Learning & Development",
    priority: "low",
    status: "open",
    createdAt: "2026-03-19 02:45 PM",
    aiSuggestion: "Policy Section 9.1: Company reimburses up to $2,000 annually for approved professional development. Submit course details and manager approval to HR before enrollment.",
  },
  {
    id: "TKT-005",
    employeeName: "David Kim",
    employeeRole: "DevOps Engineer",
    question: "I need to know about the employee referral bonus program.",
    category: "Compensation",
    priority: "medium",
    status: "resolved",
    createdAt: "2026-03-18 11:00 AM",
    aiSuggestion: "Per Section 10.5, employees receive $1,500 referral bonus for successful hires (paid after 90-day probation). Engineering roles: $2,000 bonus. Submit referrals through the HR portal.",
  },
  {
    id: "TKT-006",
    employeeName: "Lisa Anderson",
    employeeRole: "Marketing Manager",
    question: "What's the process for requesting a salary review or promotion?",
    category: "Compensation",
    priority: "medium",
    status: "resolved",
    createdAt: "2026-03-17 03:30 PM",
    aiSuggestion: "Policy Section 11.2: Salary reviews conducted bi-annually (Jan & Jul). For promotion requests, schedule 1:1 with manager, complete self-assessment, and submit to HR 30 days before review cycle.",
  },
];

const stats = [
  { label: "Open Tickets", value: 4, color: "orange" },
  { label: "In Progress", value: 1, color: "blue" },
  { label: "Resolved Today", value: 8, color: "green" },
  { label: "Avg Response Time", value: "2.3h", color: "purple" },
];

const categories = [
  "All Categories",
  "Work Policy",
  "Leave Policy",
  "Benefits",
  "Compensation",
  "Learning & Development",
];

export function HRQueryResolution() {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [filterStatus, setFilterStatus] = useState<TicketStatus | "all">("all");
  const [manualResponse, setManualResponse] = useState("");
  const [showAIAnswer, setShowAIAnswer] = useState(false);

  const filteredTickets = tickets.filter((ticket) => {
    const categoryMatch =
      filterCategory === "All Categories" || ticket.category === filterCategory;
    const statusMatch = filterStatus === "all" || ticket.status === filterStatus;
    return categoryMatch && statusMatch;
  });

  const handleResolveWithAI = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowAIAnswer(true);
    setManualResponse("");
  };

  const handleAnswerManually = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowAIAnswer(false);
    setManualResponse("");
  };

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case "open":
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case "in-progress":
        return <Clock className="w-4 h-4 text-blue-600" />;
      case "resolved":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
  };

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case "open":
        return "bg-orange-100 text-orange-700";
      case "in-progress":
        return "bg-blue-100 text-blue-700";
      case "resolved":
        return "bg-green-100 text-green-700";
    }
  };

  const getPriorityColor = (priority: TicketPriority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">HR Query Resolution</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage employee questions with AI-powered policy retrieval
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-700">Filters</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const colorClasses = {
            orange: "bg-orange-50 text-orange-600",
            blue: "bg-blue-50 text-blue-600",
            green: "bg-green-50 text-green-600",
            purple: "bg-purple-50 text-purple-600",
          };
          return (
            <div
              key={index}
              className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow"
            >
              <p className="text-sm text-gray-600 mb-2">{stat.label}</p>
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              <div className={`inline-block mt-2 px-2 py-1 rounded ${colorClasses[stat.color]}`}>
                <span className="text-xs font-medium">Active</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as TicketStatus | "all")}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          {/* Tickets */}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className={`p-5 hover:bg-gray-50 transition-colors cursor-pointer ${
                  selectedTicket?.id === ticket.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                }`}
                onClick={() => setSelectedTicket(ticket)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {ticket.employeeName.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">{ticket.employeeName}</h3>
                        <span className="text-xs text-gray-500">• {ticket.employeeRole}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{ticket.id}</span>
                        <span>•</span>
                        <Calendar className="w-3 h-3" />
                        <span>{ticket.createdAt}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(ticket.status)}`}>
                      {getStatusIcon(ticket.status)}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-900 mb-3 font-medium">{ticket.question}</p>

                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                    {ticket.category}
                  </span>
                  {ticket.status !== "resolved" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAnswerManually(ticket);
                        }}
                        className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                      >
                        <UserCircle className="w-3.5 h-3.5 inline mr-1" />
                        Answer Manually
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResolveWithAI(ticket);
                        }}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                        Resolve using AI
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Response Panel */}
        <div className="space-y-4">
          {selectedTicket ? (
            <>
              {/* Ticket Details */}
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-gray-700" />
                  <h2 className="font-semibold text-gray-900">Ticket Details</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Ticket ID</p>
                    <p className="text-sm font-medium text-gray-900">{selectedTicket.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Employee</p>
                    <p className="text-sm font-medium text-gray-900">{selectedTicket.employeeName}</p>
                    <p className="text-xs text-gray-600">{selectedTicket.employeeRole}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Category</p>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                      {selectedTicket.category}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(selectedTicket.status)}`}>
                      {selectedTicket.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Suggestion */}
              {showAIAnswer && selectedTicket.aiSuggestion && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Bot className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">AI-Generated Answer</h3>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-blue-200 mb-4">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {selectedTicket.aiSuggestion}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-blue-700 mb-4">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-medium">Auto-generated from HR Policy Database</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                      <Send className="w-4 h-4 inline mr-1" />
                      Send AI Answer
                    </button>
                    <button
                      onClick={() => {
                        setManualResponse(selectedTicket.aiSuggestion || "");
                        setShowAIAnswer(false);
                      }}
                      className="flex-1 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                    >
                      Edit & Send
                    </button>
                  </div>
                </div>
              )}

              {/* Manual Response */}
              {!showAIAnswer && (
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Your Response</h3>
                    {selectedTicket.aiSuggestion && (
                      <button
                        onClick={() => setShowAIAnswer(true)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Sparkles className="w-3 h-3 inline mr-1" />
                        View AI Suggestion
                      </button>
                    )}
                  </div>
                  <textarea
                    value={manualResponse}
                    onChange={(e) => setManualResponse(e.target.value)}
                    placeholder="Type your response here..."
                    rows={8}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <button className="w-full mt-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                    <Send className="w-4 h-4 inline mr-1" />
                    Send Response & Resolve
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
              <MessageCircleQuestion className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Select a ticket to view details and respond
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
