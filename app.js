import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBSLCVS3oHZ6_M_xoPMvH2ihsbYUgfdTSo",
  authDomain: "pwa-checkin-4dbe1.firebaseapp.com",
  projectId: "pwa-checkin-4dbe1",
  storageBucket: "pwa-checkin-4dbe1.appspot.com",
  messagingSenderId: "467417750707",
  appId: "1:467417750707:web:1c165c3c6353db694c0d3f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const translations = {
  zh: {
    requireName: "❌ 請先回首頁打卡並輸入姓名。",
    noRecord: "📭 尚無打卡紀錄",
    gps_ok: "GPS 正常",
    processing: "⏳ <b style='color:green'>處理中...</b>",
    gps_out_of_range: "❌ <b style='color:red'>GPS 不在指定範圍內，禁止打卡！</b>",
    clockin_success: "✅ 上班 打卡成功！",
    clockout_success: "✅ 下班 打卡成功！",
    gps_fail: "❌ GPS 取得失敗",
    upload_fail: "❌ 上傳失敗",
    label_type: "類型："
  },
  id: {
    requireName: "❌ Silakan kembali ke halaman utama dan masukkan nama Anda.",
    noRecord: "📭 Belum ada catatan absensi",
    gps_ok: "GPS Normal",
    processing: "⏳ <b style='color:green'>Sedang diproses...</b>",
    gps_out_of_range: "❌ <b style='color:red'>GPS di luar area yang ditentukan, tidak boleh absen!",
    clockin_success: "✅ Absen Masuk berhasil!",
    clockout_success: "✅ Absen Pulang berhasil!",
    gps_fail: "❌ Gagal mendapatkan GPS",
    upload_fail: "❌ Gagal mengunggah",
    label_type: "Jenis:"
  }
};

export async function handlePunch(type) {
  let name = localStorage.getItem("username");
  let employeeId = null; // ✅ 預先宣告員編變數

  const lang = localStorage.getItem("lang") || "zh";
  const t = translations[lang];

  // ✅ 若無姓名，提示輸入
  if (!name || name.trim() === "") {
    const promptText = lang === "id" ? "Silakan masukkan nama Anda:" : "請輸入您的姓名：";
    const errorText = lang === "id"
      ? "⚠️ Masukkan nama yang valid sebelum absen!"
      : "⚠️ 請輸入有效的姓名再打卡！";

    name = prompt(promptText);
    if (!name || name.trim() === "") {
      alert(errorText);
      return;
    }
    localStorage.setItem("username", name.trim());
  }

  // ✅ 查詢員工編號（不論是否剛剛輸入的名字）
  const q = query(collection(db, "staffList"), where("name", "==", name.trim()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    alert(lang === "id"
      ? "⚠️ Nama ini tidak ditemukan dalam daftar staf. Hubungi administrator."
      : "⚠️ 查無此姓名的員工編號，請聯絡管理員！");
    return;
  }
  employeeId = snapshot.docs[0].data().id;

  // ✅ 取得 GPS
  if (!navigator.geolocation) {
    document.getElementById("status").innerText = "❌ 無法取得 GPS 位置。";
    return;
  }

  document.getElementById("status").innerHTML = t.processing;

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;

    const isInsideFirst =
      Math.abs(latitude - 25.0982990) < 0.001 &&
      Math.abs(longitude - 121.7878391) < 0.001;

    const isInsideSecond =
      Math.abs(latitude - 25.1430205) < 0.001 &&
      Math.abs(longitude - 121.7979220) < 0.001;

    const isInside = isInsideFirst || isInsideSecond;

    if (!isInside) {
      document.getElementById("status").innerHTML = t.gps_out_of_range;
      return;
    }

    try {
      await addDoc(collection(db, "attendance"), {
        name,
        employeeId, // ✅ 寫入員工編號
        type,
        timestamp: serverTimestamp(),
        gps_status: t.gps_ok,
        location: { lat: latitude, lng: longitude }
      });
      const successMsg = type === 'clockin' ? t.clockin_success : t.clockout_success;
      document.getElementById("status").innerHTML = successMsg;
    } catch (e) {
      document.getElementById("status").innerText = `${t.upload_fail}：${e.message}`;
    }
  }, () => {
    document.getElementById("status").innerText = t.gps_fail;
  });
}

export async function loadRecords() {
  const list = document.getElementById("record-list");
  const username = localStorage.getItem("username");
  const lang = localStorage.getItem("lang") || "zh";
  const t = translations[lang];

  if (!username) {
    list.innerHTML = `<p>${t.requireName}</p>`;
    return;
  }

  const q = query(
    collection(db, "attendance"),
    where("name", "==", username),
    orderBy("timestamp", "desc"),
    limit(20)
  );

  try {
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      list.innerHTML = `<p>${t.noRecord}</p>`;
      return;
    }

    let html = "";
    snapshot.forEach((doc) => {
      const d = doc.data();
      const locale = lang === "id" ? "id-ID" : "zh-TW";
const date = d.timestamp?.toDate().toLocaleString(locale) || "N/A";
      const gpsStatus = d.gps_status === "GPS 正常"
        ? (lang === "id" ? "GPS Normal" : "GPS 正常")
        : d.gps_status;

      const rawType = d.type || "";
      let typeText = rawType;
      if (rawType === "clockin" || rawType === "in") {
        typeText = lang === "id" ? "Absen Masuk" : "上班";
      } else if (rawType === "clockout" || rawType === "out") {
        typeText = lang === "id" ? "Absen Pulang" : "下班";
      }

      html += `
        <div class="log-card">
          <div class="line1">${d.name}｜${date}</div>
          <div class="line2">📍GPS：${gpsStatus} ｜ ${t.label_type}${typeText}</div>
        </div>
      `;
    });
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = `<p>❌ 查詢錯誤：${e.message}</p>`;
  }
}
