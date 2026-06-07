# Firebase Integration Guide

## Setup

1. **Environment Variables**: Copy `.env.example` to `.env` and fill in your Firebase credentials:

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

2. **Ensure `.env` is in `.gitignore`** (already configured)

## Usage

### Authentication

```javascript
import { useAuth } from './hooks/useAuth';

function MyComponent() {
  const { user, loading, signup, login, logout } = useAuth();

  const handleSignup = async () => {
    try {
      await signup('email@example.com', 'password');
    } catch (error) {
      console.error('Signup failed:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {user ? (
        <>
          <p>Welcome, {user.email}</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={handleSignup}>Sign Up</button>
      )}
    </div>
  );
}
```

### Realtime Database

```javascript
import { useFirebaseData } from './hooks/useFirebase';

function UsersList() {
  const { data: users, loading, error, writeData, updateData, deleteData } = 
    useFirebaseData('users');

  const handleAddUser = async () => {
    await writeData({ id: 1, name: 'John Doe' });
  };

  const handleUpdateUser = async () => {
    await updateData({ name: 'Jane Doe' });
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {users && <pre>{JSON.stringify(users, null, 2)}</pre>}
    </div>
  );
}
```

### Cloud Storage

```javascript
import { useFirebaseStorage } from './hooks/useFirebaseStorage';

function FileUpload() {
  const { uploadFile, deleteFile, loading } = useFirebaseStorage();

  const handleUpload = async (file) => {
    try {
      const url = await uploadFile('uploads/' + file.name, file);
      console.log('File uploaded:', url);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => handleUpload(e.target.files[0])}
        disabled={loading}
      />
    </div>
  );
}
```

## Security

⚠️ **IMPORTANT**: Never commit your `.env` file. It contains sensitive credentials.

1. Always regenerate Firebase keys if they are accidentally exposed
2. Use environment variables for all sensitive data
3. Enable Firebase Security Rules to protect your data
4. Never expose API keys in client-side code beyond what Firebase SDKs require

## Firebase Security Rules

Configure your Firebase rules in the Firebase Console:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```
