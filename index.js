const express = require("express");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
// middleware




const uri = `mongodb+srv://${process.env.DB_USER_ACCESS}:${process.env.DB_PASS_ACCESS_KEY}@cluster0.cpjgoyc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


const verifyUser = (req, res, next) => {
    const authorization = req.Headers.authorization;
    if (!authorization) {
        res.status(401).send({ error: true, message: 'unauthorize access' });
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.USER_ACCESS_VERIFY_TOKEN, (err, decoded) => {
        if (err) {
            res.status(401).send({ error: true, message: 'unauthorize access' });
        }
        decoded = req.decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const classesCollection = client.db('EmaGraphy').collection('classes');
        const usersCollection = client.db('EmaGraphy').collection('users');


        // jwtprotect
        app.post('/jwtprotect', async (req, res) => {
            const loginUser = req.body;
            const token = jwt.sign(loginUser, process.env.USER_ACCESS_VERIFY_TOKEN, {
                expiresIn: '4h'
            });
            res.send({ token });
        })

        // post classes
        app.post('/classes', async (req, res) => {
            const classes = req.body;
            const result = await classesCollection.insertOne(classes);
            res.send(result);
        })
        // classes get
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })
        // users post
        app.post('/users', async (req, res) => {
            const users = req.body;
            const query = { email: users?.email }
            const LoginUser = await usersCollection.findOne(query);
            if (LoginUser) {
                res.send({ message: 'You are existed' })
            }
            const result = await usersCollection.insertOne(users);
            res.send(result);
        })

        // get users
        app.get('/users', async (req, res) => {
            const users = req.body;
            const result = await usersCollection.find(users).toArray();
            res.send(result);
        });

        // make admin
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const role = {
                $set: {
                    role: 'admin'
                }
            };
            const result = await usersCollection.updateOne(filter, role);
            res.send(result);
        });

        // make instructors
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const role = {
                $set: {
                    role: 'instructor'
                }
            };
            const result = await usersCollection.updateOne(filter, role);
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
    res.send('photoShoot')
})






app.listen(port);