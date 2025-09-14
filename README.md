# test-app

## Description
A robust and scalable Node.js application built with Express.js, Sequelize ORM, and PostgreSQL. This project provides a solid foundation for building RESTful APIs, featuring authentication with JWT, input validation, error handling, and structured logging.

## Features
-   **Authentication:** User registration, login, and session management using JWT (JSON Web Tokens).
-   **Authorization:** Middleware for protecting routes based on user roles.
-   **Database Management:** PostgreSQL integration with Sequelize ORM for efficient data handling, including migrations and seeders.
-   **API Validation:** Request input validation using Joi.
-   **Error Handling:** Centralized error handling with custom APIError class.
-   **Logging:** Structured logging with Winston and Morgan for HTTP request logging.
-   **Security:** Helmet for securing HTTP headers, CORS for cross-origin resource sharing, and bcrypt for password hashing.
-   **Rate Limiting:** Configurable API rate limiting.
-   **Code Structure:** Modular and scalable architecture with clear separation of concerns (controllers, services, models, routes, middlewares, validations).
-   **Testing:** Unit and integration tests using Jest and Supertest.
-   **Internationalization (i18n):** Support for multiple languages (en, fr, ar) using i18next.

## Internationalization (i18n)

This application supports multiple languages for API responses, including error messages and validation errors. The supported languages are English (`en`), French (`fr`), and Arabic (`ar`).

### Language Detection

The language is detected from the incoming request in the following order of priority:

1.  **Query String:** A `lang` parameter in the query string (e.g., `/api/auth/login?lang=fr`).
2.  **JWT Token:** For authenticated users, the `language` preference stored in their profile is included in the JWT and used to determine the language.
3.  **`Accept-Language` Header:** For guest users, the `Accept-Language` header is used (e.g., `Accept-Language: ar`).
4.  **Default:** If none of the above are present, the default language is English (`en`).

### Adding New Translations

To add or modify translations, edit the JSON files in the `locales` directory. The directory is structured as follows:

```
locales/
├── en/
│   └── translation.json
├── fr/
│   └── translation.json
└── ar/
    └── translation.json
```

Each `translation.json` file contains key-value pairs for the translated strings.

## Technologies Used
-   **Node.js**
-   **i18next:** Internationalization framework.
-   **Express.js:** Web framework
-   **Sequelize:** ORM for PostgreSQL
-   **PostgreSQL:** Database
-   **JWT (jsonwebtoken):** For authentication
-   **Bcrypt.js:** For password hashing
-   **Joi:** For data validation
-   **Winston:** For logging
-   **Helmet:** For securing HTTP headers
-   **CORS:** For enabling Cross-Origin Resource Sharing
-   **Compression:** For GZIP compression
-   **Dotenv:** For environment variable management
-   **Nodemon:** For automatic server restarts during development
-   **Jest & Supertest:** For testing

## Folder Structure

```
.
├── .env                  # Environment variables
├── .sequelizerc          # Sequelize CLI configuration
├── index.js              # Application entry point
├── package.json          # Project metadata and dependencies
├── package-lock.json     # Dependency tree lock file
├── logs/                 # Application logs
├── node_modules/         # Node.js dependencies
└── src/                  # Source code
    ├── config/           # Application configurations (auth, database, tokens)
    ├── controllers/      # Request handlers for API routes
    ├── middlewares/      # Express middlewares (auth, error handling, rate limiting, validation)
    ├── migrations/       # Database schema migrations
    ├── models/           # Sequelize models defining database tables
    ├── routes/           # API route definitions
    ├── seeders/          # Database seed files for initial data
    ├── services/         # Business logic and database interactions
    ├── test/             # Unit and integration tests
    ├── utils/            # Utility functions (ApiError, catchAsync, JWT, logger, password hashing)
    └── validations/      # Joi schemas for request validation
```

## Getting Started

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd test-app
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Environment Variables

Create a `.env` file in the root directory based on `.env.example` (if available, otherwise create one with the following structure):

```
NODE_ENV=development
PORT=3000

# Database
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database_name

# JWT
JWT_SECRET=supersecretjwtkey
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=30
```

### Database Setup

1.  **Ensure PostgreSQL is running.**
2.  **Create the database:**
    ```bash
    # You might need to connect to your PostgreSQL server and create the database manually
    # e.g., psql -U your_username -c "CREATE DATABASE your_database_name;"
    ```
3.  **Run migrations:**
    ```bash
    npx sequelize db:migrate
    ```
4.  **Seed the database (optional):**
    ```bash
    npx sequelize db:seed:all
    ```

### Running the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The server will run on the port specified in your `.env` file (default: `3000`).

## API Endpoints

### Auth

*   **POST /api/auth/register**

    Registers a new user.

    **Request Body:**

    ```json
    {
      "name": "John Doe",
      "email": "john.doe@example.com",
      "password": "password123",
      "role": "client"
    }
    ```

    **Response:**

    ```json
    {
      "user": {
        "id": "...",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "role": "client",
        ...
      },
      "tokens": {
        "access": {
          "token": "...",
          "expires": "..."
        }
      }
    }
    ```

*   **POST /api/auth/login**

    Logs in a user.

    **Request Body:**

    ```json
    {
      "email": "john.doe@example.com",
      "password": "password123"
    }
    ```

    **Response:**

    ```json
    {
      "user": {
        "id": "...",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "role": "client",
        ...
      },
      "tokens": {
        "access": {
          "token": "...",
          "expires": "..."
        }
      }
    }
    ```

## Testing
To run tests:
```bash
npm test
```