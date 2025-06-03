const tf = require('@tensorflow/tfjs-node');
const use = require('@tensorflow-models/universal-sentence-encoder');
const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");

const app = express();
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;

const client = new MongoClient(uri);

let modeloIA = null;
use.load().then(modelo => {
  modeloIA = modelo;
  console.log('Modelo IA cargado');
});

// Al principio de tu app.js, después de cargar modeloIA:
async function calcularYGuardarEmbedding(empresa) {
  if (!modeloIA) throw new Error("Modelo IA no cargado");
  const textoEmpresa = [
    empresa.name, 
    empresa.text, 
    (empresa.tags || []).join(', '), 
    empresa.categoria, 
    empresa.url
  ].filter(Boolean).join(' ');

  const embTensor = await modeloIA.embed([textoEmpresa]);
  const embArray = embTensor.arraySync()[0];
  return embArray;
}

// Ejemplo de uso al insertar una empresa nueva:
app.post("/api/empresas", async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection("empresas");
    const nuevaEmpresa = req.body;
    // Solo calcula embedding si no existe
    if (!nuevaEmpresa.embedding) {
      nuevaEmpresa.embedding = await calcularYGuardarEmbedding(nuevaEmpresa);
    }
    const resultado = await col.insertOne(nuevaEmpresa);
    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error insertando empresa");
  }
});



app.get("/", (req, res) => {
  res.send("API funcionando 🚀");
});

app.get("/api/empresas", async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("empresas");// o la colección real
    const resultados = await collection.find({}).limit(20).toArray();
    res.json(resultados);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al conectar con MongoDB");
  }
});

app.get("/api/buscar", async (req, res) => {
  const busqueda = req.query.q?.trim();
  const modelo = req.query.modelo || "use"; // por defecto usa 'use'

  if (!busqueda) return res.json([]);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("empresas");

    // --- Búsqueda Universal Sentence Encoder (igual que antes)
    if (modelo === "use") {
      if (!modeloIA) return res.status(503).json({ error: "Modelo IA no listo" });

      const empresas = await collection.find({ embedding: { $exists: true } }).toArray();
      const embeddingBusqueda = await modeloIA.embed([busqueda]);
      const embeddingArr = embeddingBusqueda.arraySync()[0];

      function dot(a, b) { return a.reduce((sum, v, i) => sum + v * b[i], 0);}
      function norm(a) { return Math.sqrt(dot(a, a));}
      function cosineSimilarity(a, b) { return dot(a, b) / (norm(a) * norm(b)); }

      const puntuaciones = empresas.map(e => ({
        ...e,
        score: cosineSimilarity(e.embedding, embeddingArr)
      }));

      const ordenadas = puntuaciones
        .sort((a, b) => b.score - a.score)
        .filter(e => e.score > 0.2)
        .slice(0, 20);

      return res.json(ordenadas);
    }

    // --- Búsqueda exacta por tags
    if (modelo === "tags") {
      const busq = busqueda.toLowerCase();
      const empresas = await collection.find({ tags: { $exists: true, $ne: [] } }).toArray();
      const filtradas = empresas.filter(e =>
        (e.tags || []).some(tag => tag.toLowerCase().includes(busq))
      );
      // Ordena las que más coincidencias tengan primero
      const ordenadas = filtradas
        .map(e => ({
          ...e,
          score: (e.tags || []).filter(tag => tag.toLowerCase().includes(busq)).length
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      return res.json(ordenadas);
    }

    // --- Puedes añadir más modelos aquí

    return res.status(400).json({ error: "Modelo de búsqueda no soportado" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error en búsqueda");
  }
});




app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");

});
