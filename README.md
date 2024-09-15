# HMS T&L System Backend

This is the backend for the HMS Teaching & Learning System, a comprehensive platform for managing assignments, video submissions, and user interactions in an educational setting.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

- User authentication and authorization
- Assignment creation and management
- Video upload and processing
- Submission handling and grading
- Real-time notifications
- Comprehensive API for frontend integration

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js (v14.0.0 or later)
- npm (v6.0.0 or later)
- MongoDB (v4.0 or later)
- Redis (optional, for caching)
- FFmpeg (for video processing)

## Installation

1. Clone the repository:

```

git clone https://github.com/your-username/hms-tl-system-backend.git
cd hms-tl-system-backend

```

2. Install the dependencies:

```

npm install

```

## Configuration

1. Create a `config.env` file in the `src/config` directory.
2. Add the following environment variables:

```

NODE_ENV=development
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d
EMAIL_SERVICE=your_email_service
EMAIL_USERNAME=your_email_username
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=noreply@example.com

```

## Running the Application

To run the application in development mode:

```

npm run dev

```

To run the application in production mode:

```

npm start

```

## API Documentation

API documentation is available via Swagger UI. After starting the server, visit:

```

http://localhost:5000/api-docs

```

## Testing

To run the test suite:

```

npm test

```

## Deployment

1. Ensure all environment variables are properly set for the production environment.
2. Build the application:

```

npm run build

```

3. Start the server:

```

npm start

```
