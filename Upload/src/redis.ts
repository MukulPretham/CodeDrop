import { createClient } from "redis"

export async function connectToRedis() {
    const redisClient = createClient();
    try{
        await redisClient.connect();
        console.log("redis connected sucessfully");
    }catch(err){
        console.log("failed to connect to redis server");
        return null;
    }
    return redisClient;
}

