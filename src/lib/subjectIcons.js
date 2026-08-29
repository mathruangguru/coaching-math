import { Sigma, Shapes, BarChart3, BookOpen } from "lucide-react";

// Peta nilai `icon` di data course -> komponen ikon lucide.
// Dipakai lewat <SubjectIcon name={...} /> (src/components/ui/SubjectIcon.jsx).
export const subjectIcons = {
  sigma: Sigma,
  shapes: Shapes,
  "bar-chart": BarChart3,
};

export const FallbackSubjectIcon = BookOpen;
