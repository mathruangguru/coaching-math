import { createElement } from "react";
import { Play, FileText, PencilLine, HelpCircle, Circle } from "lucide-react";

const icons = {
  video: Play,
  reading: FileText,
  exercise: PencilLine,
  quiz: HelpCircle,
};

// Merender ikon sesuai tipe item materi.
export default function LessonIcon({ type, ...props }) {
  return createElement(icons[type] ?? Circle, props);
}
