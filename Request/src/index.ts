import express from "express";
import { S3 } from "aws-sdk";
import dotenv from "dotenv";
import { createClient } from "redis";

const app = express();
const hashClient = createClient();
hashClient.connect();

dotenv.config();
app.use(async (req, res, next) => {
    const id = req.hostname.split(".")[0];
    const status = await hashClient.hGet("status", id);
    if (status === "pending") {
        res.json({
            status: ":pending"
        });
        return;
    }
    next();
})

app.get("/", (req, res) => {
    res.send("pong");
})

const s3 = new S3({
    accessKeyId: process.env.ACCESS_ID,
    secretAccessKey: process.env.ACCESS_KEY,
    endpoint: process.env.EP
});

app.all(`/{*any}`, async (req, res) => {
    //@ts-ignore
    const id = req.hostname.split(".")[0];
    console.log(id);

    //@ts-ignore
    let paramsArr: string[] = req.params.any;
    // console.log(paramsArr);
    let filePath = "";
    for (const element of paramsArr) {
        filePath += `/${element}`
    }
    // console.log(filePath);


    //@ts-ignore

    console.log(filePath);

    try {
        const contents = await s3.getObject({
            Bucket: "code-drop-s3",
            Key: `dist/${id}${filePath}`
        }).promise();

        const type = filePath.endsWith(".html")
            ? "text/html"
            : filePath.endsWith(".css")
                ? "text/css"
                : filePath.endsWith(".js")
                    ? "application/javascript"
                    : filePath.endsWith(".svg")
                        ? "image/svg+xml"
                        : "application/octet-stream";  // Default MIME type for unknown files

        res.set("Content-Type", type);
        res.send(contents.Body);
    } catch (err) {
        console.error("err", err);
        res.status(404).send("File not found");
    }
});



app.listen(3001, () => {
    console.log("server had started on prt 3001");
})