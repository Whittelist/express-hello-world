const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");

const app = express();
app.use(cors());

// Leer las variables de entorno desde Render
const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;

// Inicializar cliente de Mongo
const client = new MongoClient(uri);

// Ruta principal de prueba
app.get("/", (req, res) => {
  res.send("API funcionando 🚀");
});

// Ruta real para tu frontend
app.get("/api/empresas", async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("comments"); // cambia aquí si usas otra colección
    const resultados = await collection.find({}).limit(20).toArray();
    res.json(resultados);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al conectar con la base de datos");
  }
});

// Iniciar servidor
app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});
