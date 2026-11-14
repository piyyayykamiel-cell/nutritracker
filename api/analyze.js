export default async function handler(req, res) {
  // =====================================
  // 1. PENGATURAN CORS
  // =====================================

  const defaultOrigin =
    "https://piyyayykamiel-cell.github.io";

  const configuredOrigin = process.env.FRONTEND_ORIGIN;

  // Normalisasi alamat agar garis miring di akhir
  // atau path tambahan tidak menyebabkan salah cocok.
  function normalizeOrigin(value) {
    try {
      return new URL(value).origin;
    } catch {
      return null;
    }
  }

  const allowedOrigins = new Set([
    defaultOrigin,
    normalizeOrigin(configuredOrigin)
  ].filter(Boolean));

  const origin = req.headers.origin;

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  // Tolak website yang tidak dikenal.
  if (origin && !allowedOrigins.has(origin)) {
    console.warn("Origin ditolak:", origin);

    return res.status(403).json({
      error: "Website tidak diizinkan mengakses API."
    });
  }

  // Izinkan alamat website yang cocok.
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  // Menangani permintaan pemeriksaan CORS.
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // API hanya menerima POST.
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metode tidak diizinkan."
    });
  }

  try {
    // =====================================
    // 2. API KEY GEMINI
    // =====================================

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY belum dipasang di Vercel."
      });
    }

    // =====================================
    // 3. MENERIMA DATA FOTO
    // =====================================

    const {
      imageBase64,
      mimeType,
      foodHint
    } = req.body || {};

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({
        error: "Foto makanan belum diterima."
      });
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(mimeType)) {
      return res.status(400).json({
        error: "Format gambar tidak didukung."
      });
    }

    if (
      typeof imageBase64 !== "string" ||
      imageBase64.length > 5500000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)
    ) {
      return res.status(400).json({
        error: "Ukuran atau data gambar tidak valid."
      });
    }

    // =====================================
    // 4. PROMPT ANALISIS MAKANAN
    // =====================================

    const prompt = `
Kamu adalah AI analisis nutrisi makanan untuk NutriTrack.

Amati gambar dan identifikasi makanan yang terlihat.

Berikan:
1. Nama makanan.
2. Deskripsi singkat.
3. Perkiraan ukuran porsi.
4. Estimasi kalori dalam kkal.
5. Protein dalam gram.
6. Karbohidrat dalam gram.
7. Lemak dalam gram.
8. Tingkat keyakinan: Tinggi, Sedang, atau Rendah.
9. Asumsi yang digunakan.

Jika terdapat beberapa makanan, perkirakan total nutrisi
seluruh makanan yang terlihat.

Jangan mengarang bahan yang tidak terlihat.
Jika gambar bukan makanan atau tidak dapat dikenali,
gunakan nama "Makanan tidak teridentifikasi"
dan nilai nutrisi 0.

Petunjuk pengguna:
${String(foodHint || "Tidak ada").slice(0, 100)}

Angka nutrisi merupakan estimasi, bukan pengukuran pasti.

Balas hanya dengan JSON valid:
{
  "food_name": "Nama makanan",
  "description": "Deskripsi makanan",
  "portion_estimate": "Perkiraan porsi",
  "calories_kcal": 350,
  "protein_g": 18,
  "carbs_g": 30,
  "fat_g": 19,
  "confidence": "Sedang",
  "assumptions": [
    "Asumsi pertama",
    "Asumsi kedua"
  ]
}
`;

    // =====================================
    // 5. MENGIRIM FOTO KE GEMINI
    // =====================================

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        })
      }
    );

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", geminiData);

      return res.status(502).json({
        error:
          geminiData.error?.message ||
          "Gemini gagal memproses foto."
      });
    }

    // =====================================
    // 6. MEMBACA HASIL GEMINI
    // =====================================

    const responseText =
      geminiData.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!responseText) {
      console.error("Gemini response kosong:", geminiData);

      return res.status(502).json({
        error: "Gemini tidak memberikan hasil analisis."
      });
    }

    let food;

    try {
      food = JSON.parse(responseText);
    } catch (error) {
      console.error("JSON Gemini tidak valid:", responseText);

      return res.status(502).json({
        error: "Format hasil analisis Gemini tidak valid."
      });
    }

    // =====================================
    // 7. VALIDASI DATA NUTRISI
    // =====================================

    const fields = [
      "calories_kcal",
      "protein_g",
      "carbs_g",
      "fat_g"
    ];

    for (const field of fields) {
      if (
        typeof food[field] !== "number" ||
        !Number.isFinite(food[field]) ||
        food[field] < 0
      ) {
        return res.status(502).json({
          error: "Data nutrisi dari Gemini tidak valid."
        });
      }
    }

    // =====================================
    // 8. MENGIRIM HASIL KE WEBSITE
    // =====================================

    return res.status(200).json({
      success: true,
      food: {
        food_name: String(
          food.food_name || "Makanan terdeteksi"
        ),
        description: String(food.description || ""),
        portion_estimate: String(
          food.portion_estimate || ""
        ),
        calories_kcal: food.calories_kcal,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        confidence: String(
          food.confidence || "Sedang"
        ),
        assumptions: Array.isArray(food.assumptions)
          ? food.assumptions
              .map(item => String(item).slice(0, 250))
              .slice(0, 6)
          : []
      }
    });

  } catch (error) {
    console.error("NutriTrack backend error:", error);

    return res.status(500).json({
      error:
        error.message ||
        "Terjadi kesalahan pada server."
    });
  }
}
