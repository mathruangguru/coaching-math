import { supabase, hasSupabase } from "./supabase";
import { myCourses, courseSections } from "../data/mock";
import { duplicateQuestionSet } from "./quiz";
import { copyLessonPdf } from "./pdf";
import { copyLessonImage } from "./images";

/**
 * Daftar course. Bentuk: { id, title, description, icon }[]
 */
export async function getCourses() {
  if (!hasSupabase) return myCourses;

  const { data, error } = await supabase
    .from("coaching_courses")
    .select("id, title, description, icon")
    .order("created_at");

  if (error) throw error;
  return data;
}

/**
 * Satu course + sections + lessons.
 * Bentuk sama dengan gabungan myCourses + courseSections di mock,
 * jadi CourseDetailPage nggak perlu ubah struktur.
 */
export async function getCourse(id) {
  if (!hasSupabase) {
    const course = myCourses.find((c) => c.id === id);
    return course ? { ...course, sections: courseSections[id] ?? [] } : null;
  }

  const { data, error } = await supabase
    .from("coaching_courses")
    .select(
      `id, title, description, icon, announcement,
       sections:coaching_course_sections (
         id, title, position, meet_at, default_open,
         subsections:coaching_course_subsections ( id, title, position ),
         items:coaching_lessons ( id, type, title, duration, url, question_set_id, form_id, prompt, content, publish_status, access_open, access_opens_at, access_closes_at, soal_bypass, target_user_id, target_name, allow_download, subsection_id, position )
       )`
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Urutkan berdasarkan position, lalu buang field position dari hasil.
  data.sections.sort((a, b) => a.position - b.position);
  for (const section of data.sections) {
    section.items.sort((a, b) => a.position - b.position);
    (section.subsections ?? []).sort((a, b) => a.position - b.position);
    delete section.position;
    for (const item of section.items) delete item.position;
  }

  return data;
}

// ── Admin: tulis katalog (butuh login + role admin, dijaga RLS) ──────

const COURSE_COLS = "id, title, description, icon, announcement";

/**
 * Buat course baru. `payload`: { id, title, description, icon }
 */
export async function createCourse(payload) {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");

  const { data, error } = await supabase
    .from("coaching_courses")
    .insert(payload)
    .select(COURSE_COLS)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Ubah metadata course. `patch`: { title, description, icon }
 */
export async function updateCourse(id, patch) {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");

  const { data, error } = await supabase
    .from("coaching_courses")
    .update(patch)
    .eq("id", id)
    .select(COURSE_COLS)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Hapus course. Section & lesson ikut terhapus (ON DELETE CASCADE).
 */
export async function deleteCourse(id) {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");

  const { error } = await supabase.from("coaching_courses").delete().eq("id", id);
  if (error) throw error;
}

// ── Admin: passcode enroll (tabel terpisah, RLS admin-only) ─────────

/** Passcode enroll course sekarang ('' kalau nggak ada). Admin only. */
export async function getCourseSecret(courseId) {
  if (!hasSupabase) return "";
  const { data, error } = await supabase
    .from("coaching_course_secrets")
    .select("enroll_passcode")
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  return data?.enroll_passcode ?? "";
}

/** Set / hapus passcode enroll. String kosong = hapus (course jadi terbuka). */
export async function saveCourseSecret(courseId, passcode) {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
  const clean = (passcode ?? "").trim();
  if (!clean) {
    const { error } = await supabase
      .from("coaching_course_secrets")
      .delete()
      .eq("course_id", courseId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("coaching_course_secrets")
    .upsert({ course_id: courseId, enroll_passcode: clean });
  if (error) throw error;
}

// ── Admin: kurikulum (section + lesson) ─────────────────────────────

function ensureSupabase() {
  if (!hasSupabase) throw new Error("Supabase belum dikonfigurasi.");
}

async function runAll(promises) {
  const results = await Promise.all(promises);
  const failed = results.find((r) => r?.error);
  if (failed) throw failed.error;
}

export async function createSection(courseId, { title, position }) {
  ensureSupabase();
  const { data, error } = await supabase
    .from("coaching_course_sections")
    .insert({ id: crypto.randomUUID(), course_id: courseId, title, position })
    .select("id, title")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSection(id, patch) {
  ensureSupabase();
  const { error } = await supabase
    .from("coaching_course_sections")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSection(id) {
  ensureSupabase();
  const { error } = await supabase
    .from("coaching_course_sections")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderSections(orderedIds) {
  ensureSupabase();
  await runAll(
    orderedIds.map((id, i) =>
      supabase
        .from("coaching_course_sections")
        .update({ position: i })
        .eq("id", id)
    )
  );
}

export async function createLesson(
  sectionId,
  {
    type,
    title,
    duration,
    url,
    questionSetId,
    formId,
    prompt,
    content,
    publishStatus,
    position,
  }
) {
  ensureSupabase();
  const { data, error } = await supabase
    .from("coaching_lessons")
    .insert({
      id: crypto.randomUUID(),
      section_id: sectionId,
      type,
      title,
      duration: duration || null,
      url: url || null,
      question_set_id: questionSetId || null,
      form_id: formId || null,
      prompt: prompt?.trim() || null,
      content: content?.trim() || null,
      // Materi baru mulai sebagai draft — admin publish kalau sudah siap.
      publish_status: publishStatus || "none",
      position,
    })
    .select(
      "id, type, title, duration, url, question_set_id, form_id, prompt, content, publish_status"
    )
    .single();
  if (error) throw error;
  return data;
}

export async function updateLesson(id, patch) {
  ensureSupabase();
  const clean = { ...patch };
  if ("duration" in clean) clean.duration = clean.duration || null;
  if ("url" in clean) clean.url = clean.url?.trim() || null;
  if ("question_set_id" in clean) clean.question_set_id = clean.question_set_id || null;
  if ("form_id" in clean) clean.form_id = clean.form_id || null;
  if ("prompt" in clean) clean.prompt = clean.prompt?.trim() || null;
  if ("content" in clean) clean.content = clean.content?.trim() || null;
  if ("subsection_id" in clean) clean.subsection_id = clean.subsection_id || null;
  const { error } = await supabase
    .from("coaching_lessons")
    .update(clean)
    .eq("id", id);
  if (error) throw error;
}

// ── Subbagian (grup materi dalam section) ─────────────────────────────

export async function createSubsection(sectionId, { title, position }) {
  ensureSupabase();
  const { data, error } = await supabase
    .from("coaching_course_subsections")
    .insert({
      id: crypto.randomUUID(),
      section_id: sectionId,
      title: title ?? "",
      position: position ?? 0,
    })
    .select("id, title, position")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSubsection(id, patch) {
  ensureSupabase();
  const { error } = await supabase
    .from("coaching_course_subsections")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSubsection(id) {
  ensureSupabase();
  const { error } = await supabase
    .from("coaching_course_subsections")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderSubsections(orderedIds) {
  ensureSupabase();
  await runAll(
    orderedIds.map((id, i) =>
      supabase
        .from("coaching_course_subsections")
        .update({ position: i })
        .eq("id", id)
    )
  );
}

export async function deleteLesson(id) {
  ensureSupabase();
  const { error } = await supabase.from("coaching_lessons").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderLessons(orderedIds) {
  ensureSupabase();
  await runAll(
    orderedIds.map((id, i) =>
      supabase.from("coaching_lessons").update({ position: i }).eq("id", id)
    )
  );
}

/**
 * Duplikat satu pertemuan (section) beserta subbagian & materinya.
 * `src` = section dari getCourse (items sudah urut tampilan).
 *
 * Disalin: judul (+ " (salinan)"), buka-default, subbagian, dan tiap materi
 * (tipe, judul, durasi, link, isi, form, pertanyaan refleksi, setelan
 * download/bypass). Soal -> set soal ikut disalin jadi set baru; PDF/gambar
 * -> file storage disalin ke path baru.
 * Direset: publish_status = "none" (draft), jadwal pertemuan (meet_at),
 * setelan akses/jadwal soal, target feedback, dan ronde presensi (kosong).
 *
 * Balikin { id, failedFiles } — failedFiles = jumlah PDF/gambar yang gagal
 * disalin (materinya tetap dibuat, filenya kosong).
 */
export async function duplicateSection(courseId, src, position) {
  ensureSupabase();
  const secId = crypto.randomUUID();
  const { error: secErr } = await supabase
    .from("coaching_course_sections")
    .insert({
      id: secId,
      course_id: courseId,
      title: `${src.title} (salinan)`,
      position,
      default_open: src.default_open !== false,
    });
  if (secErr) throw secErr;

  let failedFiles = 0;
  try {
    const subs = [...(src.subsections ?? [])].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );
    const subMap = new Map(subs.map((s) => [s.id, crypto.randomUUID()]));
    if (subs.length) {
      const { error } = await supabase.from("coaching_course_subsections").insert(
        subs.map((s, i) => ({
          id: subMap.get(s.id),
          section_id: secId,
          title: s.title ?? "",
          position: i,
        }))
      );
      if (error) throw error;
    }

    // Satu salinan per set soal berbeda (dua materi yang pakai set sama
    // tetap berbagi satu salinan).
    const setMap = new Map();
    for (const it of src.items) {
      if (it.question_set_id && !setMap.has(it.question_set_id))
        setMap.set(it.question_set_id, await duplicateQuestionSet(it.question_set_id));
    }

    const rows = [];
    for (const [i, it] of src.items.entries()) {
      const id = crypto.randomUUID();
      let url = it.url || null;
      if (url && (it.type === "pdf" || it.type === "image")) {
        try {
          url =
            it.type === "pdf"
              ? await copyLessonPdf(url, id)
              : await copyLessonImage(url, id);
        } catch (e) {
          console.error("[duplicateSection] gagal menyalin file:", e);
          failedFiles += 1;
          url = null;
        }
      }
      rows.push({
        id,
        section_id: secId,
        type: it.type,
        title: it.title,
        duration: it.duration || null,
        url,
        question_set_id: setMap.get(it.question_set_id) ?? null,
        form_id: it.form_id || null,
        prompt: it.prompt?.trim() || null,
        content: it.content?.trim() || null,
        publish_status: "none",
        allow_download: it.allow_download ?? true,
        soal_bypass: it.soal_bypass ?? false,
        subsection_id: subMap.get(it.subsection_id) ?? null,
        position: i,
      });
    }
    if (rows.length) {
      const { error } = await supabase.from("coaching_lessons").insert(rows);
      if (error) throw error;
    }
  } catch (e) {
    // Jangan ninggalin pertemuan setengah jadi (lesson & subbagian ikut
    // kehapus lewat cascade).
    await supabase.from("coaching_course_sections").delete().eq("id", secId);
    throw e;
  }
  return { id: secId, failedFiles };
}
