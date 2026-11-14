document.addEventListener("DOMContentLoaded", () => {

  // GANTI DENGAN ALAMAT VERCEL KAMU NANTI
  const API_URL = "https://NAMA-PROYEK-KAMU.vercel.app/api/analyze";

  const $ = id => document.getElementById(id);

  let profile = {};
  let imageUrl = null;
  let selectedFile = null;

  // NOTIFIKASI
  function notify(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // PROFIL
  try {
    profile = JSON.parse(
      localStorage.getItem("nutritrack_profile")
    ) || {};
  } catch {
    profile = {};
  }

  function showProfile() {
    const name = profile.name || "Pengguna";

    $("displayName").textContent = "Halo, " + name + "! 👋";
    $("avatar").textContent = name.charAt(0).toUpperCase();

    $("displayAge").textContent =
      profile.age ? profile.age + " tahun" : "-";

    $("displayHeight").textContent =
      profile.height ? profile.height + " cm" : "-";

    $("displayWeight").textContent =
      profile.weight ? profile.weight + " kg" : "-";

    $("displayGoal").textContent =
      profile.goal || "Belum diatur";
  }

  function openProfile() {
    $("name").value = profile.name || "";
    $("age").value = profile.age || "";
    $("height").value = profile.height || "";
    $("weight").value = profile.weight || "";

    $("goal").value =
      profile.goal || "Memahami kandungan nutrisi";

    $("profileModal").classList.remove("hidden");
  }

  $("editProfile").addEventListener("click", openProfile);

  $("closeModal").addEventListener("click", () => {
    $("profileModal").classList.add("hidden");
  });

  $("profileModal").addEventListener("click", event => {
    if (event.target === $("profileModal")) {
      $("profileModal").classList.add("hidden");
    }
  });

  $("profileForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("name").value.trim();
    const age = $("age").value;
    const height = $("height").value;
    const weight = $("weight").value;

    if (!name) {
      notify("Masukkan nama terlebih dahulu.");
      return;
    }

    if (age && (Number(age) < 1 || Number(age) > 120)) {
      notify("Periksa umur yang dimasukkan.");
      return;
    }

    if (height && (Number(height) < 1 || Number(height) > 250)) {
      notify("Periksa tinggi badan.");
      return;
    }

    if (weight && (Number(weight) < 1 || Number(weight) > 500)) {
      notify("Periksa berat badan.");
      return;
    }

    profile = {
      name,
      age,
      height,
      weight,
      goal: $("goal").value
    };

    try {
      localStorage.setItem(
        "nutritrack_profile",
        JSON.stringify(profile)
      );
    } catch {
      notify("Profil tidak berhasil disimpan.");
      return;
    }

    showProfile();
    $("profileModal").classList.add("hidden");
    notify("Profil berhasil disimpan!");
  });

  // PILIH FOTO
  function openPicker(camera) {
    const input = $("foodImage");

    input.value = "";

    if (camera) {
      input.setAttribute("capture", "environment");
    } else {
      input.removeAttribute("capture");
    }

    input.click();
  }

  $("uploadButton").addEventListener("click", () => {
    openPicker(false);
  });

  $("cameraButton").addEventListener("click", () => {
    openPicker(true);
  });

  // PREVIEW FOTO
  $("foodImage").addEventListener("change", event => {
    const file = event.target.files[0];

    if (!file) return;

    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowed.includes(file.type)) {
      notify("Gunakan foto JPG, PNG, atau WEBP.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      notify("Ukuran foto maksimal 10 MB.");
      event.target.value = "";
      return;
    }

    selectedFile = file;

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    imageUrl = URL.createObjectURL(file);

    $("previewImage").src = imageUrl;

    $("uploadEmpty").classList.add("hidden");
    $("previewWrap").classList.remove("hidden");

    $("resultSection").classList.add("hidden");

    notify("Foto berhasil dipilih!");
  });

  // HAPUS FOTO
  function removePhoto() {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      imageUrl = null;
    }

    selectedFile = null;

    $("foodImage").value = "";
    $("previewImage").removeAttribute("src");

    $("previewWrap").classList.add("hidden");
    $("uploadEmpty").classList.remove("hidden");
  }

  $("removeImage").addEventListener("click", removePhoto);

  // KOMPRES FOTO AGAR LEBIH RINGAN
  async function compressImage(file) {
    const bitmap = await createImageBitmap(file);

    const maxSize = 1280;

    const scale = Math.min(
      1,
      maxSize / Math.max(bitmap.width, bitmap.height)
    );

    const canvas = document.createElement("canvas");

    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");

    context.drawImage(
      bitmap,
      0,
      0,
      canvas.width,
      canvas.height
    );

    bitmap.close();

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, "image/jpeg", 0.82);
    });

    if (!blob) {
      throw new Error("Foto tidak dapat diproses.");
    }

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;
        resolve(result.split(",")[1]);
      };

      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    return {
      base64,
      mimeType: "image/jpeg"
    };
  }

  // ANALISIS AI
  async function analyzeFood() {
    if (!selectedFile) {
      notify("Pilih foto makanan terlebih dahulu!");
      return;
    }

    if (
      API_URL.includes("NAMA-PROYEK-KAMU")
    ) {
      notify("Alamat API Vercel belum dipasang.");
      return;
    }

    const button = $("analyzeButton");

    button.disabled = true;
    button.textContent = "Sedang menganalisis...";

    $("loading").classList.remove("hidden");
    $("resultSection").classList.add("hidden");

    try {
      const image = await compressImage(selectedFile);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageBase64: image.base64,
          mimeType: image.mimeType,
          foodHint: $("foodName").value.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "AI gagal menganalisis foto."
        );
      }

      if (!data.food) {
        throw new Error("Hasil analisis tidak valid.");
      }

      showResult(data.food);

    } catch (error) {
      console.error("NutriTrack error:", error);

      notify(error.message || "Terjadi kesalahan saat analisis.");

    } finally {
      button.disabled = false;
      button.textContent = "✦ Analisis dengan Gemini AI";

      $("loading").classList.add("hidden");
    }
  }

  // TAMPILKAN HASIL
  function showResult(food) {
    const portion = Number($("portion").value);

    const calories = Math.round(
      Number(food.calories_kcal) * portion
    );

    const protein = Number(
      (Number(food.protein_g) * portion).toFixed(1)
    );

    const carbs = Number(
      (Number(food.carbs_g) * portion).toFixed(1)
    );

    const fat = Number(
      (Number(food.fat_g) * portion).toFixed(1)
    );

    $("foodEmoji").textContent = "🍽️";

    $("resultName").textContent =
      food.food_name || "Makanan terdeteksi";

    $("resultPortion").textContent =
      portion + " Porsi";

    $("resultDescription").textContent =
      food.description || "Analisis berdasarkan gambar makanan.";

    $("resultCalories").textContent =
      calories.toLocaleString("id-ID");

    $("resultProtein").textContent = protein + " g";
    $("resultCarbs").textContent = carbs + " g";
    $("resultFat").textContent = fat + " g";

    const list = $("resultAssumptions");
    list.replaceChildren();

    const assumptions = Array.isArray(food.assumptions)
      ? food.assumptions
      : [];

    assumptions.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });

    if (assumptions.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nilai nutrisi diperkirakan dari gambar.";
      list.appendChild(li);
    }

    $("resultConfidence").textContent =
      "Tingkat keyakinan AI: " +
      (food.confidence || "Tidak diketahui");

    $("resultSection").classList.remove("hidden");

    $("resultSection").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  $("analyzeButton").addEventListener(
    "click",
    analyzeFood
  );

  // SCAN LAGI
  $("scanAgain").addEventListener("click", () => {
    removePhoto();

    $("foodName").value = "";
    $("portion").value = "1";

    $("resultSection").classList.add("hidden");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  // MULAI
  showProfile();

  if (!profile.name) {
    openProfile();
  }

  console.log("NutriTrack AI siap digunakan!");

});