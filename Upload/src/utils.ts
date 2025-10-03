import path from "path"
import fs from "fs"

export function generateID(): string {
    const string = "djnvcjksdbvkjsdbvkjadbvnjksfbvjksfbvjksfbvjksfbvjksfbvkjdabvksdfjbvnkflbvkjfbvjkadbvkadjbv"
    let ID = "";
    const length = 10;
    for (let i = 0; i < length; i++) {
        let index = Math.floor(0 + Math.random() * string.length);
        ID += string[index];
    }
    return ID;
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