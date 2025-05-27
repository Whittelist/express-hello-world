const tf = require('@tensorflow/tfjs-node');
const use = require('@tensorflow-models/universal-sentence-encoder');
const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");

const app = express();
app.use(cors());

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;

const client = new MongoClient(uri);

let modeloIA = null;
use.load().then(modelo => {
  modeloIA = modelo;
  console.log('Modelo IA cargado');
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
  if (!busqueda) return res.json([]);

  // Espera el modelo cargado
  if (!modeloIA) return res.status(503).json({ error: "Modelo IA no listo" });

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("empresas");
    const empresas = await collection.find({}).limit(100).toArray();

    // Prepara textos y saca embeddings
    const textos = empresas.map(e => e.text || "");
    const embeddingsEmpresas = await modeloIA.embed(textos);
    const embeddingBusqueda = await modeloIA.embed([busqueda]);
    const sim = await tf.matMul(embeddingsEmpresas, embeddingBusqueda, false, true).array();

    // Calcula score, ordena y filtra
    const puntuaciones = sim.map((s, i) => ({
      ...empresas[i],
      score: s[0]
    }));

    const ordenadas = puntuaciones
      .sort((a, b) => b.score - a.score)
      .filter(e => e.score > 0.2)
      .slice(0, 20);

    res.json(ordenadas);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error en búsqueda IA");
  }
});


app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");

});
