# CodeDrop: A Distributed Static Site Deployment Platform

## Description
CodeDrop is a robust, full-stack application engineered for the seamless deployment of static websites directly from GitHub repositories. It employs a microservices architecture, segmenting functionality into `Upload`, `Deploy`, and `Request` services, orchestrated using AWS S3 for persistent storage and Redis for inter-service communication and state management. This platform automates the entire CI/CD pipeline for static content, from source code ingestion to live serving under dynamically generated subdomains.

## Architecture Overview
The system is composed of three primary services:

1.  **Upload Service**: Responsible for receiving GitHub repository URLs, cloning the repositories, packaging the source code, and initiating the deployment process.
2.  **Deploy Service**: A worker service that consumes deployment tasks from a queue, downloads the source code, builds the static assets, and uploads the compiled output to S3.
3.  **Request Service**: Acts as an edge server, resolving incoming requests based on subdomain to serve the appropriate static content directly from S3.

Redis serves as the central message broker and state store, managing a deployment queue (`deployQueue`) and tracking the build status of each deployed project via a hash set (`status`). AWS S3 (or compatible object storage like Cloudflare R2) provides the immutable storage layer for both raw source code and final build artifacts.

## Key Features
*   **Git Repository Integration**: Accepts public GitHub repository URLs, facilitating automated cloning via `simple-git`.
*   **Decoupled Microservices**:
    *   **Upload Service**: Exposes a `/deploy` API endpoint to accept repository URLs, clones the repository locally, and uploads all source files to S3 under a unique project ID prefix (e.g., `output/<project_id>/`). It then enqueues the `project_id` into a Redis list (`deployQueue`) and sets an initial `pending` status in a Redis hash (`status`).
    *   **Deploy Service**: Operates as a background worker, blocking on `redisClient.brPop("deployQueue", 0)` to retrieve new deployment tasks. Upon receiving a `project_id`, it downloads the corresponding source files from S3 (`output/<project_id>/`), executes `npm install` and `npm run build` within the project directory, and subsequently uploads the generated `dist` folder contents to S3 under a `dist/<project_id>/` prefix. The status in Redis is then updated to `completed`.
    *   **Request Service**: Functions as a reverse proxy/content server. It extracts the `project_id` from the request hostname's subdomain. Before serving, it queries Redis for the deployment status; if `pending`, it returns a status message. Otherwise, it constructs the S3 key (`dist/<project_id>/<requested_path>`) and fetches the static asset, serving it with the appropriate `Content-Type` header inferred from the file extension.
*   **Object Storage (AWS S3/R2)**: Utilizes the AWS SDK for JavaScript (`aws-sdk`) to interact with S3-compatible storage. This includes `s3.listObjectsV2` for directory listing, `s3.getObject` for file retrieval, and `s3.upload` for atomic file uploads.
*   **Redis for Queueing and State Management**: Employs `node-redis` for:
    *   **Deployment Queue**: A `list` (`deployQueue`) acts as a FIFO queue for deployment tasks. `lPush` adds tasks, and `brPop` atomically retrieves them.
    *   **Status Tracking**: A `hash` (`status`) stores the current deployment state (e.g., `pending`, `completed`, `error`) for each `project_id`, enabling the frontend and request service to query progress.
*   **Dynamic Subdomain Routing**: The `Request` service dynamically serves content based on the subdomain of the incoming request (e.g., `project_id.localhost:3001`).
*   **Frontend (React + Vite)**: A responsive single-page application built with React and Vite provides a user interface for submitting repository URLs and observing real-time deployment status updates via polling the `Upload` service's `/status/:id` endpoint.

## Getting Started

To set up and run CodeDrop locally, ensure you have the necessary prerequisites and follow the detailed installation and execution instructions.

### Prerequisites
*   **Node.js**: Version 18 or higher.
*   **npm**: Node Package Manager (comes with Node.js).
*   **Redis Server**: A running instance of Redis.
*   **AWS S3 Compatible Storage**: Access to an S3 bucket or a compatible service (e.g., Cloudflare R2). You will need:
    *   `ACCESS_ID` (Access Key ID)
    *   `ACCESS_KEY` (Secret Access Key)
    *   `EP` (Endpoint URL, e.g., `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` for R2, or `s3.amazonaws.com` for AWS S3).
*   **Git**: Must be installed and accessible in your system's PATH for `simple-git` to function.

### Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/MukulPretham/CodeDrop.git
    cd CodeDrop
    ```

2.  **Install Dependencies for Each Service**:
    Navigate into each of the `Upload`, `Deploy`, `Request`, and `fe` directories and install their respective `npm` dependencies.

    ```bash
    # For the Upload Service
    cd Upload
    npm install
    
    # For the Deploy Service
    cd ../Deploy
    npm install
    
    # For the Request Service
    cd ../Request
    npm install
    
    # For the Frontend
    cd ../fe
    npm install
    ```

3.  **Environment Variable Configuration**:
    For the `Upload`, `Deploy`, and `Request` services, create a `.env` file in their respective root directories. These files are crucial for configuring the S3 client.

    Example `.env` content (replace placeholders with your actual credentials):
    ```
    ACCESS_ID=YOUR_AWS_ACCESS_KEY_ID
    ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
    EP=YOUR_S3_ENDPOINT_URL 
    ```
    *   Ensure the `EP` is correctly formatted for your chosen S3 provider. For Cloudflare R2, it typically includes your Account ID.

### How to Run

1.  **Start Redis Server**:
    Ensure your Redis server instance is active and reachable. The services will attempt to connect to Redis on its default port (6379) unless otherwise configured within the `createClient()` calls.

2.  **Start Each Service (in separate terminal windows)**:

    *   **Upload Service**:
        ```bash
        cd Upload
        npm run dev # Starts the Express server on port 3000
        ```
        This service handles new deployment requests and pushes them to Redis.

    *   **Deploy Service**:
        ```bash
        cd Deploy
        npm run dev # Starts the worker that processes deployment queue
        ```
        This service continuously monitors the Redis queue, downloads code, builds projects, and uploads artifacts.

    *   **Request Service**:
        ```bash
        cd Request
        npm run dev # Starts the Express server on port 3001
        ```
        This service acts as the content delivery network, serving deployed static sites based on subdomains.

    *   **Frontend Service**:
        ```bash
        cd fe
        npm run dev # Starts the Vite development server, typically on port 5173
        ```
        This is the user interface where you submit repository URLs.

3.  **Access the Application**:
    Once all services are running, open your web browser and navigate to the frontend URL (e.g., `http://localhost:5173`). Enter a GitHub repository URL into the input field and click "Deploy". The frontend will display the deployment status and, upon completion, provide a link to your deployed static site (e.g., `http://<generated_id>.localhost:3001/index.html`).

## Code Overview

This section provides a more detailed breakdown of the critical files and their functionalities within each service.

### `Deploy` Service
*   `Deploy/src/aws.ts`:
    *   **Purpose**: Manages all interactions with AWS S3 for the `Deploy` service and handles project building.
    *   **Key Functions**:
        *   `downloadS3Files(prefix: string)`: Asynchronously lists and downloads all objects from the configured S3 bucket that match the given prefix (e.g., `output/<project_id>`). It reconstructs the directory structure locally.
        *   `buildProject(id: string)`: Executes shell commands (`npm install && npm run build`) within the downloaded project directory (`output/${id}`). This function returns a Promise that resolves upon successful build completion or rejection on error.
        *   `uploadFile(fileName: string, localFilepath: string)`: Reads a local file and uploads its content to S3 with a specified `fileName` (S3 Key).
        *   `getAllFiles(folderPath: string)`: A recursive helper function to traverse a local directory and return an array of all file paths.
    *   **S3 Configuration**: Initializes `aws-sdk.S3` with credentials from `.env` and critical R2-specific configurations (`s3ForcePathStyle: true`, `signatureVersion: 'v4'`, `region: 'auto'`).
*   `Deploy/src/index.ts`:
    *   **Purpose**: The main entry point for the deployment worker.
    *   **Logic**:
        1.  Connects to two Redis clients: one for the queue (`redisClient`) and one for status updates (`hashClient`).
        2.  Enters an infinite loop, continuously calling `redisClient.brPop("deployQueue", 0)` to block and wait for a new `project_id` to appear in the deployment queue.
        3.  Upon receiving a `project_id`:
            *   Calls `downloadS3Files` to fetch the project source.
            *   Invokes `buildProject` to compile the static assets.
            *   Updates the deployment status to `completed` in the Redis `status` hash using `hashClient.hSet`.
            *   Uses `getAllFiles` to list all files in the built `dist` directory and `Promise.all` with `uploadFile` to concurrently upload all build artifacts to S3 under the `dist/<project_id>/` prefix.

