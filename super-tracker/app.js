// ==============================
// CONFIGURACIÓN DE SUPABASE
// ==============================
const SUPABASE_URL = "https://aufwhiudhslcjkqberpm.supabase.co";
const SUPABASE_KEY = "sb_publishable_-yABvnGDSCMkq8KA7gZweQ_IVzZF9A0";

// Ojo: la variable se llama "supabaseClient" (no "supabase") porque la librería
// ya usa ese nombre de forma global y se generaba un conflicto.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==============================
// NAVEGACIÓN ENTRE PANTALLAS
// (esto va primero y no depende de Supabase, para que los botones
// funcionen siempre aunque falle la conexión a la base de datos)
// ==============================
const botonesNav = document.querySelectorAll("nav button");
const pantallas = document.querySelectorAll(".screen");

botonesNav.forEach((boton) => {
  boton.addEventListener("click", () => {
    const destino = boton.dataset.screen;

    pantallas.forEach((p) => p.classList.remove("active"));
    document.getElementById(destino).classList.add("active");

    botonesNav.forEach((b) => b.classList.remove("active"));
    boton.classList.add("active");

    if (destino === "inicio") cargarInicio();
    if (destino === "historial") cargarHistorial();
  });
});

// ==============================
// LÓGICA DE PRECIOS (bueno / caro)
// ==============================
async function evaluarPrecio(nombreProducto, precioNuevo) {
  const { data, error } = await supabaseClient
    .from("compras")
    .select("precio, producto_id, productos(nombre)")
    .eq("productos.nombre", nombreProducto);

  if (error || !data || data.length === 0) {
    return { estado: "normal", mensaje: "Primer registro de este producto." };
  }

  const precios = data.map((c) => c.precio);
  const promedio = precios.reduce((a, b) => a + b, 0) / precios.length;

  const diferencia = ((precioNuevo - promedio) / promedio) * 100;

  if (diferencia <= -10) {
    return { estado: "bueno", mensaje: `¡Buen precio! Está ${Math.abs(diferencia).toFixed(0)}% más barato que el promedio.` };
  } else if (diferencia >= 10) {
    return { estado: "caro", mensaje: `Está ${diferencia.toFixed(0)}% más caro que el promedio.` };
  } else {
    return { estado: "normal", mensaje: "Precio dentro del rango habitual." };
  }
}

// ==============================
// GUARDAR UNA COMPRA (producto + precio)
// ==============================
async function registrarCompra(nombreProducto, precio, cantidad, supermercado) {
  let { data: productoExistente } = await supabaseClient
    .from("productos")
    .select("id")
    .eq("nombre", nombreProducto)
    .maybeSingle();

  let productoId;
  if (productoExistente) {
    productoId = productoExistente.id;
  } else {
    const { data: nuevoProducto } = await supabaseClient
      .from("productos")
      .insert({ nombre: nombreProducto })
      .select()
      .single();
    productoId = nuevoProducto.id;
  }

  await supabaseClient.from("compras").insert({
    producto_id: productoId,
    precio: precio,
    cantidad: cantidad,
    fecha: new Date().toISOString().split("T")[0],
    supermercado: supermercado || "No especificado",
  });

  const { data: stockExistente } = await supabaseClient
    .from("stock")
    .select("cantidad_actual")
    .eq("producto_id", productoId)
    .maybeSingle();

  if (stockExistente) {
    await supabaseClient
      .from("stock")
      .update({ cantidad_actual: stockExistente.cantidad_actual + cantidad })
      .eq("producto_id", productoId);
  } else {
    await supabaseClient.from("stock").insert({ producto_id: productoId, cantidad_actual: cantidad });
  }
}

// ==============================
// CARGAR PANTALLA DE INICIO
// ==============================
async function cargarInicio() {
  const { data: stockData } = await supabaseClient
    .from("stock")
    .select("cantidad_actual, productos(nombre)");

  const lista = document.getElementById("lista-stock");
  lista.innerHTML = "";

  if (!stockData || stockData.length === 0) {
    lista.innerHTML = "<li>Sin datos aún</li>";
  } else {
    stockData.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = `${item.productos.nombre}: ${item.cantidad_actual}`;
      lista.appendChild(li);
    });
  }
}

// ==============================
// CARGAR HISTORIAL
// ==============================
async function cargarHistorial() {
  const { data } = await supabaseClient
    .from("compras")
    .select("precio, fecha, productos(nombre)")
    .order("fecha", { ascending: false });

  const tbody = document.querySelector("#tabla-historial tbody");
  tbody.innerHTML = "";

  (data || []).forEach((compra) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `<td>${compra.productos.nombre}</td><td>$${compra.precio}</td><td>${compra.fecha}</td>`;
    tbody.appendChild(fila);
  });
}

// ==============================
// CARGA MANUAL (formulario de prueba)
// ==============================
document.getElementById("btn-guardar-manual").addEventListener("click", async () => {
  const producto = document.getElementById("manual-producto").value.trim();
  const precio = parseFloat(document.getElementById("manual-precio").value);
  const cantidad = parseFloat(document.getElementById("manual-cantidad").value) || 1;
  const supermercado = document.getElementById("manual-super").value.trim();
  const estado = document.getElementById("estado-manual");

  if (!producto || isNaN(precio)) {
    estado.textContent = "Completa al menos el producto y el precio.";
    return;
  }

  estado.textContent = "Guardando...";

  try {
    const evaluacion = await evaluarPrecio(producto, precio);
    await registrarCompra(producto, precio, cantidad, supermercado);
    estado.textContent = `Guardado. ${evaluacion.mensaje}`;
  } catch (e) {
    estado.textContent = "Ocurrió un error al guardar. Revisa la consola.";
    console.error(e);
  }

  document.getElementById("manual-producto").value = "";
  document.getElementById("manual-precio").value = "";
  document.getElementById("manual-cantidad").value = "1";
  document.getElementById("manual-super").value = "";
});

// ==============================
// REGISTRO DEL SERVICE WORKER (PWA)
// ==============================
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

// Carga inicial (si Supabase falla, no debe romper el resto de la app)
cargarInicio().catch((e) => console.error("Error cargando inicio:", e));
