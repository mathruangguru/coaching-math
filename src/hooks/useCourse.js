import { useEffect, useState } from "react";
import { getCourse } from "../lib/courses";
import { getMyEnrollments, enroll } from "../lib/enroll";
import { useAuth } from "../context/auth-context";

/**
 * Fetch course + status enroll + aksi enroll. Dipakai lobby & halaman materi.
 * status: loading | error | not-found | ready
 */
export function useCourse(courseId) {
  const { isAdmin } = useAuth();
  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [status, setStatus] = useState("loading");
  const [enrolled, setEnrolled] = useState(true); // sampai kebukti belum
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    let alive = true;

    Promise.all([getCourse(courseId), getMyEnrollments().catch(() => null)])
      .then(([data, mine]) => {
        if (!alive) return;
        if (!data) {
          setStatus("not-found");
          return;
        }
        setCourse(data);
        setSections(data.sections ?? []);
        setEnrolled(mine === null || mine.includes(courseId));
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        console.error("[useCourse] gagal memuat course:", err);
        setStatus("error");
      });

    return () => {
      alive = false;
    };
  }, [courseId]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      await enroll(courseId);
      setEnrolled(true);
    } catch (err) {
      window.alert(`Gagal enroll: ${err?.message ?? err}`);
    } finally {
      setEnrolling(false);
    }
  };

  // Materi non-publish sudah disaring server-side buat murid; pertemuan
  // yang jadi kosong nggak usah dihitung/ditampilkan.
  const visibleSections = sections.filter((s) => (s.items?.length ?? 0) > 0);

  return {
    status,
    course,
    visibleSections,
    canView: enrolled || isAdmin,
    enrolling,
    handleEnroll,
  };
}
