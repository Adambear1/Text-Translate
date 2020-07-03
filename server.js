require("dotenv").config()
const express = require("express")
const app = express()
const fs = require("fs")
const multer = require("multer")
const { TesseractWorker } = require('tesseract.js')
const worker = new TesseractWorker();
const bodyParser = require("body-parser")
const logger = require("morgan")
const ejs = require("ejs")
const request = require("request")
const helmet = require("helmet")
var converter = require('jp-conversion');


//Middleware
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
// app.use(logger("tiny"))
app.use(helmet())

//Temp Storage
const tempStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./uploads")
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
});
const upload = multer({ storage: tempStorage }).single("image")

//DB
const mongoose = require("mongoose")
const Schema = mongoose.Schema;
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost/duolingodb", { useNewUrlParser: false });
const pictureSchema = new Schema({
    image: {
        type: String,
        trim: true
    }
})
const Picture = mongoose.model("Picture", pictureSchema)
const translationSchema = new Schema({
    native_language: {
        type: String,
        trim: true
    },
    translate_language: {
        type: String,
        trim: true
    },
    native_text: {
        type: String,
        trim: true
    },
    translate_text: {
        type: String,
        trim: true
    }
})
const Translation = mongoose.model("Translation", translationSchema)

//Views
app.set("view engine", "ejs")
app.set(express.static("pubic"))

//Routes
app.get('/', (req, res) => {
    res.render("index")
})
app.post("/uploads", (req, res) => {
    upload(req, res, err => {
        fs.readFile(`./uploads/${req.file.originalname}`, (err, data) => {
            if (err) throw err;
            worker
                .recognize(data, "jpn", { tessjs_create_pdf: "1" })
                .progress(progress => {
                    console.log(progress)
                })
                .then(result => {
                    var options = {
                        method: 'POST',
                        url: 'https://google-translate1.p.rapidapi.com/language/translate/v2',
                        headers: {
                            'x-rapidapi-host': process.env.HOST,
                            'x-rapidapi-key': process.env.KEY,
                            'accept-encoding': 'application/gzip',
                            'content-type': 'application/x-www-form-urlencoded',
                            useQueryString: true
                        },
                        form: { source: 'ja', q: result.text, target: 'en' }
                    };

                    request(options, function (error, response, body) {
                        if (error) throw new Error(error);
                        var _res = JSON.parse(response.body);
                        //JA => EN translate
                        var text = (_res.data.translations[0].translatedText)
                        console.log(text)
                        res.render("index", { translation: JSON.stringify(text) })
                        // var res = converter.convert(text);
                        // console.log(res.kanji);
                    })
                })
                .finally(() => worker.terminate());
        })
    })
})
app.get("/download", (req, res) => {
    const file = `${__dirname}/tesseract.js-ocr-result.pdf`
    res.download(file)
})
//Logic

PORT = process.env.PORT || 8080

app.listen(PORT, () => {
    console.log("App listening to PORT" + PORT)
})