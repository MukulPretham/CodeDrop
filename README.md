# CodeDrop

CodeDrop is a platform designed to streamline the process of deploying and serving web projects. Users can provide a GitHub repository URL, and CodeDrop will handle cloning the repository, building the project, and making it accessible via a unique subdomain. The architecture leverages AWS S3 for storage and Redis for managing deployment queues and statuses, ensuring a robust and scalable solution.

## Features

*   **Repository Cloning:** Easily deploy projects by providing a GitHub repository URL.
*   **Automated Building:** Projects are automatically built as part of the deployment process.
*   **Static File Hosting:** Serves built static assets (HTML, CSS, JavaScript, images) directly from AWS S3.
*   **Custom Subdomain Access:** Each deployed project is accessible via a unique subdomain.
*   **Deployment Status Tracking:** Monitor the real-time status of your deployments (pending, completed).
*   **Distributed Architecture:** Utilizes separate services for upload, deployment, and request handling for better scalability and fault tolerance.

## Architecture

The CodeDrop system is composed of three primary services:

1.  **Upload Service:**
    *   Receives GitHub repository URLs from users.
    *   Clones the provided repository into a local directory.
    *   Uploads all source files from the cloned repository to an S3 bucket.
    *   Pushes a unique deployment ID to a Redis queue for processing by the Deploy Service.
    *   Sets the initial deployment status to "pending" in a Redis hash.
    *   Provides an API endpoint to check the current status of a deployment.

2.  **Deploy Service:**
    *   Continuously listens to the Redis deployment queue for new deployment IDs.
    *   Upon receiving an ID, it downloads the corresponding source files from S3.
    *   Executes a build process for the project (e.g., `npm install` and `npm run build` for Node.js projects).
    *   Uploads the generated build artifacts (typically from a `dist` folder) back to S3, organized by the deployment ID.
    *   Updates the deployment status to "completed" in the Redis hash.

3.  **Request Service:**
    *   Acts as the public-facing server, handling incoming requests for deployed projects.
    *   Determines the project ID from the request's subdomain.
    *   Checks the deployment status in Redis; if the project is still "pending", it returns a corresponding status message.
    *   For "completed" projects, it fetches the requested file from the S3 bucket using the deployment ID and request path.
    *   Sets appropriate MIME types (e.g., `text/html`, `text/css`, `application/javascript`) for the served files.
    *   Returns a 404 error if the requested file is not found.

**Data Flow:**

1.  User sends a POST request with a GitHub URL to the Upload Service.
2.  Upload Service clones, uploads to S3, and enqueues the deployment ID in Redis.
3.  Deploy Service picks up the ID from Redis, downloads from S3, builds, and uploads built files back to S3.
4.  Deploy Service updates status in Redis.
5.  User accesses the deployed project via a subdomain, which is handled by the Request Service.
6.  Request Service retrieves files from S3 based on the subdomain and request path.

## Technologies Used

*   **Backend:** Node.js, Express.js
*   **Database/Messaging:** Redis (for queues and hash-based status tracking)
*   **Cloud Storage:** AWS S3
*   **Version Control Integration:** `simple-git` (for cloning repositories)
*   **Language:** TypeScript

## API Endpoints (Upload Service)

*   `POST /deploy`: Initiates a new deployment.
    *   **Request Body:** `{"url": "https://github.com/user/repo"}`
    *   **Response:** `{"id": "unique_deployment_id"}`
*   `GET /status/:id`: Checks the status of a deployment.
    *   **Response:** `{"status": "pending"}` or `{"status": "completed"}`

## Getting Started

### Prerequisites

*   Node.js installed
*   Redis server running
*   AWS account with S3 configured and appropriate access keys
*   Environment variables set for AWS `ACCESS_ID`, `ACCESS_KEY`, and `EP` (endpoint for S3).

### Installation and Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/MukulPretham/CodeDrop.git
    cd CodeDrop
    ```
2.  **Install dependencies for each service:**
    ```bash
    cd Upload
    npm install
    cd ../Deploy
    npm install
    cd ../Request
    npm install
    ```
3.  **Configure Environment Variables:**
    Create a `.env` file in the `Request` directory with your AWS credentials:
    ```
    ACCESS_ID=YOUR_AWS_ACCESS_KEY_ID
    ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
    EP=YOUR_S3_ENDPOINT # e.g., 'https://s3.your-region.amazonaws.com'
    ```
4.  **Start Redis:**
    Ensure your Redis server is running and accessible to the services.

5.  **Start Each Service:**
    In separate terminal windows, navigate to each service directory and start them:
    ```bash
    # In Upload directory
    npm run dev

    # In Deploy directory
    npm run dev

    # In Request directory
    npm run dev
    ```

## Usage

1.  **Deploy a Project:**
    Send a POST request to the Upload service with your GitHub repository URL:
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{"url": "https://github.com/your-username/your-repo"}' http://localhost:3000/deploy
    ```
    You will receive a unique `id` in the response.

2.  **Check Deployment Status:**
    Use the `id` from the deployment request to check its status:
    ```bash
    curl http://localhost:3000/status/your_deployment_id
    ```

3.  **Access Your Deployed Project:**
    Once the deployment status is "completed", you can access your project via the Request service. You would typically configure your DNS to point a wildcard subdomain (e.g., `*.yourdomain.com`) to the IP address of the server running the Request service. Then, you can access your project at `http://your_deployment_id.yourdomain.com`. For local testing, you might need to modify your hosts file to map `your_deployment_id.localhost` to `127.0.0.1`.

## Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests.
