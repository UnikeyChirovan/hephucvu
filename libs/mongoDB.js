const mongoClient = require("mongodb").MongoClient;
class mongoDB {
  collectionNames = {
    listTIVI: "tivi",
    listMOBILE: "mobile",
    listSTUDENT: "student",
    listFOOD: "food",
    listSTORE: "store",
    listUSER: "user",
  };
  async getAll(collectionName, filter = {}) {
    try {
      let client = await mongoClient.connect(process.env.URI);
      let result = await client
        .db(process.env.DBNAME)
        .collection(collectionName)
        .find(filter)
        .toArray();
      client.close();
      return result;
    } catch (error) {
      throw error;
    }
  }
  async getOne(collectionName, filter = {}) {
    try {
      let client = await mongoClient.connect(process.env.URI);
      let result = await client
        .db(process.env.DBNAME)
        .collection(collectionName)
        .findOne(filter);
      client.close();
      return result;
    } catch (error) {
      throw error;
    }
  }
  async insertOne(collectionName, newDocument) {
    try {
      let client = await mongoClient.connect(process.env.URI);
      let result = await client
        .db(process.env.DBNAME)
        .collection(collectionName)
        .insertOne(newDocument);
      return result;
    } catch (error) {
      throw error;
    }
  }
  async updateOne(collectionName, filter, updateFilter) {
    try {
      let client = await mongoClient.connect(process.env.URI);
      let result = await client
        .db(process.env.DBNAME)
        .collection(collectionName)
        .updateOne(filter, updateFilter);
      return result;
    } catch (error) {
      throw error;
    }
  }
  async deleteOne(collectionName, filter) {
    try {
      let client = await mongoClient.connect(process.env.URI);
      let result = await client
        .db(process.env.DBNAME)
        .collection(collectionName)
        .deleteOne(filter);
      return result;
    } catch (error) {
      throw error;
    }
  }
}

let db = new mongoDB();
module.exports = db;
