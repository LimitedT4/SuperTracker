exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Método no permitido" };
  }

  try {
    const { imagenBase64 } = JSON.parse(event.body);

    const prompt =
      'Analiza esta boleta de supermercado. Identifica cada producto con su precio final y cantidad. Responde ÚNICAMENTE con JSON válido, sin explicaciones, sin markdown, sin backticks, exactamente en este formato: {"productos":[{"nombre":"string","precio":0,"cantidad":1}]}. Si hay descuentos, usa el precio final pagado. Si no detectas ningún producto, responde {"productos":[]}.';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: imagenBase64 } },
            ],
          },
        ],
      }),
    });

    const datos = await respuesta.json();

    if (datos.error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Error de Gemini", detalle: datos.error.message }),
      };
    }

    const contenido = datos.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const limpio = contenido.replace(/```json|```/g, "").trim();

    let resultado;
    try {
      resultado = JSON.parse(limpio);
    } catch (e) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "La IA no devolvió JSON válido", respuestaCruda: contenido }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(resultado),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al procesar la boleta", detalle: error.message }),
    };
  }
};
