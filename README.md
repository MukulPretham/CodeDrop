# CodeDrop

CodeDrop is a continuous deployment system that allows users to deploy their web projects by simply providing a Git repository URL. It automates the process of cloning the repository, building the project, and serving it via a unique subdomain.

## Architecture

The system is composed of three main services:

1.  **Upload Service**: Responsible for accepting deployment requests, cloning the provided Git repository, uploading the raw project files to an S3 bucket, and queuing the deployment for processing.
2.  **Deploy Service**: Continuously monitors a Redis queue for new deployment requests. Upon receiving a request, it downloads the project files from S3, builds the project, and then uploads the generated build artifacts (e.g., `dist` folder) back to S3.
3.  **Request Service**: Acts as the web server, serving the deployed applications. It uses the subdomain of the incoming request to determine which project to serve, fetches the corresponding build artifacts from S3, and serves them to the client. It also checks the deployment status from Redis to handle pending deployments.

## Features

*   **Effortless Deployment**: Deploy projects by simply providing a Git repository URL.
*   **Automated Build Process**: Projects are automatically built as part of the deployment pipeline.
*   **Unique Subdomain Hosting**: Each deployed project is accessible via a unique subdomain.
*   **Scalable Storage**: Leverages AWS S3 for storing both raw project files and build artifacts.
*   **Asynchronous Processing**: Uses Redis queues to handle deployment requests asynchronously, ensuring responsiveness.
*   **Deployment Status Tracking**: Users can check the status of their deployments.

## Core Components

### Upload Service (`Upload/src/index.ts`)

This service exposes an API endpoint to initiate deployments.

*   Receives a `POST` request with a `repoURL`.
*   Generates a unique `id` for the deployment.
*   Clones the repository from the given `repoURL` into a local directory.
*   Uploads all files from the cloned repository to an S3 bucket under `output/{id}/`.
*   Pushes the `id` to a Redis queue named `deployQueue`.
*   Sets the initial status of the deployment to "pending" in a Redis hash (`status`).
*   Provides a `/status/:id` endpoint to check the current deployment status.

### Deploy Service (`Deploy/src/index.ts`)

This service runs continuously, processing deployment requests.

*   Connects to Redis to listen for new deployment IDs on the `deployQueue`.
*   When an `id` is popped from the queue, it downloads the corresponding project files from `output/{id}/` in S3.
*   Executes a build command (e.g., `npm install` and `npm run build`) within the downloaded project directory.
*   Updates the deployment status to "completed" in the Redis `status` hash.
*   Uploads the generated build artifacts (e.g., the `dist` folder) to S3 under `dist/{id}/`.

### Request Service (`Request/src/index.ts`)

This service acts as the public-facing server for deployed applications.

*   Listens for incoming HTTP requests.
*   Extracts the `id` from the request hostname (e.g., `id.yourdomain.com`).
*   Checks the deployment status from Redis. If "pending", it returns a pending status.
*   Fetches the requested file path from the S3 bucket (`dist/{id}{filePath}`).
*   Sets the appropriate `Content-Type` header based on the file extension (e.g., `text/html`, `application/javascript`).
*   Serves the content of the file. Handles 404 errors for non-existent files.

## Technologies Used

*   **Node.js/TypeScript**: For backend services.
*   **Express.js**: Web framework for API endpoints.
*   **AWS S3**: Object storage for project files and build artifacts.
*   **Redis**: Message broker for deployment queues and status tracking.
*   **`simple-git`**: For cloning Git repositories.
*   **`aws-sdk`**: AWS SDK for JavaScript.
*   **`dotenv`**: For managing environment variables.

## Setup and Installation

To set up CodeDrop, you will need:

1.  **AWS Account**: With S3 bucket configured and appropriate access keys.
2.  **Redis Instance**: Running and accessible by the services.
3.  **Environment Variables**: Set up `.env` files for each service with necessary AWS credentials, Redis connection strings, and other configurations.

**Example `.env` variables:**

```
ACCESS_ID=<YOUR_AWS_ACCESS_KEY_ID>
ACCESS_KEY=<YOUR_AWS_SECRET_ACCESS_KEY>
EP=<YOUR_S3_ENDPOINT_URL> # e.g., for localstack or custom S3
```

**Steps:**

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/MukulPretham/CodeDrop.git
    cd CodeDrop
    ```
2.  **Navigate to each service directory (Upload, Deploy, Request, fe) and install dependencies:**
    ```bash
    cd Upload
    npm install
    cd ../Deploy
    npm install
    cd ../Request
    npm install
    cd ../fe # if you want to run the frontend
    npm install
    ```
3.  **Build each TypeScript project:**
    ```bash
    cd Upload
    npm run build
    cd ../Deploy
    npm run build
    cd ../Request
    npm run build
    cd ../fe
    npm run build # For the frontend
    ```
4.  **Start the services:**
    ```bash
    # In separate terminal windows
    cd Upload
    npm start

    cd Deploy
    npm start

    cd Request
    npm start

    # You might also want to start the frontend (fe) if available
    cd fe
    npm run dev
    ```

## Usage

1.  **Deploy a project**: Send a `POST` request to the Upload service's `/deploy` endpoint with the `url` of your Git repository.

    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{"url": "https://github.com/your-username/your-repo.git"}' http://localhost:3000/deploy
    ```
    This will return a deployment `id`.

2.  **Check deployment status**: Use the `id` returned from the deploy request.

    ```bash
    curl http://localhost:3000/status/<your-deployment-id>
    ```

3.  **Access the deployed project**: Once the deployment status is "completed", you can access your project via a subdomain corresponding to your deployment `id`. For example, if your `Request` service is running on `yourdomain.com`, and your `id` is `abc1234`, your project would be accessible at `http://abc1234.yourdomain.com`. You will need to configure your DNS to point `*.yourdomain.com` to the IP address of your `Request` service.

---