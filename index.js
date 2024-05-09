require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
    origin: [
        'http://localhost:5173'
    ],
    credentials: true,
    optionSuccessStatus: 200,

}

app.use(cors(corsOptions))
app.use(express.json());
app.use(cookieParser());

//jwt verify token middleware
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    // console.log(token);
    if (!token) return res.status(401).send({ message: 'unauthorized access' })
    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                console.log(err);
                return res.status(401).send({ message: 'unauthorized access' })
            }
            console.log(decoded);
            req.user = decoded;
            next();
        })
    }

}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.elzgrcu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

        const jobsCollection = client.db('soloSphereDB').collection('jobs');
        const bidsCollection = client.db('soloSphereDB').collection('bids');

        //jwt generate
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "365d"
            })
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            })
                .send({ success: true })
        })

        //clear cookie on logout user
        app.get('/logout', (req, res) => {
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                maxAge: 0,
            })
                .send({ success: true })
        })


        //job information
        app.get("/jobs", async (req, res) => {
            const result = await jobsCollection.find().toArray();
            res.send(result)
        })

        //get all jobs count for pagination
        app.get("/job-count", async (req, res) => {
            const count = await jobsCollection.countDocuments()
            res.send({ count })
        })

        //for pagination
        app.get("/all-jobs", async (req, res) => {
            const size = parseInt(req.query.size);
            const page = parseInt(req.query.page) - 1;
            //for filter
            const filter = req.query.filter;
            let query = {};
            if(filter) query = {category: filter}
            
            console.log(size, page);
            const result = await jobsCollection.find(query).skip(page * size).limit(size).toArray();
            res.send(result)
        })

        app.get("/job/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobsCollection.findOne(query);
            res.send(result)
        })

        app.put("/job/:id", async (req, res) => {
            const id = req.params.id;
            const job = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedData = {
                $set: {
                    ...job,
                    // job_title: job.job_title,
                    // minimum_price: job.minimum_price,
                    // maximum_price: job.maximum_price,
                    // category: job.category,
                    // deadline: job.deadline,
                    // description: job.description,
                }
            }
            const result = await jobsCollection.updateOne(filter, updatedData, options);
            res.send(result);
        })

        app.get("/postedJob/:email", verifyToken, async (req, res) => {
            const tokenEmail = req?.user?.email;
            // console.log(tokenEmail);
            const email = req.params.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { 'buyer.email': email };
            const result = await jobsCollection.find(query).toArray();
            res.send(result)
        })

        app.delete('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobsCollection.deleteOne(query);
            res.send(result)
        })
        app.post('/job', async (req, res) => {
            const data = req.body;
            const result = await jobsCollection.insertOne(data);
            res.send(result);
        })


        //bids information
        app.post('/bids', async (req, res) => {
            const data = req.body;
            const query = {
                email: data.email,
                jobId: data.jobId
            }
            const alreadyApplied = await bidsCollection.findOne(query);
            console.log(alreadyApplied);
            if (alreadyApplied) {
                return res.status(400).send("You have already placed this job")
            }
            const result = await bidsCollection.insertOne(data);
            res.send(result);
        })

        app.get("/my-bids/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const result = await bidsCollection.find(query).toArray();
            res.send(result)
        })

        app.get("/bid-request/:email", async (req, res) => {
            const email = req.params.email;
            const query = { buyer_email: email };
            const result = await bidsCollection.find(query).toArray();
            res.send(result)
        })

        app.patch("/bid-status/:id", async (req, res) => {
            const id = req.params.id;
            const currentStatus = req.body;
            // console.log(status);
            const filter = { _id: new ObjectId(id) };
            const updateStatus = {
                $set: {
                    status: currentStatus.status
                }
            }
            const result = await bidsCollection.updateOne(filter, updateStatus);
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
    res.send("Solo Sphere server is running")
})

app.listen(port, () => {
    console.log(`Current port is: ${port}`);
})