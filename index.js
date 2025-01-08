const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
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
		// await client.connect();


		const menuCollection = client.db('BistroDB').collection('menu');
		const cartsCollection = client.db('BistroDB').collection('carts');
		const usersCollection = client.db('BistroDB').collection('users');



		// jwt related apis
		app.post('/jwt', (req, res) => {
			const user = req.body
			const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
			res.send({ token });
		})

		// verify Token middleware
		const verifyToken = async (req, res, next) => {
			console.log('inside middleware', req.headers.authorization);
			if (!req.headers.authorization) {
				return res.status('401').send({ message: 'Forbidden Access' });
			}

			const token = req.headers.authorization.split(' ')[1];
			if (!token) {
				return res.status('400').send('Forbidden access')
			}

			jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
				if (error) {
					return res.status(401).send({message: 'Forbidden Access'})
				}
				req.decoded = decoded;
				next();
			})
			
		}


		// users related api

		app.get('/users', verifyToken,async (req, res) => {
			const result = await usersCollection.find().toArray();
			res.send(result);
		});


		app.post('/users', async (req, res) => {
			const user = req.body;
			// insert email if user is new
			const query = { email: user.email };
			const existingUser = await usersCollection.findOne(query);
			if (existingUser) {
				return res.send({ message: 'User already exists', insertedId: null });
			}
			const result = await usersCollection.insertOne(user);
			res.send(result);
		})

		app.patch('/users/admin/:id', async (req, res) => {
			const { id } = req.params;
			const filter = { _id: new ObjectId(id) };
			const updateDoc = {
				$set: {
					role: 'admin'
				}
			}
			const result = await usersCollection.updateOne(filter, updateDoc);
			res.send(result);
		});

		app.delete('/users/:id', async (req, res) => {
			const { id } = req.params;
			const query = { _id: new ObjectId(id) };
			const result = await usersCollection.deleteOne(query);
			res.send(result);
		});


		// menu collection
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