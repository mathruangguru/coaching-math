import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import RequireAuth from "./components/auth/RequireAuth";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CoursePage from "./pages/CoursePage";
import CourseLobbyPage from "./pages/CourseLobbyPage";
import CourseMateriPage from "./pages/CourseMateriPage";
import MateriContentPage from "./pages/MateriContentPage";
import RecordingPage from "./pages/RecordingPage";
import SlidePage from "./pages/SlidePage";
import PdfPage from "./pages/PdfPage";
import QuizPage from "./pages/QuizPage";
import FormPage from "./pages/FormPage";
import PresensiPage from "./pages/PresensiPage";
import ProfilePage from "./pages/ProfilePage";
import RequireAdmin from "./components/admin/RequireAdmin";
import AdminLayout from "./components/admin/AdminLayout";
import AdminCoursesPage from "./pages/admin/AdminCoursesPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminEnrollmentsPage from "./pages/admin/AdminEnrollmentsPage";
import AdminQuizResultsPage from "./pages/admin/AdminQuizResultsPage";
import AdminBranchesPage from "./pages/admin/AdminBranchesPage";
import CourseFormPage from "./pages/admin/CourseFormPage";
import SetSoalPage from "./pages/admin/SetSoalPage";
import SetSoalFormPage from "./pages/admin/SetSoalFormPage";
import AdminFormsPage from "./pages/admin/AdminFormsPage";
import AdminFormFormPage from "./pages/admin/AdminFormFormPage";
import AdminFormResponsesPage from "./pages/admin/AdminFormResponsesPage";
import AdminUtilitiesPage from "./pages/admin/AdminUtilitiesPage";
import AdminSpinwheelPage from "./pages/admin/AdminSpinwheelPage";
import AdminTimerPage from "./pages/admin/AdminTimerPage";

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      {/* alias lama */}
      <Route path="admin/login" element={<Navigate to="/login" replace />} />

      {/* Aplikasi murid — butuh login */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="course" element={<CoursePage />} />
          <Route path="course/:courseId" element={<CourseLobbyPage />} />
          <Route
            path="course/:courseId/materi"
            element={<CourseMateriPage />}
          />
          <Route
            path="course/:courseId/materi/:lessonId"
            element={<MateriContentPage />}
          />
          <Route
            path="course/:courseId/recording/:lessonId"
            element={<RecordingPage />}
          />
          <Route
            path="course/:courseId/slide/:lessonId"
            element={<SlidePage />}
          />
          <Route
            path="course/:courseId/pdf/:lessonId"
            element={<PdfPage />}
          />
          <Route
            path="course/:courseId/soal/:lessonId"
            element={<QuizPage />}
          />
          <Route
            path="course/:courseId/soal/:lessonId/review"
            element={<QuizPage review />}
          />
          <Route
            path="course/:courseId/form/:lessonId"
            element={<FormPage />}
          />
          <Route
            path="course/:courseId/presensi/:lessonId"
            element={<PresensiPage />}
          />
          <Route
            path="course/:courseId/refleksi/:lessonId"
            element={<FormPage />}
          />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Admin — butuh login + role admin */}
      <Route path="admin" element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminCoursesPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="branches" element={<AdminBranchesPage />} />
          <Route path="enrollments" element={<AdminEnrollmentsPage />} />
          <Route path="quiz-results" element={<AdminQuizResultsPage />} />
          <Route path="set-soal" element={<SetSoalPage />} />
          <Route path="set-soal/:setId" element={<SetSoalFormPage />} />
          <Route path="forms" element={<AdminFormsPage />} />
          <Route path="forms/:formId" element={<AdminFormFormPage />} />
          <Route
            path="forms/:formId/responses"
            element={<AdminFormResponsesPage />}
          />
          <Route path="utilitas" element={<AdminUtilitiesPage />} />
          <Route path="utilitas/spinwheel" element={<AdminSpinwheelPage />} />
          <Route path="utilitas/timer" element={<AdminTimerPage />} />
          <Route path="course/new" element={<CourseFormPage />} />
          <Route path="course/:courseId" element={<CourseFormPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
