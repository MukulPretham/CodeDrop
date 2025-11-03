# CodeDrop

CodeDrop is a continuous deployment system that allows users to deploy their web applications by simply providing a Git repository URL. It automates the process of cloning, building, and serving applications, leveraging AWS S3 for storage and Redis for managing deployment queues and statuses.

## Features

*   **Repository Cloning and Upload**: Automatically clones a given Git repository and uploads its contents to an S3 bucket.
*   **Deployment Queue**: Utilizes Redis to manage a queue of projects awaiting deployment.
*   **Automated Building**: Downloads project files from S3, builds the application, and uploads the build artifacts back to S3.
*   **Dynamic Request Routing**: Serves deployed applications from S3 based on unique deployment IDs (subdomains).
*   **Deployment Status Tracking**: Provides real-time status updates for ongoing and completed deployments.

## Architecture

The CodeDrop system is composed of three main services:

1.  **Upload Service (`Upload/src/index.ts`)**:
    *   Receives a Git repository URL via an API endpoint.
    *   Generates a unique ID for the deployment.
    *   Clones the repository locally.
    *   Uploads all repository files to an AWS S3 bucket under a path corresponding to the unique ID.
    *   Pushes the unique ID to a Redis queue for deployment processing.
    *   Sets the deployment status to "pending" in Redis.

2.  **Deploy Service (`Deploy/src/index.ts`)**:
    *   Continuously monitors the Redis deployment queue.
    *   Pops a deployment ID from the queue.
    *   Downloads the corresponding project files from S3.
    *   Builds the project (e.g., `npm install` and `npm run build` for a typical web project).
    *   Updates the deployment status to "completed" in Redis.
    *   Uploads the generated build artifacts (e.g., `dist` folder) back to S3 under a `dist/{id}` path.

3.  **Request Service (`Request/src/index.ts`)**:
    *   Acts as an ingress, handling incoming HTTP requests.
    *   Extracts the deployment ID from the request hostname (e.g., `id.yourdomain.com`).
    *   Checks the deployment status in Redis; if "pending", it informs the client.
    *   If the deployment is completed, it retrieves the requested file from the S3 `dist/{id}` bucket.
    *   Serves the file with the appropriate `Content-Type`.

![Architecture Diagram](Arch.png)
_Note: An architecture diagram named `Arch.png` is present in the repository, which visually explains the system flow._

## Technologies Used

*   **Backend**: Node.js, Express.js
*   **Queue/Cache**: Redis
*   **Cloud Storage**: AWS S3
*   **Version Control Integration**: `simple-git`
*   **Build Automation**: Standard project build tools (e.g., `npm install`, `npm run build`)
*   **Language**: TypeScript

## Setup and Installation

To set up CodeDrop, you'll need:

1.  **AWS Account**: With S3 bucket configured and appropriate access keys.
2.  **Redis Instance**: Running and accessible.
3.  **Node.js and npm/yarn**: Installed on your system.

### Environment Variables

Each service (Upload, Deploy, Request) requires specific environment variables. Create `.env` files in each service directory with the following:

**Common:**
*   `REDIS_URL`: URL for your Redis instance (e.g., `redis://localhost:6379`)
*   `AWS_REGION`: Your AWS region (e.g., `us-east-1`)
*   `AWS_BUCKET_NAME`: The name of your S3 bucket (e.g., `code-drop-s3`)

**Upload & Deploy:**
*   `AWS_ACCESS_KEY_ID`: Your AWS access key ID.
*   `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key.
*   `AWS_ENDPOINT`: Your S3 endpoint if using a custom one (e.g., for localstack or a specific S3 region endpoint).

### Running Services

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/MukulPretham/CodeDrop.git
    cd CodeDrop
    ```
2.  **Install dependencies and build each service:**
    Navigate into `Upload`, `Deploy`, `Request` directories and run:
    ```bash
    npm install
    npm run build # if using TypeScript, this will compile .ts to .js
    ```
3.  **Start each service:**
    From their respective directories, run:
    ```bash
    npm start # Or node dist/index.js if you built it
    ```
    *   Upload Service: `http://localhost:3000`
    *   Request Service: `http://localhost:3001` (Ensure proper DNS configuration for subdomains to point to this service)
    *   Deploy Service: Runs as a background worker.

## Usage

### Deploying a Project

To deploy a project, send a POST request to the Upload service with the `url` of your Git repository.

**Endpoint:** `POST /deploy`
**Body:**
```json
{
    "url": "https://github.com/your-username/your-repo.git"
}
```

**Example using `curl`:**
```bash
curl -X POST -H "Content-Type: application/json" -d '{"url": "https://github.com/MukulPretham/CodeDrop-Frontend-Example.git"}' http://localhost:3000/deploy
```

This will return a JSON response with a unique `id` for your deployment:
```json
{
    "id": "generated-unique-id"
}
```

### Checking Deployment Status

You can check the status of a deployment using its unique `id`.

**Endpoint:** `GET /status/:id`

**Example using `curl`:**
```bash
curl http://localhost:3000/status/generated-unique-id
```

**Response:**
```json
{
    "status": "pending"
}
```
or
```json
{
    "status": "completed"
}
```

### Accessing the Deployed Application

Once the deployment status is "completed", you can access your application by configuring your DNS to point `[your-unique-id].yourdomain.com` to the IP address where your Request service is running (port 3001).

For local testing, you might modify your `/etc/hosts` file (or equivalent) to map `[your-unique-id].localhost` to `127.0.0.1`.

Example:
If your `id` is `abcde12345`, and your Request service is running on `localhost:3001`, you would access your deployed app at `http://abcde12345.localhost:3001`.

## Contribution

Feel free to fork the repository, open issues, and submit pull requests.
