const express = require("express");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
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
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorize access' });
    }
    const token = authorization.split(' ')[1]
    jwt.verify(token, process.env.USER_ACCESS_VERIFY_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorize access' });
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();



        const classesCollection = client.db('EmaGraphy').collection('classes');
        const usersCollection = client.db('EmaGraphy').collection('users');
        const instructorsCollection = client.db('EmaGraphy').collection('instructors');
        const bookingsClassCollection = client.db('EmaGraphy').collection('bookingsClass');


        // ------------------------------------------------------------Admin verify---------------------------------------------------------------
        // Admin verify
        const isAdmin = async (req, res, next) => {
            const email = req.decoded?.email;
            const filter = { email: email };
            const users = await usersCollection.findOne(filter);
            if (users?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next();
        };

        // -------------------------------------------------------------instructor verify--------------------------------------------------------------
        // instructor verify
        const isInstructor = async (req, res, next) => {
            const email = req.decoded?.email;
            const filter = { email: email };
            const users = await usersCollection.findOne(filter);
            if (users?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next();
        }

        // ------------------------------------------------------------jwt---------------------------------------------------------------
        // jwtprotect
        app.post('/jwtprotect', async (req, res) => {
            const loginUser = req.body;
            const token = jwt.sign(loginUser, process.env.USER_ACCESS_VERIFY_TOKEN, {
                expiresIn: '4h'
            });
            res.send({ token });
        })

        // --------------------------------------------------------------classes-------------------------------------------------------------
        // post classes
        app.post('/classes', verifyUser, isInstructor, async (req, res) => {
            const classes = req.body;
            const result = await classesCollection.insertOne(classes);
            res.send(result);
        })
        // classes get
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        });

        //each instructors Own classes TODO verify user and inst
        app.get('/instructorClass', verifyUser, isInstructor, async (req, res) => {
            const instructorRole = { role: 'instructor' };
            if (!instructorRole) {
                return res.status(500).send([]);
            };
            const user = await usersCollection.findOne(instructorRole);
            const instructorEmail = user.email;
            const email = { instructor_email: instructorEmail };
            const result = await classesCollection.find(email).toArray();
            res.send(result);
        });

        // update each instructorClass 
        app.put('/instructorClass/:id', verifyUser, isInstructor, async (req, res) => {
            const id = req.params.id;
            const classes = req.body;
            const query = { _id: new ObjectId(id) };
            const option = { upsert: true };

            const classInfo = {
                $set: {
                    class_name: classes.class_name, seats: classes.seats, price: classes.price
                }
            };

            const result = await classesCollection.updateOne(query, classInfo, option);
            res.send(result);
        });

        // update classes status approved
        app.put('/classes/:id', verifyUser, isAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const status = {
                $set: {
                    status: "approved"
                }
            };
            const result = await classesCollection.updateOne(filter, status);
            res.send(result);
        });

        // update classes status approved
        app.put('/classes/:id', verifyUser, isAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const defStatus = { status: 'pending' };
            const approved = { status: 'approved' }
            if (approved && !defStatus) {
                return { status: 'approved' }
            }
            //Todo
            // if (!approved && defStatus) {
            const status = {
                $set: {
                    status: "denied"
                }
            };
            const result = await classesCollection.updateOne(filter, status);
            res.send(result);
            // }
        });



        // ---------------------------------------------------------------users------------------------------------------------------------
        // users post
        app.post('/users', async (req, res) => {
            const users = req.body;
            const query = { email: users.email };
            const isLoginUser = await usersCollection.findOne(query);
            if (isLoginUser) {
                return res.send({ message: 'You are existed' })
            }
            const result = await usersCollection.insertOne(users);
            res.send(result);
        })

        // get users
        app.get('/users', verifyUser, isAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
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

        // admin verify by email
        app.get('/users/admin/:email', verifyUser, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const filter = { email: email };
            const user = await usersCollection.findOne(filter);
            const result = { admin: user?.role === 'admin' };
            res.send(result);
        });

        //  instructor verify by email
        app.get('/users/instructor/:email', verifyUser, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }
            const filter = { email: email };
            const user = await usersCollection.findOne(filter);
            const result = { instructor: user?.role === 'instructor' };
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
        });

        // instructors route 
        app.get('/instructors', verifyUser, async (req, res) => {
            const instructorRole = { role: 'instructor' };

            if (!instructorRole) {
                return res.status(500).send([]);
            };

            const results = await usersCollection.find(instructorRole).toArray();
            // const results = await instructorsCollection.insertOne(instructors);
            // console.log('data', results)
            res.send(results);
        });

        app.get('/instructors', verifyUser, async (req, res) => {
            const results = await instructorsCollection.find().toArray();
            console.log('data', results)
            res.send(results);
        })

        // -------------------------------------------------------------------bookings Classes--------------------------------------------------------
        // bookings class
        app.post('/bookedClass', async (req, res) => {
            const bookedClass = req.body;
            const result = await bookingsClassCollection.insertOne(bookedClass);
            res.send(result);
        })

        // get bookings  class 
        app.get('/bookedClass', verifyUser, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([])
            }

            const decodeEmail = req.decoded.email;
            if (email !== decodeEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const filter = { email: email };
            const result = await bookingsClassCollection.find(filter).toArray();
            res.send(result);
        });

        // delete bookedClass
        app.delete('/bookedClass/:id', verifyUser, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingsClassCollection.deleteOne(query);
            res.send(result);
        })


        // -------------------------------------------------------------------Payment--------------------------------------------------------
      

        app.post('/payment', verifyUser, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            console.log(price, amount)
            const payment = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: payment.client_secret
            })
        });
        // -------------------------------------------------------------------Payment--------------------------------------------------------



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