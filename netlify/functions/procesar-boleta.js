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
                text: 'Esta imagen es una boleta de supermercado. Extrae cada producto con su precio y cantidad. Responde SOLO con un JSON válido, sin texto adicional, con este formato exacto: {"productos": [{"nombre": "string", "precio": number, "cantidad": number}]}. Si no puedes leer algo, omítelo.',
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
    const contenido = datos.choices?.[0]?.message?.content || "{}";
    const limpio = contenido.replace(/```json|```/g, "").trim();
    const resultado = JSON.parse(limpio);

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
