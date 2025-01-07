const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 8000

// middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'))


// MongoDB Starts here
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kbg9j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	}
});

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		await client.connect();

		const menuCollection = client.db('BistroDB').collection('menu');
		const cartsCollection = client.db('BistroDB').collection('carts');
		const usersCollection = client.db('BistroDB').collection('users');


		// users related api
		app.post('/users', async (req,res) => {
			const user = req.body;
			const result = await usersCollection.insertOne(user);
			res.send(result);
		})





		app.get('/menu', async (req, res) => {
			const result = await menuCollection.find().toArray();
			res.send(result)
		})

		// carts collection

		app.get('/carts', async (req, res) => {
			const { email } = req.query;
			const query = { email: email };
			const result = await cartsCollection.find(query).toArray();
			res.send(result);
		})

		app.post('/carts', async (req, res) => {
			const cartItem = req.body;
			const result = await cartsCollection.insertOne(cartItem);
			res.send(result);
		})

		app.delete('/carts/:id', async (req, res) => {
			const { id } = req.params;
			const query = { _id: new ObjectId(id) };
			const result = await cartsCollection.deleteOne(query);
			res.send(result);
		})




		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log("Pinged your deployment. You successfully connected to MongoDB!");
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);





app.get('/', (req, res) => {
	res.send('Bistro Restro is running')
})

app.listen(port, () => {
	console.log(`Bistro is running on ${port}`);
})