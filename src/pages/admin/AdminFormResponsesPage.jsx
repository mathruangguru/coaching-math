import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { getUsers } from "../../lib/users";
import {
  getForm,
  getFormResponses,
  deleteFormResponse,
  responsesToCsv,
} from "../../lib/forms";
import FormSummary from "../../components/ui/FormSummary";
import Skeleton from "../../components/ui/Skeleton";

const th =
  "border border-zinc-100 px-2.5 py-1.5 text-left text-xs font-semibold text-zinc-500 whitespace-nowrap";
const td = "border border-zinc-100 px-2.5 py-1.5 align-top text-sm text-zinc-700";

function cellText(v) {
  if (Array.isArray(v)) return v.join(", ");
  return v == null ? "" : String(v);
}

export default function AdminFormResponsesPage() {
  const { formId } = useParams();
  const [data, setData] = useState({ status: "loading" });
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getForm(formId), getFormResponses(formId), getUsers()])
      .then(([form, responses, users]) => {
        if (!alive) return;
        if (!form) return setData({ status: "not-found" });
        setData({
          status: "ready",
          form,
          responses,
          usersById: new Map(users.map((u) => [u.id, u])),
        });
      })
      .catch((err) => {
        console.error("[admin] gagal memuat respons:", err);
        if (alive) setData({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [formId]);

  const remove = async (id) => {
    if (!window.confirm("Hapus respons ini?")) return;
    setBusyId(id);
    try {
      await deleteFormResponse(id);
      setData((d) => ({
        ...d,
        responses: d.responses.filter((r) => r.id !== id),
      }));
    } catch (err) {
      window.alert(`Gagal: ${err?.message ?? err}`);
    } finally {
      setBusyId(null);
    }
  };

  const download = () => {
    const csv = responsesToCsv(data.form, data.responses, data.usersById);
    const url = URL.createObjectURL(
      new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.form.title.replace(/[^\w.-]+/g, "_")}-respons.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (data.status === "loading")
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  if (data.status !== "ready")
    return (
      <p className="text-sm text-zinc-500">
        {data.status === "not-found" ? "Form tidak ditemukan. " : "Gagal memuat. "}
        <Link to="/admin/forms" className="font-semibold text-brand-600">
          Kembali
        </Link>
      </p>
    );

  const { form, responses, usersById } = data;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to={`/admin/forms/${form.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
          >
            <ArrowLeft size={14} /> {form.title}
          </Link>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-zinc-900">
            Respons
          </h1>
          <p className="mt-0.5 text-xs text-zinc-400">
            {responses.length} respons
          </p>
        </div>
        {responses.length > 0 && (
          <button
            type="button"
            onClick={download}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            <Download size={13} /> Download CSV
          </button>
        )}
      </div>

      {responses.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-400">
          Belum ada yang mengisi.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <FormSummary form={form} responses={responses} />
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Jawaban per murid
            </p>
            <div className="no-scrollbar overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-zinc-50">
                    <th className={th}>Waktu</th>
                    <th className={th}>Nama</th>
                    {form.fields.map((f) => (
                      <th key={f.id} className={th}>
                        {f.label || "(tanpa label)"}
                      </th>
                    ))}
                    <th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r) => {
                    const u = usersById.get(r.user_id);
                    const name = u
                      ? [u.first_name, u.last_name].filter(Boolean).join(" ") ||
                        u.email
                      : r.user_id;
                    return (
                      <tr key={r.id}>
                        <td
                          className={`${td} whitespace-nowrap text-xs text-zinc-400`}
                        >
                          {new Date(r.created_at).toLocaleString("id-ID")}
                        </td>
                        <td className={`${td} whitespace-nowrap`}>
                          {name}
                          {u?.email && (
                            <span className="ml-1.5 text-xs text-zinc-400">
                              {u.email}
                            </span>
                          )}
                        </td>
                        {form.fields.map((f) => (
                          <td key={f.id} className={td}>
                            {cellText(r.answers?.[f.id])}
                          </td>
                        ))}
                        <td className={`${td} whitespace-nowrap`}>
                          <button
                            type="button"
                            onClick={() => remove(r.id)}
                            disabled={busyId === r.id}
                            aria-label="Hapus respons"
                            className="grid h-6 w-6 place-items-center rounded text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
