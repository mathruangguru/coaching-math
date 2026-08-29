const DAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

// "Selamat Pagi/Siang/Sore/Malam" berdasarkan jam sekarang.
export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return "Selamat Pagi";
  if (h < 15) return "Selamat Siang";
  if (h < 19) return "Selamat Sore";
  return "Selamat Malam";
}

// Contoh: "Sabtu, 29 Agustus"
export function longDate(date = new Date()) {
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// 7 hari dalam minggu berjalan, mulai Senin, dengan penanda "hari ini".
export function currentWeek(date = new Date()) {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  const offsetToMonday = (base.getDay() + 6) % 7;
  const monday = new Date(base);
  monday.setDate(base.getDate() - offsetToMonday);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      key: d.toISOString().slice(0, 10),
      label: DAYS_ID[d.getDay()],
      date: d.getDate(),
      isToday: d.getTime() === base.getTime(),
    };
  });
}
