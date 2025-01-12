require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
		const paymentsCollection = client.db('BistroDB').collection('payments');



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
					return res.status(401).send({ message: 'UnAuthorized Access' })
				}
				req.decoded = decoded;
				next();
			})
		}

		// use verify admin after verifyToken
		const verifyAdmin = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await usersCollection.findOne(query);
			const isAdmin = user?.role === 'admin';
			if (!isAdmin) {
				return res.status(403).send({ message: 'Forbidden Access' })
			}
			next();
		}


		// users related api

		app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
			const result = await usersCollection.find().toArray();
			res.send(result);
		});

		// api to check if a user is admin
		app.get('/users/admin/:email', verifyToken, async (req, res) => {
			const email = req.params.email;
			if (email !== req.decoded.email) {
				return res.status(403).send({ message: 'Unauthorized Access!' })
			}
			const query = { email: email };
			const user = await usersCollection.findOne(query);
			let admin = false;
			if (user) {
				admin = user?.role === 'admin';
			}
			res.send({ admin });
		})

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

		app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
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

		app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
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

		app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
			const item = req.body;
			const result = await menuCollection.insertOne(item);
			res.send(result);
		});

		app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await menuCollection.deleteOne(query);
			res.send(result);
		});


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


		// Payment intent
		app.post('/create-payment-intent', async (req, res) => {
			const { price } = req.body;
			const amount = parseInt(price * 100);

			console.log(amount, "amount inside the intent")

			// creating payment intent
			const paymentIntent = await stripe.paymentIntents.create({
				amount: amount,
				currency: "usd",
				payment_method_types: ['card']
			})

			res.send({
				clientSecret: paymentIntent.client_secret,
			})
		})


		// payment after confirmation related api

		app.get('/payments/:email', verifyToken, async (req, res) => {
			const query = { email: req.params.email }
			if (req.params.email !== req.decoded.email) {
				return res.status(403).send({message: 'Forbidden Access'})
			}
			const result = await paymentsCollection.find(query).toArray();
			res.send(result);
		})


		app.post('/payments', async (req, res) => {
			const payment = req.body;
			const paymentResult = await paymentsCollection.insertOne(payment);
			// carefully delete each item from the cart
			console.log('payment info', payment)
			const query = {
				_id: {
					$in: payment.cartIds.map((id) => new ObjectId(id))
				}
			};

			const deleteResult = await cartsCollection.deleteMany(query);

			
			res.send({paymentResult, deleteResult});
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