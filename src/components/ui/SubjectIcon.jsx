import { createElement } from "react";
import { subjectIcons, FallbackSubjectIcon } from "../../lib/subjectIcons";

// Merender ikon mapel dari nilai `name` di data course.
export default function SubjectIcon({ name, ...props }) {
  return createElement(subjectIcons[name] ?? FallbackSubjectIcon, props);
}