### `Request` Service
*   `Request/src/index.ts`:
    *   **Purpose**: An Express.js server that serves the deployed static content based on incoming subdomain requests.
    *   **Middleware**: Implements a middleware that extracts the `project_id` from the request hostname (e.g., `id.localhost:3001` -> `id`). It then queries the Redis `status` hash for the project's deployment status. If `pending`, it responds with a JSON status, preventing access to incomplete deployments.
    *   **Route Handling**:
        *   `app.get("/")`: A simple health check endpoint.
        *   `app.all(/{*any})`: A catch-all route that handles all incoming requests for static assets.
            *   It extracts the `project_id` from the subdomain and the `filePath` from the request parameters.
            *   Constructs the S3 Key (e.g., `dist/<project_id>/<filePath>`).
            *   Calls `s3.getObject` to retrieve the file content from S3.
            *   Dynamically sets the `Content-Type` header based on the file extension (e.g., `text/html`, `text/css`, `application/javascript`).
            *   Sends the retrieved file content as the response.
    *   **S3 Configuration**: Initializes `aws-sdk.S3` with `.env` credentials.
    *   **Redis Integration**: Connects a `hashClient` to query deployment statuses.

### `Upload` Service
*   `Upload/src/aws.ts`:
    *   **Purpose**: Provides S3 upload functionality specifically for the `Upload` service.
    *   **Key Function**: `uploadFile(fileName: string, localFilepath: string)`: Reads a local file and uploads it to S3. This is used for uploading the initial source code.
    *   **S3 Configuration**: Initializes `aws-sdk.S3` with `.env` credentials.
*   `Upload/src/index.ts`:
    *   **Purpose**: The main Express.js server for handling initial deployment requests.
    *   **Middleware**: Uses `express.json()` for parsing JSON request bodies and `cors()` for cross-origin resource sharing.
    *   **Routes**:
        *   `app.get("/")`: A health check endpoint.
        *   `app.post("/deploy")`:
            *   Expects a `url` (GitHub repo URL) in the request body.
            *   Generates a unique `project_id` using `generateID`.
            *   Clones the provided GitHub repository into a local `output/${id}` directory using `simpleGit().clone`.
            *   Uses `getAllFiles` and `Promise.all` with `uploadFile` to upload all cloned source files to S3 under `output/<project_id>/`.
            *   Pushes the `project_id` to the Redis `deployQueue` (`redisClient.lPush`).
            *   Sets the initial `status` of the `project_id` to `pending` in the Redis hash (`hashClient.hSet`).
            *   Responds with the generated `project_id`.
        *   `app.get("/status/:id")`:
            *   Retrieves the deployment status for a given `project_id` from the Redis `status` hash.
            *   Responds with the current status (e.g., "pending", "completed").
    *   **Redis Integration**: Connects `redisClient` for queueing and `hashClient` for status updates.
*   `Upload/src/redis.ts`:
    *   **Purpose**: A utility module for establishing a connection to the Redis server.
    *   **Key Function**: `connectToRedis()`: Attempts to connect to Redis and logs success or failure. Returns the connected client instance or `null` on error.
*   `Upload/src/utils.ts`:
    *   **Purpose**: Contains general utility functions.
    *   **Key Functions**:
        *   `generateID()`: Creates a random alphanumeric string to serve as a unique `project_id`.
        *   `getAllFiles(folderPath: string)`: A recursive function to list all file paths within a given directory, similar to the one in the `Deploy` service.

### `Frontend` Service (`fe`)
*   `fe/src/App.tsx`:
    *   **Purpose**: The main React component for the user interface.
    *   **State Management**: Uses `useState` hooks for `result` (deployment URL or error), `id` (project ID), and `deploying` status.
    *   **`deployHandler`**: An asynchronous function triggered by the "Deploy" button. It sends a `POST` request to the `Upload` service's `/deploy` endpoint with the GitHub URL. It updates the `deploying` state and sets the `id` from the response.
    *   **`useEffect` for Polling**: A `useEffect` hook is used to set up an interval timer that periodically polls the `Upload` service's `/status/:id` endpoint. It updates the `result` state based on the deployment status (e.g., setting the live URL if `completed` or an error message if `error`). The interval clears once the deployment is `completed` or an `error` occurs.
    *   **Conditional Rendering**: Renders different UI elements based on the `deploying` status and the `result` (success URL or error message).
*   `fe/src/main.tsx`:
    *   **Purpose**: The entry point for the client-side React application.
    *   **Rendering**: Uses `createRoot` from `react-dom/client` to render the `App` component into the HTML element with `id='root'`. `StrictMode` is used for highlighting potential problems in an application.
*   `fe/vite.config.ts`:
    *   **Purpose**: Configuration file for Vite, the frontend build tool.
    *   **Plugins**: Configures `@vitejs/plugin-react` to enable React Fast Refresh and other React-specific optimizations during development and build.
