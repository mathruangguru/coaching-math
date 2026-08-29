import { useState } from "react";
import { NotebookPen, Check } from "lucide-react";
import { notes as initialNotes } from "../../data/mock";

export default function NotesPanel() {
  const [notes, setNotes] = useState(initialNotes);

  const toggle = (id) =>
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, done: !n.done } : n))
    );

  return (
    <section className="rounded-3xl border border-zinc-200/80 bg-white p-6">
      <div className="flex items-center gap-2.5">
        <NotebookPen size={20} className="text-zinc-500" />
        <h2 className="text-lg font-bold tracking-tight text-zinc-900">Notes</h2>
      </div>

      <ul className="mt-5 flex flex-col">
        {notes.map((note, i) => (
          <li
            key={note.id}
            className={`flex gap-3.5 py-4 ${
              i > 0 ? "border-t border-dashed border-zinc-200" : ""
            }`}
          >
            <button
              onClick={() => toggle(note.id)}
              aria-pressed={note.done}
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                note.done
                  ? "border-violet-500 bg-violet-500 text-white"
                  : "border-zinc-300 text-transparent hover:border-violet-400"
              }`}
            >
              <Check size={12} strokeWidth={3.5} />
            </button>
            <div className="min-w-0">
              <p
                className={`text-[15px] font-semibold ${
                  note.done
                    ? "text-zinc-400 line-through"
                    : "text-zinc-900"
                }`}
              >
                {note.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                {note.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
