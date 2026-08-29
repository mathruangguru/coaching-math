import { createElement } from "react";
import {
  FileText,
  HelpCircle,
  Video,
  Play,
  ClipboardList,
  Circle,
} from "lucide-react";

const icons = {
  materi: FileText,
  soal: HelpCircle,
  meet: Video,
  recording: Play,
  form: ClipboardList,
};

// Merender ikon sesuai tipe item materi.
export default function LessonIcon({ type, ...props }) {
  return createElement(icons[type] ?? Circle, props);
}
