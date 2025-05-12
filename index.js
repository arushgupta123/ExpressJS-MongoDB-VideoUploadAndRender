const express = require('express')
const fileUpload = require('express-fileupload')
const fs = require("fs")
const mongoose = require("mongoose")
const mongodb = require("mongodb")
const path = require('path')
const bodyParser = require("body-parser")
const {MongoClient, ObjectId} = require("mongodb")

const URI = 'your_cluster_URI'

const app = express()
const PORT = 1003; //Anything else can work

app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs')

app.use(express.static(path.join(__dirname, 'public')))

//app.use("view engine", 'ejs')
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/'  // Ensure this directory exists and is writable
}));

const client = new MongoClient(URI)

//const valiDB = client.db("datab1")

async function createBucket() {
    await client.connect()
    const db = client.db("sample_vid") //Database name
    const bucket = new mongodb.GridFSBucket(db, {bucketName : "vid"})
    return bucket;
}

app.get('/', (req, res) => {
    res.render("home")
})

app.get('/sendFile', (req,res) => {
    res.render("main")
})

app.post('/upload', async (req, res) => {
    const file = req.files.file;
    const fileTitle = req.body.fileTitle
    const bucket = await createBucket()
    console.log(req.files.file)
    if (!req.files || !req.files.file || !req.body.fileTitle) {
        return res.status(400).send('File and title are required');
    }
    if (!file.tempFilePath) {
        return res.status(400).send('Invalid file path');
    }

    const uploadStream = bucket.openUploadStream(fileTitle, {
        chunkSizeBytes: 1048576, // 1MB chunks
        metadata: { contentType: file.mimetype }
    })

    fs.createReadStream(file.tempFilePath).pipe(uploadStream).on('error', (error) => {
        console.error("error in file upload")
        console.error(error)
    }).on('finish', () => {
        console.log("File hs been uploaded")
        res.send("File uploaded")
    })
})

app.get("/view", async (req, res) => {
    const bucket = await createBucket();
    const files = await bucket.find().toArray();
    res.render('files', { files });
})

app.get('/video/:id', async (req, res) => {
    try {
        const bucket = await createBucket();
        const videoId = new ObjectId(req.params.id);
        const downloadStream = bucket.openDownloadStream(videoId);

        const file = await bucket.find({ _id: videoId }).toArray();
        if (!file || file.length === 0) {
            return res.status(404).send('Video not found');
        }

        res.setHeader('Content-Type', file[0].metadata.contentType);
        downloadStream.pipe(res);
    } catch (error) {
        console.error('Error streaming video:', error);
        res.status(500).send('Error loading video');
    }
});

app.get('/delete/:id', async(req, res) => {
    console.log("Recieved deletion request")
    try {
        const bucket = await createBucket();
        const newid = new ObjectId(req.params.id)
        const files = await bucket.find().toArray()
        await bucket.delete(newid)
        console.log(`Video with id ${req.params.id} has been deleted`)
        res.render('files', { files })
    } catch (error) {
        console.error("error deleting:", error)
        throw error;
    }
})

app.listen(PORT, () => {
    console.log(`App is listening on PORT "${PORT}"`)
})
