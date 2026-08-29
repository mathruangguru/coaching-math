// Label tampilan untuk tiap tipe item materi.
// Key = nilai `type` di DB (kolom coaching_lessons.type).
export const lessonTypeLabels = {
  materi: "Materi",
  soal: "Soal",
  meet: "Link Meet",
  recording: "Recording",
  form: "Form",
};

// Status publikasi per materi (kolom coaching_lessons.publish_status).
//   none  = draft, cuma kelihatan di editor kurikulum
//   admin = tampil di halaman course hanya buat admin (preview)
//   all   = tampil buat semua murid yang enroll
export const publishStatusLabels = {
  none: "Not Publish",
  admin: "Publish for Admin",
  all: "Publish for All",
};
