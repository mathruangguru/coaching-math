import { createElement } from "react";
import {
  FileText,
  HelpCircle,
  Video,
  Play,
  Presentation,
  ClipboardList,
  UserCheck,
  NotebookPen,
  Circle,
} from "lucide-react";

const icons = {
  materi: FileText,
  soal: HelpCircle,
  meet: Video,
  recording: Play,
  slide: Presentation,
  form: ClipboardList,
  presensi: UserCheck,
  refleksi: NotebookPen,
};

// Merender ikon sesuai tipe item materi.
export default function LessonIcon({ type, ...props }) {
  return createElement(icons[type] ?? Circle, props);
}
