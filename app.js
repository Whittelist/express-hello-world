const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");

const app = express();
app.use(cors());

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;

const client = new MongoClient(uri);

app.get("/", (req, res) => {
  res.send("API funcionando 🚀");
});

app.get("/api/empresas", async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("comments"); // o la colección real
    const resultados = await collection.find({}).limit(20).toArray();
    res.json(resultados);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al conectar con MongoDB");
  }
});

app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");

});
