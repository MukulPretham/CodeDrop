import { createClient } from "redis";
import { buildProject, downloadS3Files, getAllFiles, listAllKeys, testS3, uploadFile } from "./aws";
import path from "path";

const redisClient = createClient();
const hashClient = createClient();

(async () => {
    await redisClient.connect();
    await hashClient.connect();
    while (true) {
        const currID = await redisClient.brPop("deployQueue", 0);
        if (currID?.element == undefined) {
            return;
        }
        console.log(currID?.element);
        await downloadS3Files(`output/${currID.element}`);
        console.log("Downloaded");
        
        await buildProject(currID.element);
        await hashClient.hSet("status",{
            [currID.element]: "completed"
        });
        console.log("redis updated");

        const folderPath = path.join(__dirname,`/output/${currID.element}/dist`);
        console.log(folderPath);
        let files = getAllFiles(folderPath);
        await Promise.all(files.map((file)=> uploadFile(`dist/${currID.element}/`+file.slice(folderPath.length+1),file)));
        console.log("build folder uploaded");
    }
})();
