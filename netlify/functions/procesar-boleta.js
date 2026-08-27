exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Método no permitido" };
  }

  try {
    const { imagenBase64 } = JSON.parse(event.body);

    const respuesta = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: 'Analiza esta boleta de supermercado. Identifica cada producto con su precio final y cantidad. Responde ÚNICAMENTE con JSON válido, sin explicaciones, sin markdown, sin backticks, exactamente en este formato: {"productos":[{"nombre":"string","precio":0,"cantidad":1}]}. Si hay descuentos, usa el precio final pagado. Si no detectas ningún producto, responde {"productos":[]}.',
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imagenBase64}` },
              },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    const datos = await respuesta.json();

    if (datos.error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Error de OpenAI", detalle: datos.error.message }),
      };
    }

    const contenido = datos.choices?.[0]?.message?.content || "{}";
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
