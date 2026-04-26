import { createBrowserRouter } from "react-router";
import { MainLayout } from "./components/MainLayout";
import { Dashboard } from "./components/Dashboard";
import { Onboarding } from "./components/Onboarding";
import { Hiring } from "./components/Hiring";
import { InterviewKit } from "./components/InterviewKit";
import { HRAnalytics } from "./components/HRAnalytics";
import { TeamFormation } from "./components/TeamFormation";
import { CompensationManagement } from "./components/CompensationManagement";
import { HRQueryResolution } from "./components/HRQueryResolution";
import { Login } from "./auth/Login";
import { RequireAuth } from "./auth/RequireAuth";
import { EmployeeLayout } from "./components/employee/EmployeeLayout";
import { EmployeeHome } from "./components/employee/EmployeeHome";
import { EmployeeOffer } from "./components/employee/EmployeeOffer";
import { EmployeeOnboarding } from "./components/employee/EmployeeOnboarding";
import { EmployeeKits } from "./components/employee/EmployeeKits";
import { EmployeeInterviews } from "./components/employee/EmployeeInterviews";
import { EmployeeProjects } from "./components/employee/EmployeeProjects";
import { EmployeePayslips } from "./components/employee/EmployeePayslips";
import { Navigate } from "react-router";

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  {
    element: <RequireAuth role="hr" />,
    children: [
      {
        path: "/",
        Component: MainLayout,
        children: [
          { index: true, Component: Dashboard },
          { path: "onboarding", Component: Onboarding },
          { path: "hiring", Component: Hiring },
          { path: "interview-kit", Component: InterviewKit },
          { path: "analytics", Component: HRAnalytics },
          { path: "team-formation", Component: TeamFormation },
          { path: "compensation", Component: CompensationManagement },
          { path: "hr-queries", Component: HRQueryResolution },
        ],
      },
    ],
  },
  {
    element: <RequireAuth role="employee" />,
    children: [
      {
        path: "/employee",
        Component: EmployeeLayout,
        children: [
          { index: true, Component: EmployeeHome },
          { path: "offer", Component: EmployeeOffer },
          { path: "onboarding", Component: EmployeeOnboarding },
          { path: "projects", Component: EmployeeProjects },
          { path: "payslips", Component: EmployeePayslips },
          {
            path: "interviews",
            children: [
              { index: true, element: <Navigate to="upcoming" replace /> },
              { path: "upcoming", Component: EmployeeInterviews },
              { path: "kits", Component: EmployeeKits },
            ],
          },
          // Back-compat for the old direct link to kits.
          { path: "kits", element: <Navigate to="/employee/interviews/kits" replace /> },
        ],
      },
    ],
  },
]);
