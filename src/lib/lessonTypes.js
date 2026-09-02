// Label tampilan untuk tiap tipe item materi.
// Key = nilai `type` di DB (kolom coaching_lessons.type).
export const lessonTypeLabels = {
  materi: "Materi",
  soal: "Soal",
  meet: "Link Meet",
  recording: "Recording",
  slide: "Google Slide",
  form: "Form",
  presensi: "Presensi",
  refleksi: "Refleksi",
};

// Status publikasi per materi (kolom coaching_lessons.publish_status).
//   none = Not Publish -> non-admin nggak bisa akses & hidden
//   all  = Publish     -> semua murid yang enroll bisa akses
export const publishStatusLabels = {
  none: "Not Publish",
  all: "Publish",
};
