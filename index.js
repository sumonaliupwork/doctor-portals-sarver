const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb');
const Object = require('mongodb').ObjectId;
const admin = require("firebase-admin");
require('dotenv').config();
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000


// use middleware
app.use(cors());
app.use(express.json());

// add firebase to server

const serviceAccount = require('./doctors-portal-firebase-adminsdk.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



// connect to database
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bu6kaai.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }

    next();
}

async function run() {
    try {
        const database = client.db("doctorsPortal");
        const patientCollection = database.collection("patient");
        const userCollection = database.collection('user');

        app.post('/appointment', async (req, res) => {
            const appoint = req.body;
            const result = await patientCollection.insertOne(appoint);
            res.json(result);
        });
        app.get('/appointment', async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            const filter = { email: email, date: date };
            const query = patientCollection.find(filter).sort({ '_id': -1 });
            const result = await query.toArray();
            res.send(result);
        });

        app.get('/users/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const user = await userCollection.findOne(filter);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.json(result);
        });

        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });

        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requestAccount = await userCollection.findOne({ email: requester });
                if (requestAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await userCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                req.status(403).json({ message: 'You do not have access to admin' });
            }

        })
    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log('This is listening', port)
})