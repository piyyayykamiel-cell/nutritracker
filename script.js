document.addEventListener("DOMContentLoaded", () => {

  // ALAMAT BACKEND VERCEL
  const API_URL =
    "https://nutritracker-liard.vercel.app/api/analyze";

  const $ = id => document.getElementById(id);

  let profile = {};
  let selectedFile = null;
  let imageUrl = null;

  // CEK ELEMEN HTML
  const requiredElements = [
    "foodImage",
    "uploadButton",
    "cameraButton",
    "analyzeButton",
    "previewImage",
    "previewWrap",
    "uploadEmpty",
    "removeImage",
    "foodName",
    "portion",
    "loading",
    "resultSection",
    "resultName",
    "resultPortion",
    "resultDescription",
    "resultCalories",
    "resultProtein",
    "resultCarbs",
    "resultFat",
    "foodEmoji",
    "resultAssumptions",
    "resultConfidence"
  ];

  const missing = requiredElements.filter(id => !$(id));

  if (missing.length > 0) {
    console.error("Elemen HTML tidak ditemukan:", missing);
    alert("Ada elemen HTML yang belum ditemukan: " + missing.join(", "));
    return;
  }

  // NOTIFIKASI
  function notify(message) {
    const toast = $("toast");

    if (!toast) {
      alert(message);
      return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(window.nutriToastTimer);

    window.nutriToastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3500);
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

    if ($("displayName")) {
      $("displayName").textContent = "Halo, " + name + "! 👋";
    }

    if ($("avatar")) {
      $("avatar").textContent = name.charAt(0).toUpperCase();
    }

    if ($("displayAge")) {
      $("displayAge").textContent =
        profile.age ? profile.age + " tahun" : "-";
    }

    if ($("displayHeight")) {
      $("displayHeight").textContent =
        profile.height ? profile.height + " cm" : "-";
    }

    if ($("displayWeight")) {
      $("displayWeight").textContent =
        profile.weight ? profile.weight + " kg" : "-";
    }

    if ($("displayGoal")) {
      $("displayGoal").textContent =
        profile.goal || "Belum diatur";
    }
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

  if ($("editProfile")) {
    $("editProfile").addEventListener("click", openProfile);
  }

  if ($("closeModal")) {
    $("closeModal").addEventListener("click", () => {
      $("profileModal").classList.add("hidden");
    });
  }

  if ($("profileModal")) {
    $("profileModal").addEventListener("click", event => {
      if (event.target === $("profileModal")) {
        $("profileModal").classList.add("hidden");
      }
    });
  }

  $("profileForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("name").value.trim();

    if (!name) {
      notify("Silakan masukkan nama.");
      return;
    }

    profile = {
      name,
      age: $("age").value,
      height: $("height").value,
      weight: $("weight").value,
      goal: $("goal").value
    };

    try {
      localStorage.setItem(
        "nutritrack_profile",
        JSON.stringify(profile)
      );
    } catch {
      notify("Profil gagal disimpan.");
      return;
    }

    showProfile();
    $("profileModal").classList.add("hidden");

    notify("Profil berhasil disimpan!");
  });

  // PILIH FOTO ATAU KAMERA
  function openFilePicker(useCamera) {
    const input = $("foodImage");

    input.value = "";

    if (useCamera) {
      input.setAttribute("capture", "environment");
    } else {
      input.removeAttribute("capture");
    }

    input.click();
  }

  $("uploadButton").addEventListener("click", () => {
    openFilePicker(false);
  });

  $("cameraButton").addEventListener("click", () => {
    openFilePicker(true);
  });

  // TAMPILKAN FOTO
  $("foodImage").addEventListener("change", event => {
    const file = event.target.files[0];

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      notify("Format foto harus JPG, PNG, atau WEBP.");
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

    notify("Foto makanan berhasil dipilih!");
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

  // KOMPRES FOTO DAN UBAH KE BASE64
  async function compressImage(file) {
    const bitmap = await createImageBitmap(file);

    const maxDimension = 1280;

    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height)
    );

    const canvas = document.createElement("canvas");

    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      throw new Error("Foto tidak dapat diproses browser.");
    }

    context.drawImage(
      bitmap,
      0,
      0,
      canvas.width,
      canvas.height
    );

    bitmap.close();

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, "image/jpeg", 0.8);
    });

    if (!blob) {
      throw new Error("Gagal mengompres foto.");
    }

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;
        resolve(result.split(",")[1]);
      };

      reader.onerror = () => {
        reject(new Error("Gagal membaca foto."));
      };

      reader.readAsDataURL(blob);
    });

    return {
      imageBase64: base64,
      mimeType: "image/jpeg"
    };
  }

  // TAMPILKAN HASIL ANALISIS
  function showResult(food, portion) {
    const calories = Number(food.calories_kcal) * portion;
    const protein = Number(food.protein_g) * portion;
    const carbs = Number(food.carbs_g) * portion;
    const fat = Number(food.fat_g) * portion;

    const values = [calories, protein, carbs, fat];

    if (!values.every(value =>
      Number.isFinite(value) && value >= 0
    )) {
      throw new Error("Data nutrisi dari AI tidak valid.");
    }

    $("foodEmoji").textContent = "🍽️";

    $("resultName").textContent =
      food.food_name || "Makanan terdeteksi";

    $("resultPortion").textContent =
      (food.portion_estimate || "Perkiraan porsi") +
      " · " + portion + "x";

    $("resultDescription").textContent =
      food.description || "Estimasi nutrisi dari foto makanan.";

    $("resultCalories").textContent =
      Math.round(calories).toLocaleString("id-ID");

    $("resultProtein").textContent =
      protein.toFixed(1) + " g";

    $("resultCarbs").textContent =
      carbs.toFixed(1) + " g";

    $("resultFat").textContent =
      fat.toFixed(1) + " g";

    // CATATAN AI
    const assumptions = $("resultAssumptions");

    assumptions.replaceChildren();

    const items = Array.isArray(food.assumptions)
      ? food.assumptions
      : [];

    if (items.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nilai nutrisi merupakan perkiraan dari gambar.";
      assumptions.appendChild(li);
    } else {
      items.forEach(item => {
        const li = document.createElement("li");
        li.textContent = String(item);
        assumptions.appendChild(li);
      });
    }

    $("resultConfidence").textContent =
      "Tingkat keyakinan AI: " +
      (food.confidence || "Sedang");

    $("resultSection").classList.remove("hidden");

    $("resultSection").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // ANALISIS MAKANAN DENGAN GEMINI
  async function analyzeFood() {
    if (!selectedFile) {
      notify("Silakan pilih foto makanan terlebih dahulu.");
      return;
    }

    const button = $("analyzeButton");

    const portion = Number($("portion").value);

    if (!Number.isFinite(portion) || portion <= 0) {
      notify("Jumlah porsi tidak valid.");
      return;
    }

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
          imageBase64: image.imageBase64,
          mimeType: image.mimeType,
          foodHint: $("foodName").value.trim()
        })
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "Server tidak memberikan respons JSON yang valid."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Gagal menghubungi Gemini. Kode: " +
          response.status
        );
      }

      if (!data.success || !data.food) {
        throw new Error(
          data.error || "Hasil analisis tidak ditemukan."
        );
      }

      showResult(data.food, portion);

      notify("Analisis makanan berhasil!");

    } catch (error) {
      console.error("NutriTrack error:", error);

      notify(
        error.message ||
        "Terjadi kesalahan. Silakan coba kembali."
      );

    } finally {
      button.disabled = false;
      button.textContent = "✦ Analisis dengan Gemini AI";

      $("loading").classList.add("hidden");
    }
  }

  $("analyzeButton").addEventListener("click", analyzeFood);

  // SCAN FOTO LAIN
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

  // MULAI WEBSITE
  showProfile();

  if (!profile.name) {
    openProfile();
  }

  console.log("NutriTrack berhasil dimuat.");

});
