import { S3 } from "aws-sdk";
import fs from "fs";
import path from "path";
import dotenv from "dotenv"
import { exec } from "child_process";

dotenv.config();


const s3 = new S3({
    accessKeyId: process.env.ACCESS_ID,
    secretAccessKey: process.env.ACCESS_KEY,
    endpoint: process.env.EP,
    s3ForcePathStyle: true,     // ✅ CRITICAL for R2
    signatureVersion: 'v4',     // ✅ CRITICAL for R2
    region: 'auto'   
})

// output/asdasd
export async function downloadS3Files(prefix: string) {
    try{
        console.log("downloading files from s3 with prefix:", prefix);
        const allFiles = await s3.listObjectsV2({
            Bucket: "code-drop-s3",
            Prefix: `${prefix}`
        }).promise();
        console.log("list objects completed");
        if(!allFiles.Contents || allFiles.Contents.length === 0){
            throw new Error("No files found");
        }
        console.log("Found files:", allFiles.Contents.map(f => f.Key));
    
        const allPromises = allFiles.Contents?.map(async ({ Key }) => {
            return new Promise((resolve) => {
                if (!Key) {
                    resolve("");
                    return;
                }
                console.log("downloading ", Key);
                const finalOutputPath = path.join(__dirname, Key);
                const outputFile = fs.createWriteStream(finalOutputPath);
                const dirName = path.dirname(finalOutputPath);
                if (!fs.existsSync(dirName)) {
                    fs.mkdirSync(dirName, { recursive: true });
                }
                s3.getObject({
                    Bucket: "code-drop-s3",
                    Key
                }).createReadStream().pipe(outputFile).on("finish", () => {
                    resolve("");
                })
            });
        }) || []
        console.log("awaiting");
    
        await Promise.all(allPromises?.filter(x => x !== undefined));
    }catch(err){
        console.log("the files for given id were not found in the s3 bucket , eoor:",err);
    }
    
}

export async function buildProject(id: string) {
    return new Promise((resolve) => {

        let childProcess = exec(`cd ${path.join(__dirname, "output/")}/${id} && npm install && npm run build`);
        childProcess.on("close", () => {
            console.log("build has sucesssfully completed");
        })
        childProcess.on("error", () => {
            console.log("error while build")
        })
        childProcess.on("close", () => {
            resolve("");
        })
    })
}

export async function uploadFile(fileName: string, localFilepath: string) {
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
        console.log("S3 error");
    }

}

export const getAllFiles = (folderPath: string) => {
    let response: string[] = [];

    const allFilesAndFolders = fs.readdirSync(folderPath);
    allFilesAndFolders.forEach(file => {
        const fullFilePath = path.join(folderPath, file);
        if (fs.statSync(fullFilePath).isDirectory()) {
            response = response.concat(getAllFiles(fullFilePath))
        } else {
            response.push(fullFilePath);
        }
    });
    return response;
}

export const testS3 = async (prefix: string) => {
    try {
      console.log("testing s3 with path:", prefix);
      console.log("Bucket:", "code-drop-s3");
      console.log("Endpoint:", process.env.EP);
      console.log("Region:", 'auto');
      
      const res = await s3.listObjectsV2({
        Bucket: "code-drop-s3",
        Prefix: prefix
      }).promise();
      
      console.log("Success! KeyCount:", res.KeyCount);
      console.log("Contents:", res.Contents?.map(obj => obj.Key));
      return res;
    } catch(err: any) {
      console.log("error in s3 test api");
      console.log("Error code:", err.code);
      console.log("Status code:", err.statusCode);
      console.log("Message:", err.message);
      console.log("Endpoint used:", err.endpoint);
      throw err;
    }
  }

  export const listAllKeys = async () => {
    try {
      const res = await s3.listObjectsV2({
        Bucket: "code-drop-s3",
        Prefix: "", // Empty prefix = list everything
        MaxKeys: 20
      }).promise();
      
      console.log("Total keys found:", res.KeyCount);
      console.log("\nAll keys in bucket:");
      res.Contents?.forEach(obj => {
        console.log("  -", obj.Key);
      });
      
      return res;
    } catch(err) {
      console.log("Error listing keys:", err);
    }
  }