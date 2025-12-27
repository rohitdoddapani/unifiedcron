# Database Connection Setup

If you're getting an error like `role "user" does not exist`, it means your `DATABASE_URL` environment variable is using a placeholder username that doesn't exist in your PostgreSQL database.

## Fix the DATABASE_URL

The `DATABASE_URL` format is:
```
postgres://[username]:[password]@[host]:[port]/[database]
```

### For Local Development

1. **Find your PostgreSQL username:**
   ```bash
   whoami
   # This shows your system username, which is likely your PostgreSQL username
   ```

2. **Update `.env.local` with your actual username:**
   ```bash
   # Replace "user" with your actual PostgreSQL username
   DATABASE_URL=postgres://your-username@localhost:5432/unifiedcron
   
   # If your PostgreSQL requires a password:
   DATABASE_URL=postgres://your-username:your-password@localhost:5432/unifiedcron
   ```

### Common PostgreSQL Usernames

- **macOS (Homebrew):** Usually your system username (run `whoami`)
- **Linux:** Usually `postgres` or your system username
- **Docker:** Usually `postgres`

### Test Your Connection

You can test if your connection string works:

```bash
# Replace with your actual connection string
psql "postgres://your-username@localhost:5432/unifiedcron"
```

If this connects successfully, your `DATABASE_URL` is correct.

### Create the Database User (if needed)

If you need to create a PostgreSQL user:

```bash
# Connect as the postgres superuser
psql postgres

# Create a new user (replace 'your-username' with your desired username)
CREATE USER your-username WITH PASSWORD 'your-password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE unifiedcron TO your-username;
```

### Reset Password (if needed)

If you forgot your PostgreSQL password:

```bash
# On macOS with Homebrew:
brew services stop postgresql
# Edit pg_hba.conf to allow trust connections temporarily
# Then:
psql postgres
ALTER USER your-username WITH PASSWORD 'new-password';
```

## Troubleshooting

### Error: `role "user" does not exist`
- **Solution:** Update `DATABASE_URL` in `.env.local` with your actual PostgreSQL username
- The placeholder `postgres://user:pass@localhost:5432/unifiedcron` needs to be replaced

### Error: `database "unifiedcron" does not exist`
- **Solution:** Create the database first:
  ```bash
  createdb unifiedcron
  ```

### Error: `password authentication failed`
- **Solution:** Check your password in `DATABASE_URL` or reset the PostgreSQL password

## Example `.env.local`

```bash
# Use your actual PostgreSQL username
DATABASE_URL=postgres://rohith@localhost:5432/unifiedcron

# Or with password:
DATABASE_URL=postgres://rohith:mypassword@localhost:5432/unifiedcron

# Or using postgres user:
DATABASE_URL=postgres://postgres:postgres@localhost:5432/unifiedcron
```

**Note:** Never commit `.env.local` to version control - it contains sensitive credentials!

