import express from "express"
import { generateID, getAllFiles } from "./utils";
import cors from "cors"
import simpleGit from "simple-git"
import path from "path";
import { uploadFile } from "./aws";
import { connectToRedis } from "./redis";
import { createClient } from "redis";

const app = express();
const redisClient = createClient();
redisClient.connect();
app.use(express.json());
app.use(cors());

type status = "pending" | "completed"
const STATUS = new Map<string, status>();

app.get("/", (req, res) => {
    res.json({
        message: "server active"
    })
});

app.post("/deploy", async (req: any, res: any) => {
    console.log(req.body);
    if (!req.body || !req.body.url) {
        return res.status(400).json({
            error: "Bad Request 400 error"
        });
    }
    const repoURL = req.body.url;

    //Checking if redis is active, if not terminate the request.
    const redisClient = await connectToRedis();
    const hashClient = await connectToRedis();
    if (!redisClient || !hashClient) {
        console.log("Was not able to insert into redis");
        res.status(500).json({
            error: "Queue is busy or terminated"
        });
        return;
    }

    const id = generateID();
    try {
        await simpleGit().clone(repoURL, path.join(__dirname, `output/${id}`));
    } catch (err) {
        return res.status(404).json({
            error: "Repo not found, check url agian"
        });
    }

    let files = getAllFiles(path.join(__dirname, `output/${id}`));

    await Promise.all(files.map((file) => uploadFile(file.slice(__dirname.length + 1), file)));

    try {
        await redisClient?.lPush("deployQueue", id);
        await hashClient.hSet("status", {
            [id]: "pending"
        })
    } catch (err) {
        return res.status(500).json({
            error: "Redis Error"
        });
    }

    STATUS.set(id, "pending");
    console.log(STATUS.get(id));
    return res.status(200).json({
        id: id
    });
});

app.get("/status/:id", async(req:any, res:any) => {
    const id = req.params.id;
    
    const status: string | undefined = await redisClient.hGet("status", id);
    if(!status){
        return res.json({erro: "Redis error" });
    }
    res.json({
        status: status
    });
});

app.listen(3000, () => {
    console.log("server has started at port 3000");
});