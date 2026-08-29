import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import CoursePage from "./pages/CoursePage";
import CourseDetailPage from "./pages/CourseDetailPage";
import RequireAdmin from "./components/admin/RequireAdmin";
import AdminLayout from "./components/admin/AdminLayout";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminCoursesPage from "./pages/admin/AdminCoursesPage";
import CourseFormPage from "./pages/admin/CourseFormPage";

export default function App() {
  return (
    <Routes>
      {/* Aplikasi murid */}
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="course" element={<CoursePage />} />
        <Route path="course/:courseId" element={<CourseDetailPage />} />
      </Route>

      {/* Admin */}
      <Route path="admin/login" element={<AdminLoginPage />} />
      <Route path="admin" element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminCoursesPage />} />
          <Route path="course/new" element={<CourseFormPage />} />
          <Route path="course/:courseId" element={<CourseFormPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
