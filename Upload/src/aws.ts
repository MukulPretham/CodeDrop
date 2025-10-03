import { S3 } from "aws-sdk";
import fs from "fs";
import dotenv from "dotenv"

dotenv.config();

export const s3 = new S3({
    accessKeyId: process.env.ACCESS_ID,
    secretAccessKey: process.env.ACCESS_KEY,
    endpoint: process.env.EP
});

export async function uploadFile(fileName: string, localFilepath: string){
    let currFile;
    try {
        currFile = fs.readFileSync(localFilepath);
    } catch (e) {
        console.log("error reading the file");
    }
    try {
        const res = await s3.upload({
            Body: currFile,
            Bucket: "code-drop-s3",
            Key: fileName
        }).promise();
    } catch (err) {
        console.log("S3 error",err);
    }
}