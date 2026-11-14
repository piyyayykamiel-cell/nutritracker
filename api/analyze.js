export default async function handler(req, res) {

  // IZINKAN WEBSITE GITHUB PAGES
  const allowedOrigin =
    process.env.FRONTEND_ORIGIN ||
    "https://piyyayykamiel-cell.github.io";

  res.setHeader(
    "Access-Control-Allow-Origin",
    allowedOrigin
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader("Vary", "Origin");

  if (req.headers.origin && req.headers.origin !== allowedOrigin) {
    return res.status(403).json({
      error: "Website tidak diizinkan mengakses API."
    });
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Metode tidak diizinkan."
    });
  }

  try {

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API Key Gemini belum dipasang di Vercel."
      });
    }

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

    const prompt = `
Kamu adalah AI ahli analisis nutrisi makanan untuk aplikasi NutriTrack.

Tugas:
1. Amati gambar makanan yang diberikan.
2. Identifikasi makanan yang terlihat.
3. Jika ada beberapa jenis makanan, identifikasi semuanya dan hitung estimasi total untuk seluruh makanan yang tampak.
4. Perkirakan ukuran porsi yang terlihat.
5. Perkirakan kalori, protein, karbohidrat, dan lemak.
6. Gunakan satuan kkal untuk kalori dan gram untuk makronutrien.
7. Jangan mengarang bahan yang tidak dapat dikenali dari gambar.
8. Jika makanan tidak dapat dikenali atau gambar bukan makanan, jelaskan keterbatasannya dan jangan mengarang angka nutrisi.
9. Berikan catatan asumsi, misalnya perkiraan ukuran porsi, minyak, saus, atau bahan yang tidak terlihat.
10. Berikan tingkat keyakinan: Tinggi, Sedang, atau Rendah.

${foodHint ? "Petunjuk nama makanan dari pengguna: " + String(foodHint).slice(0, 100) : "Pengguna tidak memberikan nama makanan. Kenali makanan langsung dari gambar."}

Estimasi nutrisi harus berdasarkan gambar dan perkiraan porsi standar yang terlihat.
Jangan memberikan diagnosis medis atau menyebut angka sebagai hasil pengukuran pasti.

Balas HANYA menggunakan JSON valid dengan format:
{
  "food_name": "Nama makanan",
  "description": "Deskripsi singkat makanan",
  "portion_estimate": "Perkiraan ukuran porsi",
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

Semua nilai nutrisi harus berupa angka positif atau nol.
Jika gambar bukan makanan, isi food_name dengan "Makanan tidak teridentifikasi" dan berikan nilai nutrisi 0.
`;

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
        error: "Gemini gagal memproses foto. Periksa API Key, kuota, dan model."
      });
    }

    const responseText =
      geminiData.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!responseText) {
      return res.status(502).json({
        error: "Gemini tidak memberikan hasil analisis."
      });
    }

    const food = JSON.parse(responseText);

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
        throw new Error("Format nutrisi dari AI tidak valid.");
      }
    }

    return res.status(200).json({
      success: true,
      food: {
        food_name: String(food.food_name || "Makanan terdeteksi"),
        description: String(food.description || ""),
        portion_estimate: String(food.portion_estimate || ""),
        calories_kcal: food.calories_kcal,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        confidence: String(food.confidence || "Sedang"),
        assumptions: Array.isArray(food.assumptions)
          ? food.assumptions.map(item => String(item).slice(0, 250)).slice(0, 6)
          : []
      }
    });

  } catch (error) {

    console.error("NutriTrack backend error:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan saat menganalisis makanan. Silakan coba lagi."
    });

  }

}
